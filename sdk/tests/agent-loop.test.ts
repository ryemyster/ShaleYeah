import assert from "node:assert";
import {
	type AgentManifest,
	type AgentRuntimeConfig,
	CompensationRegistry,
	ContextStore,
	type LLMCallOptions,
	LocalAgentRuntime,
	RetryableToolError,
	runAgentTask,
	type StandaloneToolHandler,
} from "../src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	try {
		await fn();
		console.log(`  ✓ ${name}`);
		passed++;
	} catch (err) {
		console.log(`  ✗ ${name}`);
		console.log(`    ${err instanceof Error ? err.message : String(err)}`);
		failed++;
	}
}

const manifest: AgentManifest = {
	id: "loop-agent",
	role: "loop-test",
	version: "0.1.0",
	description: "Agent loop test manifest",
	persona: { name: "Loop Agent", role: "Runtime Tester", expertise: ["testing"] },
	capabilities: ["loop"],
	tools: [
		{
			name: "loop-agent.echo",
			description: "Echo a value.",
			type: "query",
			capabilities: ["loop"],
			inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: [],
			modelRequirement: "deterministic",
			provides: ["echo"],
			estimatedLatencyMs: { p50: 100, p95: 300 },
			complexity: "fast",
		},
		{
			name: "loop-agent.needs_approval",
			description: "Approval gated command.",
			type: "command",
			capabilities: ["write"],
			inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
			readOnly: false,
			destructive: false,
			requiresHumanApproval: true,
			requiredScopes: [],
			modelRequirement: "deterministic",
		},
		{
			name: "loop-agent.slow",
			description: "Long-running tool.",
			type: "query",
			capabilities: ["async"],
			inputSchema: { type: "object", properties: {}, required: [] },
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: [],
			modelRequirement: "deterministic",
			mcpServer: "loop",
			timeoutMs: 20_000,
		},
		{
			name: "loop-agent.primary",
			description: "Primary tool with fallback.",
			type: "query",
			capabilities: ["fallback"],
			inputSchema: { type: "object", properties: {}, required: [] },
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: [],
			modelRequirement: "deterministic",
			fallbackTo: "loop-agent.echo",
		},
		{
			name: "loop-agent.save",
			description: "Transactional write.",
			type: "command",
			capabilities: ["write"],
			inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: [],
			modelRequirement: "deterministic",
			transactional: true,
		},
	],
	toolChains: [
		{
			id: "loop-chain",
			description: "Loop test chain",
			steps: ["loop-agent.echo", "loop-agent.save"],
			trigger: "testing chains",
		},
	],
	requiredScopes: [],
	providerRequirements: [],
	compatibility: { agentRuntime: "0.1", remoteEndpoint: "0.1", mcp: "2025-06" },
	health: { readinessChecks: [] },
	memory: { namespace: "loop-agent", reviewRequired: false, sharedMemoryOptIn: false },
	evals: { defaultProfile: "none", requiredChecks: [] },
	autonomy: { defaultLevel: "reviewed", allowedLevels: ["reviewed"] },
};

const config: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": { provider: "test", model: "small" },
		"standard-analysis": { provider: "test", model: "standard" },
		"deep-reasoning": { provider: "test", model: "deep" },
		"local-private": { provider: "test", model: "local" },
		deterministic: { provider: "rule-based", model: "none" },
	},
	hitl: { approvalMode: "when-sensitive", requireForDestructive: true, requireForMemoryPromotion: true },
	evals: {
		enabled: false,
		profile: "none",
		checks: {
			schema: "off",
			domainCompleteness: "off",
			confidenceMinimum: 0,
			requireSources: false,
			redactSecrets: "off",
			memoryPromotion: "disabled",
		},
	},
	memory: {
		enabled: true,
		namespace: "loop-agent",
		vectorStore: { enabled: false },
		retentionDays: 1,
		promotion: { requireHumanReview: false, allowSharedMemory: false },
	},
	mcpServers: { loop: { url: "http://localhost:9999", transport: "http", authType: "none" } },
	dataConnectors: {},
};

function runtimeWith(handlers: Partial<Record<string, StandaloneToolHandler>> = {}): LocalAgentRuntime {
	const baseHandlers = Object.fromEntries(manifest.tools.map((tool) => [tool.name, async () => ({ ok: true })]));
	return new LocalAgentRuntime({
		manifest,
		config,
		handlers: { ...baseHandlers, ...handlers },
		auditLogger: () => {},
	});
}

function sequenceLLM(responses: string[], systems?: string[]): (opts: LLMCallOptions) => Promise<string> {
	let index = 0;
	return async (opts) => {
		if (systems) systems.push(opts.system ?? "");
		return responses[Math.min(index++, responses.length - 1)];
	};
}

console.log("\n🧪 Agent Loop Tests (#479)\n");

await test("successful tool call feeds result back to final synthesis and stores context", async () => {
	ContextStore.clear("loop-agent");
	const runtime = runtimeWith({
		"loop-agent.echo": async ({ args }) => ({ echoed: args.value }),
	});
	await runtime.initialize();

	const result = await runAgentTask("echo", runtime, {
		config,
		callLLM: sequenceLLM([
			JSON.stringify({ action: "tool", tool: "loop-agent.echo", args: { value: "hello" } }),
			JSON.stringify({ action: "done", answer: "echo complete" }),
		]),
	});
	await runtime.shutdown();

	assert.strictEqual(result, "echo complete");
	assert.ok(ContextStore.read("loop-agent").includes("echo complete"), "final answer stored in context");
	ContextStore.clear("loop-agent");
});

await test("system prompt includes prior context, dependency hints, tool chains, and performance hints", async () => {
	ContextStore.clear("loop-agent");
	ContextStore.write("loop-agent", "Prior loop finding.");
	const systems: string[] = [];
	const runtime = runtimeWith();
	await runtime.initialize();

	await runAgentTask("inspect prompt", runtime, {
		config,
		callLLM: sequenceLLM([JSON.stringify({ action: "done", answer: "done" })], systems),
	});
	await runtime.shutdown();

	assert.ok(systems[0].includes("Prior loop finding."), "prior context included");
	assert.ok(systems[0].includes("provides:"), "dependency hints included");
	assert.ok(systems[0].includes("loop-chain"), "tool chain included");
	assert.ok(systems[0].includes("Performance hints"), "performance hints included");
	ContextStore.clear("loop-agent");
});

await test("approval-required flow re-executes with approval callback", async () => {
	let approvedCall = false;
	const runtime = runtimeWith({
		"loop-agent.needs_approval": async () => {
			approvedCall = true;
			return { saved: true };
		},
	});
	await runtime.initialize();

	const result = await runAgentTask("approve", runtime, {
		config,
		callLLM: sequenceLLM([
			JSON.stringify({ action: "tool", tool: "loop-agent.needs_approval", args: { value: "x" } }),
			JSON.stringify({ action: "done", answer: "approved" }),
		]),
		onApprovalRequired: async () => ({ approved: true, reviewerId: "test" }),
	});
	await runtime.shutdown();

	assert.strictEqual(result, "approved");
	assert.ok(approvedCall, "handler called after approval");
});

await test("retryable failures are retried before surfacing to the LLM", async () => {
	let attempts = 0;
	const runtime = runtimeWith({
		"loop-agent.echo": async () => {
			attempts++;
			if (attempts < 3) throw new RetryableToolError("temporary");
			return { ok: true };
		},
	});
	await runtime.initialize();

	const result = await runAgentTask("retry", runtime, {
		config,
		callLLM: sequenceLLM([
			JSON.stringify({ action: "tool", tool: "loop-agent.echo", args: { value: "x" } }),
			JSON.stringify({ action: "done", answer: "retried" }),
		]),
	});
	await runtime.shutdown();

	assert.strictEqual(result, "retried");
	assert.strictEqual(attempts, 3);
});

await test("async job polling replaces pending result with completed job result", async () => {
	let pollCount = 0;
	let capturedPrompt = "";
	const runtime = runtimeWith({
		"loop-agent.slow": async () => ({ jobId: "job-1", status: "pending" }),
	});
	await runtime.initialize();

	await runAgentTask("slow", runtime, {
		config,
		callLLM: async (opts) => {
			capturedPrompt = opts.prompt;
			if (!capturedPrompt.includes("Tool result:")) {
				return JSON.stringify({ action: "tool", tool: "loop-agent.slow", args: {} });
			}
			return JSON.stringify({ action: "done", answer: "async done" });
		},
		asyncJobPoller: async () => {
			pollCount++;
			return pollCount === 1 ? { status: "pending" } : { status: "complete", result: { job: "complete" } };
		},
		pollIntervalMs: 0,
	});
	await runtime.shutdown();

	assert.strictEqual(pollCount, 2);
	assert.ok(capturedPrompt.includes('"job":"complete"'), "completed async result was sent to LLM");
});

await test("async job timeout returns timeout message without another LLM turn", async () => {
	const timeoutManifest: AgentManifest = {
		...manifest,
		tools: manifest.tools.map((tool) => (tool.name === "loop-agent.slow" ? { ...tool, timeoutMs: 10_001 } : tool)),
	};
	const runtime = new LocalAgentRuntime({
		manifest: timeoutManifest,
		config,
		handlers: Object.fromEntries(
			timeoutManifest.tools.map((tool) => [
				tool.name,
				async () => (tool.name === "loop-agent.slow" ? { jobId: "job-timeout", status: "pending" } : { ok: true }),
			]),
		),
		auditLogger: () => {},
	});
	await runtime.initialize();

	let llmCalls = 0;
	const originalNow = Date.now;
	let fakeNow = -20_000;
	Date.now = () => {
		fakeNow += 20_000;
		return fakeNow;
	};
	try {
		const result = await runAgentTask("slow timeout", runtime, {
			config,
			callLLM: async () => {
				llmCalls++;
				return JSON.stringify({ action: "tool", tool: "loop-agent.slow", args: {} });
			},
			asyncJobPoller: async () => ({ status: "pending" }),
			pollIntervalMs: 0,
		});

		assert.ok(result.includes("timed out"), `timeout message returned (got: ${result})`);
		assert.strictEqual(llmCalls, 1, "loop exits immediately on async timeout");
	} finally {
		Date.now = originalNow;
		await runtime.shutdown();
	}
});

await test("fallback tool result is sent to LLM after permanent primary failure", async () => {
	let fallbackCalled = false;
	const runtime = runtimeWith({
		"loop-agent.primary": async () => {
			throw new Error("permanent");
		},
		"loop-agent.echo": async () => {
			fallbackCalled = true;
			return { fallback: true };
		},
	});
	await runtime.initialize();

	const result = await runAgentTask("fallback", runtime, {
		config,
		callLLM: sequenceLLM([
			JSON.stringify({ action: "tool", tool: "loop-agent.primary", args: {} }),
			JSON.stringify({ action: "done", answer: "used fallback" }),
		]),
	});
	await runtime.shutdown();

	assert.ok(fallbackCalled, "fallback handler invoked");
	assert.strictEqual(result, "used fallback");
});

await test("transactional permanent failure runs compensation and lets LLM synthesize rollback", async () => {
	let compensated = false;
	CompensationRegistry.clear();
	CompensationRegistry.register("loop-agent.save", async () => {
		compensated = true;
	});
	const runtime = runtimeWith({
		"loop-agent.save": async () => {
			throw new Error("write failed");
		},
	});
	await runtime.initialize();

	const result = await runAgentTask("save", runtime, {
		config,
		callLLM: sequenceLLM([
			JSON.stringify({ action: "tool", tool: "loop-agent.save", args: { value: "x" } }),
			JSON.stringify({ action: "done", answer: "rollback explained" }),
		]),
	});
	await runtime.shutdown();
	CompensationRegistry.clear();

	assert.ok(compensated, "compensation handler invoked");
	assert.strictEqual(result, "rollback explained");
});

console.log(`\nAgent Loop Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
