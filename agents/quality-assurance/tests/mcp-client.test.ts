/**
 * Quality Assurance MCP Client Tests — Issue #376
 *
 * Verifies the qa-server MCP client helper:
 * - `callQAServerTool` is exported from the agent module
 * - It reads the qa-server URL from AgentRuntimeConfig.mcpServers["qa-server"].url
 * - The qaAssuranceConfig.mcpServers["qa-server"] entry points to localhost:3004
 * - Transport is "http"
 * - All agent tools declare mcpServer: "qa-server"
 *
 * Written before implementation (TDD — these fail until qa-server-client.ts and
 * updated index.ts are in place).
 *
 * Integration tests that require a live qa-server are skipped when the server
 * is not reachable — labelled "[integration]" for CI separation.
 */

import assert from "node:assert";
import { callQAServerTool, qaAssuranceConfig, qaAssuranceManifest } from "../src/agent/index.js";

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

async function qaServerReachable(): Promise<boolean> {
	try {
		const url = qaAssuranceConfig.mcpServers?.["qa-server"]?.url ?? "http://localhost:3004";
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
	console.log("\n🧪 Quality Assurance MCP Client Tests (#376)\n");

	await test("callQAServerTool is exported as a function", () => {
		assert.strictEqual(typeof callQAServerTool, "function", "callQAServerTool must be exported");
	});

	await test('qaAssuranceConfig.mcpServers["qa-server"].url is http://localhost:3004', () => {
		const conn = qaAssuranceConfig.mcpServers?.["qa-server"];
		assert.ok(conn, 'mcpServers["qa-server"] entry must be present');
		assert.strictEqual(conn.url, "http://localhost:3004", "qa-server URL is localhost:3004");
	});

	await test('qaAssuranceConfig.mcpServers["qa-server"].transport is http', () => {
		const conn = qaAssuranceConfig.mcpServers?.["qa-server"];
		assert.ok(conn, 'mcpServers["qa-server"] entry must be present');
		assert.strictEqual(conn.transport, "http", "qa-server transport is http");
	});

	await test("all 2 quality-assurance tools declare mcpServer: 'qa-server'", () => {
		const wrongServer = qaAssuranceManifest.tools.filter((t) => t.mcpServer !== "qa-server");
		assert.strictEqual(
			wrongServer.length,
			0,
			`Tools without mcpServer='qa-server': ${wrongServer.map((t) => t.name).join(", ")}`,
		);
	});

	await test("callQAServerTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callQAServerTool("http://localhost:19999", "run_quality_tests", { targets: ["test"] });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callQAServerTool must throw when server is unreachable");
	});

	const live = await qaServerReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] QA server not reachable at localhost:3004 — skipping live MCP call tests.");
		console.log("     Start qa-server with: PORT=3004 cd servers/qa-server && pnpm start");
	} else {
		await test("[integration] callQAServerTool routes run_quality_tests through qa-server MCP", async () => {
			const result = await callQAServerTool(qaAssuranceConfig.mcpServers["qa-server"].url, "run_quality_tests", {
				targets: ["test-component"],
				testSuite: "functional",
			});
			assert.ok(result !== undefined, "MCP call must return a value");
		});
	}

	console.log(`\nQuality Assurance MCP Client Tests: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		process.exit(1);
	}
}

await runTests();
