import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";
import { MCPServer, type MCPServerConfig } from "../src/mcp-server.js";

const fixtureToken = randomUUID();

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
	maxRequestBodyBytes?: number;
	requestTimeoutMs?: number;
	maxConcurrentRequests?: number;
}

async function fixture(httpOptions: HttpFixtureOptions = {}) {
	const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), "shale-mcp-request-"));
	const priorPort = process.env.PORT;
	process.env.PORT = "0";
	let server: FixtureServer;
	try {
		const config: MCPServerConfig & { http: HttpFixtureOptions } = {
			name: "request-fixture",
			version: "0.1.0",
			description: "Request lifecycle fixture",
			persona: { name: "Fixture", role: "fixture", expertise: [] },
			dataPath,
			http: {
				...httpOptions,
				access: {
					mode: "local",
					accessToken: fixtureToken,
					allowedHosts: ["127.0.0.1"],
					principal: {
						subjectId: "fixture",
						customerId: "fixture",
						employeeId: "fixture",
						scopes: ["fixture:connect", "fixture:tool", "fixture:resource"],
					},
					policy: {
						id: "request-fixture",
						version: "r1",
						connectionScopes: ["fixture:connect"],
						toolScopes: { echo: ["fixture:tool"], late: ["fixture:tool"] },
						resourceScopes: { "fixture://reference": ["fixture:resource"], "fixture://late": ["fixture:resource"] },
					},
					audit: () => {},
				},
			},
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
			const client = new Client({ name, version: "0.1.0" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
			const transport = new StreamableHTTPClientTransport(url, {
				requestInit: { headers: { Authorization: `Bearer ${fixtureToken}` } },
			});
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

async function rpc(url: URL, sessionId: string | undefined, body: unknown, method = "POST") {
	return fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${fixtureToken}`,
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			"MCP-Protocol-Version": "2025-11-25",
			...(sessionId ? { "MCP-Session-Id": sessionId } : {}),
		},
		...(method === "POST" ? { body: JSON.stringify(body) } : {}),
		signal: AbortSignal.timeout(1500),
	});
}

test("stop closes protocol requests and restart rejects forged transport identifiers", { timeout: 6000 }, async () => {
	const app = await fixture();
	try {
		const a = app.peer("before-stop");
		await a.client.connect(a.transport);
		const oldId = "forged-prior-transport-handle";
		await app.server.stop();
		await a.client.close();
		await app.server.initialize();
		const old = await rpc(app.url, oldId, { jsonrpc: "2.0", id: 5, method: "ping" });
		assert.equal(old.status, 400);
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
		for (const http of [{ maxConcurrentRequests: 0 }, { maxRequestBodyBytes: -1 }, { requestTimeoutMs: Number.NaN }]) {
			assert.throws(
				() =>
					new FixtureServer({
						name: "invalid-fixture",
						version: "0.1.0",
						description: "invalid limits",
						persona: { name: "Fixture", role: "fixture", expertise: [] },
						http: {
							...http,
							access: {
								mode: "local",
								accessToken: fixtureToken,
								allowedHosts: ["127.0.0.1"],
								principal: {
									subjectId: "fixture",
									customerId: "fixture",
									employeeId: "fixture",
									scopes: ["fixture:connect"],
								},
								policy: {
									id: "invalid-limit-fixture",
									version: "r1",
									connectionScopes: ["fixture:connect"],
									toolScopes: {},
									resourceScopes: {},
								},
								audit: () => {},
							},
						},
					} as MCPServerConfig & { http: HttpFixtureOptions }),
				/positive|finite|integer/i,
			);
		}
	} finally {
		if (priorPort === undefined) delete process.env.PORT;
		else process.env.PORT = priorPort;
	}
});

test("malformed, oversized, interrupted and slow bodies cannot exhaust request capacity or break another peer", {
	timeout: 6000,
}, async () => {
	const app = await fixture({ requestTimeoutMs: 100, maxConcurrentRequests: 2 });
	try {
		const healthy = app.peer("body-control");
		await healthy.client.connect(healthy.transport);
		for (const [body, status] of [
			["{", 400],
			[JSON.stringify({ value: "x".repeat(1_048_576) }), 413],
		] as const) {
			const response = await fetch(app.url, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${fixtureToken}` },
				body,
				signal: AbortSignal.timeout(1500),
			});
			assert.equal(response.status, status);
			assert.ok((await response.json()).error);
		}
		const slowStatus = await new Promise<number>((resolve, reject) => {
			const request = http.request(
				app.url,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": "100",
						Authorization: `Bearer ${fixtureToken}`,
					},
				},
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
				headers: {
					"Content-Type": "application/json",
					"Content-Length": "100",
					Authorization: `Bearer ${fixtureToken}`,
				},
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

test("tools and resources added after startup are discoverable to existing and new clients", {
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
