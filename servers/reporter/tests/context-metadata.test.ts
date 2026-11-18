import assert from "node:assert/strict";
import { test } from "node:test";
import { ReviewedSources } from "../src/reviewed-sources.js";
import { fixture } from "./fixtures/review-fixture.js";

test("reviewed work sharing grants its business metadata but cannot grant underlying source metadata by itself", async () => {
	const f = fixture();
	try {
		const evidence = f.candidate().work.evidence[0];
		const business = await f.options.sources.metadata(evidence.id, f.requester, "read");
		assert.deepEqual(business.evidence, evidence);
		assert.equal(business.allowed, true);
		await assert.rejects(() => f.options.sources.metadata(f.receipt.work.evidence[0].id, f.requester, "read"));
	} finally {
		f.close();
	}
});
test("underlying evidence metadata needs its own current exact recipient grant, with revocation and byte drift enforced", async () => {
	const f = fixture();
	try {
		const grant = {
			workRef: f.receipt.work.artifact,
			evidence: structuredClone(f.receipt.work.evidence[0]),
			subjectId: f.requester.subjectId,
			recipientScope: f.receipt.recipientScope,
			operations: ["read", "export"],
			current: true,
			expiresAt: f.receipt.expiresAt,
		};
		const sources = new ReviewedSources({
			scope: f.receipt.recipientScope,
			current: async () => f.receipt,
			currentMetadata: async () => grant,
			contentGuard: async () => true,
			clock: () => new Date("2026-10-13T00:00:00Z"),
			maxSourceAgeSeconds: 31536000,
		});
		assert.equal((await sources.metadata(grant.evidence.id, f.requester, "export")).allowed, true);
		grant.current = false;
		await assert.rejects(() => sources.metadata(grant.evidence.id, f.requester, "read"));
		grant.current = true;
		grant.evidence.hash.value = "a".repeat(64);
		await assert.rejects(() => sources.metadata(grant.evidence.id, f.requester, "read"));
	} finally {
		f.close();
	}
});
