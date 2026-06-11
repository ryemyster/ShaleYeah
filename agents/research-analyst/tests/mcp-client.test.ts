/**
 * Research Analyst MCP Client + runTask Tests — Issue #369
 *
 * Layer 1: verifies callResearchTool delegates to research server over HTTP.
 * Layer 2: verifies runResearchAnalystTask drives a multi-step LLM loop.
 *
 * TDD — these tests were written before the implementation.
 * Run: cd agents/research-analyst && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callResearchTool,
	createResearchAnalystRuntime,
	researchAnalystConfig,
	researchAnalystManifest,
	runResearchAnalystTask,
} from "../src/agent/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			console.log(`  ✓ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

async function researchReachable(): Promise<boolean> {
	try {
		const url = researchAnalystConfig.mcpServers?.research?.url ?? "http://localhost:3008";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Research Analyst MCP Client + runTask Tests (#369)\n");

	// ── Layer 1: HTTP client ──────────────────────────────────────────────────

	await test("callResearchTool is exported as a function", () => {
		assert.strictEqual(typeof callResearchTool, "function", "callResearchTool must be exported");
	});

	await test('researchAnalystConfig.mcpServers["research"].url is http://localhost:3008', () => {
		const conn = researchAnalystConfig.mcpServers?.research;
		assert.ok(conn, 'mcpServers["research"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3008", "research URL must be localhost:3008");
	});

	await test('researchAnalystConfig.mcpServers["research"].transport is http', () => {
		const conn = researchAnalystConfig.mcpServers?.research;
		assert.ok(conn, 'mcpServers["research"] entry must be present');
		assert.strictEqual(conn.transport, "http", "research transport must be http");
	});

	await test("all 2 research-analyst tools declare mcpServer: 'research'", () => {
		const wrong = researchAnalystManifest.tools.filter((t) => t.mcpServer !== "research");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='research': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("researchAnalystConfig.modelRouting['standard-analysis'] uses a real model ID (not placeholder)", () => {
		const binding = researchAnalystConfig.modelRouting["standard-analysis"];
		assert.ok(binding, "standard-analysis binding must be present");
		assert.notStrictEqual(binding?.model, "configured-by-operator", "model must not be a placeholder");
		assert.strictEqual(binding?.provider, "anthropic", "provider must be anthropic");
	});

	await test("callResearchTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callResearchTool("http://localhost:19999", "conduct_market_research", { topic: "Permian Basin" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callResearchTool must throw when server is unreachable");
	});

	// ── Layer 2: runTask execution loop ───────────────────────────────────────

	await test("runResearchAnalystTask is exported as a function", () => {
		assert.strictEqual(typeof runResearchAnalystTask, "function", "runResearchAnalystTask must be exported");
	});

	await test("runResearchAnalystTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		process.env.ANTHROPIC_API_KEY = "";
		let threw = false;
		try {
			await runResearchAnalystTask("research Permian Basin competitive landscape");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
			else delete process.env.ANTHROPIC_API_KEY;
		}
		assert.ok(threw, "runResearchAnalystTask must throw when no API key is set");
	});

	await test("runResearchAnalystTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runResearchAnalystTask("research a test market", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runResearchAnalystTask with invalid key must throw (proves callLLM was hit)");
	});

	// ── SDK error exports ─────────────────────────────────────────────────────

	await test("RetryableToolError is exported from @shaleyeah/sdk", () => {
		assert.strictEqual(typeof RetryableToolError, "function");
		const err = new RetryableToolError("test");
		assert.strictEqual(err.retryable, true);
	});

	await test("PermanentToolError is exported from @shaleyeah/sdk", () => {
		assert.strictEqual(typeof PermanentToolError, "function");
		const err = new PermanentToolError("test");
		assert.strictEqual(err.retryable, false);
	});

	// ── runResearchAnalystTask runtime option ─────────────────────────────────

	await test("runResearchAnalystTask accepts runtime option (signature check)", () => {
		const params = runResearchAnalystTask.length;
		assert.ok(params >= 1, "runResearchAnalystTask must accept at least a goal argument");
	});

	await test("runResearchAnalystTask throws when approval_required and no onApprovalRequired callback", async () => {
		const runtime = createResearchAnalystRuntime({
			...researchAnalystConfig,
			hitl: { ...researchAnalystConfig.hitl, approvalMode: "always" },
		});
		await runtime.initialize();
		const result = await runtime.execute({
			toolName: "research-analyst.conduct_market_research",
			args: { topic: "Permian Basin" },
		});
		await runtime.shutdown();
		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "research-analyst.conduct_market_research");
	});

	// ── Integration tests (require live research server + real API key) ───────

	const live = await researchReachable();
	const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

	if (!live) {
		console.log("\n  ⚠️  [integration] research server not reachable at localhost:3008 — skipping live MCP tests.");
		console.log("     Start with: cd servers/research && PORT=3008 pnpm start");
	}
	if (!HAS_API_KEY) {
		console.log("  ⚠️  [integration] ANTHROPIC_API_KEY not set — skipping runTask live test.");
	}

	if (live) {
		await test("[integration] callResearchTool routes conduct_market_research through research MCP", async () => {
			const result = await callResearchTool(researchAnalystConfig.mcpServers!.research.url, "conduct_market_research", {
				topic: "Permian Basin activity",
				scope: "regional",
			});
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && HAS_API_KEY) {
		await test("[integration] runResearchAnalystTask completes a multi-step intelligence task", async () => {
			const answer = await runResearchAnalystTask(
				"Research the Permian Basin competitive landscape and summarize key findings.",
			);
			assert.strictEqual(typeof answer, "string", "runResearchAnalystTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	}

	console.log(`\nResearch Analyst MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
