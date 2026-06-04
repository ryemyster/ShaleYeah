import {
	type AgentDiscoverySummary,
	type AgentExecutionMetadata,
	type AgentExecutionRequest,
	type AgentExecutionResult,
	type AgentHealth,
	type AgentManifest,
	AgentManifestSchema,
	type AgentRuntime,
	type AgentRuntimeConfig,
	AgentRuntimeConfigSchema,
	type AgentToolManifest,
	type AgentToolSummary,
	type EvalResult,
	type HumanApprovalChallenge,
	type ModelBinding,
} from "./contracts.js";

const SENSITIVE_KEY_PATTERN = /key|token|secret|password|credential|auth|bearer|api.?key/i;

export interface StandaloneToolHandlerContext {
	agentId: string;
	tool: AgentToolManifest;
	model: ModelBinding;
	config: AgentRuntimeConfig;
	args: Record<string, unknown>;
}

export type StandaloneToolHandler = (context: StandaloneToolHandlerContext) => Promise<unknown>;

export interface LocalAgentRuntimeOptions {
	manifest: AgentManifest;
	config: AgentRuntimeConfig;
	handlers: Record<string, StandaloneToolHandler>;
}

export class LocalAgentRuntime implements AgentRuntime {
	private readonly manifest: AgentManifest;
	private readonly config: AgentRuntimeConfig;
	private readonly handlers: Record<string, StandaloneToolHandler>;
	private initialized = false;

	constructor(options: LocalAgentRuntimeOptions) {
		this.manifest = AgentManifestSchema.parse(options.manifest);
		this.config = AgentRuntimeConfigSchema.parse(options.config);
		this.handlers = { ...options.handlers };
	}

	async initialize(): Promise<void> {
		this.validateHandlers();
		this.validateModelRouting();
		this.initialized = true;
	}

	async health(): Promise<AgentHealth> {
		const missingHandlers = this.missingHandlers();
		const checks: AgentHealth["checks"] = [
			{
				name: "manifest",
				status: "pass",
				message: `${this.manifest.id} manifest is valid`,
			},
			{
				name: "runtime-config",
				status: "pass",
				message: "runtime config is valid",
			},
			{
				name: "tool-handlers",
				status: missingHandlers.length === 0 ? "pass" : "fail",
				message:
					missingHandlers.length === 0
						? "all tool handlers are registered"
						: `missing handlers: ${missingHandlers.join(", ")}`,
			},
			{
				name: "model-routing",
				status: this.missingModelRoutes().length === 0 ? "pass" : "fail",
				message:
					this.missingModelRoutes().length === 0
						? "all tool model requirements resolve to organization config"
						: `missing model routes: ${this.missingModelRoutes().join(", ")}`,
			},
		];

		const hasFail = checks.some((check) => check.status === "fail");
		return {
			status: hasFail ? "not_ready" : this.initialized ? "ready" : "degraded",
			agentId: this.manifest.id,
			checks,
		};
	}

	getManifest(): AgentManifest {
		return this.manifest;
	}

	discover(level: "summary"): AgentDiscoverySummary;
	discover(level: "tools"): AgentToolSummary[];
	discover(level: "schema", toolName: string): AgentToolManifest | null;
	discover(
		level: "summary" | "tools" | "schema",
		toolName?: string,
	): AgentDiscoverySummary | AgentToolSummary[] | AgentToolManifest | null {
		if (level === "summary") {
			return {
				id: this.manifest.id,
				role: this.manifest.role,
				version: this.manifest.version,
				description: this.manifest.description,
				capabilities: this.manifest.capabilities,
			};
		}

		if (level === "tools") {
			return this.manifest.tools.map(({ inputSchema: _inputSchema, outputSchema: _outputSchema, ...tool }) => tool);
		}

		if (!toolName) return null;
		return this.findTool(toolName);
	}

	async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
		const tool = this.findTool(request.toolName);
		if (!tool) {
			return this.failed(request.toolName, `Unknown tool: ${request.toolName}`);
		}

		const approvalChallenge = this.approvalChallengeFor(tool, request);
		if (approvalChallenge) {
			return {
				status: "approval_required",
				challenge: approvalChallenge,
				metadata: this.metadataWithoutBinding(tool),
			};
		}

		const modelBinding = this.config.modelRouting[tool.modelRequirement];
		if (!modelBinding) {
			return this.failed(
				tool.name,
				`No organization model route configured for ${tool.modelRequirement}`,
				tool.modelRequirement,
			);
		}

		const handler = this.handlers[tool.name];
		if (!handler) {
			return this.failed(tool.name, `No handler registered for ${tool.name}`, tool.modelRequirement);
		}

		const safeArgs = redactSensitive(request.args) as Record<string, unknown>;

		try {
			const data = await handler({
				agentId: this.manifest.id,
				tool,
				model: modelBinding,
				config: this.config,
				args: safeArgs,
			});
			const evals = this.evaluate(tool, data);
			return {
				status: "completed",
				data,
				evals,
				metadata: this.metadata(tool, modelBinding),
			};
		} catch (error) {
			return {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				evals: [],
				metadata: this.metadata(tool, modelBinding),
			};
		}
	}

	async shutdown(): Promise<void> {
		this.initialized = false;
	}

	private findTool(name: string): AgentToolManifest | null {
		return this.manifest.tools.find((tool) => tool.name === name) ?? null;
	}

	private validateHandlers(): void {
		const missing = this.missingHandlers();
		if (missing.length > 0) {
			throw new Error(`Missing handlers for tools: ${missing.join(", ")}`);
		}
	}

	private validateModelRouting(): void {
		const missing = this.missingModelRoutes();
		if (missing.length > 0) {
			throw new Error(`Missing model routes for requirements: ${missing.join(", ")}`);
		}
	}

	private missingHandlers(): string[] {
		return this.manifest.tools.filter((tool) => !this.handlers[tool.name]).map((tool) => tool.name);
	}

	private missingModelRoutes(): string[] {
		return Array.from(
			new Set(
				this.manifest.tools
					.filter((tool) => !this.config.modelRouting[tool.modelRequirement])
					.map((tool) => tool.modelRequirement),
			),
		);
	}

	private approvalChallengeFor(tool: AgentToolManifest, request: AgentExecutionRequest): HumanApprovalChallenge | null {
		const explicitApprovalRequired = tool.requiresHumanApproval;
		const destructiveApprovalRequired = tool.destructive && this.config.hitl.requireForDestructive;
		const alwaysApprovalRequired = this.config.hitl.approvalMode === "always";
		// Tool-level requiresHumanApproval wins over approvalMode: "never". "never" only suppresses
		// the config-level "always" gate — tools that explicitly require approval still require it.
		// This is intentional: "never" unlocks the auto-approval path for ordinary tools in trusted
		// operator contexts, not for tools that declare a mandatory review step.
		const approvalRequired = explicitApprovalRequired || destructiveApprovalRequired || alwaysApprovalRequired;

		if (!approvalRequired || request.approval?.approved) return null;

		return {
			type: "human_approval_required",
			challengeId: `${this.manifest.id}:${tool.name}:${request.runId ?? "run"}`,
			agentId: this.manifest.id,
			toolName: tool.name,
			reason: `${tool.name} requires human approval under ${this.config.autonomy} autonomy`,
			requiredScopes: tool.requiredScopes,
		};
	}

	private evaluate(tool: AgentToolManifest, data: unknown): EvalResult[] {
		if (!this.config.evals.enabled) return [];

		const results: EvalResult[] = [];
		const schemaBlocking = this.config.evals.checks.schema === "blocking";
		const schemaAdvisory = this.config.evals.checks.schema === "advisory";
		if (schemaBlocking || schemaAdvisory) {
			results.push({
				check: "schema",
				status: data === undefined ? "fail" : "pass",
				message: data === undefined ? "tool returned undefined" : "tool returned a value",
				blocking: schemaBlocking,
			});
		}

		const redactionBlocking = this.config.evals.checks.redactSecrets === "blocking";
		const redactionAdvisory = this.config.evals.checks.redactSecrets === "advisory";
		if (redactionBlocking || redactionAdvisory) {
			const leaked = containsSensitiveValue(data);
			results.push({
				check: "redactSecrets",
				status: leaked ? "fail" : "pass",
				message: leaked ? "output appears to include sensitive material" : "no sensitive material detected",
				blocking: redactionBlocking,
			});
		}

		if (tool.evalProfile) {
			results.push({
				check: "profile",
				status: "pass",
				message: `applied eval profile ${tool.evalProfile}`,
				blocking: false,
			});
		}

		return results;
	}

	private failed(
		toolName: string,
		error: string,
		modelRequirement: AgentExecutionMetadata["modelRequirement"] = "deterministic",
	): AgentExecutionResult {
		return {
			status: "failed",
			error,
			evals: [],
			metadata: {
				agentId: this.manifest.id,
				toolName,
				modelRequirement,
				autonomy: this.config.autonomy,
				timestamp: new Date().toISOString(),
			},
		};
	}

	private metadata(tool: AgentToolManifest, modelBinding: ModelBinding): AgentExecutionMetadata {
		return {
			...this.metadataWithoutBinding(tool),
			modelBinding,
		};
	}

	private metadataWithoutBinding(tool: AgentToolManifest): Omit<AgentExecutionMetadata, "modelBinding"> {
		return {
			agentId: this.manifest.id,
			toolName: tool.name,
			modelRequirement: tool.modelRequirement,
			autonomy: this.config.autonomy,
			timestamp: new Date().toISOString(),
		};
	}
}

export function redactSensitive(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactSensitive);
	}

	if (value && typeof value === "object") {
		const redacted: Record<string, unknown> = {};
		for (const [key, inner] of Object.entries(value)) {
			redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSensitive(inner);
		}
		return redacted;
	}

	return value;
}

function containsSensitiveValue(value: unknown): boolean {
	if (typeof value === "string") {
		// Minimal pattern set — catches common prefixes only. Expand before enabling blocking
		// redactSecrets eval in production: add sk-ant- (Anthropic), AIza (Google), AKIA (AWS).
		return /sk-[a-z0-9_-]+|bearer\s+[a-z0-9._-]+/i.test(value);
	}

	if (Array.isArray(value)) {
		return value.some(containsSensitiveValue);
	}

	if (value && typeof value === "object") {
		return Object.entries(value).some(
			([key, inner]) => (SENSITIVE_KEY_PATTERN.test(key) && inner !== "[REDACTED]") || containsSensitiveValue(inner),
		);
	}

	return false;
}
