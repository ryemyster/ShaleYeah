import type {
	AgentManifest,
	AgentRuntimeConfig,
	HumanApproval,
	HumanApprovalChallenge,
} from "@shaleyeah/sdk";
import {
	LocalAgentEndpoint,
	LocalAgentRuntime,
	type StandaloneToolHandler,
	callLLM,
} from "@shaleyeah/sdk";
import { callDrillingTool } from "./drilling-client.js";

export { callDrillingTool };

// ── Manifest ──────────────────────────────────────────────────────────────────

export const drillingEngineerManifest: AgentManifest = {
	id: "drilling-engineer",
	role: "drilling-analyst",
	version: "0.1.0",
	description:
		"Perforator Maximus — drilling engineer agent that designs programs, estimates costs, and assesses drilling risks.",
	persona: {
		name: "Perforator Maximus",
		role: "Master Drilling Strategist",
		expertise: [
			"Drilling program design",
			"Well trajectory optimization",
			"Drilling risk assessment",
			"Cost estimation and budgeting",
			"Technical troubleshooting",
		],
	},
	capabilities: [
		"drilling-program-design",
		"well-cost-estimation",
		"drilling-risk-assessment",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "drilling-engineer.design_drilling_program",
			description:
				"Design comprehensive drilling program with casing schedule and mud program.",
			type: "query",
			capabilities: ["drilling-program-design"],
			inputSchema: {
				type: "object",
				properties: {
					wellParameters: {
						type: "object",
						properties: {
							targetDepth: { type: "number" },
							wellType: {
								type: "string",
								enum: ["vertical", "horizontal", "directional"],
							},
							formation: { type: "string" },
						},
						required: ["targetDepth", "wellType", "formation"],
					},
					constraints: {
						type: "object",
						properties: {
							budget: { type: "number" },
							timeline: { type: "string" },
						},
					},
				},
				required: ["wellParameters"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:drilling"],
			modelRequirement: "standard-analysis",
			evalProfile: "drilling-engineer-program",
			mcpServer: "drilling",
		},
		{
			name: "drilling-engineer.estimate_well_costs",
			description:
				"Estimate drilling, completion, and facilities cost breakdown for a well.",
			type: "query",
			capabilities: ["well-cost-estimation"],
			inputSchema: {
				type: "object",
				properties: {
					wellParameters: {
						type: "object",
						properties: {
							targetDepth: { type: "number" },
							wellType: {
								type: "string",
								enum: ["vertical", "horizontal", "directional"],
							},
							formation: { type: "string" },
						},
						required: ["targetDepth", "wellType", "formation"],
					},
					location: { type: "string" },
				},
				required: ["wellParameters"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:drilling"],
			modelRequirement: "standard-analysis",
			evalProfile: "drilling-engineer-costs",
			mcpServer: "drilling",
		},
		{
			name: "drilling-engineer.assess_drilling_risks",
			description:
				"Assess geological, operational, and environmental drilling risks with mitigations.",
			type: "query",
			capabilities: ["drilling-risk-assessment"],
			inputSchema: {
				type: "object",
				properties: {
					wellParameters: {
						type: "object",
						properties: {
							targetDepth: { type: "number" },
							wellType: {
								type: "string",
								enum: ["vertical", "horizontal", "directional"],
							},
							formation: { type: "string" },
						},
						required: ["targetDepth", "wellType", "formation"],
					},
					environmentalConstraints: {
						type: "array",
						items: { type: "string" },
					},
				},
				required: ["wellParameters"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:drilling"],
			modelRequirement: "standard-analysis",
			evalProfile: "drilling-engineer-risks",
			mcpServer: "drilling",
		},
	],
	requiredScopes: ["read:drilling"],
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
		readinessChecks: [
			"manifest",
			"runtime-config",
			"tool-handlers",
			"model-routing",
		],
	},
	memory: {
		namespace: "drilling-engineer",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "drilling-engineer-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "assistive",
		allowedLevels: ["assistive", "reviewed"],
	},
};

// ── Runtime config ────────────────────────────────────────────────────────────

export const drillingEngineerConfig: AgentRuntimeConfig = {
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
		profile: "drilling-engineer-default",
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
		namespace: "drilling-engineer",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: { requireHumanReview: true, allowSharedMemory: false },
	},
	mcpServers: {
		drilling: {
			url: process.env.DRILLING_MCP_URL ?? "http://localhost:3003",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

// ── URL helper ────────────────────────────────────────────────────────────────

function drillingUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.drilling?.url ?? "http://localhost:3003";
}

// ── Handler map ───────────────────────────────────────────────────────────────

const handlers: Record<string, StandaloneToolHandler> = {
	"drilling-engineer.design_drilling_program": ({ args, config }) =>
		callDrillingTool(
			drillingUrl(config),
			"design_drilling_program",
			args as Record<string, unknown>,
		),
	"drilling-engineer.estimate_well_costs": ({ args, config }) =>
		callDrillingTool(
			drillingUrl(config),
			"estimate_well_costs",
			args as Record<string, unknown>,
		),
	"drilling-engineer.assess_drilling_risks": ({ args, config }) =>
		callDrillingTool(
			drillingUrl(config),
			"assess_drilling_risks",
			args as Record<string, unknown>,
		),
};

// ── Runtime + Endpoint factories ──────────────────────────────────────────────

export function createDrillingEngineerRuntime(
	config: AgentRuntimeConfig = drillingEngineerConfig,
): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: drillingEngineerManifest,
		config,
		handlers,
	});
}

export function createDrillingEngineerEndpoint(
	config: AgentRuntimeConfig = drillingEngineerConfig,
): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createDrillingEngineerRuntime(config));
}

// ── Task execution loop (Layer 2) ─────────────────────────────────────────────
/**
 * Run a multi-step drilling-engineer task driven by the LLM.
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
export async function runDrillingEngineerTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (
			challenge: HumanApprovalChallenge,
		) => Promise<HumanApproval>;
	} = {},
): Promise<string> {
	const config = options.config ?? drillingEngineerConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createDrillingEngineerRuntime(config);
		await runtime.initialize();
		ownedRuntime = true;
	}

	try {
		return await executeLoop(goal, runtime, options);
	} finally {
		if (ownedRuntime) await runtime.shutdown();
	}
}

function buildTranscript(
	history: Array<{ role: "user" | "assistant" | "tool"; content: string }>,
): string {
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

async function executeLoop(
	goal: string,
	runtime: LocalAgentRuntime,
	options: {
		apiKey?: string;
		onApprovalRequired?: (
			challenge: HumanApprovalChallenge,
		) => Promise<HumanApproval>;
	},
): Promise<string> {
	// TODO (#395): Context Injection — read from memory.namespace before building system prompt.

	const toolDefs = drillingEngineerManifest.tools
		.map((t) => `  ${t.name}: ${t.description}`)
		.join("\n");

	const system = `You are ${drillingEngineerManifest.persona.name}, ${drillingEngineerManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "drilling-engineer.design_drilling_program").
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

		// TODO (#396): Async Job — detect asyncJob tools and poll instead of blocking.

		// Permission Gate: all tool calls go through runtime.execute() — never call
		// the MCP client directly from the loop.
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
					`Tool ${parsed.tool} requires human approval. Provide an onApprovalRequired callback to runDrillingEngineerTask, or set autonomy to 'autonomous'.`,
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
				const err =
					approved.status === "failed"
						? approved.error
						: "approval re-execution failed";
				history.push({
					role: "tool",
					content: `Error after approval for ${parsed.tool}: ${err}`,
				});
			}
		} else {
			const hint = execResult.retryable
				? " (retryable — server may be temporarily unavailable)"
				: " (permanent)";
			history.push({
				role: "tool",
				content: `Error calling ${parsed.tool}: ${execResult.error}${hint}`,
			});
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
