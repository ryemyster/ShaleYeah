import type {
	AgentManifest,
	AgentRuntimeConfig,
	AsyncJobPoller,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
} from "@shaleyeah/sdk";
import {
	ASYNC_POLL_INTERVAL_MS,
	ASYNC_THRESHOLD_MS,
	ContextStore,
	callLLM,
	defaultAsyncJobPoller,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callEconobotTool } from "./econobot-client.js";

export { callEconobotTool };

export const economistManifest: AgentManifest = {
	id: "economist",
	role: "economic-analyst",
	version: "0.1.0",
	description:
		"Caesar Augustus Economicus — standalone economist agent migrated from the econobot MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Caesar Augustus Economicus",
		role: "Master Financial Strategist",
		expertise: [
			"DCF analysis and financial modeling",
			"NPV and IRR calculations",
			"Sensitivity and risk analysis",
			"Investment decision frameworks",
			"Economic data processing and validation",
		],
	},
	capabilities: [
		"economic-analysis",
		"dcf-analysis",
		"sensitivity-analysis",
		"investment-analysis",
		"financial-modeling",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "economist.analyze_economics",
			description: "Analyze economic data with DCF modeling from CSV or Excel inputs.",
			type: "query",
			capabilities: ["economic-analysis", "dcf-analysis", "financial-modeling"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to economic data file (.csv, .xlsx, .xls)" },
					dataType: {
						type: "string",
						enum: ["pricing", "costs", "production", "mixed"],
						description: "Type of economic data contained in the file",
					},
					discountRate: { type: "number", minimum: 0, maximum: 1, default: 0.1 },
					analysisType: {
						type: "string",
						enum: ["basic", "standard", "comprehensive"],
						default: "standard",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath", "dataType"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:economics"],
			modelRequirement: "standard-analysis",
			evalProfile: "economist-analysis",
			mcpServer: "econobot",
			dependsOn: ["geologist.analyze_formation"],
			provides: ["economics"],
		},
		{
			name: "economist.calculate_dcf",
			description: "Calculate NPV, IRR, and payback period from cash flows.",
			type: "query",
			capabilities: ["dcf-analysis", "investment-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					cashFlows: {
						type: "array",
						items: { type: "number" },
						description: "Cash flows by period",
					},
					discountRate: { type: "number", minimum: 0, maximum: 1 },
					periods: {
						type: "array",
						items: { type: "string" },
						description: "Optional labels for each cash flow period",
					},
					currency: { type: "string", default: "USD" },
				},
				required: ["cashFlows", "discountRate"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:economics"],
			modelRequirement: "deterministic",
			evalProfile: "economist-dcf",
			mcpServer: "econobot",
			// Arcade #44: if DCF calculation permanently fails, fall back to a simpler
			// economics analysis so the economist can still surface an economic outlook.
			fallbackTo: "economist.analyze_economics",
			dependsOn: ["economist.analyze_economics"],
			provides: ["dcf"],
		},
		{
			name: "economist.sensitivity_analysis",
			description: "Perform sensitivity analysis on commodity prices, production, and costs.",
			type: "query",
			capabilities: ["sensitivity-analysis", "risk-analysis", "investment-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					baseCase: {
						type: "object",
						properties: {
							oilPrice: { type: "number" },
							gasPrice: { type: "number" },
							production: { type: "array", items: { type: "number" } },
							costs: {
								type: "object",
								properties: {
									drilling: { type: "number" },
									completion: { type: "number" },
									operating: { type: "number" },
								},
								required: ["drilling", "completion", "operating"],
							},
						},
						required: ["oilPrice", "gasPrice", "production", "costs"],
					},
					ranges: {
						type: "object",
						properties: {
							oilPriceVariance: { type: "number", minimum: 0, maximum: 1, default: 0.2 },
							gasPriceVariance: { type: "number", minimum: 0, maximum: 1, default: 0.3 },
							productionVariance: { type: "number", minimum: 0, maximum: 1, default: 0.15 },
						},
					},
					scenarios: { type: "number", minimum: 10, maximum: 1000, default: 100 },
				},
				required: ["baseCase"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:economics"],
			modelRequirement: "standard-analysis",
			evalProfile: "economist-sensitivity",
			mcpServer: "econobot",
			dependsOn: ["economist.calculate_dcf"],
			provides: ["sensitivity"],
		},
	],
	// Arcade #21: Tool Chain — recommended step sequences for known workflows.
	toolChains: [
		{
			id: "economics-deep-dive",
			description: "Full economics analysis: market context → DCF valuation → sensitivity",
			steps: ["economist.analyze_economics", "economist.calculate_dcf", "economist.sensitivity_analysis"],
			trigger: "evaluating project economics or performing financial due diligence",
		},
	],
	requiredScopes: ["read:economics"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for economic synthesis — financial analysis and investment recommendations call the model.",
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
		namespace: "economist",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "economist-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const economistConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	// Dev defaults — operators override these bindings at deploy time via env-driven config.
	// provider: "anthropic" here means the standard Anthropic API path through callLLM().
	// provider: "rule-based" means the tool handler is deterministic; callLLM() is not invoked.
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		// rule-based: no LLM invoked — handler returns deterministic output from domain constants.
		deterministic: { provider: "rule-based", model: "no-model" },
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "economist-standard",
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
		namespace: "economist",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	// Tier 1 tool server — operator configures the actual URL at deployment time.
	mcpServers: {
		econobot: {
			url: "http://localhost:3002",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function econobotUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.econobot?.url ?? "http://localhost:3002";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"economist.analyze_economics": ({ args, config }) =>
		callEconobotTool(econobotUrl(config), "analyze_economics", args as Record<string, unknown>),

	"economist.calculate_dcf": ({ args, config }) =>
		callEconobotTool(econobotUrl(config), "calculate_dcf", args as Record<string, unknown>),

	"economist.sensitivity_analysis": ({ args, config }) =>
		callEconobotTool(econobotUrl(config), "sensitivity_analysis", args as Record<string, unknown>),
};

export function createEconomistRuntime(config: AgentRuntimeConfig = economistConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: economistManifest,
		config,
		handlers,
	});
}

export function createEconomistEndpoint(config: AgentRuntimeConfig = economistConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createEconomistRuntime(config));
}

/**
 * Run a multi-step economics task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which econobot tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running economics analyses.
 */
export async function runEconomistTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		/** Inject a custom LLM function — used in tests to capture model routing without real API calls. */
		callLLM?: (opts: LLMCallOptions) => Promise<string>;
		/** Override the async-job poller — used in tests to avoid real HTTP polling. */
		asyncJobPoller?: AsyncJobPoller;
		/** Override poll interval in ms — set to 0 in tests for instant polling. */
		pollIntervalMs?: number;
	} = {},
): Promise<string> {
	const config = options.config ?? economistConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createEconomistRuntime(config);
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
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
	},
): Promise<string> {
	const config = options.config ?? economistConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	const manifest = runtime.getManifest();

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const namespace = config.memory?.namespace ?? "economist";
	const priorContext = ContextStore.read(namespace);

	// Resolve the model that drives the reasoning loop from the operator's routing table.
	// The loop itself is always standard-analysis class — tool-level model requirements are
	// for the tool handlers (e.g. deterministic tools skip the LLM entirely).
	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[economist] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runEconomistTask.',
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

	const priorContextSection = priorContext ? `\nPrior context from previous runs:\n${priorContext}\n` : "";

	const system = `You are ${manifest.persona.name}, ${manifest.persona.role}.
${priorContextSection}

Available tools:
${toolDefs}${depSection}${toolChainsSection}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "economist.calculate_dcf").
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

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
		// executeWithRetry transparently retries transient (retryable) failures before
		// surfacing the error to the LLM as a recoverable hint.
		const execResult = await executeWithRetry(runtime, {
			toolName: parsed.tool,
			args: parsed.args ?? {},
			runId: `task:step:${step}`,
		});

		if (execResult.status === "completed") {
			// Async Job (Arcade #24): if the tool declares a long timeoutMs and the server
			// returned a pending job ID, poll get_job_status until complete or timeout.
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
						"Provide an onApprovalRequired callback to runEconomistTask, or set autonomy to 'autonomous'.",
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
				// Arcade #44: Fallback Tool — if the manifest declares fallbackTo, attempt it once
				// before surfacing the error. The fallback receives the same args.
				const toolManifest = manifest.tools.find((t) => t.name === parsed.tool);
				if (toolManifest?.fallbackTo) {
					const fallbackResult = await executeWithRetry(runtime, {
						toolName: toolManifest.fallbackTo,
						args: parsed.args ?? {},
						runId: `task:step:${step}:fallback`,
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
// Run an economics task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Calculate DCF for ..."
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error(
			'  Example: npx tsx src/agent/index.ts "Calculate DCF for -1000, 400, 500, 600 at 10% discount rate"',
		);
		process.exit(1);
	}
	const answer = await runEconomistTask(goal, {
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
