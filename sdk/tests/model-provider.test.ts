import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	createFileModelCredentialResolver,
	createModelRuntime,
	type ModelProfile,
	parseModelProfile,
	parseReferenceModelConfig,
	readPrivateReferenceModelConfig,
} from "../src/model-provider.js";

const outputSchema = {
	type: "object",
	properties: { toc: { type: "number", minimum: 0, maximum: 15 }, recommendation: { type: "string", minLength: 1 } },
	required: ["toc", "recommendation"],
	additionalProperties: false,
} as const;

function profile(provider: "gemini" | "anthropic" = "gemini"): ModelProfile {
	return parseModelProfile({
		version: "0.1.0",
		id: "geologist-synthesis",
		revision: "fixture-r1",
		purpose: "synthesis",
		owner: { customerId: "fixture", employeeId: "geologist" },
		provider,
		model: provider === "gemini" ? "gemini-fixture-001" : "claude-fixture-001",
		modelRevision: "fixture-001",
		endpoint: provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.anthropic.com",
		credentialRef: "secret:fixture/geologist/synthesis",
		capabilities: { toolUse: true, structuredOutput: true },
		limits: { timeoutMs: 1000, maxAttempts: 1, maxOutputTokens: 256, maxRequests: 2, maxInputChars: 4096 },
	});
}

for (const provider of ["gemini", "anthropic"] as const) {
	test(`${provider} adapter receives only the requested profile, key and structured request`, async () => {
		const key = randomBytes(32).toString("base64url");
		const calls: unknown[] = [];
		const runtime = createModelRuntime(profile(provider), {
			resolveCredential: async (owner, reference, purpose) => {
				assert.deepEqual(owner, { customerId: "fixture", employeeId: "geologist" });
				assert.equal(reference, "secret:fixture/geologist/synthesis");
				assert.equal(purpose, "synthesis");
				return key;
			},
			adapter: async (settings, credential, input, signal) => {
				calls.push({ settings, credential, input });
				assert.equal(settings.provider, provider);
				assert.equal(settings.model, profile(provider).model);
				assert.equal(credential, key);
				assert.equal(signal.aborted, false);
				assert.deepEqual(input.schema, outputSchema);
				return {
					output: { toc: 1.25, recommendation: "Fixture requires review" },
					reportedModelRevision: "fixture-native-001",
				};
			},
		});
		const result = await runtime.generate({ prompt: "Fixture geological context", schema: outputSchema });
		assert.equal(calls.length, 1);
		assert.equal(result.metadata.provider, provider);
		assert.equal(result.metadata.model, profile(provider).model);
		assert.equal(result.metadata.reportedModelRevision, "fixture-native-001");
		assert.equal(result.output.toc, 1.25);
		assert.ok(!JSON.stringify(result).includes(key));
		assert.ok(!JSON.stringify(runtime.publicProfile()).includes("credentialRef"));
		assert.ok(!JSON.stringify(runtime).includes("secret:fixture"));
	});
}

test("profile rejects unknown keys, latest aliases, plaintext/credential URLs and unbounded limits", () => {
	for (const changes of [
		{ provider: "unsupported" },
		{ model: "gemini-flash-latest" },
		{ endpoint: "http://remote.example" },
		{ endpoint: "https://user:secret@example.test" },
		{ endpoint: "https://example.test?api_key=secret" },
		{ apiKey: "untrusted-inline-value" },
		{ credentialRef: "inline-provider-key" },
		{ limits: { ...profile().limits, maxAttempts: 9 } },
		{ limits: { ...profile().limits, maxRequests: 0 } },
	])
		assert.throws(() => parseModelProfile({ ...profile(), ...changes }), /configuration|endpoint|profile|model/i);
});

test("owner mismatch and exhausted budget stop before credential resolution", async () => {
	let secrets = 0;
	const runtime = createModelRuntime(profile(), {
		resolveCredential: async () => {
			secrets++;
			return randomBytes(32).toString("base64url");
		},
		adapter: async () => ({ output: { toc: 1, recommendation: "Fixture" } }),
	});
	await assert.rejects(
		runtime.generate({ prompt: "x", schema: outputSchema }, { customerId: "other", employeeId: "geologist" }),
		/scope|owner|forbidden/i,
	);
	assert.equal(secrets, 0);
	await runtime.generate({ prompt: "x", schema: outputSchema });
	await runtime.generate({ prompt: "x", schema: outputSchema });
	await assert.rejects(runtime.generate({ prompt: "x", schema: outputSchema }), /budget/i);
	assert.equal(secrets, 2);
});

test("missing credential and unsupported capability cannot silently invoke a default provider", async () => {
	let calls = 0;
	const adapter = async () => {
		calls++;
		return { output: { toc: 1, recommendation: "Fixture" } };
	};
	const missing = createModelRuntime(profile(), {
		resolveCredential: async () => {
			throw new Error("unsafe key text");
		},
		adapter,
	});
	await assert.rejects(missing.generate({ prompt: "x", schema: outputSchema }), /credential|auth/i);
	const unsupported = createModelRuntime(
		parseModelProfile({ ...profile(), capabilities: { toolUse: false, structuredOutput: false } }),
		{
			resolveCredential: async () => randomBytes(32).toString("base64url"),
			adapter,
		},
	);
	await assert.rejects(unsupported.generate({ prompt: "x", schema: outputSchema }), /capability/i);
	assert.equal(calls, 0);
});

test("malformed output and reflected credentials are safe failures without invented replacements", async () => {
	const key = randomBytes(32).toString("base64url");
	for (const output of [{ toc: 99, recommendation: "invalid" }, { toc: 1, recommendation: key }, { toc: 1 }]) {
		const runtime = createModelRuntime(profile(), {
			resolveCredential: async () => key,
			adapter: async () => ({ output }),
		});
		await assert.rejects(runtime.generate({ prompt: "x", schema: outputSchema }), (error: Error) => {
			assert.ok(!String(error).includes(key));
			return /output|secret|schema/i.test(String(error));
		});
	}
});

test("private credential references in prompts or schemas stop before provider dispatch", async () => {
	let calls = 0;
	for (const input of [
		{ prompt: profile().credentialRef, schema: outputSchema },
		{ prompt: "Fixture", schema: { ...outputSchema, description: profile().credentialRef } },
	]) {
		const runtime = createModelRuntime(profile(), {
			resolveCredential: async () => randomBytes(32).toString("base64url"),
			adapter: async () => {
				calls++;
				return { output: { toc: 1, recommendation: "Fixture" } };
			},
		});
		await assert.rejects(runtime.generate(input), /input/i);
	}
	assert.equal(calls, 0);
});

test("deadline and cancellation abort the selected adapter without replay", async () => {
	for (const cancel of [false, true]) {
		let calls = 0;
		let aborted = false;
		const controller = new AbortController();
		const settings = parseModelProfile({ ...profile(), limits: { ...profile().limits, timeoutMs: 25 } });
		const runtime = createModelRuntime(settings, {
			resolveCredential: async () => randomBytes(32).toString("base64url"),
			adapter: async (_settings, _credential, _input, signal) => {
				calls++;
				return await new Promise((_, reject) => {
					signal.addEventListener(
						"abort",
						() => {
							aborted = true;
							reject(new Error("unsafe vendor error"));
						},
						{ once: true },
					);
					if (cancel) controller.abort();
				});
			},
		});
		await assert.rejects(
			runtime.generate({ prompt: "x", schema: outputSchema, signal: controller.signal }),
			/timeout|cancel/i,
		);
		assert.equal(calls, 1);
		assert.equal(aborted, true);
	}
});

for (const provider of ["gemini", "anthropic"] as const) {
	test(`${provider} maintained SDK serializes explicit credentials, model and schema without ambient auth`, async () => {
		const key = randomBytes(32).toString("base64url");
		const calls: { url: string; body: Record<string, any> }[] = [];
		const runtime = createModelRuntime(profile(provider), {
			resolveCredential: async () => key,
			fetch: async (resource, init) => {
				const url = resource instanceof Request ? resource.url : String(resource);
				const headers = new Headers(init?.headers);
				assert.equal(headers.get(provider === "gemini" ? "x-goog-api-key" : "x-api-key"), key);
				assert.equal(init?.redirect, "error");
				assert.equal(init?.signal?.aborted, false);
				const body = JSON.parse(String(init?.body));
				calls.push({ url, body });
				const output = { toc: 1.25, recommendation: "Offline controlled result" };
				const response =
					provider === "gemini"
						? {
								candidates: [
									{ content: { role: "model", parts: [{ text: JSON.stringify(output) }] }, finishReason: "STOP" },
								],
								modelVersion: "fixture-native-001",
							}
						: {
								id: "fixture",
								type: "message",
								role: "assistant",
								model: "fixture-native-001",
								content: [{ type: "tool_use", id: "fixture-tool", name: "submit_result", input: output }],
								stop_reason: "tool_use",
								usage: { input_tokens: 12, output_tokens: 16 },
							};
				return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
			},
		});
		const result = await runtime.generate({ prompt: "Reference context", schema: outputSchema });
		assert.equal(calls.length, 1);
		assert.equal(result.metadata.reportedModelRevision, "fixture-native-001");
		if (provider === "gemini") {
			assert.ok(calls[0].url.includes(`models/${profile(provider).model}:generateContent`));
			assert.equal(calls[0].body.generationConfig.maxOutputTokens, 256);
			assert.deepEqual(calls[0].body.generationConfig.responseJsonSchema, outputSchema);
		} else {
			assert.equal(calls[0].body.model, profile(provider).model);
			assert.equal(calls[0].body.max_tokens, 256);
			assert.deepEqual(calls[0].body.tools[0].input_schema, outputSchema);
			assert.equal(calls[0].body.tool_choice.name, "submit_result");
		}
		assert.deepEqual((await runtime.fork?.().generate({ prompt: "x", schema: outputSchema }))?.output, result.output);
	});
	test(`${provider} provider failure stays selected and bounded, with safe errors`, async () => {
		const key = randomBytes(32).toString("base64url");
		let calls = 0;
		const runtime = createModelRuntime(profile(provider), {
			resolveCredential: async () => key,
			fetch: async () => {
				calls++;
				return new Response(JSON.stringify({ error: { message: key, type: "authentication_error" } }), {
					status: 401,
					headers: { "content-type": "application/json" },
				});
			},
		});
		await assert.rejects(runtime.generate({ prompt: "x", schema: outputSchema }), (error: Error) => {
			assert.ok(!String(error).includes(key));
			return /provider/.test(String(error));
		});
		assert.equal(calls, 1);
	});
}

test("separate production and judge profiles are strict and use distinct judge references", () => {
	const agent = { ...profile(), purpose: "agent" };
	const synthesis = profile();
	const judge = { ...profile(), purpose: "judge", credentialRef: "secret:fixture/geologist/judge" };
	const value = { version: "0.1.0", agent, synthesis, judge };
	assert.equal(parseReferenceModelConfig(value).judge?.purpose, "judge");
	assert.equal(parseReferenceModelConfig({ ...value, judge: null }).judge, null);
	for (const changes of [
		{ judge: { ...judge, credentialRef: agent.credentialRef } },
		{ synthesis: profile("anthropic") },
		{ agent: { ...agent, owner: { customerId: "other", employeeId: "geologist" } } },
		{ extra: true },
	])
		assert.throws(() => parseReferenceModelConfig({ ...value, ...changes }), /configuration/);
});

test("credential files are private, owned, bounded and scoped; no path or key escapes", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "model-credential-"));
	const file = path.join(directory, "key"),
		link = path.join(directory, "link");
	const key = randomBytes(32).toString("base64url");
	const resolve = createFileModelCredentialResolver(profile().owner);
	try {
		await fs.writeFile(file, key, { mode: 0o600 });
		assert.equal(await resolve(profile().owner, `file:${file}`, "synthesis"), key);
		await assert.rejects(
			resolve({ customerId: "other", employeeId: "geologist" }, `file:${file}`, "synthesis"),
			/owner/,
		);
		await assert.rejects(resolve(profile().owner, "secret:uninstalled-adapter", "synthesis"), /credential/);
		await fs.symlink(file, link);
		await assert.rejects(resolve(profile().owner, `file:${link}`, "synthesis"), /credential/);
		await fs.chmod(file, 0o644);
		await assert.rejects(resolve(profile().owner, `file:${file}`, "synthesis"), /credential/);
		await fs.chmod(file, 0o600);
		await fs.writeFile(file, "x".repeat(4097));
		await assert.rejects(resolve(profile().owner, `file:${file}`, "synthesis"), /credential/);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test("private reference file validates the entire binding before execution", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "model-profile-"));
	const file = path.join(dir, "profile.json");
	try {
		const config = { version: "0.1.0", agent: { ...profile(), purpose: "agent" }, synthesis: profile(), judge: null };
		await fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
		assert.equal((await readPrivateReferenceModelConfig(file)).synthesis.provider, "gemini");
		await fs.writeFile(file, "invalid-json");
		await assert.rejects(readPrivateReferenceModelConfig(file), /configuration/);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});
