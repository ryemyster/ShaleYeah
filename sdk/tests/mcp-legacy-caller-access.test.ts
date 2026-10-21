import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { callCurveSmithTool } from "../../agents/reservoir-engineer/src/agent/curve-smith-client.js";

for (const [role, call, prefix] of [["Reservoir engineer", callCurveSmithTool, "CURVE_SMITH"]] as const) {
	for (const scenario of [
		"success",
		"disconnect",
		"missing",
		"public-file",
		"oversized",
		"redirect",
		"tool-error",
	] as const) {
		test(`${role} ${scenario} uses dedicated credentials and a single bounded command`, async () => {
			const directory = mkdtempSync(path.join(os.tmpdir(), "legacy-mcp-access-"));
			const token = randomUUID();
			const file = path.join(directory, "credential");
			writeFileSync(file, token, { mode: 0o600 });
			if (scenario === "public-file") chmodSync(file, 0o644);
			const key = `${prefix}_MCP_ACCESS_TOKEN_FILE`;
			const previous = process.env[key];
			if (scenario === "missing") delete process.env[key];
			else process.env[key] = file;
			let requests = 0;
			let dispatched = 0;
			const server = http.createServer(async (request, response) => {
				requests++;
				if (scenario === "redirect") {
					response.writeHead(307, { location: "/unexpected-target" }).end();
					return;
				}
				if (request.url !== "/mcp" || request.headers.authorization !== `Bearer ${token}`) {
					response.writeHead(401).end();
					return;
				}
				const chunks: Buffer[] = [];
				for await (const chunk of request) chunks.push(Buffer.from(chunk));
				const message = JSON.parse(Buffer.concat(chunks).toString());
				const reply = { jsonrpc: "2.0", id: message.id };
				if (message.method === "tools/call") {
					dispatched++;
					if (scenario === "disconnect") {
						response.destroy();
						return;
					}
				}
				const result =
					message.method === "server/discover"
						? {
								resultType: "complete",
								supportedVersions: ["2026-07-28"],
								capabilities: { tools: {} },
								ttlMs: 0,
								cacheScope: "private",
							}
						: message.method === "tools/list"
							? {
									resultType: "complete",
									tools: [{ name: "command", inputSchema: { type: "object" } }],
									ttlMs: 0,
									cacheScope: "private",
								}
							: {
									resultType: "complete",
									content: [{ type: "text", text: scenario === "oversized" ? "x".repeat(1_048_577) : "fixture-only" }],
									isError: scenario === "tool-error",
								};
				response.writeHead(200, { "content-type": "application/json", "mcp-protocol-version": "2026-07-28" });
				response.end(JSON.stringify({ ...reply, result }));
			});
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			try {
				const address = server.address();
				assert.ok(address && typeof address !== "string");
				const operation = call(`http://127.0.0.1:${address.port}`, "command", {});
				if (scenario === "success") {
					assert.deepEqual(await operation, [{ type: "text", text: "fixture-only" }]);
					assert.equal(dispatched, 1);
				} else {
					await assert.rejects(operation, (error: unknown) => {
						assert.ok(error instanceof Error && "retryable" in error && error.retryable === false);
						assert.ok(!String(error).includes(token) && !String(error).includes(file));
						if (scenario === "disconnect") assert.match(String(error), /after dispatch|outcome.*unknown/i);
						return true;
					});
					assert.equal(
						dispatched,
						scenario === "disconnect" || scenario === "oversized" || scenario === "tool-error" ? 1 : 0,
					);
					if (scenario === "redirect") assert.equal(requests, 1);
					if (scenario === "missing" || scenario === "public-file") assert.equal(requests, 0);
				}
			} finally {
				if (previous === undefined) delete process.env[key];
				else process.env[key] = previous;
				server.closeAllConnections();
				await new Promise<void>((resolve) => server.close(() => resolve()));
				rmSync(directory, { recursive: true });
			}
		});
	}
}
