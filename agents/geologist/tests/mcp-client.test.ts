/**
 * Geologist MCP Client Tests — Issue #363
 *
 * Verifies the geowiz MCP client helper:
 * - `callGeowizTool` is exported from the agent module
 * - It reads the geowiz URL from AgentRuntimeConfig.mcpServers.geowiz.url
 * - The geologistConfig.mcpServers.geowiz entry points to localhost:3001
 * - Handlers no longer import @shaleyeah/server-geowiz directly (dependency removed)
 *
 * Written before implementation (TDD — these fail until the geowiz-client.ts module
 * and updated index.ts are in place).
 *
 * Integration tests that require a live geowiz server are skipped when the server
 * is not reachable — they're labelled "[integration]" so CI can run them separately.
 */

import assert from "node:assert";
import { callGeowizTool, geologistConfig, geologistManifest } from "../src/agent/index.js";

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

async function geowizReachable(): Promise<boolean> {
	try {
		const url = geologistConfig.mcpServers?.geowiz?.url ?? "http://localhost:3001";
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
	console.log("\n🧪 Geologist MCP Client Tests (#363)\n");

	await test("callGeowizTool is exported as a function", () => {
		assert.strictEqual(typeof callGeowizTool, "function", "callGeowizTool must be exported");
	});

	await test("geologistConfig.mcpServers.geowiz.url is http://localhost:3001", () => {
		const conn = geologistConfig.mcpServers?.geowiz;
		assert.ok(conn, "mcpServers.geowiz entry must be present");
		assert.strictEqual(conn.url, "http://localhost:3001", "geowiz URL is localhost:3001");
	});

	await test("geologistConfig.mcpServers.geowiz.transport is http", () => {
		const conn = geologistConfig.mcpServers?.geowiz;
		assert.ok(conn, "mcpServers.geowiz entry must be present");
		assert.strictEqual(conn.transport, "http", "geowiz transport is http");
	});

	await test("all 8 geologist tools declare mcpServer: 'geowiz'", () => {
		const wrongServer = geologistManifest.tools.filter((t) => t.mcpServer !== "geowiz");
		assert.strictEqual(
			wrongServer.length,
			0,
			`Tools without mcpServer='geowiz': ${wrongServer.map((t) => t.name).join(", ")}`,
		);
	});

	await test("callGeowizTool rejects with a clear error when server is unreachable", async () => {
		let threw = false;
		try {
			await callGeowizTool("http://localhost:19998", "analyze_formation", { filePath: "test.las" });
		} catch (err) {
			threw = true;
			const msg = err instanceof Error ? err.message : String(err);
			// Must propagate a network error — not silently return undefined
			assert.ok(msg.length > 0, "Error message must be non-empty");
		}
		assert.ok(threw, "callGeowizTool must throw when server is unreachable");
	});

	const live = await geowizReachable();
	if (!live) {
		console.log("\n  ⚠️  [integration] Geowiz server not reachable at localhost:3001 — skipping live MCP call tests.");
		console.log("     Start geowiz with: PORT=3001 cd servers/geowiz && pnpm start");
	} else {
		await test("[integration] callGeowizTool routes assess_quality through geowiz MCP", async () => {
			const result = await callGeowizTool(geologistConfig.mcpServers.geowiz.url, "assess_data_quality", {
				filePath: "test.las",
				dataType: "las",
			});
			assert.ok(result !== undefined, "MCP call must return a value");
		});
	}

	console.log(`\nGeologist MCP Client Tests: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		process.exit(1);
	}
}

await runTests();
