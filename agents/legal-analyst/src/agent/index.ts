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
import { callLegalTool } from "./legal-client.js";

export { callLegalTool };

export const legalAnalystManifest: AgentManifest = {
	id: "legal-analyst",
	role: "legal-analyst",
	version: "0.1.0",
	description:
		"Legatus Juridicus — standalone legal analyst agent backed by the legal MCP server. Reviews regulatory exposure, contract terms, and compliance requirements for oil & gas projects.",
	persona: {
		name: "Legatus Juridicus",
		role: "Master Legal Strategist",
		expertise: [
			"Regulatory compliance assessment and risk analysis",
			"Oil & gas contract review and negotiation",
			"Environmental, safety, and tax compliance",
			"Permitting and approval timeline planning",
			"Lease, JOA, and farmout agreement analysis",
		],
	},
	capabilities: [
		"regulatory-analysis",
		"contract-review",
		"compliance-assessment",
		"permit-planning",
		"legal-risk-analysis",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "legal-analyst.analyze_legal_framework",
			description: "Analyze regulatory and legal exposure for a jurisdiction and project type.",
			type: "query",
			capabilities: ["regulatory-analysis", "legal-risk-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					jurisdiction: {
						type: "string",
						description: "State or jurisdiction (e.g. Texas, California)",
					},
					projectType: {
						type: "string",
						enum: ["exploration", "development", "production", "abandonment"],
						description: "Stage of the oil & gas project",
					},
					assets: {
						type: "array",
						items: { type: "string" },
						description: "List of asset names or descriptions",
					},
					timeline: {
						type: "string",
						description: "Optional project timeline description",
					},
				},
				required: ["jurisdiction", "projectType", "assets"],
				provides: ["legal-framework"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:legal"],
			modelRequirement: "standard-analysis",
			evalProfile: "legal-analyst-regulatory",
			mcpServer: "legal",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
		{
			name: "legal-analyst.review_contract",
			description: "Review and assess risk in oil & gas contract terms.",
			type: "query",
			capabilities: ["contract-review", "legal-risk-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					contractType: {
						type: "string",
						enum: ["lease", "JOA", "purchase", "service", "farmout"],
						description: "Type of oil & gas contract",
					},
					keyTerms: {
						type: "array",
						items: { type: "string" },
						description: "Key contract terms and clauses to review",
					},
					parties: {
						type: "array",
						items: { type: "string" },
						description: "Contracting parties",
					},
					riskProfile: {
						type: "string",
						enum: ["conservative", "moderate", "aggressive"],
						description: "Risk tolerance of the reviewing party",
					},
				},
				required: ["contractType", "keyTerms", "parties"],
				dependsOn: ["legal-analyst.analyze_legal_framework"],
				provides: ["contract-review"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:legal"],
			modelRequirement: "standard-analysis",
			evalProfile: "legal-analyst-contract",
			mcpServer: "legal",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
		{
			name: "legal-analyst.assess_compliance",
			description: "Assess environmental, safety, and tax compliance requirements for a project.",
			type: "query",
			capabilities: ["compliance-assessment", "permit-planning"],
			inputSchema: {
				type: "object",
				properties: {
					jurisdiction: {
						type: "string",
						description: "State or jurisdiction",
					},
					projectType: {
						type: "string",
						enum: ["exploration", "development", "production", "abandonment"],
					},
					assetCount: {
						type: "number",
						description: "Number of assets in the project",
					},
				},
				required: ["jurisdiction", "projectType", "assetCount"],
				dependsOn: ["legal-analyst.analyze_legal_framework"],
				provides: ["compliance"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:legal"],
			modelRequirement: "standard-analysis",
			evalProfile: "legal-analyst-compliance",
			mcpServer: "legal",
			estimatedLatencyMs: { p50: 200, p95: 800 },
			complexity: "fast",
		},
	],
	requiredScopes: ["read:legal"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description: "Anthropic Claude — standard analysis for regulatory and contract synthesis.",
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
		namespace: "legal-analyst",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "legal-analyst-default",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const legalAnalystConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": {
			provider: "anthropic",
			model: "claude-haiku-4-5-20251001",
		},
		deterministic: { provider: "rule-based", model: "no-model" },
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "legal-analyst-default",
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
		namespace: "legal-analyst",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {
		legal: {
			url: process.env.LEGAL_MCP_URL ?? "http://localhost:3006",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

function legalUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.legal?.url ?? "http://localhost:3006";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"legal-analyst.analyze_legal_framework": ({ args, config }) =>
		callLegalTool(legalUrl(config), "analyze_legal_framework", args as Record<string, unknown>),

	"legal-analyst.review_contract": ({ args, config }) =>
		callLegalTool(legalUrl(config), "review_contract", args as Record<string, unknown>),

	"legal-analyst.assess_compliance": ({ args, config }) =>
		callLegalTool(legalUrl(config), "assess_compliance", args as Record<string, unknown>),
};

export function createLegalAnalystRuntime(config: AgentRuntimeConfig = legalAnalystConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: legalAnalystManifest,
		config,
		handlers,
	});
}

export function createLegalAnalystEndpoint(config: AgentRuntimeConfig = legalAnalystConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createLegalAnalystRuntime(config));
}

/**
 * Run a multi-step legal analysis task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which legal tools to call,
 * executes them through the governed runtime (HITL + scope checks fire on every
 * tool call — Arcade pattern #46: Permission Gate), and returns a synthesized answer.
 *
 * options.runtime    — caller-managed runtime (e.g. in tests)
 * options.onApprovalRequired — HITL callback; throws if omitted and approval is required
 *
 * Deferred (#395): Context Injection — read/write memory namespace around the loop.
 * Deferred (#396): Async Job — polling for long-running legal analyses.
 */
export async function runLegalAnalystTask(
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
	const config = options.config ?? legalAnalystConfig;

	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createLegalAnalystRuntime(config);
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
	if (last === null) throw new Error("executeWithRetry: loop completed without a result");
	return last;
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
		config?: AgentRuntimeConfig;
		apiKey?: string;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		callLLMFn?: (opts: LLMCallOptions) => Promise<string>;
		asyncJobPoller?: AsyncJobPoller;
		pollIntervalMs?: number;
		identity?: SessionIdentity;
	},
): Promise<string> {
	const config = options.config ?? legalAnalystConfig;
	const manifest = runtime.getManifest();
	const callLLMFn = options.callLLMFn ?? callLLM;

	// Context Injection (#395): surface prior findings from this agent's namespace.
	const baseNamespace = config.memory?.namespace ?? "legal-analyst";
	const namespace = options.identity?.userId ? `${options.identity.userId}:${baseNamespace}` : baseNamespace;
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[legal-analyst] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runLegalAnalystTask.',
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

Always use the full tool name (e.g. "legal-analyst.analyze_legal_framework").
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
					`Tool ${parsed.tool} requires human approval. Provide an onApprovalRequired callback to runLegalAnalystTask, or set autonomy to 'autonomous'.`,
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
		console.error('  Example: npx tsx src/agent/index.ts "Analyze legal exposure for Texas exploration project"');
		process.exit(1);
	}
	const answer = await runLegalAnalystTask(goal, {
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
