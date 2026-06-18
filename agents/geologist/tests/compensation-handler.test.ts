/**
 * Arcade Pattern #27 — Compensation Handler
 *
 * When a transactional tool fails permanently, the CompensationRegistry is consulted.
 * If a handler is registered for that tool, it runs before the rollback message is pushed
 * to LLM history so any partially-written state can be cleaned up. If the handler throws,
 * the error is surfaced to history but does not abort the loop. No handler registered →
 * same rollback message behavior as #26 (Transactional Boundary), unchanged.
 */

import assert from "node:assert";
import type { AgentExecutionRequest, AgentExecutionResult, LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import { CompensationRegistry } from "@shaleyeah/sdk";
import { geologistManifest, runGeologistTask } from "../src/agent/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(() => fn())
		.then(() => {
			console.log(`  ✅ ${name}`);
			passed++;
		})
		.catch((err) => {
			console.error(`  ❌ ${name}`);
			console.error(`     ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

function makeFakeRuntime(
	executeHandler: (req: AgentExecutionRequest) => Promise<AgentExecutionResult>,
): LocalAgentRuntime {
	return {
		initialize: async () => {},
		health: async () => ({ status: "ready", agentId: "geologist", checks: [] }),
		getManifest: () => geologistManifest,
		discover: () => [] as ReturnType<LocalAgentRuntime["discover"]>,
		execute: executeHandler,
		shutdown: async () => {},
	} as unknown as LocalAgentRuntime;
}

function extractToolResults(prompt: string): string[] {
	return prompt
		.split("\n\n")
		.filter((seg) => seg.startsWith("Tool result:"))
		.map((seg) => seg.replace(/^Tool result:\s*/, ""));
}

/** Permanent-failure result for save_finding. */
function saveFindingFailure(toolName: string): AgentExecutionResult {
	return {
		status: "failed",
		error: "Network write error — could not persist finding",
		retryable: false,
		evals: [],
		metadata: {
			agentId: "geologist",
			toolName,
			modelRequirement: "deterministic",
			modelBinding: { provider: "anthropic", model: "test" },
			autonomy: "autonomous",
			timestamp: new Date().toISOString(),
		},
	};
}

/** LLM that calls save_finding once then signals done. */
function makeTransactionalLLM(
	capturedPrompts: string[],
	args = { finding: "test", wellId: "W-001", confidence: 0.9, formation: "Wolfcamp" },
): (opts: LLMCallOptions) => Promise<string> {
	return async (opts) => {
		capturedPrompts.push(opts.prompt ?? "");
		const hasToolResult = (opts.prompt ?? "").includes("Tool result:");
		if (!hasToolResult) {
			return JSON.stringify({ action: "call", tool: "geologist.save_finding", args });
		}
		return JSON.stringify({ action: "done", answer: "acknowledged" });
	};
}

console.log("🧪 Arcade #27: Compensation Handler\n");

// ── Registry unit tests ───────────────────────────────────────────────────────

console.log("📋 CompensationRegistry...");

await test("register and get roundtrip", () => {
	const fn = async () => {};
	CompensationRegistry.register("test.tool", fn);
	assert.strictEqual(CompensationRegistry.get("test.tool"), fn, "get should return the registered fn");
	CompensationRegistry.clear();
});

await test("get returns undefined for unregistered tool", () => {
	assert.strictEqual(
		CompensationRegistry.get("nonexistent.tool"),
		undefined,
		"unregistered tool should return undefined",
	);
});

await test("clear removes all registrations", () => {
	CompensationRegistry.register("a.tool", async () => {});
	CompensationRegistry.register("b.tool", async () => {});
	CompensationRegistry.clear();
	assert.strictEqual(CompensationRegistry.get("a.tool"), undefined);
	assert.strictEqual(CompensationRegistry.get("b.tool"), undefined);
});

// ── Integration: compensation fn called ──────────────────────────────────────

console.log("\n📋 executeLoop — compensation fn invoked on transactional failure...");
{
	const capturedPrompts: string[] = [];
	const capturedArgs: Record<string, unknown>[] = [];
	const saveFindingArgs = { finding: "test", wellId: "W-001", confidence: 0.9, formation: "Wolfcamp" };

	CompensationRegistry.clear();
	CompensationRegistry.register("geologist.save_finding", async (args) => {
		capturedArgs.push(args);
	});

	const fakeRuntime = makeFakeRuntime(async (req) => {
		if (req.toolName === "geologist.save_finding") return saveFindingFailure(req.toolName);
		return {
			status: "completed",
			data: {},
			evals: [],
			metadata: {
				agentId: "geologist",
				toolName: req.toolName,
				modelRequirement: "deterministic",
				modelBinding: { provider: "anthropic", model: "test" },
				autonomy: "autonomous",
				timestamp: new Date().toISOString(),
			},
		} satisfies AgentExecutionResult;
	});

	await runGeologistTask("save this finding", {
		runtime: fakeRuntime,
		callLLM: makeTransactionalLLM(capturedPrompts, saveFindingArgs),
	});

	CompensationRegistry.clear();

	await test("compensation fn is called on transactional failure", () => {
		assert.strictEqual(capturedArgs.length, 1, "compensation fn should be called exactly once");
	});

	await test("compensation fn receives the original tool args", () => {
		const received = capturedArgs[0];
		assert.ok(received, "compensation fn should receive args");
		assert.strictEqual(received.finding, saveFindingArgs.finding);
		assert.strictEqual(received.wellId, saveFindingArgs.wellId);
	});

	await test("rollback message still pushed after compensation succeeds", () => {
		const secondPrompt = capturedPrompts[1] ?? "";
		const toolResults = extractToolResults(secondPrompt);
		const hasRollback = toolResults.some((m) => m.includes("rolled back") || m.includes("Transactional write failed"));
		assert.ok(hasRollback, `Rollback message expected in second LLM call.\nTool results: ${toolResults.join(" | ")}`);
	});
}

// ── Integration: compensation fn throws ──────────────────────────────────────

console.log("\n📋 executeLoop — compensation fn throws...");
{
	const capturedPrompts: string[] = [];

	CompensationRegistry.clear();
	CompensationRegistry.register("geologist.save_finding", async () => {
		throw new Error("delete_finding server unavailable");
	});

	const fakeRuntime = makeFakeRuntime(async (req) => {
		if (req.toolName === "geologist.save_finding") return saveFindingFailure(req.toolName);
		return {
			status: "completed",
			data: {},
			evals: [],
			metadata: {
				agentId: "geologist",
				toolName: req.toolName,
				modelRequirement: "deterministic",
				modelBinding: { provider: "anthropic", model: "test" },
				autonomy: "autonomous",
				timestamp: new Date().toISOString(),
			},
		} satisfies AgentExecutionResult;
	});

	// Should not throw — compensation failure must not crash the loop
	await runGeologistTask("save this finding", {
		runtime: fakeRuntime,
		callLLM: makeTransactionalLLM(capturedPrompts),
	});

	CompensationRegistry.clear();

	await test("compensation failure is surfaced to LLM history", () => {
		const secondPrompt = capturedPrompts[1] ?? "";
		const toolResults = extractToolResults(secondPrompt);
		const hasCompFailure = toolResults.some(
			(m) => m.toLowerCase().includes("compensation") || m.includes("delete_finding server unavailable"),
		);
		assert.ok(hasCompFailure, `Compensation error expected in history.\nTool results: ${toolResults.join(" | ")}`);
	});

	await test("rollback message still pushed after compensation throws", () => {
		const secondPrompt = capturedPrompts[1] ?? "";
		const toolResults = extractToolResults(secondPrompt);
		const hasRollback = toolResults.some((m) => m.includes("rolled back") || m.includes("Transactional write failed"));
		assert.ok(
			hasRollback,
			`Rollback message must still appear even when compensation throws.\nTool results: ${toolResults.join(" | ")}`,
		);
	});

	await test("loop continues after compensation failure (LLM gets a second turn)", () => {
		// If compensation failure crashed the loop, capturedPrompts would only have 1 entry.
		assert.ok(capturedPrompts.length >= 2, `Loop should continue — got ${capturedPrompts.length} LLM calls`);
	});
}

// ── Integration: no compensation registered ──────────────────────────────────

console.log("\n📋 executeLoop — no compensation handler registered...");
{
	const capturedPrompts: string[] = [];

	CompensationRegistry.clear(); // ensure nothing registered

	const fakeRuntime = makeFakeRuntime(async (req) => {
		if (req.toolName === "geologist.save_finding") return saveFindingFailure(req.toolName);
		return {
			status: "completed",
			data: {},
			evals: [],
			metadata: {
				agentId: "geologist",
				toolName: req.toolName,
				modelRequirement: "deterministic",
				modelBinding: { provider: "anthropic", model: "test" },
				autonomy: "autonomous",
				timestamp: new Date().toISOString(),
			},
		} satisfies AgentExecutionResult;
	});

	await runGeologistTask("save this finding", {
		runtime: fakeRuntime,
		callLLM: makeTransactionalLLM(capturedPrompts),
	});

	await test("rollback message still pushed when no compensation registered (regression for #26)", () => {
		const secondPrompt = capturedPrompts[1] ?? "";
		const toolResults = extractToolResults(secondPrompt);
		const hasRollback = toolResults.some((m) => m.includes("rolled back") || m.includes("Transactional write failed"));
		assert.ok(
			hasRollback,
			`Rollback message required even without compensation handler.\nResults: ${toolResults.join(" | ")}`,
		);
	});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
