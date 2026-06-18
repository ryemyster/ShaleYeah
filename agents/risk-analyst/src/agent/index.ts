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
	ContextStore,
	callLLM,
	defaultAsyncJobPoller,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
import { callRiskAnalysisTool } from "./risk-analysis-client.js";

export { callRiskAnalysisTool };

export const riskAnalystManifest: AgentManifest = {
	id: "risk-analyst",
	role: "risk-analyst",
	version: "0.1.0",
	description:
		"Gaius Probabilis Assessor — standalone risk analyst agent migrated from the risk-analysis MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Gaius Probabilis Assessor",
		role: "Master Risk Assessment Analyst",
		expertise: [
			"Monte Carlo simulation and probabilistic analysis",
			"Investment risk quantification",
			"P10/P50/P90 scenario construction",
			"Risk-adjusted return metrics (EMV, EV at risk)",
			"Portfolio risk aggregation",
		],
	},
	capabilities: [
		"risk-assessment",
		"monte-carlo-simulation",
		"probabilistic-analysis",
		"scenario-analysis",
		"portfolio-risk",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "risk-analyst.assess_investment_risk",
			description:
				"Assess overall investment risk across geological, economic, regulatory, and operational dimensions.",
			type: "query",
			capabilities: ["risk-assessment", "probabilistic-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					geologicalRisk: {
						type: "object",
						description: "Geological risk factors (porosity, permeability, thickness uncertainty)",
					},
					economicRisk: {
						type: "object",
						description: "Economic risk factors (price decks, cost estimates, timing)",
					},
					regulatoryRisk: {
						type: "string",
						enum: ["low", "medium", "high"],
						description: "Regulatory and permitting risk level",
					},
					operationalRisk: {
						type: "string",
						enum: ["low", "medium", "high"],
						description: "Operational and execution risk level",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: [],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:risk"],
			modelRequirement: "standard-analysis",
			evalProfile: "risk-analyst-assessment",
			mcpServer: "risk-analysis",
			dependsOn: ["geologist.analyze_formation", "economist.analyze_economics"],
			provides: ["risk-assessment"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
		{
			name: "risk-analyst.monte_carlo_simulation",
			description:
				"Run Monte Carlo simulation (10,000 iterations) over uncertain input parameters to derive P10/P50/P90 outcomes.",
			type: "query",
			capabilities: ["monte-carlo-simulation", "probabilistic-analysis", "scenario-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					inputs: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string", description: "Parameter name" },
								distribution: {
									type: "string",
									enum: ["uniform", "triangular", "normal"],
									description: "Probability distribution type",
								},
								min: { type: "number", description: "Minimum value (uniform/triangular)" },
								mode: { type: "number", description: "Most likely value (triangular)" },
								max: { type: "number", description: "Maximum value (uniform/triangular)" },
								mean: { type: "number", description: "Mean value (normal distribution)" },
								stddev: { type: "number", description: "Standard deviation (normal distribution)" },
							},
							required: ["name", "distribution"],
						},
						description: "Uncertain input parameters with distributions",
					},
					iterations: {
						type: "number",
						minimum: 100,
						maximum: 100000,
						default: 10000,
						description: "Number of Monte Carlo iterations",
					},
					outputMetric: {
						type: "string",
						description: "Output metric to compute (e.g. NPV, EUR, IRR)",
					},
				},
				required: ["inputs"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:risk"],
			// Monte Carlo uses sampleUniform/sampleTriangular/sampleNormal — not Math.random() in business logic.
			// These named samplers are exempt from the no-Math.random() rule (CLAUDE.md § Standards).
			modelRequirement: "standard-analysis",
			evalProfile: "risk-analyst-monte-carlo",
			mcpServer: "risk-analysis",
			timeoutMs: 60_000,
			// Arcade #44: if Monte Carlo permanently fails, fall back to deterministic risk
			// assessment so the analyst can still deliver a risk profile to the committee.
			fallbackTo: "risk-analyst.assess_investment_risk",
			dependsOn: ["risk-analyst.assess_investment_risk"],
			provides: ["risk-simulation"],
			estimatedLatencyMs: { p50: 8000, p95: 30000 },
			complexity: "slow",
		},
	],
	// Arcade #21: Tool Chain — recommended step sequences for known workflows.
	toolChains: [
		{
			id: "risk-assessment",
			description: "Full risk assessment: deterministic risk → Monte Carlo simulation",
			steps: ["risk-analyst.assess_investment_risk", "risk-analyst.monte_carlo_simulation"],
			trigger: "assessing investment risk or stress-testing a prospect",
		},
	],
	requiredScopes: ["read:risk"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for risk synthesis — risk assessment interpretation and scenario analysis call the model.",
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
		namespace: "risk-analyst",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "risk-analyst-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const riskAnalystConfig: AgentRuntimeConfig = {
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
		profile: "risk-analyst-standard",
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
		namespace: "risk-analyst",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		"risk-analysis": {
			url: process.env.RISK_ANALYSIS_MCP_URL ?? "http://localhost:3005",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function riskAnalysisUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.["risk-analysis"]?.url ?? "http://localhost:3005";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"risk-analyst.assess_investment_risk": ({ args, config }) =>
		callRiskAnalysisTool(riskAnalysisUrl(config), "assess_investment_risk", args as Record<string, unknown>),

	"risk-analyst.monte_carlo_simulation": ({ args, config }) =>
		callRiskAnalysisTool(riskAnalysisUrl(config), "monte_carlo_simulation", args as Record<string, unknown>),
};

export function createRiskAnalystRuntime(config: AgentRuntimeConfig = riskAnalystConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: riskAnalystManifest,
		config,
		handlers,
	});
}

export function createRiskAnalystEndpoint(config: AgentRuntimeConfig = riskAnalystConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createRiskAnalystRuntime(config));
}

/**
 * Run a multi-step risk analysis task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which risk-analysis tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running Monte Carlo simulations.
 */
export async function runRiskAnalystTask(
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
	const config = options.config ?? riskAnalystConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createRiskAnalystRuntime(config);
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
		identity?: SessionIdentity;
	},
): Promise<string> {
	const config = options.config ?? riskAnalystConfig;
	const manifest = runtime.getManifest();
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const baseNamespace = config.memory?.namespace ?? "risk-analyst";
	const namespace = options.identity?.userId ? `${options.identity.userId}:${baseNamespace}` : baseNamespace;
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[risk-analyst] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runRiskAnalystTask.',
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

Always use the full tool name (e.g. "risk-analyst.assess_investment_risk").
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
		// executeWithRetry transparently retries transient (retryable) failures before
		// surfacing the error to the LLM as a recoverable hint.
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
						"Provide an onApprovalRequired callback to runRiskAnalystTask, or set autonomy to 'autonomous'.",
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
// Run a risk analysis task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Assess investment risk for..."
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error('  Example: npx tsx src/agent/index.ts "Run Monte Carlo simulation for Permian Basin EUR"');
		process.exit(1);
	}
	const answer = await runRiskAnalystTask(goal, {
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
