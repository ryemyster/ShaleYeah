import type {
	AgentManifest,
	AgentRuntimeConfig,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
} from "@shaleyeah/sdk";
import {
	ContextStore,
	callLLM,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callMarketTool } from "./market-client.js";

export { callMarketTool };

export const marketAnalystManifest: AgentManifest = {
	id: "market-analyst",
	role: "market-analyst",
	version: "0.1.0",
	description:
		"Mercatus Analyticus — standalone market analyst agent migrated from the market MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Mercatus Analyticus",
		role: "Master Market Intelligence Analyst",
		expertise: [
			"Commodity price analysis (WTI, Henry Hub)",
			"Competitive landscape assessment",
			"Market timing and trend identification",
			"Supply/demand fundamentals",
			"EIA data interpretation",
		],
	},
	capabilities: [
		"market-analysis",
		"competitive-intelligence",
		"commodity-pricing",
		"market-timing",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "market-analyst.analyze_market_conditions",
			description:
				"Analyze current market conditions including live WTI and Henry Hub prices, supply/demand fundamentals, and market outlook.",
			type: "query",
			capabilities: ["market-analysis", "commodity-pricing"],
			inputSchema: {
				type: "object",
				properties: {
					commodity: {
						type: "string",
						enum: ["oil", "gas", "both"],
						default: "both",
						description: "Commodity to analyze",
					},
					timeHorizon: {
						type: "string",
						enum: ["spot", "short-term", "medium-term", "long-term"],
						default: "short-term",
					},
					region: { type: "string", description: "Geographic focus (e.g. Permian, Eagle Ford)" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: [],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:market"],
			modelRequirement: "standard-analysis",
			evalProfile: "market-analyst-conditions",
			mcpServer: "market",
		},
		{
			name: "market-analyst.competitive_analysis",
			description:
				"Analyze the competitive landscape for an O&G asset — identify active operators, typical bid multiples, and acquisition activity.",
			type: "query",
			capabilities: ["competitive-intelligence", "market-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					basin: { type: "string", description: "Basin or play area (e.g. Permian, Haynesville)" },
					formation: { type: "string", description: "Target formation" },
					assetType: {
						type: "string",
						enum: ["acreage", "producing", "midstream", "royalty"],
						description: "Type of asset",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["basin"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:market"],
			modelRequirement: "standard-analysis",
			evalProfile: "market-analyst-competitive",
			mcpServer: "market",
		},
	],
	requiredScopes: ["read:market"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for market synthesis — commodity analysis and competitive assessments call the model.",
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
		namespace: "market-analyst",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "market-analyst-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const marketAnalystConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		deterministic: { provider: "rule-based", model: "no-model" },
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "market-analyst-standard",
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
		namespace: "market-analyst",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		market: {
			url: process.env.MARKET_MCP_URL ?? "http://localhost:3007",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function marketUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.market?.url ?? "http://localhost:3007";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"market-analyst.analyze_market_conditions": ({ args, config }) =>
		callMarketTool(marketUrl(config), "analyze_market_conditions", args as Record<string, unknown>),

	"market-analyst.competitive_analysis": ({ args, config }) =>
		callMarketTool(marketUrl(config), "competitive_analysis", args as Record<string, unknown>),
};

export function createMarketAnalystRuntime(config: AgentRuntimeConfig = marketAnalystConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: marketAnalystManifest,
		config,
		handlers,
	});
}

export function createMarketAnalystEndpoint(config: AgentRuntimeConfig = marketAnalystConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createMarketAnalystRuntime(config));
}

/**
 * Run a multi-step market analysis task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which market tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running market analyses.
 */
export async function runMarketAnalystTask(
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
	const config = options.config ?? marketAnalystConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createMarketAnalystRuntime(config);
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

// Retry budgets — Arcade pattern #40: Error Classification.
// Retryable errors (network transients, server restarts) get up to MAX_TOOL_RETRIES attempts
// with exponential backoff before the error is surfaced to the LLM as a recoverable hint.
const MAX_TOOL_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

async function executeWithRetry(
	runtime: LocalAgentRuntime,
	request: Parameters<typeof runtime.execute>[0],
): Promise<ReturnType<LocalAgentRuntime["execute"]>> {
	let last: Awaited<ReturnType<LocalAgentRuntime["execute"]>> | null = null;
	for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
		if (attempt > 0) {
			// Exponential backoff: 500ms, 1000ms, 2000ms
			await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
		}
		const result = await runtime.execute(request);
		if (result.status !== "failed" || !result.retryable) return result;
		last = result;
	}
	return last!;
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
		config?: AgentRuntimeConfig;
		apiKey?: string;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		callLLMFn?: (opts: LLMCallOptions) => Promise<string>;
	},
): Promise<string> {
	const config = options.config ?? marketAnalystConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const namespace = config.memory?.namespace ?? "market-analyst";
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[market-analyst] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runMarketAnalystTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = marketAnalystManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");
	const priorContextSection = priorContext ? `\nPrior context from previous runs:\n${priorContext}\n` : "";

	const system = `You are ${marketAnalystManifest.persona.name}, ${marketAnalystManifest.persona.role}.
${priorContextSection}

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "market-analyst.analyze_market_conditions").
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

		// TODO (#396): Async Job — detect long-running market analyses and poll for completion.

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
		// executeWithRetry transparently retries transient (retryable) failures before
		// surfacing the error to the LLM as a recoverable hint.
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
						"Provide an onApprovalRequired callback to runMarketAnalystTask, or set autonomy to 'autonomous'.",
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

// ── CLI entrypoint ────────────────────────────────────────────────────────────
// Run a market analysis task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Analyze WTI market outlook..."
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error(
			'  Example: npx tsx src/agent/index.ts "Analyze current WTI oil price and Permian Basin market outlook"',
		);
		process.exit(1);
	}
	const answer = await runMarketAnalystTask(goal, {
		onApprovalRequired: async (challenge) => {
			console.log(`\n⏸  Approval required for: ${challenge.toolName}`);
			console.log(`   Reason: ${challenge.reason ?? "tool requires human review"}`);
			console.log("   Auto-approving in CLI mode...\n");
			return { approved: true, reviewerId: "cli", reason: "CLI auto-approve" };
		},
	}).catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
	console.log(answer);
}
