import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { MCPServer, type MCPServerConfig } from "../src/mcp-server.js";

class FixtureServer extends MCPServer {
	protected setupCapabilities(): void {
		this.registerTool({
			name: "echo",
			description: "Return the supplied fixture value without an external provider",
			inputSchema: z.object({ value: z.string(), delayMs: z.number().int().nonnegative().optional() }),
			handler: async ({ value, delayMs }: { value: string; delayMs?: number }) => {
				if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
				return { value };
			},
		});
		this.registerResource({
			name: "fixture",
			uri: "fixture://reference",
			description: "Deterministic resource used by generic MCP clients",
			handler: async () => ({ kind: "fixture" }),
		});
	}
	protected async setupDataDirectories(): Promise<void> {}
}

interface HttpFixtureOptions {
	sessionIdleTimeoutMs?: number;
	requestTimeoutMs?: number;
	maxSessions?: number;
}

async function fixture(httpOptions: HttpFixtureOptions = {}) {
	const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), "shale-mcp-session-"));
	const priorPort = process.env.PORT;
	process.env.PORT = "0";
	let server: FixtureServer;
	try {
		const config: MCPServerConfig & { http: HttpFixtureOptions } = {
			name: "session-fixture",
			version: "0.1.0",
			description: "Session lifecycle fixture",
			persona: { name: "Fixture", role: "fixture", expertise: [] },
			dataPath,
			http: httpOptions,
		};
		server = new FixtureServer(config);
	} finally {
		if (priorPort === undefined) delete process.env.PORT;
		else process.env.PORT = priorPort;
	}
	await server.initialize();
	const url = new URL(`http://127.0.0.1:${server.httpPort()}/mcp`);
	const peers: Array<{ client: Client; transport: StreamableHTTPClientTransport }> = [];
	return {
		server,
		url,
		peer(name: string) {
			const client = new Client({ name, version: "0.1.0" }, { capabilities: { roots: { listChanged: true } } });
			const transport = new StreamableHTTPClientTransport(url);
			const peer = { client, transport };
			peers.push(peer);
			return peer;
		},
		async close() {
			await Promise.allSettled(peers.map(({ client }) => client.close()));
			await server.stop();
			await fs.rm(dataPath, { recursive: true, force: true });
		},
	};
}

function valueFrom(result: Awaited<ReturnType<Client["callTool"]>>): string {
	const content = result.content;
	assert.ok(Array.isArray(content));
	const first = content[0];
	assert.ok(first && first.type === "text");
	const parsed = JSON.parse(first.text);
	assert.equal(parsed.success, true);
	return parsed.data.value;
}

test("independent MCP clients initialize and call concurrently without crossing responses", {
	timeout: 6000,
}, async () => {
	const app = await fixture();
	try {
		const a = app.peer("client-a");
		const b = app.peer("client-b");
		const connected = await Promise.allSettled([a.client.connect(a.transport), b.client.connect(b.transport)]);
		assert.deepEqual(
			connected.map((result) => result.status),
			["fulfilled", "fulfilled"],
			"both clients must initialize; a singleton stateful transport rejects the second client",
		);
		assert.ok(a.transport.sessionId);
		assert.ok(b.transport.sessionId);
		assert.notEqual(a.transport.sessionId, b.transport.sessionId);
		const [ra, rb] = await Promise.all([
			a.client.callTool({ name: "echo", arguments: { value: "only-a" } }),
			b.client.callTool({ name: "echo", arguments: { value: "only-b" } }),
		]);
		assert.equal(valueFrom(ra), "only-a");
		assert.equal(valueFrom(rb), "only-b");
		const [tools, resource] = await Promise.all([
			a.client.listTools(),
			b.client.readResource({ uri: "fixture://reference" }),
		]);
		assert.equal(tools.tools[0].name, "echo");
		assert.equal(resource.contents[0].uri, "fixture://reference");
	} finally {
		await app.close();
	}
});

async function rpc(url: URL, sessionId: string | undefined, body: unknown, method = "POST") {
	return fetch(url, {
		method,
		headers: {
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			"MCP-Protocol-Version": "2025-11-25",
			...(sessionId ? { "MCP-Session-Id": sessionId } : {}),
		},
		...(method === "POST" ? { body: JSON.stringify(body) } : {}),
		signal: AbortSignal.timeout(1500),
	});
}

const initializeRequest = {
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "raw-peer", version: "0.1.0" } },
};

test("missing/unknown session and second initialization fail without disturbing a valid peer", {
	timeout: 6000,
}, async () => {
	const app = await fixture();
	try {
		const a = app.peer("valid");
		await a.client.connect(a.transport);
		const ping = { jsonrpc: "2.0", id: 2, method: "ping" };
		for (const [sessionId, status] of [
			[undefined, 400],
			["not-a-session", 404],
		] as const) {
			const response = await rpc(app.url, sessionId, ping);
			assert.equal(response.status, status);
			assert.ok((await response.json()).error);
		}
		const duplicate = await rpc(app.url, a.transport.sessionId, initializeRequest);
		assert.equal(duplicate.status, 400);
		assert.equal((await duplicate.json()).error.code, -32600);
		assert.equal(
			valueFrom(await a.client.callTool({ name: "echo", arguments: { value: "still-valid" } })),
			"still-valid",
		);
		const health = await fetch(new URL("/health", app.url), { signal: AbortSignal.timeout(1500) });
		assert.equal(health.status, 200);
		assert.equal((await health.json()).server, "session-fixture");
	} finally {
		await app.close();
	}
});

test("DELETE and reconnect remove only the closed session", { timeout: 6000 }, async () => {
	const app = await fixture();
	try {
		const a = app.peer("closing");
		const b = app.peer("remaining");
		await Promise.all([a.client.connect(a.transport), b.client.connect(b.transport)]);
		const oldId = a.transport.sessionId;
		await a.transport.terminateSession();
		await a.client.close();
		const old = await rpc(app.url, oldId, { jsonrpc: "2.0", id: 3, method: "ping" });
		assert.equal(old.status, 404);
		await old.body?.cancel();
		assert.equal(valueFrom(await b.client.callTool({ name: "echo", arguments: { value: "remaining" } })), "remaining");
		const replacement = app.peer("reconnected");
		await replacement.client.connect(replacement.transport);
		assert.notEqual(replacement.transport.sessionId, oldId);
		assert.equal(
			valueFrom(await replacement.client.callTool({ name: "echo", arguments: { value: "new-session" } })),
			"new-session",
		);
	} finally {
		await app.close();
	}
});

test("idle expiration closes an inactive session while another client remains active", { timeout: 6000 }, async () => {
	const app = await fixture({ sessionIdleTimeoutMs: 100 });
	try {
		const a = app.peer("idle");
		const b = app.peer("active");
		await Promise.all([a.client.connect(a.transport), b.client.connect(b.transport)]);
		const idleId = a.transport.sessionId;
		for (let i = 0; i < 6; i++) {
			await new Promise((resolve) => setTimeout(resolve, 30));
			await b.client.ping();
		}
		const expired = await rpc(app.url, idleId, undefined, "GET");
		assert.equal(expired.status, 404);
		await expired.body?.cancel();
		assert.equal(valueFrom(await b.client.callTool({ name: "echo", arguments: { value: "active" } })), "active");
		const c = app.peer("after-expiration");
		await c.client.connect(c.transport);
		assert.notEqual(c.transport.sessionId, idleId);
	} finally {
		await app.close();
	}
});

test("finite session capacity is reclaimed after DELETE and rejected initialization", { timeout: 6000 }, async () => {
	const app = await fixture({ maxSessions: 1 });
	try {
		const invalid = await rpc(app.url, undefined, { ...initializeRequest, params: {} });
		assert.equal(invalid.status, 400);
		await invalid.body?.cancel();
		const a = app.peer("occupying");
		await a.client.connect(a.transport);
		const full = await rpc(app.url, undefined, initializeRequest);
		assert.equal(full.status, 503);
		await full.body?.cancel();
		await a.transport.terminateSession();
		const b = app.peer("after-delete");
		await b.client.connect(b.transport);
		assert.equal(
			valueFrom(await b.client.callTool({ name: "echo", arguments: { value: "capacity-freed" } })),
			"capacity-freed",
		);
	} finally {
		await app.close();
	}
});

test("a timed-out request releases its session without poisoning another client", { timeout: 6000 }, async () => {
	const app = await fixture({ requestTimeoutMs: 100 });
	try {
		const a = app.peer("slow");
		const b = app.peer("healthy");
		await Promise.all([a.client.connect(a.transport), b.client.connect(b.transport)]);
		const oldId = a.transport.sessionId;
		await assert.rejects(
			a.client.callTool({ name: "echo", arguments: { value: "slow", delayMs: 250 } }, undefined, { timeout: 1500 }),
		);
		const old = await rpc(app.url, oldId, { jsonrpc: "2.0", id: 4, method: "ping" });
		assert.equal(old.status, 404);
		await old.body?.cancel();
		assert.equal(valueFrom(await b.client.callTool({ name: "echo", arguments: { value: "healthy" } })), "healthy");
	} finally {
		await app.close();
	}
});

test("stop closes open SSE sessions and restart rejects prior session identifiers", { timeout: 6000 }, async () => {
	const app = await fixture();
	try {
		const a = app.peer("before-stop");
		await a.client.connect(a.transport);
		const oldId = a.transport.sessionId;
		await app.server.stop();
		await a.client.close();
		await app.server.initialize();
		const old = await rpc(app.url, oldId, { jsonrpc: "2.0", id: 5, method: "ping" });
		assert.equal(old.status, 404);
		await old.body?.cancel();
		const replacement = app.peer("after-restart");
		await replacement.client.connect(replacement.transport);
		assert.equal(
			valueFrom(await replacement.client.callTool({ name: "echo", arguments: { value: "restarted" } })),
			"restarted",
		);
	} finally {
		await app.close();
	}
});

test("HTTP lifecycle limits reject invalid configuration before opening a listener", () => {
	const priorPort = process.env.PORT;
	process.env.PORT = "19999";
	try {
		for (const http of [{ maxSessions: 0 }, { sessionIdleTimeoutMs: -1 }, { requestTimeoutMs: Number.NaN }]) {
			assert.throws(
				() =>
					new FixtureServer({
						name: "invalid-fixture",
						version: "0.1.0",
						description: "invalid limits",
						persona: { name: "Fixture", role: "fixture", expertise: [] },
						http,
					} as MCPServerConfig & { http: HttpFixtureOptions }),
				/positive|finite|integer/i,
			);
		}
	} finally {
		if (priorPort === undefined) delete process.env.PORT;
		else process.env.PORT = priorPort;
	}
});

test("malformed, oversized, interrupted and slow bodies cannot leak sessions or break another peer", {
	timeout: 6000,
}, async () => {
	const app = await fixture({ requestTimeoutMs: 100, maxSessions: 2 });
	try {
		const healthy = app.peer("body-control");
		await healthy.client.connect(healthy.transport);
		for (const [body, status] of [
			["{", 400],
			[JSON.stringify({ value: "x".repeat(1_048_576) }), 413],
		] as const) {
			const response = await fetch(app.url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
				signal: AbortSignal.timeout(1500),
			});
			assert.equal(response.status, status);
			assert.ok((await response.json()).error);
		}
		const slowStatus = await new Promise<number>((resolve, reject) => {
			const request = http.request(
				app.url,
				{ method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "100" } },
				(response) => {
					response.resume();
					resolve(response.statusCode!);
				},
			);
			request.once("error", reject);
			request.write("{");
		});
		assert.equal(slowStatus, 408);
		await new Promise<void>((resolve) => {
			const request = http.request(app.url, {
				method: "POST",
				headers: { "Content-Type": "application/json", "Content-Length": "100" },
			});
			request.on("error", () => resolve());
			request.write("{");
			setTimeout(() => request.destroy(), 15);
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(
			valueFrom(await healthy.client.callTool({ name: "echo", arguments: { value: "after-bad-body" } })),
			"after-bad-body",
		);
		const replacement = app.peer("no-leaked-capacity");
		await replacement.client.connect(replacement.transport);
	} finally {
		await app.close();
	}
});

test("tools and resources added after startup are discoverable in existing and new sessions", {
	timeout: 6000,
}, async () => {
	const app = await fixture();
	try {
		const a = app.peer("before-registration");
		await a.client.connect(a.transport);
		app.server.registerTool({
			name: "late",
			description: "Late fixture tool",
			inputSchema: z.object({}),
			handler: async () => ({ value: "late" }),
		});
		app.server.registerResource({
			name: "late-resource",
			uri: "fixture://late",
			description: "Late fixture resource",
			handler: async () => "late-resource",
		});
		const b = app.peer("after-registration");
		await b.client.connect(b.transport);
		for (const peer of [a, b]) {
			assert.equal(valueFrom(await peer.client.callTool({ name: "late", arguments: {} })), "late");
			const result = await peer.client.readResource({ uri: "fixture://late" });
			assert.equal(result.contents[0].text, "late-resource");
		}
	} finally {
		await app.close();
	}
});

test("repeated stop/start does not accumulate listener callbacks", { timeout: 6000 }, async () => {
	const warnings: Error[] = [];
	const observe = (warning: Error) => {
		if (warning.name === "MaxListenersExceededWarning") warnings.push(warning);
	};
	process.on("warning", observe);
	const app = await fixture();
	try {
		for (let i = 0; i < 12; i++) {
			await app.server.stop();
			await app.server.initialize();
		}
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(warnings.length, 0, "completed listen attempts must release their error listener");
	} finally {
		process.off("warning", observe);
		await app.close();
	}
});
