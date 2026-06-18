import type {
	AgentManifest,
	AgentRuntimeConfig,
	AsyncJobPoller,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
	SessionIdentity,
} from "@shaleyeah/sdk";
import {
	ASYNC_POLL_INTERVAL_MS,
	ASYNC_THRESHOLD_MS,
	CompensationRegistry,
	ContextStore,
	callLLM,
	defaultAsyncJobPoller,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callResearchTool } from "./research-client.js";

export { callResearchTool };

export const researchAnalystManifest: AgentManifest = {
	id: "research-analyst",
	role: "market-intelligence-analyst",
	version: "0.1.0",
	description:
		"Scientius Researchicus — standalone research analyst agent that gathers market intelligence and competitive data via the research MCP server.",
	persona: {
		name: "Scientius Researchicus",
		role: "Master Intelligence Gatherer",
		expertise: [
			"Web research and data collection",
			"Competitive intelligence analysis",
			"Market trend identification",
			"Technology scouting and assessment",
			"Industry report synthesis",
		],
	},
	capabilities: ["market-research", "competitive-analysis", "model-routing", "evals"],
	tools: [
		{
			name: "research-analyst.conduct_market_research",
			description: "Conduct comprehensive market research on oil & gas topics.",
			type: "query",
			capabilities: ["market-research"],
			inputSchema: {
				type: "object",
				properties: {
					topic: { type: "string", description: "Research topic or question" },
					scope: {
						type: "string",
						enum: ["local", "regional", "national", "global"],
						default: "regional",
					},
					timeframe: {
						type: "string",
						enum: ["current", "historical", "forecast"],
						default: "current",
					},
					sources: {
						type: "array",
						items: { type: "string" },
						description: "Preferred data sources",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["topic"],
				provides: ["market-research"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:research"],
			modelRequirement: "standard-analysis",
			evalProfile: "research-analyst-market",
			mcpServer: "research",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
		{
			name: "research-analyst.analyze_competition",
			description: "Analyze competitive landscape and operator activities in an oil & gas region.",
			type: "query",
			capabilities: ["competitive-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					region: { type: "string", description: "Geographic region of interest" },
					competitors: {
						type: "array",
						items: { type: "string" },
						description: "Specific competitors to analyze",
					},
					analysisType: {
						type: "string",
						enum: ["activities", "strategy", "performance", "comprehensive"],
						default: "comprehensive",
					},
					timeframe: { type: "string", default: "last 12 months" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["region"],
				dependsOn: ["research-analyst.conduct_market_research"],
				provides: ["competition-analysis"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:research"],
			modelRequirement: "standard-analysis",
			evalProfile: "research-analyst-competition",
			mcpServer: "research",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
	],
	requiredScopes: ["read:research"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for intelligence synthesis — market research and competitive analysis call the model.",
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
		namespace: "research-analyst",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "research-analyst-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "assistive",
		allowedLevels: ["assistive", "reviewed"],
	},
};

export const researchAnalystConfig: AgentRuntimeConfig = {
	autonomy: "assistive",
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
		profile: "research-analyst-default",
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
		namespace: "research-analyst",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		research: {
			url: process.env.RESEARCH_MCP_URL ?? "http://localhost:3008",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function researchUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.research?.url ?? "http://localhost:3008";
}

// Each handler resolves the research URL from runtime config and delegates via MCP over HTTP.
// The server tool name is the agent tool name without the "research-analyst." prefix.
const handlers: Record<string, StandaloneToolHandler> = {
	"research-analyst.conduct_market_research": ({ args, config }) =>
		callResearchTool(researchUrl(config), "conduct_market_research", args as Record<string, unknown>),

	"research-analyst.analyze_competition": ({ args, config }) =>
		callResearchTool(researchUrl(config), "analyze_competition", args as Record<string, unknown>),
};

export function createResearchAnalystRuntime(config: AgentRuntimeConfig = researchAnalystConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: researchAnalystManifest,
		config,
		handlers,
	});
}

export function createResearchAnalystEndpoint(config: AgentRuntimeConfig = researchAnalystConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createResearchAnalystRuntime(config));
}

/**
 * Run a multi-step market intelligence task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which research tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running research tasks.
 */
export async function runResearchAnalystTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
		/** Inject a custom LLM function — used in tests to capture model routing without real API calls. */
		callLLM?: (opts: LLMCallOptions) => Promise<string>;
	} = {},
): Promise<string> {
	const config = options.config ?? researchAnalystConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createResearchAnalystRuntime(config);
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
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
		identity?: SessionIdentity;
	},
): Promise<string> {
	const config = options.config ?? researchAnalystConfig;
	const manifest = runtime.getManifest();
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const baseNamespace = config.memory?.namespace ?? "research-analyst";
	const namespace = options.identity?.userId ? `${options.identity.userId}:${baseNamespace}` : baseNamespace;
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[research-analyst] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runResearchAnalystTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = manifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");
	const depHints = manifest.tools
		.filter((t) => t.dependsOn?.length || t.provides?.length)
		.map((t) => {
			const depPart = t.dependsOn?.length ? ` → depends on: [${t.dependsOn.join(", ")}]` : "";
			const provPart = t.provides?.length ? ` → provides: [${t.provides.join(", ")}]` : "";
			return `  ${t.name}${depPart}${provPart}`;
		})
		.join("\n");
	const depSection = depHints ? `\nTool ordering constraints (call dependencies first):\n${depHints}` : "";
	const toolChainsSection = manifest.toolChains?.length
		? `\nRecommended workflows (use these step sequences when they match the goal):\n${manifest.toolChains.map((c) => `  ${c.id}: ${c.steps.join(" → ")}${c.trigger ? `\n  Use when: ${c.trigger}` : ""}`).join("\n")}`
		: "";

	const perfHints = manifest.tools
		.filter((t) => t.complexity || t.estimatedLatencyMs)
		.map((t) => {
			const parts: string[] = [];
			if (t.complexity) parts.push(t.complexity);
			if (t.estimatedLatencyMs) parts.push(`~${t.estimatedLatencyMs.p50}ms`);
			return `  ${t.name}: [${parts.join(", ")}]`;
		})
		.join("\n");
	const perfSection = perfHints
		? `\nPerformance hints (prefer fast tools first; slow tools may block):\n${perfHints}`
		: "";

	const priorContextSection = priorContext ? `\nPrior context from previous runs:\n${priorContext}\n` : "";

	const system = `You are ${manifest.persona.name}, ${manifest.persona.role}.
${priorContextSection}

Available tools:
${toolDefs}${depSection}${toolChainsSection}${perfSection}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "research-analyst.conduct_market_research").
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

		// Async Job (Arcade #24): if the tool declares a long timeoutMs and the server
		// returned a pending job ID, poll get_job_status until complete or timeout.

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
		const execResult = await executeWithRetry(runtime, {
			toolName: parsed.tool,
			args: parsed.args ?? {},
			runId: `task:step:${step}`,
			identity: options.identity,
		});

		if (execResult.status === "completed") {
			const toolManifest = manifest.tools.find((t) => t.name === parsed.tool);
			const data = execResult.data as Record<string, unknown> | null;
			if (
				toolManifest?.timeoutMs &&
				toolManifest.timeoutMs > ASYNC_THRESHOLD_MS &&
				data !== null &&
				typeof data === "object" &&
				typeof data.jobId === "string" &&
				data.status === "pending"
			) {
				const serverKey = toolManifest.mcpServer;
				const serverUrl = serverKey ? (config.mcpServers?.[serverKey]?.url ?? "") : "";
				const poller = options.asyncJobPoller ?? defaultAsyncJobPoller;
				const pollMs = options.pollIntervalMs ?? ASYNC_POLL_INTERVAL_MS;
				const deadline = Date.now() + toolManifest.timeoutMs;
				let pollResult = await poller(data.jobId, serverUrl);
				while (pollResult.status === "pending" && Date.now() < deadline) {
					if (pollMs > 0) await new Promise((r) => setTimeout(r, pollMs));
					pollResult = await poller(data.jobId, serverUrl);
				}
				if (pollResult.status === "complete") {
					history.push({ role: "tool", content: JSON.stringify(pollResult.result) });
				} else {
					const msg =
						pollResult.status === "pending"
							? `Async job ${data.jobId} timed out after ${toolManifest.timeoutMs}ms`
							: `Async job ${data.jobId} failed: ${pollResult.error}`;
					return msg;
				}
			} else {
				history.push({ role: "tool", content: JSON.stringify(execResult.data) });
			}
		} else if (execResult.status === "approval_required") {
			if (!options.onApprovalRequired) {
				throw new Error(
					`Tool ${parsed.tool} requires human approval. ` +
						"Provide an onApprovalRequired callback to runResearchAnalystTask, or set autonomy to 'autonomous'.",
				);
			}
			const approval = await options.onApprovalRequired(execResult.challenge);
			const approved = await runtime.execute({
				toolName: parsed.tool,
				args: parsed.args ?? {},
				approval,
				runId: `task:step:${step}:approved`,
				identity: options.identity,
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
				// Arcade #44: Fallback Tool — if the manifest declares fallbackTo, attempt it once
				// before surfacing the error. The fallback receives the same args.
				const toolManifest = manifest.tools.find((t) => t.name === parsed.tool);
				if (toolManifest?.fallbackTo) {
					const fallbackResult = await executeWithRetry(runtime, {
						toolName: toolManifest.fallbackTo,
						args: parsed.args ?? {},
						runId: `task:step:${step}:fallback`,
						identity: options.identity,
					});
					if (fallbackResult.status === "completed") {
						history.push({
							role: "tool",
							content: JSON.stringify({
								...((fallbackResult.data as Record<string, unknown> | null) ?? {}),
								usedFallback: true,
								primaryTool: parsed.tool,
							}),
						});
						continue;
					}
				}
				// Arcade #26/#27: Transactional Boundary + Compensation Handler — write tool failures
				// run any registered undo fn (Arcade #27) then push a structured rollback message
				// (Arcade #26) to history instead of exiting the loop, letting the LLM surface
				// partial state and ask the user whether to retry or discard.
				if (toolManifest?.transactional) {
					const compensate = CompensationRegistry.get(parsed.tool);
					if (compensate) {
						try {
							await compensate(parsed.args ?? {});
						} catch (e) {
							history.push({
								role: "tool",
								content: `Compensation for ${parsed.tool} failed: ${e instanceof Error ? e.message : String(e)}. Manual cleanup may be required.`,
							});
						}
					}
					history.push({
						role: "tool",
						content: `Transactional write failed for ${parsed.tool}. All changes rolled back. Do not retry — ask the user whether to re-attempt or discard.`,
					});
					continue;
				}
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
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error('  Example: npx tsx src/agent/index.ts "Research Permian Basin competitive landscape"');
		process.exit(1);
	}
	const answer = await runResearchAnalystTask(goal, {
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
