import type {
	AgentManifest,
	AgentRuntimeConfig,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
} from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callReporterTool } from "./reporter-client.js";

export { callReporterTool };

export const reporterAgentManifest: AgentManifest = {
	id: "reporter-agent",
	role: "report-synthesizer",
	version: "0.1.0",
	description:
		"Scriptor Reporticus Maximus — standalone reporter agent migrated from the reporter MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Scriptor Reporticus Maximus",
		role: "Master Investment Report Synthesizer",
		expertise: [
			"Investment memo and executive report authoring",
			"Multi-source analysis synthesis",
			"Decision recommendation packaging",
			"Risk-opportunity narrative framing",
			"Board-ready presentation structuring",
		],
	},
	capabilities: [
		"report-generation",
		"analysis-synthesis",
		"executive-reporting",
		"decision-packaging",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "reporter-agent.generate_investment_decision",
			description:
				"Generate a complete investment decision package — narrative, recommendation, risk summary, and supporting exhibits.",
			type: "query",
			capabilities: ["report-generation", "decision-packaging"],
			inputSchema: {
				type: "object",
				properties: {
					analysisInputs: { type: "object", description: "Consolidated analysis from all domain agents" },
					decisionOutcome: {
						type: "string",
						enum: ["invest", "pass", "conditional"],
						description: "Investment decision outcome",
					},
					targetAudience: {
						type: "string",
						enum: ["board", "investment-committee", "management"],
						default: "investment-committee",
					},
					outputPath: { type: "string", description: "Optional path to write report output" },
				},
				required: ["analysisInputs"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reporting"],
			modelRequirement: "deep-reasoning",
			evalProfile: "reporter-agent-decision",
			mcpServer: "reporter",
		},
		{
			name: "reporter-agent.create_executive_report",
			description: "Create a concise executive summary report from multi-domain O&G analysis results.",
			type: "query",
			capabilities: ["executive-reporting", "analysis-synthesis"],
			inputSchema: {
				type: "object",
				properties: {
					title: { type: "string", description: "Report title" },
					sections: {
						type: "array",
						items: { type: "object" },
						description: "Analysis sections to include",
					},
					format: {
						type: "string",
						enum: ["memo", "slide-deck", "detailed-report"],
						default: "memo",
					},
					outputPath: { type: "string", description: "Optional path to write output" },
				},
				required: ["title", "sections"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reporting"],
			modelRequirement: "standard-analysis",
			evalProfile: "reporter-agent-executive",
			mcpServer: "reporter",
		},
		{
			name: "reporter-agent.synthesize_analysis",
			description:
				"Synthesize analysis outputs from multiple domain agents into a unified narrative with key findings and recommendations.",
			type: "query",
			capabilities: ["analysis-synthesis", "report-generation"],
			inputSchema: {
				type: "object",
				properties: {
					geological: { type: "object", description: "Geological analysis output" },
					economic: { type: "object", description: "Economic analysis output" },
					risk: { type: "object", description: "Risk assessment output" },
					market: { type: "object", description: "Market analysis output" },
					legal: { type: "object", description: "Legal and title analysis output" },
					focusAreas: {
						type: "array",
						items: { type: "string" },
						description: "Key areas to emphasize in synthesis",
					},
				},
				required: [],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:reporting"],
			modelRequirement: "standard-analysis",
			evalProfile: "reporter-agent-synthesis",
			mcpServer: "reporter",
		},
	],
	requiredScopes: ["read:reporting"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description: "Organization-selected LLM for report synthesis — all report generation calls the model.",
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
		namespace: "reporter-agent",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "reporter-agent-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const reporterAgentConfig: AgentRuntimeConfig = {
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
		profile: "reporter-agent-standard",
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
		namespace: "reporter-agent",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		reporter: {
			url: process.env.REPORTER_MCP_URL ?? "http://localhost:3009",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function reporterUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.reporter?.url ?? "http://localhost:3009";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"reporter-agent.generate_investment_decision": ({ args, config }) =>
		callReporterTool(reporterUrl(config), "generate_investment_decision", args as Record<string, unknown>),

	"reporter-agent.create_executive_report": ({ args, config }) =>
		callReporterTool(reporterUrl(config), "create_executive_report", args as Record<string, unknown>),

	"reporter-agent.synthesize_analysis": ({ args, config }) =>
		callReporterTool(reporterUrl(config), "synthesize_analysis", args as Record<string, unknown>),
};

export function createReporterAgentRuntime(config: AgentRuntimeConfig = reporterAgentConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: reporterAgentManifest,
		config,
		handlers,
	});
}

export function createReporterAgentEndpoint(config: AgentRuntimeConfig = reporterAgentConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createReporterAgentRuntime(config));
}

/**
 * Run a multi-step reporting task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which reporter tools to call,
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
 * Deferred (#396): Async Job — polling pattern for long-running report generation.
 */
export async function runReporterAgentTask(
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
	const config = options.config ?? reporterAgentConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createReporterAgentRuntime(config);
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
	// memory.namespace = "reporter-agent" to surface relevant prior task context.

	const config = options.config ?? reporterAgentConfig;
	const callLLMFn = options.callLLMFn ?? callLLM;

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[reporter-agent] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runReporterAgentTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const toolDefs = reporterAgentManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${reporterAgentManifest.persona.name}, ${reporterAgentManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "reporter-agent.synthesize_analysis").
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

		// TODO (#396): Async Job — detect long-running report generation and poll for completion.

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
						"Provide an onApprovalRequired callback to runReporterAgentTask, or set autonomy to 'autonomous'.",
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
// Run a reporting task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Generate investment memo for..."
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error('  Example: npx tsx src/agent/index.ts "Generate an investment memo for the Wolfcamp acquisition"');
		process.exit(1);
	}
	const answer = await runReporterAgentTask(goal, {
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
