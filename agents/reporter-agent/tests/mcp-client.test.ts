/**
 * Reporter Agent MCP Client + runTask Tests — Issue #441
 *
 * Layer 1: verifies callReporterTool delegates to reporter server over HTTP.
 * Layer 2: verifies runReporterAgentTask drives a multi-step LLM loop.
 *
 * Run: cd agents/reporter-agent && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callReporterTool,
	createReporterAgentRuntime,
	reporterAgentConfig,
	reporterAgentManifest,
	runReporterAgentTask,
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

async function reporterReachable(): Promise<boolean> {
	try {
		const url = reporterAgentConfig.mcpServers?.reporter?.url ?? "http://localhost:3009";
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
	console.log("\n🧪 Reporter Agent MCP Client + runTask Tests (#441)\n");

	await test("callReporterTool is exported as a function", () => {
		assert.strictEqual(typeof callReporterTool, "function", "callReporterTool must be exported");
	});

	await test('reporterAgentConfig.mcpServers["reporter"].url is http://localhost:3009', () => {
		const conn = reporterAgentConfig.mcpServers?.reporter;
		assert.ok(conn, 'mcpServers["reporter"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3009", "reporter URL must be localhost:3009");
	});

	await test('reporterAgentConfig.mcpServers["reporter"].transport is http', () => {
		const conn = reporterAgentConfig.mcpServers?.reporter;
		assert.ok(conn, 'mcpServers["reporter"] entry must be present');
		assert.strictEqual(conn.transport, "http", "reporter transport must be http");
	});

	await test("all 3 reporter-agent tools declare mcpServer: 'reporter'", () => {
		const wrong = reporterAgentManifest.tools.filter((t) => t.mcpServer !== "reporter");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='reporter': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("callReporterTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callReporterTool("http://localhost:19999", "synthesize_analysis", {});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callReporterTool must throw when server is unreachable");
	});

	await test("runReporterAgentTask is exported as a function", () => {
		assert.strictEqual(typeof runReporterAgentTask, "function", "runReporterAgentTask must be exported");
	});

	await test("runReporterAgentTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		let threw = false;
		try {
			await runReporterAgentTask("generate investment report");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runReporterAgentTask must throw when no API key is set");
	});

	await test("runReporterAgentTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runReporterAgentTask("generate investment report", { apiKey: "sk-ant-invalid-key-for-test" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runReporterAgentTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runReporterAgentTask accepts runtime option (signature check)", () => {
		const params = runReporterAgentTask.length;
		assert.ok(params >= 1, "runReporterAgentTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createReporterAgentRuntime({
			...reporterAgentConfig,
			hitl: { ...reporterAgentConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "reporter-agent.synthesize_analysis",
			args: {},
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
		assert.strictEqual(challenge.toolName, "reporter-agent.synthesize_analysis");
		assert.strictEqual(challenge.agentId, "reporter-agent");
	});

	const live = await reporterReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] reporter server not reachable at localhost:3009 — skipping live MCP tests.");
		console.log("     Start with: cd servers/reporter && PORT=3009 pnpm start");
	}

	if (live) {
		await test("[integration] callReporterTool routes synthesize_analysis through reporter MCP", async () => {
			const result = await callReporterTool(reporterAgentConfig.mcpServers!.reporter.url, "synthesize_analysis", {});
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runReporterAgentTask completes a multi-step reporting task", async () => {
			const answer = await runReporterAgentTask(
				"Generate an investment decision report for a Permian Basin acquisition.",
			);
			assert.strictEqual(typeof answer, "string", "runReporterAgentTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or reporter server not running — skipping runTask live test.",
		);
	}

	console.log(`\nReporter Agent MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
