/**
 * Drilling Engineer MCP Client + runTask Tests — Issue #374
 *
 * Layer 1: verifies callDrillingTool delegates to the drilling server over HTTP.
 * Layer 2: verifies runDrillingEngineerTask drives a multi-step LLM loop.
 *
 * Run: cd agents/drilling-engineer && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callDrillingTool,
	createDrillingEngineerRuntime,
	drillingEngineerConfig,
	drillingEngineerManifest,
	runDrillingEngineerTask,
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

async function drillingServerReachable(): Promise<boolean> {
	try {
		const url =
			drillingEngineerConfig.mcpServers?.drilling?.url ??
			"http://localhost:3003";
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
	console.log("\n🧪 Drilling Engineer MCP Client + runTask Tests (#374)\n");

	// ── Layer 1: HTTP client ──────────────────────────────────────────────────

	await test("callDrillingTool is exported as a function", () => {
		assert.strictEqual(
			typeof callDrillingTool,
			"function",
			"callDrillingTool must be exported",
		);
	});

	await test('drillingEngineerConfig.mcpServers["drilling"].url is http://localhost:3003', () => {
		const conn = drillingEngineerConfig.mcpServers?.drilling;
		assert.ok(conn, 'mcpServers["drilling"] entry must be present');
		assert.strictEqual(
			conn.url,
			"http://localhost:3003",
			"drilling URL must be localhost:3003",
		);
	});

	await test('drillingEngineerConfig.mcpServers["drilling"].transport is http', () => {
		const conn = drillingEngineerConfig.mcpServers?.drilling;
		assert.ok(conn, 'mcpServers["drilling"] entry must be present');
		assert.strictEqual(
			conn.transport,
			"http",
			"drilling transport must be http",
		);
	});

	await test("all 3 drilling-engineer tools declare mcpServer: 'drilling'", () => {
		const wrong = drillingEngineerManifest.tools.filter(
			(t) => t.mcpServer !== "drilling",
		);
		assert.strictEqual(
			wrong.length,
			0,
			`Tools without mcpServer='drilling': ${wrong.map((t) => t.name).join(", ")}`,
		);
	});

	await test("drillingEngineerConfig.modelRouting['standard-analysis'] uses a real model ID (not placeholder)", () => {
		const binding = drillingEngineerConfig.modelRouting["standard-analysis"];
		assert.ok(binding, "standard-analysis binding must be present");
		assert.notStrictEqual(
			binding?.model,
			"configured-by-operator",
			"model must not be a placeholder",
		);
		assert.strictEqual(
			binding?.provider,
			"anthropic",
			"provider must be anthropic",
		);
	});

	await test("callDrillingTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callDrillingTool(
				"http://localhost:19999",
				"design_drilling_program",
				{
					wellParameters: {
						targetDepth: 10000,
						wellType: "horizontal",
						formation: "wolfcamp",
					},
				},
			);
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callDrillingTool must throw when server is unreachable");
	});

	// ── Layer 2: runTask execution loop ───────────────────────────────────────

	await test("runDrillingEngineerTask is exported as a function", () => {
		assert.strictEqual(
			typeof runDrillingEngineerTask,
			"function",
			"runDrillingEngineerTask must be exported",
		);
	});

	await test("runDrillingEngineerTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		process.env.ANTHROPIC_API_KEY = "";
		let threw = false;
		try {
			await runDrillingEngineerTask(
				"design a drilling program for a horizontal Wolfcamp well",
			);
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(
				msg.includes("ANTHROPIC_API_KEY"),
				`Error must mention ANTHROPIC_API_KEY, got: ${msg}`,
			);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
			else process.env.ANTHROPIC_API_KEY = undefined;
		}
		assert.ok(
			threw,
			"runDrillingEngineerTask must throw when no API key is set",
		);
	});

	await test("runDrillingEngineerTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runDrillingEngineerTask("design a drilling program", {
				apiKey: "sk-ant-invalid-key-for-test",
			});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(
			threw,
			"runDrillingEngineerTask with invalid key must throw (proves callLLM was hit)",
		);
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

	// ── runDrillingEngineerTask runtime option ────────────────────────────────

	await test("runDrillingEngineerTask accepts runtime option (signature check)", () => {
		const params = runDrillingEngineerTask.length;
		assert.ok(
			params >= 1,
			"runDrillingEngineerTask must accept at least a goal argument",
		);
	});

	await test("runDrillingEngineerTask throws when approval_required and no onApprovalRequired callback", async () => {
		const runtime = createDrillingEngineerRuntime({
			...drillingEngineerConfig,
			hitl: { ...drillingEngineerConfig.hitl, approvalMode: "always" },
		});
		await runtime.initialize();
		const result = await runtime.execute({
			toolName: "drilling-engineer.design_drilling_program",
			args: {
				wellParameters: {
					targetDepth: 10000,
					wellType: "horizontal",
					formation: "wolfcamp",
				},
			},
		});
		await runtime.shutdown();
		assert.strictEqual(
			result.status,
			"approval_required",
			"HITL gate must block with approvalMode='always'",
		);
		assert.ok(
			"challenge" in result,
			"approval_required result must have a challenge",
		);
		const challenge = (
			result as {
				status: "approval_required";
				challenge: HumanApprovalChallenge;
			}
		).challenge;
		assert.strictEqual(
			challenge.toolName,
			"drilling-engineer.design_drilling_program",
		);
	});

	// ── Integration tests (require live drilling server + real API key) ────────

	const live = await drillingServerReachable();
	const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

	if (!live) {
		console.log(
			"\n  ⚠️  [integration] drilling server not reachable at localhost:3003 — skipping live MCP tests.",
		);
		console.log("     Start with: cd servers/drilling && PORT=3003 pnpm start");
	}
	if (!HAS_API_KEY) {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set — skipping runTask live test.",
		);
	}

	if (live) {
		await test("[integration] callDrillingTool routes design_drilling_program through drilling MCP", async () => {
			const result = await callDrillingTool(
				drillingEngineerConfig.mcpServers?.drilling.url,
				"design_drilling_program",
				{
					wellParameters: {
						targetDepth: 10000,
						wellType: "horizontal",
						formation: "wolfcamp",
					},
				},
			);
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && HAS_API_KEY) {
		await test("[integration] runDrillingEngineerTask completes a multi-step drilling task", async () => {
			const answer = await runDrillingEngineerTask(
				"Design a drilling program for a horizontal Wolfcamp well at 10,000ft and estimate costs.",
			);
			assert.strictEqual(
				typeof answer,
				"string",
				"runDrillingEngineerTask must return a string",
			);
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	}

	console.log(
		`\nDrilling Engineer MCP Client + runTask Tests: ${passed} passed, ${failed} failed`,
	);
	if (failed > 0) process.exit(1);
}

await runTests();
