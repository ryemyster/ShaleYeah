import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callQAServerTool } from "./qa-server-client.js";

export { callQAServerTool };

export const qaAssuranceManifest: AgentManifest = {
	id: "quality-assurance",
	role: "qa-analyst",
	version: "0.1.0",
	description:
		"Testius Validatus — standalone quality assurance agent migrated from the qa-server MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Testius Validatus",
		role: "Master Quality Engineer",
		expertise: [
			"Quality assurance and validation",
			"Testing methodology and automation",
			"Performance monitoring and analysis",
			"Compliance verification and auditing",
			"Continuous improvement processes",
		],
	},
	capabilities: [
		"qa-testing",
		"quality-reporting",
		"compliance-verification",
		"performance-monitoring",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "quality-assurance.run_quality_tests",
			description:
				"Execute comprehensive quality assurance tests across functional, performance, integration, and compliance dimensions.",
			type: "query",
			capabilities: ["qa-testing", "compliance-verification"],
			inputSchema: {
				type: "object",
				properties: {
					testSuite: {
						type: "string",
						enum: ["functional", "performance", "integration", "compliance", "all"],
						default: "all",
						description: "Test suite to run",
					},
					targets: {
						type: "array",
						items: { type: "string" },
						description: "Components or modules to test",
					},
					criteria: {
						type: "object",
						properties: {
							accuracy: { type: "number", minimum: 0, maximum: 1, default: 0.95 },
							performance: { type: "string", default: "standard" },
							compliance: { type: "array", items: { type: "string" }, default: [] },
						},
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["targets"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:qa"],
			modelRequirement: "standard-analysis",
			evalProfile: "qa-run-tests",
			mcpServer: "qa-server",
		},
		{
			name: "quality-assurance.generate_quality_report",
			description:
				"Generate a comprehensive quality assurance report covering accuracy, performance, and reliability metrics.",
			type: "query",
			capabilities: ["quality-reporting", "compliance-verification"],
			inputSchema: {
				type: "object",
				properties: {
					reportType: {
						type: "string",
						enum: ["summary", "detailed", "executive", "compliance"],
						default: "summary",
						description: "Report format",
					},
					period: { type: "string", default: "current", description: "Reporting period" },
					metrics: {
						type: "array",
						items: { type: "string" },
						default: ["accuracy", "performance", "reliability"],
						description: "Metrics to include",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: [],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:qa"],
			modelRequirement: "deterministic",
			evalProfile: "qa-generate-report",
			mcpServer: "qa-server",
		},
	],
	requiredScopes: ["read:qa"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for QA synthesis — test validation and compliance assessment call the model.",
		},
	],
	compatibility: {
		agentRuntime: "0.1",
		remoteEndpoint: "0.1",
		mcp: "2025-06",
	},
	health: {
		readinessChecks: ["manifest", "runtime-config", "tool-handlers", "model-routing"],
	},
	memory: {
		namespace: "quality-assurance",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "qa-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const qaAssuranceConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": {
			provider: "organization-small-model",
			model: "configured-by-operator",
		},
		"standard-analysis": {
			provider: "organization-standard-model",
			model: "configured-by-operator",
		},
		"deep-reasoning": {
			provider: "organization-deep-model",
			model: "configured-by-operator",
		},
		"local-private": {
			provider: "organization-local-model",
			model: "configured-by-operator",
		},
		deterministic: {
			provider: "rule-based",
			model: "no-model",
		},
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "qa-standard",
		checks: {
			schema: "blocking",
			domainCompleteness: "advisory",
			confidenceMinimum: 0.7,
			requireSources: false,
			redactSecrets: "blocking",
			memoryPromotion: "reviewed-only",
		},
	},
	memory: {
		enabled: true,
		namespace: "quality-assurance",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	// Tier 1 tool server — operator configures the actual URL at deployment time.
	mcpServers: {
		"qa-server": {
			url: "http://localhost:3004",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

// Each handler resolves the qa-server URL from the runtime config and delegates via MCP over HTTP.
// The server name "qa-server" matches AgentToolManifest.mcpServer and AgentRuntimeConfig.mcpServers key.
function qaServerUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.["qa-server"]?.url ?? "http://localhost:3004";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"quality-assurance.run_quality_tests": ({ args, config }) =>
		callQAServerTool(qaServerUrl(config), "run_quality_tests", args),

	"quality-assurance.generate_quality_report": ({ args, config }) =>
		callQAServerTool(qaServerUrl(config), "generate_quality_report", args),
};

export function createQAAssuranceRuntime(config: AgentRuntimeConfig = qaAssuranceConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: qaAssuranceManifest,
		config,
		handlers,
	});
}

export function createQAAssuranceEndpoint(config: AgentRuntimeConfig = qaAssuranceConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createQAAssuranceRuntime(config));
}

/**
 * Run a multi-step QA task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which qa-server tools to call,
 * executes them through the governed runtime (HITL + scope checks fire on every
 * tool call — Arcade pattern #46: Permission Gate), and returns a synthesized answer.
 *
 * options.runtime    — use an already-initialized runtime (e.g. in tests or when the
 *                      caller manages lifecycle). If omitted, one is created internally.
 * options.onApprovalRequired — called when the runtime returns approval_required.
 *                      If omitted and approval is required, the loop throws rather than
 *                      silently bypassing the HITL gate.
 *
 * Deferred (#395): Context Injection — read/write agent memory namespace around the loop.
 * Deferred (#396): Async Job — polling pattern for long-running QA test suites.
 */
export async function runQAAssuranceTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
	} = {},
): Promise<string> {
	const config = options.config ?? qaAssuranceConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createQAAssuranceRuntime(config);
		await runtime.initialize();
		ownedRuntime = true;
	}

	try {
		return await executeLoop(goal, runtime, options);
	} finally {
		if (ownedRuntime) await runtime.shutdown();
	}
}

function buildTranscript(history: Array<{ role: "user" | "assistant" | "tool"; content: string }>): string {
	return history
		.map((t) => {
			if (t.role === "user") return `User: ${t.content}`;
			if (t.role === "assistant") return `Assistant: ${t.content}`;
			return `Tool result: ${t.content}`;
		})
		.join("\n\n");
}

function parseJson(
	text: string,
): { action?: string; tool?: string; args?: Record<string, unknown>; answer?: string } | null {
	try {
		const cleaned = text
			.replace(/^```(?:json)?\s*/m, "")
			.replace(/\s*```\s*$/m, "")
			.trim();
		return JSON.parse(cleaned);
	} catch {
		return null;
	}
}

async function executeLoop(
	goal: string,
	runtime: LocalAgentRuntime,
	options: {
		apiKey?: string;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
	},
): Promise<string> {
	// TODO (#395): Context Injection — before building the system prompt, read from
	// memory.namespace = "quality-assurance" to surface relevant prior task context.

	const toolDefs = qaAssuranceManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${qaAssuranceManifest.persona.name}, ${qaAssuranceManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "quality-assurance.run_quality_tests").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.`;

	type Turn = { role: "user" | "assistant" | "tool"; content: string };
	const history: Turn[] = [{ role: "user", content: goal }];
	const MAX_STEPS = 8;

	for (let step = 0; step < MAX_STEPS; step++) {
		const response = await callLLM({
			system,
			prompt: `${buildTranscript(history)}\n\nAssistant:`,
			apiKey: options.apiKey,
		});

		history.push({ role: "assistant", content: response });

		const parsed = parseJson(response);
		if (!parsed || parsed.action === "done" || !parsed.tool) {
			return parsed?.answer ?? response;
		}

		// TODO (#396): Async Job — detect long-running test suites and poll for completion.

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
		const execResult = await runtime.execute({
			toolName: parsed.tool,
			args: parsed.args ?? {},
			runId: `task:step:${step}`,
		});

		if (execResult.status === "completed") {
			history.push({ role: "tool", content: JSON.stringify(execResult.data) });
		} else if (execResult.status === "approval_required") {
			if (!options.onApprovalRequired) {
				throw new Error(
					`Tool ${parsed.tool} requires human approval. ` +
						"Provide an onApprovalRequired callback to runQAAssuranceTask, or set autonomy to 'autonomous'.",
				);
			}
			const approval = await options.onApprovalRequired(execResult.challenge);
			const approved = await runtime.execute({
				toolName: parsed.tool,
				args: parsed.args ?? {},
				approval,
				runId: `task:step:${step}:approved`,
			});
			if (approved.status === "completed") {
				history.push({ role: "tool", content: JSON.stringify(approved.data) });
			} else {
				const err = approved.status === "failed" ? approved.error : "approval re-execution failed";
				history.push({ role: "tool", content: `Error after approval for ${parsed.tool}: ${err}` });
			}
		} else {
			const hint = execResult.retryable ? " (retryable — server may be temporarily unavailable)" : " (permanent)";
			history.push({ role: "tool", content: `Error calling ${parsed.tool}: ${execResult.error}${hint}` });
		}
	}

	// TODO (#395): Context Injection — write key findings to memory.namespace before returning.

	const finalResponse = await callLLM({
		system,
		prompt: `${buildTranscript(history)}\n\nUser: Maximum steps reached. Synthesize findings now.\n\nAssistant:`,
		apiKey: options.apiKey,
	});

	return parseJson(finalResponse)?.answer ?? finalResponse;
}
