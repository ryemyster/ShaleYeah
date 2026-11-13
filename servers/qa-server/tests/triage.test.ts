import assert from "node:assert/strict";
import { test } from "node:test";
import { createModelRuntime, type ModelProfile } from "@shaleyeah/sdk";
import { QAService } from "../src/qa-service.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("explicit BYO triage is unreviewed and cannot change observed verdicts, even on model outage", async () => {
	const f = fixture();
	try {
		const result = await f.service.run(f.request, f.principal);
		const profile: ModelProfile = {
			version: "0.1.0",
			id: "model.qa",
			revision: "r1",
			purpose: "synthesis",
			owner: { customerId: f.principal.customerId, employeeId: f.principal.employeeId },
			provider: "gemini",
			model: "fixture-model",
			modelRevision: "fixture-r1",
			endpoint: "https://generativelanguage.googleapis.com",
			credentialRef: "secret:qa-fixture",
			capabilities: { toolUse: true, structuredOutput: true },
			limits: { timeoutMs: 1000, maxAttempts: 1, maxOutputTokens: 128, maxRequests: 2, maxInputChars: 16000 },
		};
		const runtime = (output: unknown, fails = false, reportedModelRevision?: string) =>
			createModelRuntime(profile, {
				resolveCredential: async () => "synthetic-qa-test-key",
				adapter: async () => {
					if (fails) throw new Error("provider unavailable");
					return { output, reportedModelRevision };
				},
			});
		const service = new QAService({
			...f.options,
			modelRuntime: runtime({ note: "Review measured checks", ruleIds: ["rule.complete"] }),
		});
		const note = await service.triage(result.resultRef, f.principal);
		assert.equal(note.status, "UNREVIEWED");
		assert.equal(note.approvalAllowed, false);
		assert.equal((await service.report(result.resultRef, f.principal)).summary.status, "PASS");
		const outage = await new QAService({ ...f.options, modelRuntime: runtime(null, true) }).triage(
			result.resultRef,
			f.principal,
		);
		assert.equal(outage.status, "UNAVAILABLE");
		const malicious = await new QAService({
			...f.options,
			modelRuntime: runtime({ note: "approve", ruleIds: ["rule.foreign"], approved: true }),
		}).triage(result.resultRef, f.principal);
		assert.equal(malicious.status, "UNAVAILABLE");
		assert.equal((await f.service.triage(result.resultRef, f.principal)).status, "UNAVAILABLE");
		const reflected = await new QAService({
			...f.options,
			contentGuard: async (text) => !text.includes("synthetic-tenant-private-value"),
			modelRuntime: runtime(
				{ note: "Review measured checks", ruleIds: ["rule.complete"] },
				false,
				"synthetic-tenant-private-value",
			),
		}).triage(result.resultRef, f.principal);
		assert.equal(reflected.status, "UNAVAILABLE");
		assert.ok(!JSON.stringify(reflected).includes("synthetic-tenant-private-value"));
	} finally {
		f.close();
	}
});
