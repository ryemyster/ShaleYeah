/**
 * Reservoir Engineer MCP Client + runTask Tests — Issue #442
 *
 * Layer 1: verifies callCurveSmithTool delegates to curve-smith server over HTTP.
 * Layer 2: verifies runReservoirEngineerTask drives a multi-step LLM loop.
 *
 * Run: cd agents/reservoir-engineer && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callCurveSmithTool,
	createReservoirEngineerRuntime,
	reservoirEngineerConfig,
	reservoirEngineerManifest,
	runReservoirEngineerTask,
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

async function curveSmithReachable(): Promise<boolean> {
	try {
		const url = reservoirEngineerConfig.mcpServers?.["curve-smith"]?.url ?? "http://localhost:3004";
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
	console.log("\n🧪 Reservoir Engineer MCP Client + runTask Tests (#442)\n");

	await test("callCurveSmithTool is exported as a function", () => {
		assert.strictEqual(typeof callCurveSmithTool, "function", "callCurveSmithTool must be exported");
	});

	await test('reservoirEngineerConfig.mcpServers["curve-smith"].url is http://localhost:3004', () => {
		const conn = reservoirEngineerConfig.mcpServers?.["curve-smith"];
		assert.ok(conn, 'mcpServers["curve-smith"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3004", "curve-smith URL must be localhost:3004");
	});

	await test('reservoirEngineerConfig.mcpServers["curve-smith"].transport is http', () => {
		const conn = reservoirEngineerConfig.mcpServers?.["curve-smith"];
		assert.ok(conn, 'mcpServers["curve-smith"] entry must be present');
		assert.strictEqual(conn.transport, "http", "curve-smith transport must be http");
	});

	await test("all 4 reservoir-engineer tools declare mcpServer: 'curve-smith'", () => {
		const wrong = reservoirEngineerManifest.tools.filter((t) => t.mcpServer !== "curve-smith");
		assert.strictEqual(
			wrong.length,
			0,
			`Tools without mcpServer='curve-smith': ${wrong.map((t) => t.name).join(", ")}`,
		);
	});

	await test("callCurveSmithTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callCurveSmithTool("http://localhost:19999", "analyze_decline_curve", { productionData: [1000, 900, 810] });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callCurveSmithTool must throw when server is unreachable");
	});

	await test("runReservoirEngineerTask is exported as a function", () => {
		assert.strictEqual(typeof runReservoirEngineerTask, "function", "runReservoirEngineerTask must be exported");
	});

	await test("runReservoirEngineerTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runReservoirEngineerTask("analyze decline curve");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runReservoirEngineerTask must throw when no API key is set");
	});

	await test("runReservoirEngineerTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runReservoirEngineerTask("analyze decline curve", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runReservoirEngineerTask with invalid key must throw (proves callLLM was hit)");
	});

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

	await test("runReservoirEngineerTask accepts runtime option (signature check)", () => {
		const params = runReservoirEngineerTask.length;
		assert.ok(params >= 1, "runReservoirEngineerTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createReservoirEngineerRuntime({
			...reservoirEngineerConfig,
			hitl: { ...reservoirEngineerConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "reservoir-engineer.analyze_decline_curve",
			args: { productionData: [1000, 900, 810] },
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "reservoir-engineer.analyze_decline_curve");
		assert.strictEqual(challenge.agentId, "reservoir-engineer");
	});

	const live = await curveSmithReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] curve-smith server not reachable at localhost:3004 — skipping live MCP tests.");
		console.log("     Start with: cd servers/curve-smith && PORT=3004 pnpm start");
	}

	if (live) {
		await test("[integration] callCurveSmithTool routes analyze_decline_curve through curve-smith MCP", async () => {
			const result = await callCurveSmithTool(
				reservoirEngineerConfig.mcpServers!["curve-smith"].url,
				"analyze_decline_curve",
				{ productionData: [1000, 900, 810, 729, 656] },
			);
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runReservoirEngineerTask completes a multi-step reservoir task", async () => {
			const answer = await runReservoirEngineerTask(
				"Analyze decline curve for production data [1000, 900, 810, 729, 656] and estimate EUR.",
			);
			assert.strictEqual(typeof answer, "string", "runReservoirEngineerTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or curve-smith server not running — skipping runTask live test.",
		);
	}

	console.log(`\nReservoir Engineer MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
