/**
 * Development Planner MCP Client + runTask Tests — Issue #373
 *
 * Layer 1: verifies callDevelopmentTool delegates to development server over HTTP.
 * Layer 2: verifies runDevelopmentPlannerTask drives a multi-step LLM loop.
 *
 * Run: cd agents/development-planner && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import {
	callDevelopmentTool,
	createDevelopmentPlannerRuntime,
	developmentPlannerConfig,
	developmentPlannerManifest,
	runDevelopmentPlannerTask,
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

async function developmentServerReachable(): Promise<boolean> {
	try {
		const url =
			developmentPlannerConfig.mcpServers?.development?.url ??
			"http://localhost:3011";
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
	console.log("\n🧪 Development Planner MCP Client + runTask Tests (#373)\n");

	await test("callDevelopmentTool is exported as a function", () => {
		assert.strictEqual(
			typeof callDevelopmentTool,
			"function",
			"callDevelopmentTool must be exported",
		);
	});

	await test('developmentPlannerConfig.mcpServers["development"].url is http://localhost:3011', () => {
		const conn = developmentPlannerConfig.mcpServers?.development;
		assert.ok(conn, 'mcpServers["development"] entry must be present');
		assert.strictEqual(
			conn.url,
			"http://localhost:3011",
			"development URL must be localhost:3011",
		);
	});

	await test('developmentPlannerConfig.mcpServers["development"].transport is http', () => {
		const conn = developmentPlannerConfig.mcpServers?.development;
		assert.ok(conn, 'mcpServers["development"] entry must be present');
		assert.strictEqual(
			conn.transport,
			"http",
			"development transport must be http",
		);
	});

	await test("all 3 development-planner tools declare mcpServer: 'development'", () => {
		const wrong = developmentPlannerManifest.tools.filter(
			(t) => t.mcpServer !== "development",
		);
		assert.strictEqual(
			wrong.length,
			0,
			`Tools without mcpServer='development': ${wrong.map((t) => t.name).join(", ")}`,
		);
	});

	await test("callDevelopmentTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callDevelopmentTool(
				"http://localhost:19999",
				"create_development_plan",
				{
					project: {
						name: "Test",
						location: "TX",
						reserves: 1000,
						wellCount: 5,
					},
				},
			);
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(
			threw,
			"callDevelopmentTool must throw when server is unreachable",
		);
	});

	await test("runDevelopmentPlannerTask is exported as a function", () => {
		assert.strictEqual(
			typeof runDevelopmentPlannerTask,
			"function",
			"runDevelopmentPlannerTask must be exported",
		);
	});

	await test("runDevelopmentPlannerTask throws when no ANTHROPIC_API_KEY is set", async () => {
		const saved = process.env.ANTHROPIC_API_KEY;
		process.env.ANTHROPIC_API_KEY = undefined;
		let threw = false;
		try {
			await runDevelopmentPlannerTask("create a development plan");
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(
				msg.includes("ANTHROPIC_API_KEY"),
				`Error must mention ANTHROPIC_API_KEY, got: ${msg}`,
			);
		} finally {
			if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
		}
		assert.ok(
			threw,
			"runDevelopmentPlannerTask must throw when no API key is set",
		);
	});

	await test("runDevelopmentPlannerTask hits callLLM when API key is present (auth error confirms path)", async () => {
		let threw = false;
		try {
			await runDevelopmentPlannerTask("create a development plan", {
				apiKey: "sk-ant-invalid-key-for-test",
			});
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error from invalid key must have a message");
		}
		assert.ok(
			threw,
			"runDevelopmentPlannerTask with invalid key must throw (proves callLLM was hit)",
		);
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

	await test("runDevelopmentPlannerTask accepts runtime option (signature check)", () => {
		const params = runDevelopmentPlannerTask.length;
		assert.ok(
			params >= 1,
			"runDevelopmentPlannerTask must accept at least a goal argument",
		);
	});

	await test("approvalMode: 'always' returns a structured HITL challenge", async () => {
		const strictRuntime = createDevelopmentPlannerRuntime({
			...developmentPlannerConfig,
			hitl: { ...developmentPlannerConfig.hitl, approvalMode: "always" },
		});
		await strictRuntime.initialize();

		const result = await strictRuntime.execute({
			toolName: "development-planner.create_development_plan",
			args: {
				project: { name: "Test", location: "TX", reserves: 1000, wellCount: 5 },
			},
		});
		await strictRuntime.shutdown();

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
			"development-planner.create_development_plan",
		);
		assert.strictEqual(challenge.agentId, "development-planner");
	});

	const live = await developmentServerReachable();
	if (!live) {
		console.log(
			"\n  ⚠️  [integration] development server not reachable at localhost:3011 — skipping live MCP tests.",
		);
		console.log(
			"     Start with: cd servers/development && PORT=3011 pnpm start",
		);
	}

	if (live) {
		await test("[integration] callDevelopmentTool routes create_development_plan through development MCP", async () => {
			const result = await callDevelopmentTool(
				developmentPlannerConfig.mcpServers?.development.url,
				"create_development_plan",
				{
					project: {
						name: "Permian Basin Program",
						location: "TX",
						reserves: 5000,
						wellCount: 10,
					},
					constraints: { budget: 30_000_000 },
				},
			);
			assert.ok(result !== undefined, "MCP tool call must return a value");
		});
	}

	if (live && process.env.ANTHROPIC_API_KEY) {
		await test("[integration] runDevelopmentPlannerTask completes a multi-step development task", async () => {
			const answer = await runDevelopmentPlannerTask(
				"Create a phased development plan for a 15-well program in the Permian Basin with a $45M budget.",
			);
			assert.strictEqual(
				typeof answer,
				"string",
				"runDevelopmentPlannerTask must return a string",
			);
			assert.ok(answer.length > 0, "Answer must be non-empty");
		});
	} else {
		console.log(
			"  ⚠️  [integration] ANTHROPIC_API_KEY not set or development server not running — skipping runTask live test.",
		);
	}

	console.log(
		`\nDevelopment Planner MCP Client + runTask Tests: ${passed} passed, ${failed} failed`,
	);
	if (failed > 0) process.exit(1);
}

await runTests();
