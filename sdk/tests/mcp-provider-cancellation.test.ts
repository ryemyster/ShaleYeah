import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { createModelRuntime, parseModelProfile } from "../src/model-provider.js";
import { ServerFactory } from "../src/server-factory.js";

test("actual protected MCP cancellation aborts the selected model operation without replay", async () => {
	let signalStarted: () => void = () => {};
	let signalAborted: () => void = () => {};
	const started = new Promise<void>((resolve) => {
		signalStarted = resolve;
	});
	const aborted = new Promise<void>((resolve) => {
		signalAborted = resolve;
	});
	let dispatches = 0;
	const runtime = createModelRuntime(
		parseModelProfile({
			version: "0.1.0",
			id: "model",
			revision: "fixture-r1",
			purpose: "synthesis",
			owner: { customerId: "fixture", employeeId: "geologist" },
			provider: "gemini",
			model: "gemini-fixture-001",
			modelRevision: "fixture-001",
			endpoint: "https://generativelanguage.googleapis.com",
			credentialRef: "secret:fixture/geologist",
			capabilities: { toolUse: true, structuredOutput: true },
			limits: { timeoutMs: 5000, maxAttempts: 1, maxOutputTokens: 256, maxRequests: 2, maxInputChars: 4096 },
		}),
		{
			resolveCredential: async () => randomBytes(32).toString("base64url"),
			adapter: async (_profile, _key, _input, signal) => {
				dispatches++;
				signalStarted();
				return await new Promise((_, reject) => {
					signal.addEventListener(
						"abort",
						() => {
							signalAborted();
							reject(new Error("fixture cancelled"));
						},
						{ once: true },
					);
				});
			},
		},
	);
	const Controlled = ServerFactory.createServer({
		name: "provider-control",
		description: "Cancellation control",
		persona: { name: "Control", role: "fixture", expertise: [] },
		directories: [],
		tools: [
			ServerFactory.createAnalysisTool(
				"model",
				"Fixture model",
				z.object({}).strict(),
				async (_args, context, signal) =>
					runtime.generate({ prompt: "Fixture", schema: { type: "object" }, signal }, context?.principal),
			),
		],
	});
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-model-cancellation-"));
	const token = randomBytes(32).toString("base64url");
	const prior = process.env.PORT;
	process.env.PORT = "0";
	const server = new Controlled({
		dataPath: directory,
		http: {
			access: {
				mode: "local",
				accessToken: token,
				allowedHosts: ["127.0.0.1"],
				principal: {
					subjectId: "fixture",
					customerId: "fixture",
					employeeId: "geologist",
					scopes: ["mcp:connect", "model:run"],
				},
				policy: {
					id: "fixture",
					version: "r1",
					connectionScopes: ["mcp:connect"],
					toolScopes: { model: ["model:run"] },
					resourceScopes: {},
				},
				audit: () => {},
			},
		},
	});
	if (prior === undefined) delete process.env.PORT;
	else process.env.PORT = prior;
	const client = new Client({ name: "cancellation-control", version: "0.1.0" });
	const controller = new AbortController();
	try {
		await server.initialize();
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
				requestInit: { headers: { Authorization: `Bearer ${token}` } },
			}),
		);
		const request = client.callTool({ name: "model", arguments: {} }, undefined, { signal: controller.signal }).then(
			() => null,
			(error) => error,
		);
		await Promise.race([
			started,
			new Promise((_, reject) => setTimeout(() => reject(new Error("Provider was not started")), 2000)),
		]);
		controller.abort();
		assert.ok(await request);
		await Promise.race([
			aborted,
			new Promise((_, reject) => setTimeout(() => reject(new Error("Cancellation was not forwarded")), 2000)),
		]);
		assert.equal(dispatches, 1);
	} finally {
		controller.abort();
		await client.close();
		await server.stop();
		await fs.rm(directory, { recursive: true, force: true });
	}
});
