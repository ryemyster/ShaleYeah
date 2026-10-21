import assert from "node:assert/strict";
import { test } from "node:test";
import { createModelRuntime, parseModelProfile } from "@shaleyeah/sdk";
import { createReporterTemplate } from "../src/server.js";
import { fixture } from "./fixtures/review-fixture.js";

for (const provider of ["gemini", "anthropic"] as const)
	test(`explicit ${provider} synthesis is an unreviewed cited note, with no default model or publication`, async () => {
		const f = fixture();
		try {
			const policy = await f.options.currentPolicy();
			const owner = { customerId: f.requester.customerId, employeeId: f.requester.employeeId };
			const profile = parseModelProfile({
				version: "0.1.0",
				id: "reporter-synthesis",
				revision: "r1",
				purpose: "synthesis",
				owner,
				provider,
				model: provider === "gemini" ? "gemini-fixture-001" : "claude-fixture-001",
				modelRevision: "fixture-001",
				endpoint: provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.anthropic.com",
				credentialRef: "secret:reporter-synthesis",
				capabilities: { toolUse: true, structuredOutput: true },
				limits: { timeoutMs: 30000, maxAttempts: 1, maxOutputTokens: 512, maxRequests: 4, maxInputChars: 262144 },
			});
			let sourceId = f.receipt.work.artifact.id;
			let seen = 0;
			const runtime = createModelRuntime(profile, {
				resolveCredential: async (actual, reference, purpose) => {
					assert.deepEqual(actual, owner);
					assert.equal(reference, profile.credentialRef);
					assert.equal(purpose, "synthesis");
					return "fixture-own-synthesis-key";
				},
				adapter: async (configured, key, input) => {
					seen++;
					assert.equal(key, "fixture-own-synthesis-key");
					assert.equal(configured.provider, provider);
					assert.ok(input.prompt.includes(f.receipt.work.artifact.id));
					assert.ok(!input.prompt.includes(key));
					return { output: { note: "Review source uncertainty before publication", sourceIds: [sourceId] } };
				},
			});
			const template = createReporterTemplate({
				...f.options,
				localPrincipal: f.requester,
				currentTask: async () => policy.task,
				modelRuntime: runtime,
			});
			const call = async (name: string, args: object = {}) =>
				template.tools.find((tool) => tool.name === name)!.handler(args);
			const discovery = await call("get_model_profile");
			assert.equal(discovery.analysis.provider, provider);
			assert.equal(discovery.analysis.credentialRef, undefined);
			const result = await call("synthesize_report", { sourceIds: [f.receipt.work.artifact.id] });
			assert.equal(result.analysis.status, "unreviewed");
			assert.equal(result.analysis.publicationAllowed, false);
			assert.equal(seen, 1);
			assert.equal(
				(await call("get_reviewed_source", { sourceId: f.receipt.work.artifact.id })).analysis.work.review.status,
				"approved",
			);
			sourceId = "product.unauthorized";
			await assert.rejects(
				() => call("synthesize_report", { sourceIds: [f.receipt.work.artifact.id] }),
				/source_fidelity_mismatch/,
			);
			const absent = createReporterTemplate({
				...f.options,
				localPrincipal: f.requester,
				currentTask: async () => policy.task,
			});
			await assert.rejects(
				() =>
					absent.tools
						.find((tool) => tool.name === "synthesize_report")!
						.handler({ sourceIds: [f.receipt.work.artifact.id] }),
				/model_configuration/,
			);
		} finally {
			f.close();
		}
	});
