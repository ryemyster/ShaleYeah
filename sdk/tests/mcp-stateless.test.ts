import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { z } from "zod";
import { MCPServer } from "../src/mcp-server.js";

const revision = "2026-07-28";

async function fixture(
	options: {
		http?: { maxConcurrentRequests?: number; requestTimeoutMs?: number; maxRequestBodyBytes?: number };
		run?: (value: string, signal?: AbortSignal) => Promise<{ value: string }>;
	} = {},
) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shale-stateless-"));
	const token = randomUUID();
	const dispatched: string[] = [];
	class Server extends MCPServer {
		protected setupCapabilities(): void {
			this.registerTool({
				name: "echo",
				description: "Return an authorized fixture input",
				inputSchema: z.object({ value: z.string() }),
				outputSchema: z.object({ value: z.string() }),
				handler: async ({ value }: { value: string }, context, signal) => {
					assert.equal(context?.principal.subjectId, "enrolled-fixture-owner");
					dispatched.push(value);
					return options.run ? options.run(value, signal) : { value };
				},
			});
		}
		protected async setupDataDirectories(): Promise<void> {}
	}
	const previousPort = process.env.PORT;
	let server: Server;
	try {
		process.env.PORT = "0";
		server = new Server({
			name: "stateless-fixture",
			version: "0.0.0",
			description: "Protocol boundary fixture only",
			persona: { name: "Fixture", role: "fixture", expertise: [] },
			dataPath: directory,
			http: {
				...options.http,
				access: {
					mode: "local",
					accessToken: token,
					allowedHosts: ["127.0.0.1"],
					principal: {
						subjectId: "enrolled-fixture-owner",
						customerId: "fixture-customer",
						employeeId: "fixture-employee",
						scopes: ["fixture:connect", "fixture:echo"],
					},
					policy: {
						id: "stateless-fixture",
						version: "r1",
						connectionScopes: ["fixture:connect"],
						toolScopes: { echo: ["fixture:echo"] },
						resourceScopes: {},
					},
					audit: () => {},
				},
			},
		});
	} finally {
		if (previousPort === undefined) delete process.env.PORT;
		else process.env.PORT = previousPort;
	}
	await server.initialize();
	const endpoint = `http://127.0.0.1:${server.httpPort()}/mcp`;
	return {
		dispatched,
		endpoint,
		token,
		async call(value: string, options: { name?: string; credential?: boolean; version?: string } = {}) {
			const version = options.version ?? revision;
			return fetch(endpoint, {
				method: "POST",
				headers: {
					Accept: "application/json, text/event-stream",
					"Content-Type": "application/json",
					"MCP-Protocol-Version": version,
					"Mcp-Method": "tools/call",
					"Mcp-Name": options.name ?? "echo",
					...(options.credential === false ? {} : { Authorization: `Bearer ${token}` }),
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name: "echo",
						arguments: { value },
						_meta: {
							"io.modelcontextprotocol/protocolVersion": version,
							"io.modelcontextprotocol/clientInfo": { name: "untrusted-client-identity", version: "0.0.0" },
							"io.modelcontextprotocol/clientCapabilities": {},
						},
					},
				}),
				signal: AbortSignal.timeout(2000),
			});
		},
		async close() {
			await server.stop();
			await fs.rm(directory, { recursive: true, force: true });
		},
	};
}

test("modern requests execute without initialize, transport sessions or instance affinity", async () => {
	const a = await fixture();
	const b = await fixture();
	try {
		for (const [instance, value] of [
			[a, "first"],
			[b, "second"],
			[a, "third"],
		] as const) {
			const response = await instance.call(value);
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("Mcp-Session-Id"), null);
			const body = await response.json();
			assert.equal(body.id, 1);
			assert.equal(body.result.structuredContent.value, value);
		}
		assert.deepEqual(a.dispatched, ["first", "third"]);
		assert.deepEqual(b.dispatched, ["second"]);
	} finally {
		await a.close();
		await b.close();
	}
});

test("request capacity is bounded during execution and is released after completion", async () => {
	let started!: () => void;
	let release!: () => void;
	const running = new Promise<void>((resolve) => {
		started = resolve;
	});
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	const app = await fixture({
		http: { maxConcurrentRequests: 1 },
		run: async (value) => {
			if (value === "held") {
				started();
				await released;
			}
			return { value };
		},
	});
	try {
		const held = app.call("held");
		await running;
		assert.equal((await app.call("over-capacity")).status, 503);
		assert.deepEqual(app.dispatched, ["held"]);
		release();
		assert.equal((await held).status, 200);
		assert.equal((await app.call("after-completion")).status, 200);
		assert.deepEqual(app.dispatched, ["held", "after-completion"]);
	} finally {
		release();
		await app.close();
	}
});

test("server request deadline aborts only its own operation and permits a later call", async () => {
	let aborted!: () => void;
	const cancelled = new Promise<void>((resolve) => {
		aborted = resolve;
	});
	const app = await fixture({
		http: { requestTimeoutMs: 100 },
		run: async (value, signal) => {
			if (value === "held")
				await new Promise<void>((_resolve, reject) => {
					signal!.addEventListener(
						"abort",
						() => {
							aborted();
							reject(new Error("Fixture aborted"));
						},
						{ once: true },
					);
				});
			return { value };
		},
	});
	try {
		await app.call("held").then(
			async (response) => {
				assert.equal(response.status, 504);
			},
			(error) => {
				assert.ok(error instanceof TypeError);
			},
		);
		await Promise.race([
			cancelled,
			new Promise<never>((_resolve, reject) => {
				const timer = setTimeout(() => reject(new Error("Operation did not receive cancellation")), 500);
				timer.unref();
			}),
		]);
		assert.equal((await app.call("after-deadline")).status, 200);
		assert.deepEqual(app.dispatched, ["held", "after-deadline"]);
	} finally {
		await app.close();
	}
});

test("legacy initialization is explicitly rejected and cannot mint transport authority", async () => {
	const app = await fixture();
	try {
		const response = await fetch(app.endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${app.token}`,
				Accept: "application/json, text/event-stream",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "legacy-client", version: "0.0.0" },
				},
			}),
		});
		assert.equal(response.status, 400);
		assert.equal(response.headers.get("Mcp-Session-Id"), null);
		assert.deepEqual(app.dispatched, []);
		assert.equal((await app.call("modern-still-works")).status, 200);
	} finally {
		await app.close();
	}
});

test("oversized and malformed bodies fail before domain dispatch", async () => {
	const app = await fixture({ http: { maxRequestBodyBytes: 128 } });
	try {
		for (const [body, status] of [
			["x".repeat(129), 413],
			["{broken", 400],
		] as const) {
			const response = await fetch(app.endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${app.token}`,
					Accept: "application/json, text/event-stream",
					"Content-Type": "application/json",
				},
				body,
			});
			assert.equal(response.status, status);
		}
		assert.deepEqual(app.dispatched, []);
	} finally {
		await app.close();
	}
});

test("modern routing and version failures do not dispatch or contaminate a valid later call", async () => {
	const app = await fixture();
	try {
		for (const options of [{ name: "different-tool" }, { version: "2099-01-01" }]) {
			const response = await app.call("denied", options);
			assert.equal(response.status, 400);
		}
		assert.deepEqual(app.dispatched, []);
		const response = await app.call("permitted");
		assert.equal(response.status, 200);
		assert.deepEqual(app.dispatched, ["permitted"]);
	} finally {
		await app.close();
	}
});

test("modern client metadata never substitutes for separately verified request authority", async () => {
	const app = await fixture();
	try {
		assert.equal((await app.call("denied", { credential: false })).status, 401);
		assert.deepEqual(app.dispatched, []);
		assert.equal((await app.call("permitted")).status, 200);
		assert.deepEqual(app.dispatched, ["permitted"]);
	} finally {
		await app.close();
	}
});

test("modern envelopes reject missing capabilities and inconsistent body versions before dispatch", async () => {
	const app = await fixture();
	try {
		for (const metadata of [
			{
				"io.modelcontextprotocol/protocolVersion": revision,
				"io.modelcontextprotocol/clientInfo": { name: "fixture", version: "0.0.0" },
			},
			{
				"io.modelcontextprotocol/protocolVersion": "2025-11-25",
				"io.modelcontextprotocol/clientInfo": { name: "fixture", version: "0.0.0" },
				"io.modelcontextprotocol/clientCapabilities": {},
			},
		]) {
			const response = await fetch(app.endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${app.token}`,
					Accept: "application/json, text/event-stream",
					"Content-Type": "application/json",
					"MCP-Protocol-Version": revision,
					"Mcp-Method": "tools/call",
					"Mcp-Name": "echo",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: { name: "echo", arguments: { value: "denied" }, _meta: metadata },
				}),
				signal: AbortSignal.timeout(2000),
			});
			assert.equal(response.status, 400);
		}
		assert.deepEqual(app.dispatched, []);
		assert.equal((await app.call("valid-after-rejection")).status, 200);
		assert.deepEqual(app.dispatched, ["valid-after-rejection"]);
	} finally {
		await app.close();
	}
});
