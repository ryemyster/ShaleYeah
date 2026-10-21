import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./fixtures/review-fixture.js";

test("Reporter accepts exact reviewed shared context and own pending work, with no raw-data profile substitution", async () => {
	const f = fixture();
	try {
		const candidate = f.candidate();
		candidate.context.selectedEvidence = [];
		candidate.context.workingArtifactRefs = [candidate.work.artifact];
		candidate.context.sharedKnowledge = [
			{
				artifact: f.receipt.work.artifact,
				origin: f.receipt.work.scope,
				evidence: f.receipt.work.evidence,
				reviewDecisionRef: { id: f.receipt.decision.id, revision: f.receipt.decision.revision },
				usagePolicy: f.receipt.usagePolicy,
				retentionPolicy: f.receipt.retentionPolicy,
			},
		];
		const prepared = await f.workflow.prepare(candidate, f.requester, null);
		assert.equal(prepared.state, "awaiting-review");
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.context.sharedKnowledge.length, 1);
		assert.deepEqual(packet.packet.context.workingArtifactRefs, [candidate.work.artifact]);
	} finally {
		f.close();
	}
});
test("another origin, changed review, foreign context evidence or another work reference cannot enter publication review", async () => {
	for (const mutation of ["origin", "review", "policy", "evidence", "working"]) {
		const f = fixture();
		try {
			const candidate = f.candidate();
			candidate.context.selectedEvidence = [];
			candidate.context.workingArtifactRefs = [candidate.work.artifact];
			candidate.context.sharedKnowledge = [
				{
					artifact: f.receipt.work.artifact,
					origin: f.receipt.work.scope,
					evidence: f.receipt.work.evidence,
					reviewDecisionRef: { id: f.receipt.decision.id, revision: f.receipt.decision.revision },
					usagePolicy: f.receipt.usagePolicy,
					retentionPolicy: f.receipt.retentionPolicy,
				},
			];
			if (mutation === "origin")
				candidate.context.sharedKnowledge[0].origin = { ...f.receipt.work.scope, employeeId: "other" };
			if (mutation === "review")
				candidate.context.sharedKnowledge[0].reviewDecisionRef = { id: "decision.forged", revision: "r1" };
			if (mutation === "policy")
				candidate.context.sharedKnowledge[0].usagePolicy = { id: "policy.unrestricted", version: "r1" };
			if (mutation === "evidence")
				candidate.context.selectedEvidence = [{ ...candidate.work.evidence[0], id: "evidence.foreign" }];
			if (mutation === "working")
				candidate.context.workingArtifactRefs = [{ ...candidate.work.artifact, id: "product.other" }];
			await assert.rejects(() => f.workflow.prepare(candidate, f.requester, null));
		} finally {
			f.close();
		}
	}
});
