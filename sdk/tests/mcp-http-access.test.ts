import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import {
	type MCPExecutionContext,
	type MCPHttpAccessConfig,
	type MCPHttpSecurityEvent,
	MCPServer,
	type MCPServerConfig,
	type VerifiedMCPIdentity,
} from "../src/mcp-server.js";
import { ServerFactory } from "../src/server-factory.js";

const issuer = "https://issuer.example.test";
const resource = "https://mcp.example.test/mcp";
const base: MCPServerConfig = {
	name: "access-fixture",
	version: "0.1.0",
	description: "Deterministic ingress control",
	persona: { name: "Fixture", role: "fixture", expertise: [] },
};
const policy = {
	id: "fixture-access",
	version: "r1",
	connectionScopes: ["mcp:connect"],
	toolScopes: { echo: ["fixture:read"] },
	resourceScopes: { "fixture://reference": ["fixture:read"] },
};

class Fixture extends MCPServer {
	calls = 0;
	protected setupCapabilities(): void {
		this.registerTool({
			name: "echo",
			description: "Read a synthetic value",
			inputSchema: z.object({ delayMs: z.number().optional() }).passthrough(),
			handler: async ({ delayMs }: { delayMs?: number }, context?: MCPExecutionContext) => {
				this.calls++;
				if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
				return {
					subjectId: context?.principal.subjectId,
					customerId: context?.principal.customerId,
					contextKeys: context ? Object.keys(context).sort() : [],
					principalKeys: context ? Object.keys(context.principal).sort() : [],
					frozen: context ? Object.isFrozen(context) && Object.isFrozen(context.principal.scopes) : false,
				};
			},
		});
		this.registerTool({
			name: "unlisted",
			description: "Must have no authority",
			inputSchema: z.object({}),
			handler: async () => {
				this.calls++;
				return {};
			},
		});
		this.registerResource({
			name: "reference",
			uri: "fixture://reference",
			description: "Synthetic resource",
			handler: async () => {
				this.calls++;
				return {};
			},
		});
	}
	protected async setupDataDirectories(): Promise<void> {}
}

interface FixtureOptions {
	local?: boolean;
	audit?: (event: MCPHttpSecurityEvent) => void | Promise<void>;
	verify?: (token: string, signal: AbortSignal) => Promise<VerifiedMCPIdentity>;
	verificationTimeoutMs?: number;
	auditTimeoutMs?: number;
}

async function fixture(options: FixtureOptions = {}) {
	const token = randomUUID();
	const otherToken = randomUUID();
	const identity: VerifiedMCPIdentity = {
		subjectId: "alice",
		customerId: "customer-a",
		employeeId: "employee-a",
		issuer,
		audience: resource,
		expiresAt: Date.now() / 1000 + 60,
		scopes: ["mcp:connect", "fixture:read"],
	};
	const tokens = new Map([
		[token, identity],
		[otherToken, { ...identity, subjectId: "bob" }],
	]);
	const events: MCPHttpSecurityEvent[] = [];
	let verifications = 0;
	const common = {
		bindHost: "127.0.0.1",
		allowedHosts: ["127.0.0.1"],
		allowedOrigins: [],
		policy,
		audit:
			options.audit ??
			((event: MCPHttpSecurityEvent) => {
				events.push(event);
			}),
		verificationTimeoutMs: options.verificationTimeoutMs,
		auditTimeoutMs: options.auditTimeoutMs,
	};
	const access: MCPHttpAccessConfig = options.local
		? {
				...common,
				mode: "local",
				accessToken: token,
				principal: {
					subjectId: identity.subjectId,
					customerId: identity.customerId,
					employeeId: identity.employeeId,
					scopes: identity.scopes,
				},
			}
		: {
				...common,
				mode: "remote",
				issuer,
				resource,
				authorizationServers: [issuer],
				customerId: identity.customerId,
				employeeId: identity.employeeId,
				verifyBearer: async (value: string, signal: AbortSignal) => {
					verifications++;
					if (options.verify) return options.verify(value, signal);
					const verified = tokens.get(value);
					if (!verified) throw new Error("Synthetic credential is not enrolled");
					return verified;
				},
			};
	const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), "shale-access-"));
	const prior = process.env.PORT;
	process.env.PORT = "0";
	let server: Fixture;
	try {
		server = new Fixture({ ...base, dataPath, http: { access } });
	} finally {
		if (prior === undefined) delete process.env.PORT;
		else process.env.PORT = prior;
	}
	await server.initialize();
	const url = new URL(`http://127.0.0.1:${server.httpPort()}/mcp`);
	const clients: Client[] = [];
	return {
		server,
		url,
		token,
		otherToken,
		tokens,
		identity,
		events,
		access,
		verifications: () => verifications,
		async peer(credential = token) {
			const client = new Client({ name: "external-client", version: "0.1.0" });
			const transport = new StreamableHTTPClientTransport(url, {
				requestInit: { headers: { Authorization: `Bearer ${credential}` } },
			});
			clients.push(client);
			await client.connect(transport);
			return { client, transport };
		},
		async close() {
			await Promise.allSettled(clients.map((client) => client.close()));
			await server.stop();
			await fs.rm(dataPath, { recursive: true, force: true });
		},
	};
}

const initialize = {
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "direct-http", version: "0.1.0" } },
};
async function rpc(
	app: Awaited<ReturnType<typeof fixture>>,
	body: unknown,
	token?: string,
	session?: string,
	method = "POST",
	extra: Record<string, string> = {},
) {
	return fetch(app.url, {
		method,
		headers: {
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			"MCP-Protocol-Version": "2025-11-25",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(session ? { "MCP-Session-Id": session } : {}),
			...extra,
		},
		...(method === "POST" ? { body: JSON.stringify(body) } : {}),
	});
}
async function status(response: Response) {
	const code = response.status;
	await response.body?.cancel();
	return code;
}

async function rawHostStatus(app: Awaited<ReturnType<typeof fixture>>, host: string) {
	return new Promise<number>((resolve, reject) => {
		const request = http.request(
			app.url,
			{
				method: "POST",
				headers: {
					Host: host,
					Authorization: `Bearer ${app.token}`,
					Accept: "application/json, text/event-stream",
					"Content-Type": "application/json",
				},
			},
			(response) => {
				response.resume();
				response.once("end", () => resolve(response.statusCode!));
			},
		);
		request.once("error", reject);
		request.end(JSON.stringify(initialize));
	});
}
const call = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: {} } };

test("HTTP requires an explicit known trust mode before listening", () => {
	const prior = process.env.PORT;
	process.env.PORT = "0";
	try {
		assert.throws(() => new Fixture(base), /access|trust/i);
	} finally {
		if (prior === undefined) delete process.env.PORT;
		else process.env.PORT = prior;
	}
});

test("generic MCP client receives only immutable verified execution context", async () => {
	const app = await fixture();
	try {
		const peer = await app.peer();
		const result = await peer.client.callTool({
			name: "echo",
			arguments: { identity: { subjectId: "forged", scopes: ["all"] }, approved: true },
		});
		const data = result.structuredContent?.data as Record<string, unknown>;
		assert.equal(data.subjectId, "alice");
		assert.equal(data.customerId, "customer-a");
		assert.equal(data.frozen, true);
		assert.deepEqual(data.contextKeys, ["policyId", "policyVersion", "principal", "requestId"]);
		assert.deepEqual(data.principalKeys, ["customerId", "employeeId", "scopes", "subjectId"]);
		assert.ok(app.verifications() >= 3);
	} finally {
		await app.close();
	}
});

test("missing, forged, expired and incorrectly targeted identities fail before handlers", async () => {
	const app = await fixture();
	try {
		for (const change of [
			{ expiresAt: 0 },
			{ issuer: "https://other.example.test" },
			{ audience: "https://other.example.test/mcp" },
		]) {
			const credential = randomUUID();
			app.tokens.set(credential, { ...app.identity, ...change });
			assert.equal(await status(await rpc(app, initialize, credential)), 401);
		}
		assert.equal(await status(await rpc(app, initialize)), 401);
		assert.equal(await status(await rpc(app, initialize, randomUUID())), 401);
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("verified identity with wrong customer or employee has no ownership authority", async () => {
	const app = await fixture();
	try {
		for (const change of [{ customerId: "customer-b" }, { employeeId: "employee-b" }]) {
			const credential = randomUUID();
			app.tokens.set(credential, { ...app.identity, ...change });
			assert.equal(await status(await rpc(app, initialize, credential)), 403);
		}
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("connection scope does not grant a tool or resource scope", async () => {
	const app = await fixture();
	try {
		app.tokens.set(app.token, { ...app.identity, scopes: ["mcp:connect"] });
		const peer = await app.peer();
		assert.equal(await status(await rpc(app, call, app.token, peer.transport.sessionId)), 403);
		assert.equal(
			await status(
				await rpc(
					app,
					{ ...call, method: "resources/read", params: { uri: "fixture://reference" } },
					app.token,
					peer.transport.sessionId,
				),
			),
			403,
		);
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("stolen session IDs confer no POST, GET or DELETE authority", async () => {
	const app = await fixture();
	try {
		const peer = await app.peer();
		for (const method of ["POST", "GET", "DELETE"]) {
			assert.equal(await status(await rpc(app, call, undefined, peer.transport.sessionId, method)), 401);
			assert.equal(await status(await rpc(app, call, app.otherToken, peer.transport.sessionId, method)), 403);
		}
		const result = await peer.client.callTool({ name: "echo", arguments: {} });
		assert.equal((result.structuredContent?.data as Record<string, unknown>).subjectId, "alice");
	} finally {
		await app.close();
	}
});

test("each request revalidates a revoked identity rather than trusting initialization", async () => {
	const app = await fixture();
	try {
		const peer = await app.peer();
		app.tokens.delete(app.token);
		for (const method of ["POST", "GET", "DELETE"])
			assert.equal(await status(await rpc(app, call, app.token, peer.transport.sessionId, method)), 401);
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("concurrent sessions cannot swap principal context", async () => {
	const app = await fixture();
	try {
		const [alice, bob] = await Promise.all([app.peer(), app.peer(app.otherToken)]);
		const results = await Promise.all([
			alice.client.callTool({ name: "echo", arguments: { delayMs: 30 } }),
			bob.client.callTool({ name: "echo", arguments: {} }),
		]);
		assert.deepEqual(
			results.map((result) => (result.structuredContent?.data as Record<string, unknown>).subjectId),
			["alice", "bob"],
		);
	} finally {
		await app.close();
	}
});

test("unclassified operations are denied rather than inheriting connection access", async () => {
	const app = await fixture();
	try {
		const peer = await app.peer();
		for (const request of [
			{ ...call, params: { name: "unlisted", arguments: { approved: true } } },
			{ ...call, method: "unknown/operation" },
			{ ...call, method: "resources/read", params: { uri: "fixture://unlisted" } },
		]) {
			assert.equal(await status(await rpc(app, request, app.token, peer.transport.sessionId)), 403);
		}
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("security events exclude raw credentials, arguments, identity text and verifier errors", async () => {
	const canary = randomUUID();
	const app = await fixture();
	try {
		const peer = await app.peer();
		await status(
			await rpc(
				app,
				{ ...call, params: { name: "unlisted", arguments: { password: canary, approved: true } } },
				app.token,
				peer.transport.sessionId,
			),
		);
		await status(await rpc(app, initialize, canary));
		await peer.client.callTool({ name: "echo", arguments: { password: canary } });
		assert.ok(app.events.some((event) => event.decision === "deny"));
		assert.ok(app.events.some((event) => event.decision === "allow"));
		const serialized = JSON.stringify(app.events);
		for (const secret of [app.token, canary, "alice", "Synthetic credential"])
			assert.equal(serialized.includes(secret), false);
	} finally {
		await app.close();
	}
});

test("verifier and audit failures/timeouts prevent effects with a safe denial", async () => {
	for (const options of [
		{
			verify: async () => {
				throw new Error("unsafe verifier detail");
			},
		},
		{ verify: async () => new Promise<VerifiedMCPIdentity>(() => {}), verificationTimeoutMs: 20 },
		{
			audit: async () => {
				throw new Error("unsafe audit detail");
			},
		},
		{ audit: async () => new Promise<void>(() => {}), auditTimeoutMs: 20 },
	]) {
		const app = await fixture(options);
		try {
			const response = await rpc(app, initialize, app.token);
			const body = await response.text();
			assert.ok([401, 503].includes(response.status));
			assert.equal(body.includes("unsafe"), false);
			assert.equal(app.server.calls, 0);
		} finally {
			await app.close();
		}
	}
});

test("local mode requires its dedicated credential and rejects hostile host/origin", async () => {
	const app = await fixture({ local: true });
	try {
		assert.equal(await status(await rpc(app, initialize)), 401);
		assert.equal(
			await status(
				await rpc(app, initialize, app.token, undefined, "POST", { Origin: "https://hostile.example.test" }),
			),
			403,
		);
		assert.equal(await rawHostStatus(app, "hostile.example.test"), 403);
		const peer = await app.peer();
		await peer.client.callTool({ name: "echo", arguments: {} });
		assert.equal(app.server.calls, 1);
	} finally {
		await app.close();
	}
});

test("factory constructors preserve explicit HTTP access options", async () => {
	const app = await fixture();
	const prior = process.env.PORT;
	process.env.PORT = "0";
	try {
		const Server = ServerFactory.createServer({
			name: "factory-access",
			description: "Factory boundary control",
			persona: base.persona,
			directories: [],
			tools: [],
		});
		assert.doesNotThrow(() => new Server({ http: { access: app.access } }));
	} finally {
		if (prior === undefined) delete process.env.PORT;
		else process.env.PORT = prior;
		await app.close();
	}
});

test("configured public resource metadata and bearer challenges work without tool access", async () => {
	const app = await fixture();
	try {
		const metadata = await fetch(new URL("/.well-known/oauth-protected-resource", app.url));
		assert.equal(metadata.status, 200);
		assert.deepEqual(await metadata.json(), {
			resource,
			authorization_servers: [issuer],
			scopes_supported: ["mcp:connect", "fixture:read"],
			bearer_methods_supported: ["header"],
		});
		const denied = await rpc(app, initialize);
		assert.equal(denied.status, 401);
		assert.match(denied.headers.get("www-authenticate") ?? "", /Bearer.*resource_metadata=/);
		await denied.body?.cancel();
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("a per-operation audit failure blocks an already authenticated tool call", async () => {
	const app = await fixture({
		audit: (event) => {
			if (event.operation === "tools/call") throw new Error("sink unavailable");
		},
	});
	try {
		const peer = await app.peer();
		assert.equal(await status(await rpc(app, call, app.token, peer.transport.sessionId)), 503);
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("expiry during the pre-dispatch audit cannot authorize a late effect", async () => {
	const app = await fixture({
		verify: async () => ({
			subjectId: "alice",
			customerId: "customer-a",
			employeeId: "employee-a",
			issuer,
			audience: resource,
			expiresAt: Date.now() / 1000 + 0.06,
			scopes: ["mcp:connect", "fixture:read"],
		}),
		audit: async (event) => {
			if (event.operation === "tools/call") await new Promise((resolve) => setTimeout(resolve, 100));
		},
	});
	try {
		const peer = await app.peer();
		assert.equal(await status(await rpc(app, call, app.token, peer.transport.sessionId)), 401);
		assert.equal(app.server.calls, 0);
	} finally {
		await app.close();
	}
});

test("public server configuration does not serialize dedicated access credentials", async () => {
	const app = await fixture({ local: true });
	try {
		assert.equal(JSON.stringify(app.server.config).includes(app.token), false);
		assert.equal(app.server.config.http?.access, undefined);
	} finally {
		await app.close();
	}
});
