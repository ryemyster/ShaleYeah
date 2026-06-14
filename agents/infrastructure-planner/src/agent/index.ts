import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import {
	ContextStore,
	callLLM,
	type LLMCallOptions,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callInfrastructureTool } from "./infrastructure-client.js";

export { callInfrastructureTool };

// ── Manifest ──────────────────────────────────────────────────────────────────

export const infrastructurePlannerManifest: AgentManifest = {
	id: "infrastructure-planner",
	role: "infrastructure-planning",
	version: "0.1.0",
	description:
		"Plans gathering pipelines, surface facilities, capital costs, and permitting for O&G development projects",
	persona: {
		name: "Structura Ingenious",
		role: "Master Infrastructure Architect",
		expertise: [
			"Pipeline and gathering system design",
			"Surface facility sizing and layout",
			"Infrastructure CAPEX estimation",
			"Permitting and regulatory compliance",
			"Midstream takeaway capacity planning",
		],
	},
	capabilities: ["pipeline-planning", "facility-sizing", "cost-estimation", "compliance-assessment"],
	tools: [
		{
			name: "infrastructure-planner.plan_pipeline",
			description: "Plan gathering and transmission pipeline infrastructure — routing, capacity, and takeaway risk",
			type: "query",
			capabilities: ["pipeline-planning"],
			inputSchema: {
				type: "object",
				properties: {
					wellCount: {
						type: "number",
						description: "Number of wells to connect",
					},
					expectedProduction: {
						type: "number",
						description: "Expected total production in BOPD",
					},
					location: {
						type: "string",
						description: "Project location (state, basin, or county)",
					},
				},
				required: ["wellCount", "expectedProduction", "location"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-pipeline",
			mcpServer: "infrastructure",
		},
		{
			name: "infrastructure-planner.size_facilities",
			description: "Size surface facilities — batteries, separators, compressors, and salt water disposal wells",
			type: "query",
			capabilities: ["facility-sizing"],
			inputSchema: {
				type: "object",
				properties: {
					wellCount: { type: "number", description: "Number of wells" },
					expectedProduction: {
						type: "number",
						description: "Expected total production in BOPD",
					},
					location: { type: "string", description: "Project location" },
				},
				required: ["wellCount", "expectedProduction", "location"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-facilities",
			mcpServer: "infrastructure",
		},
		{
			name: "infrastructure-planner.estimate_costs",
			description: "Estimate infrastructure CAPEX — pipelines, facilities, compression, and SWD wells",
			type: "query",
			capabilities: ["cost-estimation"],
			inputSchema: {
				type: "object",
				properties: {
					wellCount: { type: "number", description: "Number of wells" },
					compressors: {
						type: "number",
						description: "Number of compressor units required",
					},
					swdWells: {
						type: "number",
						description: "Number of salt water disposal wells required",
					},
					location: { type: "string", description: "Project location" },
				},
				required: ["wellCount", "compressors", "swdWells", "location"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-costs",
			mcpServer: "infrastructure",
		},
		{
			name: "infrastructure-planner.assess_compliance",
			description:
				"Assess permitting and regulatory compliance requirements — permits, timeline, and environmental risks",
			type: "query",
			capabilities: ["compliance-assessment"],
			inputSchema: {
				type: "object",
				properties: {
					wellCount: { type: "number", description: "Number of wells" },
					location: {
						type: "string",
						description: "Project location (state, basin, or county)",
					},
					environmentalConstraints: {
						type: "array",
						items: { type: "string" },
						description: "Known environmental constraints or sensitivities",
					},
				},
				required: ["wellCount", "location"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-compliance",
			mcpServer: "infrastructure",
		},
	],
	requiredScopes: ["read:infrastructure"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description: "Anthropic Claude — standard analysis",
		},
	],
	compatibility: {
		agentRuntime: "^0.1.0",
		remoteEndpoint: "^0.1.0",
		mcp: "2025-03",
	},
	health: {
		readinessChecks: ["manifest", "runtime-config", "tool-handlers", "model-routing"],
	},
	memory: {
		namespace: "infrastructure-planner",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "infrastructure-planner-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "assistive",
		allowedLevels: ["assistive", "reviewed"],
	},
};

// ── Runtime config ────────────────────────────────────────────────────────────

export const infrastructurePlannerConfig: AgentRuntimeConfig = {
	autonomy: "assistive",
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": {
			provider: "anthropic",
			model: "claude-haiku-4-5-20251001",
		},
		deterministic: {
			provider: "anthropic",
			model: "claude-haiku-4-5-20251001",
		},
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "infrastructure-planner-default",
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
		namespace: "infrastructure-planner",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: { requireHumanReview: true, allowSharedMemory: false },
	},
	mcpServers: {
		infrastructure: {
			url: process.env.INFRASTRUCTURE_MCP_URL ?? "http://localhost:3012",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

// ── URL helper ────────────────────────────────────────────────────────────────

function infrastructureUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.infrastructure?.url ?? "http://localhost:3012";
}

// ── Handler map ───────────────────────────────────────────────────────────────

const handlers: Record<string, StandaloneToolHandler> = {
	"infrastructure-planner.plan_pipeline": ({ args, config }) =>
		callInfrastructureTool(infrastructureUrl(config), "plan_pipeline", args as Record<string, unknown>),
	"infrastructure-planner.size_facilities": ({ args, config }) =>
		callInfrastructureTool(infrastructureUrl(config), "size_facilities", args as Record<string, unknown>),
	"infrastructure-planner.estimate_costs": ({ args, config }) =>
		callInfrastructureTool(infrastructureUrl(config), "estimate_costs", args as Record<string, unknown>),
	"infrastructure-planner.assess_compliance": ({ args, config }) =>
		callInfrastructureTool(infrastructureUrl(config), "assess_compliance", args as Record<string, unknown>),
};

// ── Runtime + Endpoint factories ──────────────────────────────────────────────

export function createInfrastructurePlannerRuntime(
	config: AgentRuntimeConfig = infrastructurePlannerConfig,
): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: infrastructurePlannerManifest,
		config,
		handlers,
	});
}

export function createInfrastructurePlannerEndpoint(
	config: AgentRuntimeConfig = infrastructurePlannerConfig,
): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createInfrastructurePlannerRuntime(config));
}

// ── Task execution loop (Layer 2) ─────────────────────────────────────────────

/**
 * Run a multi-step infrastructure planning task driven by the LLM.
 *
 * All tool calls route through LocalAgentRuntime.execute() — HITL gate, scope
 * checks, and audit logging fire on every step (Arcade #46: Permission Gate).
 *
 * Deferred (#395): Context Injection — read/write memory namespace around the loop.
 * Deferred (#396): Async Job — polling for long-running tools.
 */
export async function runInfrastructurePlannerTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		/** Inject a custom LLM function — used in tests to capture model routing without real API calls. */
		callLLM?: (opts: LLMCallOptions) => Promise<string>;
	} = {},
): Promise<string> {
	const config = options.config ?? infrastructurePlannerConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createInfrastructurePlannerRuntime(config);
		await runtime.initialize();
		ownedRuntime = true;
	}

	try {
		return await executeLoop(goal, runtime, { ...options, config, callLLMFn: options.callLLM ?? callLLM });
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

function parseJson(text: string): {
	action?: string;
	tool?: string;
	args?: Record<string, unknown>;
	answer?: string;
} | null {
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

// Retry budgets — Arcade pattern #40: Error Classification.
const MAX_TOOL_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

async function executeWithRetry(
	runtime: LocalAgentRuntime,
	request: Parameters<typeof runtime.execute>[0],
): Promise<ReturnType<LocalAgentRuntime["execute"]>> {
	let last: Awaited<ReturnType<LocalAgentRuntime["execute"]>> | null = null;
	for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
		}
		const result = await runtime.execute(request);
		if (result.status !== "failed" || !result.retryable) return result;
		last = result;
	}
	return last!;
}

async function executeLoop(
	goal: string,
	runtime: LocalAgentRuntime,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		callLLMFn?: (opts: LLMCallOptions) => Promise<string>;
	},
): Promise<string> {
	const config = options.config ?? infrastructurePlannerConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const namespace = config.memory?.namespace ?? "infrastructure-planner";
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[infrastructure-planner] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runInfrastructurePlannerTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = infrastructurePlannerManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");
	const priorContextSection = priorContext ? `\nPrior context from previous runs:\n${priorContext}\n` : "";

	const system = `You are ${infrastructurePlannerManifest.persona.name}, ${infrastructurePlannerManifest.persona.role}.
${priorContextSection}

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "infrastructure-planner.plan_pipeline").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.`;

	type Turn = { role: "user" | "assistant" | "tool"; content: string };
	const history: Turn[] = [{ role: "user", content: goal }];
	const MAX_STEPS = 8;

	for (let step = 0; step < MAX_STEPS; step++) {
		const response = await callLLMFn({
			system,
			prompt: `${buildTranscript(history)}\n\nAssistant:`,
			model: reasoningModel,
			apiKey: options.apiKey,
		});

		history.push({ role: "assistant", content: response });

		const parsed = parseJson(response);
		if (!parsed || parsed.action === "done" || !parsed.tool) {
			const result = parsed?.answer ?? response;
			ContextStore.write(namespace, result);
			return result;
		}

		const execResult = await executeWithRetry(runtime, {
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
						"Provide an onApprovalRequired callback to runInfrastructurePlannerTask, or set autonomy to 'autonomous'.",
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
				history.push({
					role: "tool",
					content: `Error after approval for ${parsed.tool}: ${err}`,
				});
			}
		} else {
			// Permanent failure (blocking eval, scope rejection, unretryable error) — safety gate,
			// do not continue the loop. The LLM cannot recover from a security or governance halt.
			if (!execResult.retryable) {
				return execResult.error ?? `Permanent failure calling ${parsed.tool}`;
			}
			// Transient failure — push to history so the LLM can reformulate and retry.
			history.push({
				role: "tool",
				content: `Error calling ${parsed.tool}: ${execResult.error} (retryable — server may be temporarily unavailable)`,
			});
		}
	}

	const finalResponse = await callLLMFn({
		system,
		prompt: `${buildTranscript(history)}\n\nUser: Maximum steps reached. Synthesize findings now.\n\nAssistant:`,
		model: reasoningModel,
		apiKey: options.apiKey,
	});

	const finalResult = parseJson(finalResponse)?.answer ?? finalResponse;
	ContextStore.write(namespace, finalResult);
	return finalResult;
}
