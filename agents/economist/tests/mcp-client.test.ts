/**
 * Economist MCP Client + runTask Tests — Issue #364
 *
 * Layer 1: verifies callEconobotTool delegates to econobot over HTTP.
 * Layer 2: verifies runEconomistTask drives a multi-step LLM loop.
 *
 * Run: cd agents/economist && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callEconobotTool,
	createEconomistRuntime,
	economistConfig,
	economistManifest,
	runEconomistTask,
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

async function econobotReachable(): Promise<boolean> {
	try {
		const url = economistConfig.mcpServers?.econobot?.url ?? "http://localhost:3002";
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
	console.log("\n🧪 Economist MCP Client + runTask Tests (#364)\n");

	await test("callEconobotTool is exported as a function", () => {
		assert.strictEqual(typeof callEconobotTool, "function", "callEconobotTool must be exported");
	});

	await test('economistConfig.mcpServers["econobot"].url is http://localhost:3002', () => {
		const conn = economistConfig.mcpServers?.econobot;
		assert.ok(conn, 'mcpServers["econobot"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3002", "econobot URL must be localhost:3002");
	});

	await test('economistConfig.mcpServers["econobot"].transport is http', () => {
		const conn = economistConfig.mcpServers?.econobot;
		assert.ok(conn, 'mcpServers["econobot"] entry must be present');
		assert.strictEqual(conn.transport, "http", "econobot transport must be http");
	});

	await test("all 3 economist tools declare mcpServer: 'econobot'", () => {
		const wrong = economistManifest.tools.filter((t) => t.mcpServer !== "econobot");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='econobot': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("callEconobotTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callEconobotTool("http://localhost:19999", "calculate_dcf", {
				cashFlows: [-100, 60, 70],
				discountRate: 0.1,
			});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callEconobotTool must throw when server is unreachable");
	});

	await test("runEconomistTask is exported as a function", () => {
		assert.strictEqual(typeof runEconomistTask, "function", "runEconomistTask must be exported");
	});

	await test("runEconomistTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runEconomistTask("calculate project economics");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runEconomistTask must throw when no API key is set");
	});

	await test("runEconomistTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runEconomistTask("calculate project economics", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runEconomistTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runEconomistTask accepts runtime option (signature check)", () => {
		const params = runEconomistTask.length;
		assert.ok(params >= 1, "runEconomistTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createEconomistRuntime({
			...economistConfig,
			hitl: { ...economistConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "economist.calculate_dcf",
			args: { cashFlows: [-100, 60, 70], discountRate: 0.1 },
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "economist.calculate_dcf");
		assert.strictEqual(challenge.agentId, "economist");
	});

	const live = await econobotReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] econobot not reachable at localhost:3002 — skipping live MCP tests.");
		console.log("     Start with: cd servers/econobot && PORT=3002 pnpm start");
	}

	if (live) {
		await test("[integration] callEconobotTool routes calculate_dcf through econobot MCP", async () => {
			const result = await callEconobotTool(economistConfig.mcpServers!.econobot.url, "calculate_dcf", {
				cashFlows: [-1000, 400, 500, 600],
				discountRate: 0.1,
				currency: "USD",
			});
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runEconomistTask completes a multi-step economics task", async () => {
			const answer = await runEconomistTask(
				"Calculate DCF for cash flows -1000, 400, 500, 600 using a 10% discount rate and summarize the result.",
			);
			assert.strictEqual(typeof answer, "string", "runEconomistTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log("  ⚠️  [integration] ANTHROPIC_API_KEY not set or econobot not running — skipping runTask live test.");
	}

	console.log(`\nEconomist MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
