import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { callCurveSmithTool } from "../../agents/reservoir-engineer/src/agent/curve-smith-client.js";

for (const [name, call, prefix] of [["Reservoir engineer", callCurveSmithTool, "CURVE_SMITH"]] as const) {
	for (const scenario of ["header-mismatch", "input-required", "invalid-output", "success"] as const) {
		test(`${name} temporary adapter preserves ${scenario} with exactly one command dispatch`, async () => {
			const directory = mkdtempSync(path.join(os.tmpdir(), "mcp-replay-control-"));
			const key = `${prefix}_MCP_ACCESS_TOKEN_FILE`;
			const previous = process.env[key];
			const reference = path.join(directory, "credential");
			writeFileSync(reference, randomUUID(), { mode: 0o600 });
			process.env[key] = reference;
			let dispatched = 0;
			const server = http.createServer(async (request, response) => {
				const chunks: Buffer[] = [];
				for await (const chunk of request) chunks.push(Buffer.from(chunk));
				const message = JSON.parse(Buffer.concat(chunks).toString());
				const reply = { jsonrpc: "2.0", id: message.id };
				response.writeHead(200, { "content-type": "application/json", "mcp-protocol-version": "2026-07-28" });
				if (message.method === "server/discover") {
					response.end(
						JSON.stringify({
							...reply,
							result: {
								resultType: "complete",
								supportedVersions: ["2026-07-28"],
								ttlMs: 0,
								cacheScope: "private",
								serverInfo: { name: "independent-no-replay-fixture", version: "r1" },
								capabilities: { tools: {} },
							},
						}),
					);
				} else if (message.method === "tools/list") {
					response.end(
						JSON.stringify({
							...reply,
							result: {
								resultType: "complete",
								ttlMs: 0,
								cacheScope: "private",
								tools: [
									{
										name: "command",
										description: "Fixture command",
										inputSchema: { type: "object" },
										outputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
									},
								],
							},
						}),
					);
				} else if (message.method === "tools/call") {
					dispatched++;
					const outcome =
						scenario === "header-mismatch"
							? { error: { code: -32020, message: "Fixture header mismatch" } }
							: {
									result:
										scenario === "input-required"
											? { resultType: "input_required", inputRequests: {}, requestState: "untrusted-fixture-state" }
											: {
													resultType: "complete",
													content: [{ type: "text", text: "fixture-only" }],
													structuredContent: { value: scenario === "invalid-output" ? 7 : "kept" },
													isError: false,
												},
								};
					response.end(JSON.stringify({ ...reply, ...outcome }));
				} else {
					response.end(JSON.stringify({ ...reply, error: { code: -32601, message: "Unsupported fixture method" } }));
				}
			});
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			try {
				const address = server.address();
				assert.ok(address && typeof address !== "string");
				const operation = call(`http://127.0.0.1:${address.port}/mcp`, "command", {});
				if (scenario === "success") assert.deepEqual(await operation, [{ type: "text", text: "fixture-only" }]);
				else
					await assert.rejects(operation, (error) => {
						if (dispatched === 0) throw error;
						if (scenario === "input-required") assert.match(String(error), /input_required/);
						if (scenario === "invalid-output") assert.match(String(error), /output schema/);
						return true;
					});
				assert.equal(dispatched, 1, "A command with uncertain effects must never be repeated automatically");
			} finally {
				if (previous === undefined) delete process.env[key];
				else process.env[key] = previous;
				rmSync(directory, { recursive: true });
				server.closeAllConnections();
				await new Promise<void>((resolve) => server.close(() => resolve()));
			}
		});
	}
}
