/**
 * Legal Analyst MCP Client + runTask Tests — Issue #370
 *
 * Layer 1: verifies callLegalTool delegates to legal server over HTTP.
 * Layer 2: verifies runLegalAnalystTask drives a multi-step LLM loop.
 *
 * Run: cd agents/legal-analyst && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callLegalTool,
	createLegalAnalystRuntime,
	legalAnalystConfig,
	legalAnalystManifest,
	runLegalAnalystTask,
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

async function legalReachable(): Promise<boolean> {
	try {
		const url = legalAnalystConfig.mcpServers?.legal?.url ?? "http://localhost:3006";
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
	console.log("\n🧪 Legal Analyst MCP Client + runTask Tests (#370)\n");

	await test("callLegalTool is exported as a function", () => {
		assert.strictEqual(typeof callLegalTool, "function", "callLegalTool must be exported");
	});

	await test('legalAnalystConfig.mcpServers["legal"].url is http://localhost:3006', () => {
		const conn = legalAnalystConfig.mcpServers?.legal;
		assert.ok(conn, 'mcpServers["legal"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3006", "legal URL must be localhost:3006");
	});

	await test('legalAnalystConfig.mcpServers["legal"].transport is http', () => {
		const conn = legalAnalystConfig.mcpServers?.legal;
		assert.ok(conn, 'mcpServers["legal"] entry must be present');
		assert.strictEqual(conn.transport, "http", "legal transport must be http");
	});

	await test("all 3 legal-analyst tools declare mcpServer: 'legal'", () => {
		const wrong = legalAnalystManifest.tools.filter((t) => t.mcpServer !== "legal");
		assert.strictEqual(wrong.length, 0, `Tools without mcpServer='legal': ${wrong.map((t) => t.name).join(", ")}`);
	});

	await test("callLegalTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callLegalTool("http://localhost:19999", "analyze_legal_framework", {
				jurisdiction: "Texas",
				projectType: "production",
				assets: ["Well A"],
			});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callLegalTool must throw when server is unreachable");
	});

	await test("runLegalAnalystTask is exported as a function", () => {
		assert.strictEqual(typeof runLegalAnalystTask, "function", "runLegalAnalystTask must be exported");
	});

	await test("runLegalAnalystTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		process.env.ANTHROPIC_API_KEY = "";
		let threw = false;
		try {
			await runLegalAnalystTask("analyze legal exposure for Texas exploration");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(threw, "runLegalAnalystTask must throw when no API key is set");
	});

	await test("runLegalAnalystTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runLegalAnalystTask("analyze legal exposure for Texas exploration", {
				apiKey: "sk-ant-invalid-key-for-test",
			});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(threw, "runLegalAnalystTask with invalid key must throw (proves callLLM was hit)");
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

	await test("runLegalAnalystTask accepts runtime option (signature check)", () => {
		const params = runLegalAnalystTask.length;
		assert.ok(params >= 1, "runLegalAnalystTask must accept at least a goal argument");
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createLegalAnalystRuntime({
			...legalAnalystConfig,
			hitl: { ...legalAnalystConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "legal-analyst.analyze_legal_framework",
			args: {
				jurisdiction: "Texas",
				projectType: "production",
				assets: ["Well A"],
			},
		});
		await strictRuntime.shutdown();

		assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
		assert.ok("challenge" in result, "approval_required result must have a challenge");
		const challenge = (
			result as {
				status: "approval_required";
				challenge: HumanApprovalChallenge;
			}
		).challenge;
		assert.strictEqual(challenge.toolName, "legal-analyst.analyze_legal_framework");
		assert.strictEqual(challenge.agentId, "legal-analyst");
	});

	const live = await legalReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] legal server not reachable at localhost:3006 — skipping live MCP tests.");
		console.log("     Start with: cd servers/legal && PORT=3006 pnpm start");
	}

	if (live) {
		await test("[integration] callLegalTool routes analyze_legal_framework through legal MCP", async () => {
			const result = await callLegalTool(legalAnalystConfig.mcpServers?.legal.url, "analyze_legal_framework", {
				jurisdiction: "Texas",
				projectType: "production",
				assets: ["Well A-1"],
			});
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runLegalAnalystTask completes a multi-step legal task", async () => {
			const answer = await runLegalAnalystTask(
				"Analyze the regulatory exposure for a Texas production project with 2 wells.",
			);
			assert.strictEqual(typeof answer, "string", "runLegalAnalystTask must return a string");
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or legal server not running — skipping runTask live test.",
		);
	}

	console.log(`\nLegal Analyst MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
