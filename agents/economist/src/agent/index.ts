import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
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
	// memory.namespace = "economist" to surface relevant prior task context.

	const toolDefs = economistManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${economistManifest.persona.name}, ${economistManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "economist.calculate_dcf").
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

		// TODO (#396): Async Job — detect long-running economic analyses and poll for completion.

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
