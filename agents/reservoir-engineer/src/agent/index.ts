import type {
	AgentManifest,
	AgentRuntimeConfig,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
} from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callCurveSmithTool } from "./curve-smith-client.js";

export { callCurveSmithTool };

export const reservoirEngineerManifest: AgentManifest = {
	id: "reservoir-engineer",
	role: "reservoir-engineer",
	version: "0.1.0",
	description:
		"Lucius Technicus Engineer — standalone reservoir engineer agent migrated from the curve-smith MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Lucius Technicus Engineer",
		role: "Master Reservoir Engineer",
		expertise: [
			"Decline curve analysis (Arps, Duong, power-law)",
			"Type curve generation and normalization",
			"EUR and reserves estimation",
			"Curve quality assessment and peer benchmarking",
			"Production forecasting",
		],
	},
	capabilities: [
		"decline-curve-analysis",
		"type-curve-generation",
		"eur-estimation",
		"curve-quality-assessment",
		"production-forecasting",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "reservoir-engineer.analyze_decline_curve",
			description:
				"Analyze production decline curves using Arps, Duong, or power-law methods to characterize reservoir performance.",
			type: "query",
			capabilities: ["decline-curve-analysis", "production-forecasting"],
			inputSchema: {
				type: "object",
				properties: {
					productionData: {
						type: "array",
						items: { type: "number" },
						description: "Monthly production volumes (BOE or MCF)",
					},
					method: {
						type: "string",
						enum: ["arps", "duong", "power-law", "auto"],
						default: "auto",
						description: "Decline curve fitting method",
					},
					wellIdentifier: { type: "string", description: "Well API or name for reference" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["productionData"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reservoir"],
			modelRequirement: "standard-analysis",
			evalProfile: "reservoir-engineer-decline",
			mcpServer: "curve-smith",
		},
		{
			name: "reservoir-engineer.generate_type_curve",
			description:
				"Generate a type curve from a population of wells in a given basin and formation for EUR normalization.",
			type: "query",
			capabilities: ["type-curve-generation", "decline-curve-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					basin: { type: "string", description: "Basin name (e.g. Permian, Haynesville)" },
					formation: { type: "string", description: "Target formation" },
					lateralLength: { type: "number", description: "Normalized lateral length in feet" },
					percentile: {
						type: "string",
						enum: ["P10", "P50", "P90"],
						default: "P50",
						description: "Production curve percentile",
					},
				},
				required: ["basin", "formation"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reservoir"],
			modelRequirement: "standard-analysis",
			evalProfile: "reservoir-engineer-type-curve",
			mcpServer: "curve-smith",
		},
		{
			name: "reservoir-engineer.calculate_eur",
			description: "Calculate estimated ultimate recovery (EUR) from decline curve parameters or production history.",
			type: "query",
			capabilities: ["eur-estimation", "decline-curve-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					declineParams: {
						type: "object",
						properties: {
							qi: { type: "number", description: "Initial production rate (BOE/d or MCF/d)" },
							di: { type: "number", description: "Initial decline rate (annual fraction)" },
							b: { type: "number", description: "Arps b-factor (0=exponential, 1=harmonic)" },
						},
						required: ["qi", "di"],
					},
					economicLimit: { type: "number", default: 1, description: "Economic abandonment rate (BOE/d)" },
					forecastMonths: { type: "number", default: 360, description: "Maximum forecast horizon (months)" },
				},
				required: ["declineParams"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reservoir"],
			modelRequirement: "deterministic",
			evalProfile: "reservoir-engineer-eur",
			mcpServer: "curve-smith",
		},
		{
			name: "reservoir-engineer.assess_curve_quality",
			description: "Assess the quality and reliability of a decline curve fit against raw production data.",
			type: "query",
			capabilities: ["curve-quality-assessment", "decline-curve-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					productionData: {
						type: "array",
						items: { type: "number" },
						description: "Actual monthly production volumes",
					},
					fittedCurve: {
						type: "array",
						items: { type: "number" },
						description: "Fitted curve values at same time steps",
					},
					wellIdentifier: { type: "string", description: "Well API or name for reference" },
				},
				required: ["productionData", "fittedCurve"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reservoir"],
			modelRequirement: "standard-analysis",
			evalProfile: "reservoir-engineer-quality",
			mcpServer: "curve-smith",
		},
	],
	requiredScopes: ["read:reservoir"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for reservoir analysis — decline curve interpretation and type curve analysis call the model.",
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
		namespace: "reservoir-engineer",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "reservoir-engineer-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const reservoirEngineerConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		// EUR calculation is deterministic — no LLM needed for the computation itself.
		deterministic: { provider: "rule-based", model: "no-model" },
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "reservoir-engineer-standard",
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
		namespace: "reservoir-engineer",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		"curve-smith": {
			url: process.env.CURVE_SMITH_MCP_URL ?? "http://localhost:3004",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function curveSmithUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.["curve-smith"]?.url ?? "http://localhost:3004";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"reservoir-engineer.analyze_decline_curve": ({ args, config }) =>
		callCurveSmithTool(curveSmithUrl(config), "analyze_decline_curve", args as Record<string, unknown>),

	"reservoir-engineer.generate_type_curve": ({ args, config }) =>
		callCurveSmithTool(curveSmithUrl(config), "generate_type_curve", args as Record<string, unknown>),

	"reservoir-engineer.calculate_eur": ({ args, config }) =>
		callCurveSmithTool(curveSmithUrl(config), "calculate_eur", args as Record<string, unknown>),

	"reservoir-engineer.assess_curve_quality": ({ args, config }) =>
		callCurveSmithTool(curveSmithUrl(config), "assess_curve_quality", args as Record<string, unknown>),
};

export function createReservoirEngineerRuntime(
	config: AgentRuntimeConfig = reservoirEngineerConfig,
): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: reservoirEngineerManifest,
		config,
		handlers,
	});
}

export function createReservoirEngineerEndpoint(
	config: AgentRuntimeConfig = reservoirEngineerConfig,
): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createReservoirEngineerRuntime(config));
}

/**
 * Run a multi-step reservoir engineering task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which curve-smith tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running EUR calculations.
 */
export async function runReservoirEngineerTask(
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
	const config = options.config ?? reservoirEngineerConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createReservoirEngineerRuntime(config);
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
	// TODO (#395): Context Injection — before building the system prompt, read from
	// memory.namespace = "reservoir-engineer" to surface relevant prior task context.

	const config = options.config ?? reservoirEngineerConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[reservoir-engineer] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runReservoirEngineerTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = reservoirEngineerManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${reservoirEngineerManifest.persona.name}, ${reservoirEngineerManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "reservoir-engineer.analyze_decline_curve").
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
			return parsed?.answer ?? response;
		}

		// TODO (#396): Async Job — detect long-running EUR calculations and poll for completion.

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
						"Provide an onApprovalRequired callback to runReservoirEngineerTask, or set autonomy to 'autonomous'.",
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

	// TODO (#395): Context Injection — write key findings to memory.namespace before returning.

	const finalResponse = await callLLMFn({
		system,
		prompt: `${buildTranscript(history)}\n\nUser: Maximum steps reached. Synthesize findings now.\n\nAssistant:`,
		model: reasoningModel,
		apiKey: options.apiKey,
	});

	return parseJson(finalResponse)?.answer ?? finalResponse;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
// Run a reservoir engineering task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Analyze production decline for..."
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error('  Example: npx tsx src/agent/index.ts "Analyze decline curve and estimate EUR for Wolfcamp B well"');
		process.exit(1);
	}
	const answer = await runReservoirEngineerTask(goal, {
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
