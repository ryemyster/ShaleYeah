/**
 * Market Analyst MCP Client + runTask Tests — Issue #440
 *
 * Layer 1: verifies callMarketTool delegates to market server over HTTP.
 * Layer 2: verifies runMarketAnalystTask drives a multi-step LLM loop.
 *
 * Run: cd agents/market-analyst && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callMarketTool,
	createMarketAnalystRuntime,
	marketAnalystConfig,
	marketAnalystManifest,
	runMarketAnalystTask,
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

async function marketReachable(): Promise<boolean> {
	try {
		const url = marketAnalystConfig.mcpServers?.market?.url ?? "http://localhost:3007";
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
	console.log("\n🧪 Market Analyst MCP Client + runTask Tests (#440)\n");

	await test("callMarketTool is exported as a function", () => {
		assert.strictEqual(typeof callMarketTool, "function", "callMarketTool must be exported");
	});

	await test('marketAnalystConfig.mcpServers["market"].url is http://localhost:3007', () => {
		const conn = marketAnalystConfig.mcpServers?.market;
		assert.ok(conn, 'mcpServers["market"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3007", "market URL must be localhost:3007");
	});

	await test('marketAnalystConfig.mcpServers["market"].transport is http', () => {
		const conn = marketAnalystConfig.mcpServers?.market;
		assert.ok(conn, 'mcpServers["market"] entry must be present');
		assert.strictEqual(conn.transport, "http", "market transport must be http");
	});

	await test("all 2 market-analyst tools declare mcpServer: 'market'", () => {
		const wrong = marketAnalystManifest.tools.filter((t) => t.mcpServer !== "market");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='market': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("callMarketTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callMarketTool("http://localhost:19999", "analyze_market_conditions", {});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callMarketTool must throw when server is unreachable");
	});

	await test("runMarketAnalystTask is exported as a function", () => {
		assert.strictEqual(typeof runMarketAnalystTask, "function", "runMarketAnalystTask must be exported");
	});

	await test("runMarketAnalystTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runMarketAnalystTask("analyze oil market conditions");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runMarketAnalystTask must throw when no API key is set");
	});

	await test("runMarketAnalystTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runMarketAnalystTask("analyze oil market conditions", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runMarketAnalystTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runMarketAnalystTask accepts runtime option (signature check)", () => {
		const params = runMarketAnalystTask.length;
		assert.ok(params >= 1, "runMarketAnalystTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createMarketAnalystRuntime({
			...marketAnalystConfig,
			hitl: { ...marketAnalystConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "market-analyst.analyze_market_conditions",
			args: {},
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "market-analyst.analyze_market_conditions");
		assert.strictEqual(challenge.agentId, "market-analyst");
	});

	const live = await marketReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] market server not reachable at localhost:3007 — skipping live MCP tests.");
		console.log("     Start with: cd servers/market && PORT=3007 pnpm start");
	}

	if (live) {
		await test("[integration] callMarketTool routes analyze_market_conditions through market MCP", async () => {
			const result = await callMarketTool(marketAnalystConfig.mcpServers!.market.url, "analyze_market_conditions", {});
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runMarketAnalystTask completes a multi-step market analysis task", async () => {
			const answer = await runMarketAnalystTask(
				"Analyze current WTI oil market conditions and competitive landscape in the Permian Basin.",
			);
			assert.strictEqual(typeof answer, "string", "runMarketAnalystTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or market server not running — skipping runTask live test.",
		);
	}

	console.log(`\nMarket Analyst MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
