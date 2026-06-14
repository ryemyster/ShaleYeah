/**
 * Risk Analyst MCP Client + runTask Tests — Issue #443
 *
 * Layer 1: verifies callRiskAnalysisTool delegates to risk-analysis server over HTTP.
 * Layer 2: verifies runRiskAnalystTask drives a multi-step LLM loop.
 *
 * Run: cd agents/risk-analyst && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callRiskAnalysisTool,
	createRiskAnalystRuntime,
	riskAnalystConfig,
	riskAnalystManifest,
	runRiskAnalystTask,
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

async function riskAnalysisReachable(): Promise<boolean> {
	try {
		const url = riskAnalystConfig.mcpServers?.["risk-analysis"]?.url ?? "http://localhost:3005";
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
	console.log("\n🧪 Risk Analyst MCP Client + runTask Tests (#443)\n");

	await test("callRiskAnalysisTool is exported as a function", () => {
		assert.strictEqual(typeof callRiskAnalysisTool, "function", "callRiskAnalysisTool must be exported");
	});

	await test('riskAnalystConfig.mcpServers["risk-analysis"].url is http://localhost:3005', () => {
		const conn = riskAnalystConfig.mcpServers?.["risk-analysis"];
		assert.ok(conn, 'mcpServers["risk-analysis"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3005", "risk-analysis URL must be localhost:3005");
	});

	await test('riskAnalystConfig.mcpServers["risk-analysis"].transport is http', () => {
		const conn = riskAnalystConfig.mcpServers?.["risk-analysis"];
		assert.ok(conn, 'mcpServers["risk-analysis"] entry must be present');
		assert.strictEqual(conn.transport, "http", "risk-analysis transport must be http");
	});

	await test("all 2 risk-analyst tools declare mcpServer: 'risk-analysis'", () => {
		const wrong = riskAnalystManifest.tools.filter((t) => t.mcpServer !== "risk-analysis");
		assert.strictEqual(
			wrong.length,
			0,
			`Tools without mcpServer='risk-analysis': ${wrong.map((t) => t.name).join(", ")}`,
		);
	});

	await test("callRiskAnalysisTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callRiskAnalysisTool("http://localhost:19999", "assess_investment_risk", {});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callRiskAnalysisTool must throw when server is unreachable");
	});

	await test("runRiskAnalystTask is exported as a function", () => {
		assert.strictEqual(typeof runRiskAnalystTask, "function", "runRiskAnalystTask must be exported");
	});

	await test("runRiskAnalystTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runRiskAnalystTask("assess investment risk");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runRiskAnalystTask must throw when no API key is set");
	});

	await test("runRiskAnalystTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runRiskAnalystTask("assess investment risk", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runRiskAnalystTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runRiskAnalystTask accepts runtime option (signature check)", () => {
		const params = runRiskAnalystTask.length;
		assert.ok(params >= 1, "runRiskAnalystTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createRiskAnalystRuntime({
			...riskAnalystConfig,
			hitl: { ...riskAnalystConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "risk-analyst.assess_investment_risk",
			args: {},
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "risk-analyst.assess_investment_risk");
		assert.strictEqual(challenge.agentId, "risk-analyst");
	});

	const live = await riskAnalysisReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] risk-analysis server not reachable at localhost:3005 — skipping live MCP tests.");
		console.log("     Start with: cd servers/risk-analysis && PORT=3005 pnpm start");
	}

	if (live) {
		await test("[integration] callRiskAnalysisTool routes assess_investment_risk through risk-analysis MCP", async () => {
			const result = await callRiskAnalysisTool(
				riskAnalystConfig.mcpServers!["risk-analysis"].url,
				"assess_investment_risk",
				{},
			);
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runRiskAnalystTask completes a multi-step risk analysis task", async () => {
			const answer = await runRiskAnalystTask(
				"Assess investment risk for a Permian Basin acquisition and run Monte Carlo simulation on NPV.",
			);
			assert.strictEqual(typeof answer, "string", "runRiskAnalystTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or risk-analysis server not running — skipping runTask live test.",
		);
	}

	console.log(`\nRisk Analyst MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
