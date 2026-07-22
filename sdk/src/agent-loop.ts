import { ASYNC_POLL_INTERVAL_MS, ASYNC_THRESHOLD_MS, type AsyncJobPoller, defaultAsyncJobPoller } from "./async-job.js";
import { CompensationRegistry } from "./compensation.js";
import { ContextStore } from "./context-store.js";
import type { AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge, SessionIdentity } from "./contracts.js";
import { callLLM, type LLMCallOptions } from "./llm-client.js";
import type { LocalAgentRuntime } from "./runtime.js";

export interface AgentTaskLoopOptions {
	config: AgentRuntimeConfig;
	apiKey?: string;
	onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
	callLLM?: (opts: LLMCallOptions) => Promise<string>;
	asyncJobPoller?: AsyncJobPoller;
	pollIntervalMs?: number;
	identity?: SessionIdentity;
	maxSteps?: number;
	taskLabel?: string;
}

type Turn = { role: "user" | "assistant" | "tool"; content: string };
type ParsedAgentResponse = { action?: string; tool?: string; args?: Record<string, unknown>; answer?: string };

const MAX_TOOL_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export async function runAgentTask(
	goal: string,
	runtime: LocalAgentRuntime,
	options: AgentTaskLoopOptions,
): Promise<string> {
	const config = options.config;
	const callLLMFn = options.callLLM ?? callLLM;
	const manifest = runtime.getManifest();
	const taskLabel = options.taskLabel ?? manifest.id;

	const baseNamespace = config.memory?.namespace ?? manifest.memory.namespace;
	const namespace = options.identity?.userId ? `${options.identity.userId}:${baseNamespace}` : baseNamespace;
	const priorContext = ContextStore.read(namespace);

	const standardAnalysisBinding = config.modelRouting["standard-analysis"];
	if (!standardAnalysisBinding) {
		throw new Error(
			`[${taskLabel}] modelRouting is missing a "standard-analysis" entry. ` +
				'Configure AgentRuntimeConfig.modelRouting["standard-analysis"] before calling runAgentTask.',
		);
	}
	const reasoningModel = standardAnalysisBinding.model;

	const system = buildSystemPrompt(manifest, priorContext);
	const history: Turn[] = [{ role: "user", content: goal }];
	const maxSteps = options.maxSteps ?? 8;

	for (let step = 0; step < maxSteps; step++) {
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
			const asyncResult = await handlePossibleAsyncJob(execResult.data, parsed.tool, manifest, config, options);
			if (asyncResult.done) return asyncResult.message;
			history.push({ role: "tool", content: JSON.stringify(asyncResult.data) });
		} else if (execResult.status === "approval_required") {
			if (!options.onApprovalRequired) {
				throw new Error(
					`Tool ${parsed.tool} requires human approval. ` +
						"Provide an onApprovalRequired callback to runAgentTask, or set autonomy to 'autonomous'.",
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
			if (!execResult.retryable) {
				const recovered = await handlePermanentFailure(
					parsed.tool,
					parsed.args ?? {},
					runtime,
					history,
					manifest,
					options,
				);
				if (recovered === "continue") continue;
				return recovered ?? execResult.error ?? `Permanent failure calling ${parsed.tool}`;
			}
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

export function buildAgentTranscript(history: Turn[]): string {
	return buildTranscript(history);
}

export function parseAgentJsonResponse(text: string): ParsedAgentResponse | null {
	return parseJson(text);
}

function buildSystemPrompt(manifest: ReturnType<LocalAgentRuntime["getManifest"]>, priorContext: string): string {
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

	return `You are ${manifest.persona.name}, ${manifest.persona.role}.
${priorContextSection}
Available tools:
${toolDefs}${depSection}${toolChainsSection}${perfSection}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "geologist.analyze_formation").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.
If a tool result includes a viewUrl field, include it in your answer as a clickable link (e.g. "View in Dashboard: <viewUrl>") for the user.`;
}

function buildTranscript(history: Turn[]): string {
	return history
		.map((t) => {
			if (t.role === "user") return `User: ${t.content}`;
			if (t.role === "assistant") return `Assistant: ${t.content}`;
			return `Tool result: ${t.content}`;
		})
		.join("\n\n");
}

function parseJson(text: string): ParsedAgentResponse | null {
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

async function handlePossibleAsyncJob(
	data: unknown,
	toolName: string,
	manifest: ReturnType<LocalAgentRuntime["getManifest"]>,
	config: AgentRuntimeConfig,
	options: AgentTaskLoopOptions,
): Promise<{ done: false; data: unknown } | { done: true; message: string }> {
	const toolManifest = manifest.tools.find((t) => t.name === toolName);
	if (
		!toolManifest?.timeoutMs ||
		toolManifest.timeoutMs <= ASYNC_THRESHOLD_MS ||
		data === null ||
		typeof data !== "object" ||
		typeof (data as Record<string, unknown>).jobId !== "string" ||
		(data as Record<string, unknown>).status !== "pending"
	) {
		return { done: false, data };
	}

	const serverKey = toolManifest.mcpServer;
	const serverUrl = serverKey ? (config.mcpServers?.[serverKey]?.url ?? "") : "";
	const poller = options.asyncJobPoller ?? defaultAsyncJobPoller;
	const pollMs = options.pollIntervalMs ?? ASYNC_POLL_INTERVAL_MS;
	const deadline = Date.now() + toolManifest.timeoutMs;
	let pollResult = await poller((data as Record<string, unknown>).jobId as string, serverUrl);
	while (pollResult.status === "pending" && Date.now() < deadline) {
		if (pollMs > 0) await new Promise((r) => setTimeout(r, pollMs));
		pollResult = await poller((data as Record<string, unknown>).jobId as string, serverUrl);
	}
	if (pollResult.status === "complete") return { done: false, data: pollResult.result };
	const msg =
		pollResult.status === "pending"
			? `Async job ${(data as Record<string, unknown>).jobId} timed out after ${toolManifest.timeoutMs}ms`
			: `Async job ${(data as Record<string, unknown>).jobId} failed: ${pollResult.error}`;
	return { done: true, message: msg };
}

async function handlePermanentFailure(
	toolName: string,
	args: Record<string, unknown>,
	runtime: LocalAgentRuntime,
	history: Turn[],
	manifest: ReturnType<LocalAgentRuntime["getManifest"]>,
	options: AgentTaskLoopOptions,
): Promise<"continue" | string | null> {
	const toolManifest = manifest.tools.find((t) => t.name === toolName);
	if (toolManifest?.fallbackTo) {
		const fallbackResult = await executeWithRetry(runtime, {
			toolName: toolManifest.fallbackTo,
			args,
			runId: "task:fallback",
			identity: options.identity,
		});
		if (fallbackResult.status === "completed") {
			history.push({
				role: "tool",
				content: JSON.stringify({
					...((fallbackResult.data as Record<string, unknown> | null) ?? {}),
					usedFallback: true,
					primaryTool: toolName,
				}),
			});
			return "continue";
		}
	}

	if (toolManifest?.transactional) {
		const compensate = CompensationRegistry.get(toolName);
		if (compensate) {
			try {
				await compensate(args);
			} catch (e) {
				history.push({
					role: "tool",
					content: `Compensation for ${toolName} failed: ${e instanceof Error ? e.message : String(e)}. Manual cleanup may be required.`,
				});
			}
		}
		history.push({
			role: "tool",
			content: `Transactional write failed for ${toolName}. All changes rolled back. Do not retry — ask the user whether to re-attempt or discard.`,
		});
		return "continue";
	}

	return null;
}
