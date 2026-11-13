import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

for (const endpoint of [
	"https://example.invalid/mcp",
	"http://localhost:3001/mcp",
	"http://127.0.0.1:3001/other",
	"http://user:password@127.0.0.1:3001/mcp",
	"http://127.0.0.1:3001/mcp?target=elsewhere",
	"http://127.0.0.1:3001/mcp#elsewhere",
	"http://127.0.0.1/mcp",
]) {
	test(`fixture client rejects ${endpoint} before reading private settings`, () => {
		const result = spawnSync(
			process.execPath,
			["tests/extraction/generic-client.mjs", "/nonexistent-private-fixture.json", endpoint],
			{ encoding: "utf8" },
		);
		assert.notEqual(result.status, 0);
		assert.ok(result.stderr.includes("explicit loopback MCP endpoint"), result.stderr);
		assert.ok(!result.stderr.includes("ENOENT"), "Private settings must not be read first");
	});
}

test("authenticated fixture requests cannot follow a redirect to another path", async () => {
	const temporary = await mkdtemp(path.join(os.tmpdir(), "shale-client-redirect-"));
	let destinationRequests = 0;
	let authenticatedRequests = 0;
	const server = createServer((request, response) => {
		request.resume();
		if (request.url !== "/mcp") {
			destinationRequests++;
			response.writeHead(404).end();
		} else if (!request.headers.authorization) {
			response.writeHead(401).end();
		} else {
			authenticatedRequests++;
			response.writeHead(307, { location: "/unexpected-path" }).end();
		}
	});
	try {
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const credential = randomUUID();
		const tokenFile = path.join(temporary, "token");
		const settingsFile = path.join(temporary, "settings.json");
		await writeFile(tokenFile, credential, { mode: 0o600 });
		await writeFile(settingsFile, JSON.stringify({ tokenFile }), { mode: 0o600 });
		const child = spawn(
			process.execPath,
			["tests/extraction/generic-client.mjs", settingsFile, `http://127.0.0.1:${server.address().port}/mcp`],
			{ timeout: 5000, stdio: ["ignore", "pipe", "pipe"] },
		);
		let output = "";
		for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => (output += bytes.toString()));
		const code = await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("close", resolve);
		});
		assert.equal(code, 1, output);
		assert.ok(authenticatedRequests > 0);
		assert.equal(destinationRequests, 0);
		assert.ok(!output.includes(credential));
	} finally {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
		await rm(temporary, { recursive: true, force: true });
	}
});
