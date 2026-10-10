import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createModelRuntime, type MCPHttpAccessConfig, parseModelProfile } from "@shaleyeah/sdk";
import { GeowizServer, performFormationAnalysis } from "../src/index.js";

const sample = path.join(path.dirname(fileURLToPath(import.meta.url)), "sample-files/sample.las");

async function withoutAmbientProvider<T>(run: () => Promise<T>): Promise<T> {
	const original = process.env.ANTHROPIC_API_KEY;
	delete process.env.ANTHROPIC_API_KEY;
	try {
		return await run();
	} finally {
		if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = original;
	}
}

test("formation analysis without an explicit model runtime fails instead of inventing synthesis", async () => {
	await withoutAmbientProvider(async () => {
		await assert.rejects(performFormationAnalysis({ filePath: sample }), /config|provider|runtime/i);
	});
});

test("formation analysis observes the injected Gemini synthesis runtime", async () => {
	await withoutAmbientProvider(async () => {
		const calls: unknown[] = [];
		const runtime = {
			publicProfile: () => ({ provider: "gemini", model: "gemini-fixture-001", revision: "fixture-r1" }),
			generate: async (input: unknown) => {
				calls.push(input);
				return {
					output: { toc: 1.25, recommendation: "Fixture requires geological review" },
					metadata: { provider: "gemini", model: "gemini-fixture-001", revision: "fixture-r1" },
				};
			},
		};
		const result = await Reflect.apply(performFormationAnalysis, undefined, [{ filePath: sample }, runtime]);
		assert.equal(calls.length, 1, "the selected synthesis runtime must receive the model call");
		assert.equal(result.toc, 1.25);
		assert.equal(result.modelMetadata.provider, "gemini");
		assert.equal(result.modelMetadata.model, "gemini-fixture-001");
	});
});

test("injected provider failure propagates once without the formation catch fabricating a result", async () => {
	await withoutAmbientProvider(async () => {
		let calls = 0;
		const runtime = {
			publicProfile: () => ({ provider: "anthropic", model: "claude-fixture-001", revision: "fixture-r1" }),
			generate: async () => {
				calls++;
				throw new Error("Model provider unavailable");
			},
		};
		await assert.rejects(
			Reflect.apply(performFormationAnalysis, undefined, [{ filePath: sample }, runtime]),
			/Model provider unavailable/,
		);
		assert.equal(calls, 1, "a failed model call must not be repeated through a fallback path");
	});
});

test("ambient provider key cannot activate an unconfigured formation synthesis runtime", async () => {
	const originalKey = process.env.ANTHROPIC_API_KEY;
	const originalFetch = globalThis.fetch;
	const credential = randomBytes(32).toString("base64url");
	let requests = 0;
	process.env.ANTHROPIC_API_KEY = credential;
	globalThis.fetch = async () => {
		requests++;
		return new Response(JSON.stringify({ content: [{ type: "text", text: '{"toc":2,"recommendation":"fixture"}' }] }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	};
	try {
		await assert.rejects(performFormationAnalysis({ filePath: sample }), /config|provider|runtime/i);
		assert.equal(requests, 0, "ambient keys must not authorize a different vendor's call");
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = originalKey;
	}
});

test("authenticated employee cannot discover or execute another owner's synthesis binding", async () => {
	let credentials = 0;
	const runtime = createModelRuntime(
		parseModelProfile({
			version: "0.1.0",
			id: "formation",
			revision: "fixture-r1",
			purpose: "synthesis",
			owner: { customerId: "private-owner", employeeId: "geologist" },
			provider: "gemini",
			model: "gemini-fixture-001",
			modelRevision: "fixture-001",
			endpoint: "https://generativelanguage.googleapis.com",
			credentialRef: "secret:private-owner/geologist",
			capabilities: { toolUse: true, structuredOutput: true },
			limits: { timeoutMs: 1000, maxAttempts: 1, maxOutputTokens: 256, maxRequests: 2, maxInputChars: 4096 },
		}),
		{
			resolveCredential: async () => {
				credentials++;
				return randomBytes(32).toString("base64url");
			},
		},
	);
	const token = randomBytes(32).toString("base64url");
	const access: MCPHttpAccessConfig = {
		mode: "local",
		accessToken: token,
		allowedHosts: ["127.0.0.1"],
		principal: {
			subjectId: "other-operator",
			customerId: "other-owner",
			employeeId: "geologist",
			scopes: ["mcp:connect", "geowiz:analyze"],
		},
		policy: {
			id: "fixture",
			version: "r1",
			connectionScopes: ["mcp:connect"],
			toolScopes: { get_model_profile: ["geowiz:analyze"], analyze_formation: ["geowiz:analyze"] },
			resourceScopes: {},
		},
		audit: () => {},
	};
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-model-owner-"));
	const prior = process.env.PORT;
	process.env.PORT = "0";
	const server = new GeowizServer({ dataPath: directory, modelRuntime: runtime, http: { access } });
	if (prior === undefined) delete process.env.PORT;
	else process.env.PORT = prior;
	const client = new Client({ name: "owner-control", version: "0.1.0" });
	try {
		await server.initialize();
		const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
			requestInit: { headers: { Authorization: `Bearer ${token}` } },
		});
		await client.connect(transport);
		for (const name of ["get_model_profile", "analyze_formation"]) {
			const result = await client.callTool({
				name,
				arguments: name === "analyze_formation" ? { filePath: sample } : {},
			});
			assert.equal(result.isError, true);
			assert.equal(result.structuredContent?.error_type, "auth_required");
			assert.ok(!JSON.stringify(result).includes("private-owner"));
		}
		assert.equal(credentials, 0);
	} finally {
		await client.close();
		await server.stop();
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test("unreadable source fails before synthesis and cannot fabricate a fallback", async () => {
	let calls = 0;
	const runtime = {
		publicProfile: () => ({}),
		generate: async () => {
			calls++;
			throw new Error("Provider must not be called");
		},
	};
	await assert.rejects(
		Reflect.apply(performFormationAnalysis, undefined, [{ filePath: `${sample}.missing` }, runtime]),
	);
	assert.equal(calls, 0);
});

test("formation processing forwards the executing request cancellation to its provider", async () => {
	const controller = new AbortController();
	let observed: AbortSignal | undefined;
	const runtime = {
		publicProfile: () => ({}),
		generate: async (input: { signal?: AbortSignal }) => {
			observed = input.signal;
			return { output: { toc: 1, recommendation: "Fixture" }, metadata: { provider: "gemini", model: "fixture" } };
		},
	};
	await Reflect.apply(performFormationAnalysis, undefined, [{ filePath: sample }, runtime, controller.signal]);
	assert.equal(observed, controller.signal);
});
