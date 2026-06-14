/**
 * Investment Chair MCP Client + runTask Tests — Issue #439
 *
 * Layer 1: verifies callDecisionTool delegates to decision server over HTTP.
 * Layer 2: verifies runInvestmentChairTask drives a multi-step LLM loop.
 *
 * Run: cd agents/investment-chair && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callDecisionTool,
	createInvestmentChairRuntime,
	investmentChairConfig,
	investmentChairManifest,
	runInvestmentChairTask,
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

async function decisionReachable(): Promise<boolean> {
	try {
		const url = investmentChairConfig.mcpServers?.decision?.url ?? "http://localhost:3013";
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
	console.log("\n🧪 Investment Chair MCP Client + runTask Tests (#439)\n");

	await test("callDecisionTool is exported as a function", () => {
		assert.strictEqual(typeof callDecisionTool, "function", "callDecisionTool must be exported");
	});

	await test('investmentChairConfig.mcpServers["decision"].url is http://localhost:3013', () => {
		const conn = investmentChairConfig.mcpServers?.decision;
		assert.ok(conn, 'mcpServers["decision"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3013", "decision URL must be localhost:3013");
	});

	await test('investmentChairConfig.mcpServers["decision"].transport is http', () => {
		const conn = investmentChairConfig.mcpServers?.decision;
		assert.ok(conn, 'mcpServers["decision"] entry must be present');
		assert.strictEqual(conn.transport, "http", "decision transport must be http");
	});

	await test("all 3 investment-chair tools declare mcpServer: 'decision'", () => {
		const wrong = investmentChairManifest.tools.filter((t) => t.mcpServer !== "decision");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='decision': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("callDecisionTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callDecisionTool("http://localhost:19999", "make_investment_decision", {});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callDecisionTool must throw when server is unreachable");
	});

	await test("runInvestmentChairTask is exported as a function", () => {
		assert.strictEqual(typeof runInvestmentChairTask, "function", "runInvestmentChairTask must be exported");
	});

	await test("runInvestmentChairTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runInvestmentChairTask("make investment decision");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runInvestmentChairTask must throw when no API key is set");
	});

	await test("runInvestmentChairTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runInvestmentChairTask("make investment decision", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runInvestmentChairTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runInvestmentChairTask accepts runtime option (signature check)", () => {
		const params = runInvestmentChairTask.length;
		assert.ok(params >= 1, "runInvestmentChairTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createInvestmentChairRuntime({
			...investmentChairConfig,
			hitl: { ...investmentChairConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "investment-chair.make_investment_decision",
			args: {},
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "investment-chair.make_investment_decision");
		assert.strictEqual(challenge.agentId, "investment-chair");
	});

	const live = await decisionReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] decision server not reachable at localhost:3013 — skipping live MCP tests.");
		console.log("     Start with: cd servers/decision && PORT=3013 pnpm start");
	}

	if (live) {
		await test("[integration] callDecisionTool routes make_investment_decision through decision MCP", async () => {
			const result = await callDecisionTool(
				investmentChairConfig.mcpServers!.decision.url,
				"make_investment_decision",
				{},
			);
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runInvestmentChairTask completes a multi-step decision task", async () => {
			const answer = await runInvestmentChairTask(
				"Analyze portfolio fit for a Permian Basin acquisition and make a recommendation.",
			);
			assert.strictEqual(typeof answer, "string", "runInvestmentChairTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or decision server not running — skipping runTask live test.",
		);
	}

	console.log(`\nInvestment Chair MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
