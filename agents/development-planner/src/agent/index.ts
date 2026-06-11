import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callDevelopmentTool } from "./development-client.js";

export { callDevelopmentTool };

export const developmentPlannerManifest: AgentManifest = {
	id: "development-planner",
	role: "development-analyst",
	version: "0.1.0",
	description:
		"Architectus Developmentus — standalone development planner agent backed by the development MCP server. Creates phased development plans, estimates timelines, and monitors project progress for oil & gas well programs.",
	persona: {
		name: "Architectus Developmentus",
		role: "Master Development Strategist",
		expertise: [
			"Development planning and phase scheduling",
			"Resource allocation and budget management",
			"Project timeline estimation and milestone planning",
			"Performance monitoring and KPI tracking",
			"Risk assessment for schedule and budget overruns",
		],
	},
	capabilities: [
		"development-planning",
		"phase-scheduling",
		"timeline-estimation",
		"progress-monitoring",
		"budget-risk-analysis",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "development-planner.create_development_plan",
			description: "Create comprehensive development plan for oil & gas project.",
			type: "query",
			capabilities: ["development-planning", "phase-scheduling"],
			inputSchema: {
				type: "object",
				properties: {
					project: {
						type: "object",
						properties: {
							name: { type: "string" },
							location: { type: "string" },
							reserves: { type: "number" },
							wellCount: { type: "number" },
						},
						required: ["name", "location", "reserves", "wellCount"],
					},
					timeline: { type: "string" },
					constraints: {
						type: "object",
						properties: {
							budget: { type: "number" },
							environmental: { type: "array", items: { type: "string" } },
							technical: { type: "array", items: { type: "string" } },
						},
					},
					outputPath: { type: "string" },
				},
				required: ["project"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:development"],
			modelRequirement: "standard-analysis",
			evalProfile: "development-planner-plan",
			mcpServer: "development",
		},
		{
			name: "development-planner.estimate_project_timeline",
			description: "Estimate phased development timeline and milestones for a well program.",
			type: "query",
			capabilities: ["timeline-estimation", "phase-scheduling"],
			inputSchema: {
				type: "object",
				properties: {
					projectName: { type: "string" },
					wellCount: { type: "number", description: "Total number of wells in the program" },
					budget: { type: "number", description: "Total project budget in USD" },
					constraints: { type: "array", items: { type: "string" } },
				},
				required: ["projectName", "wellCount", "budget"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:development"],
			modelRequirement: "standard-analysis",
			evalProfile: "development-planner-timeline",
			mcpServer: "development",
		},
		{
			name: "development-planner.monitor_development_progress",
			description: "Monitor and analyze development project progress across schedule, budget, safety, and quality KPIs.",
			type: "query",
			capabilities: ["progress-monitoring"],
			inputSchema: {
				type: "object",
				properties: {
					projectId: { type: "string" },
					metrics: { type: "array", items: { type: "string" } },
					reportingPeriod: { type: "string", enum: ["weekly", "monthly", "quarterly"] },
					outputPath: { type: "string" },
				},
				required: ["projectId"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:development"],
			modelRequirement: "deterministic",
			evalProfile: "development-planner-monitoring",
			mcpServer: "development",
		},
	],
	requiredScopes: ["read:development"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description: "Anthropic Claude — standard analysis for development plan synthesis and timeline estimation.",
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
		namespace: "development-planner",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "development-planner-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const developmentPlannerConfig: AgentRuntimeConfig = {
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
		profile: "development-planner-default",
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
		namespace: "development-planner",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		development: {
			url: process.env.DEVELOPMENT_MCP_URL ?? "http://localhost:3011",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function developmentUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.development?.url ?? "http://localhost:3011";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"development-planner.create_development_plan": ({ args, config }) =>
		callDevelopmentTool(developmentUrl(config), "create_development_plan", args as Record<string, unknown>),

	"development-planner.estimate_project_timeline": ({ args, config }) =>
		callDevelopmentTool(developmentUrl(config), "estimate_project_timeline", args as Record<string, unknown>),

	"development-planner.monitor_development_progress": ({ args, config }) =>
		callDevelopmentTool(developmentUrl(config), "monitor_development_progress", args as Record<string, unknown>),
};

export function createDevelopmentPlannerRuntime(config: AgentRuntimeConfig = developmentPlannerConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: developmentPlannerManifest,
		config,
		handlers,
	});
}

export function createDevelopmentPlannerEndpoint(
	config: AgentRuntimeConfig = developmentPlannerConfig,
): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createDevelopmentPlannerRuntime(config));
}

/**
 * Run a multi-step development planning task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which development tools to call,
 * executes them through the governed runtime (HITL + scope checks fire on every
 * tool call — Arcade pattern #46: Permission Gate), and returns a synthesized answer.
 *
 * options.runtime    — caller-managed runtime (e.g. in tests)
 * options.onApprovalRequired — HITL callback; throws if omitted and approval is required
 *
 * Deferred (#395): Context Injection — read/write memory namespace around the loop.
 * Deferred (#396): Async Job — polling for long-running development analyses.
 */
export async function runDevelopmentPlannerTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
	} = {},
): Promise<string> {
	const config = options.config ?? developmentPlannerConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createDevelopmentPlannerRuntime(config);
		await runtime.initialize();
		ownedRuntime = true;
	}

	try {
		return await executeLoop(goal, runtime, { ...options, config });
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
	},
): Promise<string> {
	// TODO (#395): Context Injection — read from memory.namespace before building system prompt.

	const config = options.config ?? developmentPlannerConfig;
	const reasoningModel = config.modelRouting["standard-analysis"]?.model;

	const toolDefs = developmentPlannerManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${developmentPlannerManifest.persona.name}, ${developmentPlannerManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "development-planner.create_development_plan").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.`;

	type Turn = { role: "user" | "assistant" | "tool"; content: string };
	const history: Turn[] = [{ role: "user", content: goal }];
	const MAX_STEPS = 8;

	for (let step = 0; step < MAX_STEPS; step++) {
		const response = await callLLM({
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

		// TODO (#396): Async Job — detect long-running development analyses and poll for completion.

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
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
						"Provide an onApprovalRequired callback to runDevelopmentPlannerTask, or set autonomy to 'autonomous'.",
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
		model: reasoningModel,
		apiKey: options.apiKey,
	});

	return parseJson(finalResponse)?.answer ?? finalResponse;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error(
			'  Example: npx tsx src/agent/index.ts "Create a development plan for 15-well program in Texas"',
		);
		process.exit(1);
	}
	const answer = await runDevelopmentPlannerTask(goal, {
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
