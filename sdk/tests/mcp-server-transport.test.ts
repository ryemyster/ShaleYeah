/**
 * MCPServer Transport Selection Tests — Issue #363
 *
 * Verifies that MCPServer picks stdio vs HTTP transport based on the PORT env var.
 * Written before implementation (TDD — these tests fail until sdk/src/mcp-server.ts
 * is updated to support StreamableHTTPServerTransport).
 *
 * Tests deliberately avoid actually starting the server (connect/listen) because
 * that would block stdio or bind a real port. They inspect the constructed state
 * that can be observed without starting.
 */

import assert from "node:assert";
import { MCPServer, type MCPServerConfig } from "@shaleyeah/sdk";

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

// Minimal concrete subclass — just fulfills the abstract contract.
class TestServer extends MCPServer {
	protected setupCapabilities(): void {}
	protected async setupDataDirectories(): Promise<void> {}
}

const baseConfig: MCPServerConfig = {
	name: "test-server",
	version: "0.0.1",
	description: "Transport selection test server",
	persona: { name: "Tester", role: "test", expertise: [] },
};

async function runTests(): Promise<void> {
	console.log("\n🧪 MCPServer Transport Selection Tests (#363)\n");

	await test("MCPServer can be constructed without PORT env var (stdio mode)", () => {
		delete process.env.PORT;
		const server = new TestServer(baseConfig);
		// transport field is protected — probe via getInfo() which doesn't depend on transport type
		const info = server.getInfo();
		assert.strictEqual(info.name, "test-server");
	});

	await test("MCPServer exposes isHttpMode() returning false when no PORT set", () => {
		delete process.env.PORT;
		const server = new TestServer(baseConfig);
		assert.strictEqual(server.isHttpMode(), false, "stdio mode when PORT is absent");
	});

	await test("MCPServer exposes isHttpMode() returning true when PORT is set", () => {
		process.env.PORT = "19999";
		try {
			const server = new TestServer(baseConfig);
			assert.strictEqual(server.isHttpMode(), true, "HTTP mode when PORT is set");
		} finally {
			delete process.env.PORT;
		}
	});

	await test("MCPServer httpPort() returns undefined in stdio mode", () => {
		delete process.env.PORT;
		const server = new TestServer(baseConfig);
		assert.strictEqual(server.httpPort(), undefined, "no port in stdio mode");
	});

	await test("MCPServer httpPort() returns the configured port in HTTP mode", () => {
		process.env.PORT = "3001";
		try {
			const server = new TestServer(baseConfig);
			assert.strictEqual(server.httpPort(), 3001, "port matches PORT env var");
		} finally {
			delete process.env.PORT;
		}
	});

	console.log(`\nMCPServer Transport Tests: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		process.exit(1);
	}
}

await runTests();
