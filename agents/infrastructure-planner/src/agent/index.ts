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
				dependsOn: ["development-planner.create_development_plan"],
				provides: ["pipeline-plan"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-pipeline",
			mcpServer: "infrastructure",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
				dependsOn: ["infrastructure-planner.plan_pipeline"],
				provides: ["facility-sizing"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-facilities",
			mcpServer: "infrastructure",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
				dependsOn: ["infrastructure-planner.plan_pipeline"],
				provides: ["infra-costs"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-costs",
			mcpServer: "infrastructure",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
				dependsOn: ["infrastructure-planner.plan_pipeline"],
				provides: ["infra-compliance"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:infrastructure"],
			modelRequirement: "standard-analysis",
			evalProfile: "infrastructure-planner-compliance",
			mcpServer: "infrastructure",
			estimatedLatencyMs: { p50: 200, p95: 800 },
			complexity: "fast",
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
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
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
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
		identity?: SessionIdentity;
	},
): Promise<string> {
	const config = options.config ?? infrastructurePlannerConfig;
	const manifest = runtime.getManifest();
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const baseNamespace = config.memory?.namespace ?? "infrastructure-planner";
	const namespace = options.identity?.userId ? `${options.identity.userId}:${baseNamespace}` : baseNamespace;
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[infrastructure-planner] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runInfrastructurePlannerTask.',
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

Always use the full tool name (e.g. "infrastructure-planner.plan_pipeline").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.
If a tool result includes a viewUrl field, include it in your answer as a clickable link (e.g. "View in Dashboard: <viewUrl>") for the user.`;

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
						"Provide an onApprovalRequired callback to runInfrastructurePlannerTask, or set autonomy to 'autonomous'.",
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
				history.push({
					role: "tool",
					content: `Error after approval for ${parsed.tool}: ${err}`,
				});
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
