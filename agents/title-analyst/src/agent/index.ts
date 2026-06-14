import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import {
	ContextStore,
	callLLM,
	type LLMCallOptions,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callTitleTool } from "./title-client.js";

export { callTitleTool };

export const titleAnalystManifest: AgentManifest = {
	id: "title-analyst",
	role: "title-analyst",
	version: "0.1.0",
	description:
		"Titulus Verificatus — standalone title analyst agent that examines O&G property ownership, lease terms, encumbrances, and chain of title via the title MCP server.",
	persona: {
		name: "Titulus Verificatus",
		role: "Master Title Analyst",
		expertise: [
			"Title examination and verification",
			"Working interest (WI) and net revenue interest (NRI) analysis",
			"Lease term parsing and expiry risk assessment",
			"Encumbrance and burden identification (ORRI, production payments, liens)",
			"Chain of title validation and curative requirements",
		],
	},
	capabilities: ["ownership-analysis", "lease-analysis", "burden-check", "chain-of-title", "model-routing", "evals"],
	tools: [
		{
			name: "title-analyst.examine_ownership",
			description: "Analyze working interest (WI) and net revenue interest (NRI) for an O&G property.",
			type: "query",
			capabilities: ["ownership-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					propertyDescription: {
						type: "string",
						description: "Legal description of the property",
					},
					county: { type: "string" },
					state: { type: "string" },
					outputPath: {
						type: "string",
						description: "Optional path to write JSON output",
					},
				},
				required: ["propertyDescription", "county", "state"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:title"],
			modelRequirement: "standard-analysis",
			evalProfile: "title-analyst-ownership",
			mcpServer: "title",
		},
		{
			name: "title-analyst.analyze_lease",
			description: "Parse lease terms and assess expiry risk, depth severance, and acreage limitations.",
			type: "query",
			capabilities: ["lease-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					primaryTerm: {
						type: "string",
						description: "Lease primary term, e.g. '3 years' or '36 months'",
					},
					county: { type: "string" },
					state: { type: "string" },
					examPeriod: { type: "string", default: "20 years" },
					outputPath: {
						type: "string",
						description: "Optional path to write JSON output",
					},
				},
				required: ["primaryTerm", "county", "state"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:title"],
			modelRequirement: "standard-analysis",
			evalProfile: "title-analyst-lease",
			mcpServer: "title",
		},
		{
			name: "title-analyst.check_burdens",
			description: "Identify ORRI, production payments, liens, and other encumbrances on an O&G property.",
			type: "query",
			capabilities: ["burden-check"],
			inputSchema: {
				type: "object",
				properties: {
					propertyDescription: {
						type: "string",
						description: "Legal description of the property",
					},
					county: { type: "string" },
					state: { type: "string" },
					outputPath: {
						type: "string",
						description: "Optional path to write JSON output",
					},
				},
				required: ["propertyDescription", "county", "state"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:title"],
			modelRequirement: "standard-analysis",
			evalProfile: "title-analyst-burdens",
			mcpServer: "title",
		},
		{
			name: "title-analyst.trace_chain_of_title",
			description: "Validate conveyance chain, identify gaps, and list curative requirements.",
			type: "query",
			capabilities: ["chain-of-title"],
			inputSchema: {
				type: "object",
				properties: {
					propertyDescription: {
						type: "string",
						description: "Legal description of the property",
					},
					county: { type: "string" },
					state: { type: "string" },
					examPeriod: { type: "string", default: "20 years" },
					outputPath: {
						type: "string",
						description: "Optional path to write JSON output",
					},
				},
				required: ["propertyDescription", "county", "state"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:title"],
			modelRequirement: "standard-analysis",
			evalProfile: "title-analyst-chain",
			mcpServer: "title",
		},
	],
	requiredScopes: ["read:title"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description: "Anthropic Claude — standard analysis for title synthesis across ownership, lease, and chain tools.",
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
		namespace: "title-analyst",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "title-analyst-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "assistive",
		allowedLevels: ["assistive", "reviewed"],
	},
};

export const titleAnalystConfig: AgentRuntimeConfig = {
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
		profile: "title-analyst-default",
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
		namespace: "title-analyst",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: { requireHumanReview: true, allowSharedMemory: false },
	},
	mcpServers: {
		title: {
			url: process.env.TITLE_MCP_URL ?? "http://localhost:3010",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function titleUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.title?.url ?? "http://localhost:3010";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"title-analyst.examine_ownership": ({ args, config }) =>
		callTitleTool(titleUrl(config), "examine_ownership", args as Record<string, unknown>),

	"title-analyst.analyze_lease": ({ args, config }) =>
		callTitleTool(titleUrl(config), "analyze_lease", args as Record<string, unknown>),

	"title-analyst.check_burdens": ({ args, config }) =>
		callTitleTool(titleUrl(config), "check_burdens", args as Record<string, unknown>),

	"title-analyst.trace_chain_of_title": ({ args, config }) =>
		callTitleTool(titleUrl(config), "trace_chain_of_title", args as Record<string, unknown>),
};

export function createTitleAnalystRuntime(config: AgentRuntimeConfig = titleAnalystConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: titleAnalystManifest,
		config,
		handlers,
	});
}

export function createTitleAnalystEndpoint(config: AgentRuntimeConfig = titleAnalystConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createTitleAnalystRuntime(config));
}

/**
 * Run a multi-step title analysis task driven by the LLM (Layer 2 execution loop).
 *
 * All tool calls route through LocalAgentRuntime.execute() — HITL gate, scope
 * checks, and audit logging fire on every step (Arcade #46: Permission Gate).
 *
 * options.runtime            — caller-managed runtime (e.g. in tests)
 * options.onApprovalRequired — HITL callback; throws if omitted and approval is required
 *
 * Deferred (#395): Context Injection — read/write memory namespace around the loop.
 * Deferred (#396): Async Job — polling for long-running tools.
 */
export async function runTitleAnalystTask(
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
	const config = options.config ?? titleAnalystConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createTitleAnalystRuntime(config);
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
	const config = options.config ?? titleAnalystConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const namespace = config.memory?.namespace ?? "title-analyst";
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[title-analyst] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runTitleAnalystTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = titleAnalystManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");
	const priorContextSection = priorContext ? `\nPrior context from previous runs:\n${priorContext}\n` : "";

	const system = `You are ${titleAnalystManifest.persona.name}, ${titleAnalystManifest.persona.role}.
${priorContextSection}

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "title-analyst.examine_ownership").
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

		// TODO (#396): Async Job — detect asyncJob tools and poll instead of blocking.

		// Permission Gate: all tool calls go through executeWithRetry → runtime.execute() — never call
		// callTitleTool directly from the loop.
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
						"Provide an onApprovalRequired callback to runTitleAnalystTask, or set autonomy to 'autonomous'.",
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

	// Context Injection (#395): write synthesized findings so subsequent runs can surface them.

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
