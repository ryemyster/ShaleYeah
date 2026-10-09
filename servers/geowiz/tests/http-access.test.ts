import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MCPHttpAccessConfig, MCPHttpSecurityEvent } from "@shaleyeah/sdk";
import { GeowizServer } from "../src/index.js";

function localPolicy(token: string, audit: (event: MCPHttpSecurityEvent) => void | Promise<void>): MCPHttpAccessConfig {
	return {
		mode: "local",
		accessToken: token,
		allowedHosts: ["127.0.0.1"],
		principal: {
			subjectId: "geologist-fixture",
			customerId: "fixture",
			employeeId: "geologist",
			scopes: ["mcp:connect", "geowiz:quality"],
		},
		policy: {
			id: "geowiz-fixture",
			version: "r1",
			connectionScopes: ["mcp:connect"],
			toolScopes: { assess_quality: ["geowiz:quality"] },
			resourceScopes: {},
		},
		audit,
	};
}

async function control(url: URL, token: string) {
	const client = new Client({ name: "outside-shaleyeah", version: "0.1.0" });
	const transport = new StreamableHTTPClientTransport(url, {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	try {
		await client.connect(transport);
		const result = await client.callTool({
			name: "assess_quality",
			arguments: { filePath: "not-opened-by-this-existing-stub.las", dataType: "las" },
		});
		assert.equal(result.isError, false);
		assert.equal((result.structuredContent?.analysis as Record<string, unknown>).dataType, "las");
		// This existing tool does not inspect the file; the test qualifies ingress, not its scores.
		const denied = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"MCP-Session-Id": transport.sessionId!,
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 9,
				method: "tools/call",
				params: { name: "save_finding", arguments: { approved: true, scopes: ["all"] } },
			}),
		});
		assert.equal(denied.status, 403);
		await denied.body?.cancel();
		await transport.terminateSession();
	} finally {
		await client.close();
	}
}

async function findingFiles(directory: string) {
	try {
		return await fs.readdir(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

test("real Geowiz enforces configured ingress for an external MCP client", async () => {
	const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), "shale-geowiz-access-"));
	const token = randomUUID();
	const events: MCPHttpSecurityEvent[] = [];
	const prior = process.env.PORT;
	process.env.PORT = "0";
	let server: InstanceType<typeof GeowizServer>;
	try {
		server = new GeowizServer({
			dataPath,
			http: {
				access: localPolicy(token, (event) => {
					events.push(event);
				}),
			},
		});
	} finally {
		if (prior === undefined) delete process.env.PORT;
		else process.env.PORT = prior;
	}
	try {
		await server.initialize();
		const url = new URL(`http://127.0.0.1:${server.httpPort()}/mcp`);
		const anonymous = await fetch(url, { method: "POST", body: "{}" });
		assert.equal(anonymous.status, 401);
		await anonymous.body?.cancel();
		await control(url, token);
		assert.deepEqual(await findingFiles(path.join(dataPath, "findings")), []);
		assert.ok(events.some((event) => event.decision === "deny"));
		assert.equal(JSON.stringify(events).includes(token), false);
	} finally {
		await server.stop();
		await fs.rm(dataPath, { recursive: true, force: true });
	}
});

test("local reference launcher loads private credential references and records redacted ingress", {
	timeout: 10000,
}, async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shale-geowiz-launcher-"));
	const token = randomUUID();
	const tokenFile = path.join(dir, "credential");
	const auditFile = path.join(dir, "audit.jsonl");
	await fs.writeFile(tokenFile, token, { mode: 0o600 });
	const { accessToken: _token, audit: _audit, mode: _mode, ...settings } = localPolicy(token, () => {});
	const configFile = path.join(dir, "access.json");
	await fs.writeFile(
		configFile,
		JSON.stringify({ ...settings, accessTokenFile: tokenFile, auditFile, dataPath: path.join(dir, "data") }),
		{ mode: 0o600 },
	);
	const child = spawn(process.execPath, ["examples/local-http.mjs"], {
		env: { ...process.env, PORT: "0", GEOWIZ_HTTP_CONFIG_FILE: configFile },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	child.stdout.on("data", (chunk) => {
		output += chunk;
	});
	child.stderr.on("data", (chunk) => {
		output += chunk;
	});
	const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
	try {
		const port = await new Promise<number>((resolve, reject) => {
			const deadline = setTimeout(() => {
				clearInterval(timer);
				reject(new Error("Local launcher did not become ready"));
			}, 5000);
			const timer = setInterval(() => {
				const match = output.match(/HTTP transport listening on port (\d+)/);
				if (match) {
					clearInterval(timer);
					clearTimeout(deadline);
					resolve(Number(match[1]));
				}
			}, 10);
			child.once("exit", () => {
				clearInterval(timer);
				clearTimeout(deadline);
				reject(new Error("Local launcher exited before opening its configured listener"));
			});
		});
		await control(new URL(`http://127.0.0.1:${port}/mcp`), token);
		const events = (await fs.readFile(auditFile, "utf8"))
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		assert.ok(events.some((event) => event.decision === "allow" && event.operation === "tools/call"));
		assert.ok(events.some((event) => event.decision === "deny"));
		assert.equal(JSON.stringify(events).includes(token), false);
		assert.equal(output.includes(token), false);
		assert.deepEqual(await findingFiles(path.join(dir, "data/findings")), []);
	} finally {
		child.kill("SIGTERM");
		await exited;
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test("local launcher refuses shared or symlinked credential files without printing secrets", {
	timeout: 10000,
}, async () => {
	for (const kind of ["shared", "symlink"] as const) {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shale-geowiz-private-"));
		const token = randomUUID();
		const target = path.join(dir, "target");
		const credential = path.join(dir, "credential");
		await fs.writeFile(target, token, { mode: 0o600 });
		if (kind === "shared") await fs.writeFile(credential, token, { mode: 0o644 });
		else await fs.symlink(target, credential);
		const { accessToken: _token, audit: _audit, mode: _mode, ...settings } = localPolicy(token, () => {});
		const config = path.join(dir, "access.json");
		await fs.writeFile(
			config,
			JSON.stringify({ ...settings, accessTokenFile: credential, auditFile: path.join(dir, "audit.jsonl") }),
			{ mode: 0o600 },
		);
		const child = spawn(process.execPath, ["examples/local-http.mjs"], {
			env: { ...process.env, PORT: "0", GEOWIZ_HTTP_CONFIG_FILE: config },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr.on("data", (chunk) => {
			output += chunk;
		});
		try {
			const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
			assert.equal(code, 1);
			assert.equal(output.includes(token), false);
			assert.equal(output.includes("listening"), false);
		} finally {
			child.kill("SIGTERM");
			await fs.rm(dir, { recursive: true, force: true });
		}
	}
});
