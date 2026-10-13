import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { discoverMCPTool, loadMCPClientConnection, mcpCommandFailure } from "../src/mcp-client-connection.js";
import { readPrivateJson, readPrivateText } from "../src/private-json.js";

test("configured fetch bounds actual response bytes and refuses redirects before following", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "mcp-bounded-fetch-"));
	const file = path.join(root, "credential");
	writeFileSync(file, randomUUID(), { mode: 0o600 });
	const previous = process.env.BOUNDED_MCP_ACCESS_TOKEN_FILE;
	process.env.BOUNDED_MCP_ACCESS_TOKEN_FILE = file;
	let requests = 0;
	const server = http.createServer((request, response) => {
		requests++;
		if (request.url === "/redirect") response.writeHead(307, { location: "/target" }).end();
		else if (request.url === "/oversized") response.end("x".repeat(1_048_577));
		else response.end("bounded fixture");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const base = `http://127.0.0.1:${address.port}`;
		const connection = await loadMCPClientConnection(base, "BOUNDED");
		assert.equal(await (await connection.fetch(`${base}/mcp`, connection.requestInit)).text(), "bounded fixture");
		const oversized = await connection.fetch(`${base}/oversized`, connection.requestInit);
		await assert.rejects(oversized.text(), /byte limit/);
		await assert.rejects(connection.fetch(`${base}/redirect`, connection.requestInit), /redirect denied/);
		assert.equal(requests, 3);
	} finally {
		if (previous === undefined) delete process.env.BOUNDED_MCP_ACCESS_TOKEN_FILE;
		else process.env.BOUNDED_MCP_ACCESS_TOKEN_FILE = previous;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		rmSync(root, { recursive: true });
	}
});

test("connection configuration resolves fresh owned credentials and denies unsafe destinations/files", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "mcp-client-options-"));
	const key = "FIXTURE_MCP_ACCESS_TOKEN_FILE";
	const previous = process.env[key];
	const token = randomUUID();
	const file = path.join(root, "credential");
	writeFileSync(file, token, { mode: 0o600 });
	process.env[key] = file;
	try {
		for (const endpoint of [
			"https://configured.example/mcp",
			"http://127.0.0.1:4321",
			"http://localhost:4321",
			"http://[::1]:4321",
		]) {
			const options = await loadMCPClientConnection(endpoint, "FIXTURE");
			assert.equal(options.url.pathname, "/mcp");
			assert.equal(options.requestInit.redirect, "error");
			assert.ok(new Headers(options.requestInit.headers).get("authorization") === `Bearer ${token}`);
		}
		for (const endpoint of [
			"http://outside.example/mcp",
			"https://user:secret@configured.example/mcp",
			"https://configured.example/mcp?",
			"https://configured.example/mcp#",
			"malformed",
			" https://configured.example/mcp",
			`https://configured.example/${"x".repeat(2048)}`,
		])
			await assert.rejects(loadMCPClientConnection(endpoint, "FIXTURE"), /Invalid MCP endpoint/);
		await assert.rejects(
			loadMCPClientConnection("https://configured.example/mcp", "invalid-prefix"),
			/Invalid MCP endpoint/,
		);
		const next = randomUUID();
		writeFileSync(file, next);
		assert.ok(
			new Headers((await loadMCPClientConnection("https://configured.example/mcp", "FIXTURE")).requestInit.headers).get(
				"authorization",
			) === `Bearer ${next}`,
		);
		chmodSync(file, 0o644);
		await assert.rejects(loadMCPClientConnection("https://configured.example/mcp", "FIXTURE"), /private credential/);
		chmodSync(file, 0o600);
		symlinkSync(file, path.join(root, "link"));
		process.env[key] = path.join(root, "link");
		await assert.rejects(loadMCPClientConnection("https://configured.example/mcp", "FIXTURE"), /private credential/);
		process.env[key] = file;
		for (const bad of ["", "token\ninjection", "x".repeat(4097)]) {
			writeFileSync(file, bad);
			await assert.rejects(loadMCPClientConnection("https://configured.example/mcp", "FIXTURE"), /private credential/);
		}
		delete process.env[key];
		await assert.rejects(loadMCPClientConnection("https://configured.example/mcp", "FIXTURE"), /private credential/);
		writeFileSync(file, JSON.stringify({ value: 0 }));
		assert.equal(await readPrivateText(file, 128), '{"value":0}');
		assert.deepEqual(await readPrivateJson(file, 128), { value: 0 });
		await assert.rejects(readPrivateText(file, 0));
		await assert.rejects(readPrivateText(root, 128));
		writeFileSync(file, "invalid JSON");
		await assert.rejects(readPrivateJson(file, 128));
	} finally {
		if (previous === undefined) delete process.env[key];
		else process.env[key] = previous;
		rmSync(root, { recursive: true });
	}
});

const tool = { name: "command", inputSchema: { type: "object" as const } };
test("tool discovery scans bounded pages and rejects ambiguous, missing or repeated catalogs", async () => {
	let page = 0;
	assert.deepEqual(
		await discoverMCPTool(
			{ listTools: async () => (++page === 1 ? { tools: [], nextCursor: "next" } : { tools: [tool] }) },
			"command",
		),
		tool,
	);
	assert.equal(page, 2);
	for (const pages of [
		[{ tools: [] }],
		[{ tools: [tool, tool] }],
		[{ tools: [tool], nextCursor: "next" }, { tools: [tool] }],
		[
			{ tools: [], nextCursor: "repeat" },
			{ tools: [], nextCursor: "repeat" },
		],
		[{ tools: [], nextCursor: "x".repeat(513) }],
	]) {
		let index = 0;
		await assert.rejects(discoverMCPTool({ listTools: async () => pages[index++] }, "command"));
	}
	let calls = 0;
	await assert.rejects(
		discoverMCPTool({ listTools: async () => ({ tools: [], nextCursor: `page-${calls++}` }) }, "command"),
		/page budget/,
	);
	assert.equal(calls, 32);
});

test("post-dispatch failures preserve safe categories without server messages or error causes", () => {
	for (const [code, expected] of [
		["UNSUPPORTED_RESULT_TYPE", /input_required/],
		[-32602, /output schema/],
		[undefined, /after dispatch/],
	] as const) {
		const original = Object.assign(new Error("untrusted-secret-marker"), { code });
		const failure = mcpCommandFailure(original);
		assert.equal(failure.retryable, false);
		assert.match(failure.message, expected);
		assert.ok(!JSON.stringify(failure).includes("untrusted-secret-marker"));
		assert.equal(failure.cause, undefined);
	}
});
