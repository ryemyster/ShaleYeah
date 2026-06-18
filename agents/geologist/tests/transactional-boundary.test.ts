/**
 * Arcade Pattern #26 — Transactional Boundary
 *
 * When a transactional tool (save_finding) fails permanently, executeLoop must
 * surface "rolled back — do not retry" instead of a generic error. Non-transactional
 * tool failures must still return the original error message.
 */

import assert from "node:assert";
import type { AgentExecutionRequest, AgentExecutionResult, LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
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

/** Build a minimal fake runtime that satisfies what executeLoop needs. */
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

/** Extract "Tool result: ..." lines from the prompt string built by buildTranscript(). */
function extractToolResults(prompt: string): string[] {
	return prompt
		.split("\n\n")
		.filter((seg) => seg.startsWith("Tool result:"))
		.map((seg) => seg.replace(/^Tool result:\s*/, ""));
}

console.log("🧪 Arcade #26: Transactional Boundary\n");

console.log("📋 Manifest...");

await test("save_finding has transactional: true", () => {
	const tool = geologistManifest.tools.find((t) => t.name === "geologist.save_finding");
	assert.ok(tool, "save_finding tool must exist in manifest");
	assert.strictEqual(tool?.transactional, true, "save_finding must be marked transactional");
});

await test("read-only tools do not have transactional flag", () => {
	const readOnlyTools = geologistManifest.tools.filter((t) => t.readOnly);
	const wronglyFlagged = readOnlyTools.filter((t) => t.transactional === true);
	assert.strictEqual(
		wronglyFlagged.length,
		0,
		`Read-only tools should not be transactional: ${wronglyFlagged.map((t) => t.name).join(", ")}`,
	);
});

console.log("\n📋 executeLoop — transactional failure...");
{
	// LLM calls save_finding → fails permanently → executeLoop must push "rolled back" message.
	const capturedPrompts: string[] = [];

	const fakeLLM = async (opts: LLMCallOptions): Promise<string> => {
		capturedPrompts.push(opts.prompt ?? "");
		// On the first call there are no tool results yet; direct the LLM to call save_finding.
		const hasToolResult = (opts.prompt ?? "").includes("Tool result:");
		if (!hasToolResult) {
			return JSON.stringify({
				action: "call",
				tool: "geologist.save_finding",
				args: { finding: "test", wellId: "W-001", confidence: 0.9, formation: "Wolfcamp" },
			});
		}
		return JSON.stringify({ action: "done", answer: "acknowledged" });
	};

	const fakeRuntime = makeFakeRuntime(async (req) => {
		if (req.toolName === "geologist.save_finding") {
			return {
				status: "failed",
				error: "Network write error — could not persist finding",
				retryable: false,
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
		}
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

	await runGeologistTask("save this finding", { runtime: fakeRuntime, callLLM: fakeLLM });

	// The rolled-back message should appear in the SECOND LLM call's prompt (as "Tool result: ...")
	const secondPrompt = capturedPrompts[1] ?? "";
	const toolResults = extractToolResults(secondPrompt);

	await test("transactional failure pushes rolled-back message to history", () => {
		const rolledBack = toolResults.some(
			(msg) => msg.includes("rolled back") || msg.includes("Transactional write failed"),
		);
		assert.ok(
			rolledBack,
			`Expected rolled-back message in second LLM call.\nTool results: ${toolResults.join(" | ")}\nFull prompt[1]: ${secondPrompt.slice(0, 400)}`,
		);
	});

	await test("rolled-back message includes the tool name", () => {
		const msg = toolResults.find((m) => m.includes("rolled back") || m.includes("Transactional"));
		assert.ok(msg?.includes("save_finding"), `Expected tool name in message.\nGot: ${msg}`);
	});

	await test("rolled-back message does not say 'retryable'", () => {
		const msg = toolResults.find((m) => m.includes("rolled back") || m.includes("Transactional"));
		assert.ok(!msg?.includes("retryable"), `Message should not mention retryable.\nGot: ${msg}`);
	});
}

console.log("\n📋 executeLoop — non-transactional failure...");
{
	// Non-transactional permanent failure must not get a "rolled back" message.
	const capturedPrompts: string[] = [];

	const fakeLLM = async (opts: LLMCallOptions): Promise<string> => {
		capturedPrompts.push(opts.prompt ?? "");
		const hasToolResult = (opts.prompt ?? "").includes("Tool result:");
		if (!hasToolResult) {
			return JSON.stringify({
				action: "call",
				tool: "geologist.analyze_formation",
				args: { formation: "Wolfcamp", depth: 8000, porosity: 0.12, permeability: 0.5 },
			});
		}
		return JSON.stringify({ action: "done", answer: "acknowledged" });
	};

	const fakeRuntime = makeFakeRuntime(async (req) => {
		if (req.toolName === "geologist.analyze_formation") {
			return {
				status: "failed",
				error: "Geowiz server unavailable",
				retryable: false,
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
		}
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

	// Non-transactional permanent failure exits the loop (returns error string), no second LLM call
	await runGeologistTask("analyze formation", { runtime: fakeRuntime, callLLM: fakeLLM });

	await test("non-transactional failure does not push rolled-back message", () => {
		// The loop exits immediately on permanent non-transactional failure — only one LLM call
		const allToolResults = capturedPrompts.flatMap(extractToolResults);
		const rolledBack = allToolResults.some((m) => m.includes("rolled back") || m.includes("Transactional"));
		assert.ok(
			!rolledBack,
			`Non-transactional failure should not produce a rolled-back message.\nGot: ${allToolResults.join(" | ")}`,
		);
	});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
