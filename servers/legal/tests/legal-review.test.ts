import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { LegalReviewWorkflow } from "../src/review-workflow.js";
import { who } from "./fixtures/legal.js";
import { reviewFixture } from "./fixtures/review.js";

test("enrolled legal reviewer inspects all exact sources, approves a private memo, and resumes once after restart", async () => {
	const f = await reviewFixture();
	let reopened: LegalReviewWorkflow | undefined;
	try {
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		await assert.rejects(f.workflow.inspect(prepared.reviewId, who), /authority_denied/);
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.sources.length, 3);
		assert.equal(packet.packet.legal.legalClearance, false);
		assert.equal(packet.packet.legal.professionalAcceptance, false);
		assert.ok(packet.packet.sources.some((s) => s.text.includes("Café 🛢 LLC")));
		assert.ok(packet.packet.sources.some((s) => s.text.includes("requiredDocumentRefs")));
		await assert.rejects(
			f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Self clearance", who),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Reviewed this exact private advisory memo; no legal clearance granted",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new LegalReviewWorkflow(f.directory, f.options);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const outcome = await reopened.execute(request, who);
		assert.equal(outcome.stored, true);
		assert.match(outcome.uri, /^urn:legal:/);
		assert.deepEqual(await reopened.execute(request, who), outcome);
		assert.equal(reopened.findingCount(), 1);
		f.revoke();
		await assert.rejects(reopened.execute(request, who));
	} finally {
		reopened?.close();
		f.close();
	}
});

test("fabricated quotes, applicability, coverage, work findings or clearance cannot create a review", async () => {
	const f = await reviewFixture();
	try {
		for (const alter of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.legal.issues[0].citations[0].quote = "No approval required";
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.legal.applicability[0].reasons = ["expired"];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.legal.coverage.coveredQuestionRefs = [];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				Object.assign(c.legal, { legalClearance: true });
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.work.findings[0].value = "No approval required";
			},
		]) {
			const candidate = await f.candidate();
			alter(candidate);
			await assert.rejects(f.workflow.prepare(candidate, who, null), /source_fidelity_mismatch/);
		}
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("the agent may propose its own cited analysis; the backend does not substitute an operator memo", async () => {
	const f = await reviewFixture();
	try {
		f.proposal.issues[0].statement =
			"The quoted transfer clause requires written approval; counsel must assess its application to the proposed transaction.";
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.legal.issues[0].statement, f.proposal.issues[0].statement);
		assert.equal(packet.packet.legal.legalClearance, false);
	} finally {
		f.close();
	}
});

test("request changes and rejection cannot authorize execution or revive an older memo revision", async () => {
	const f = await reviewFixture();
	try {
		const first = await f.workflow.prepare(await f.candidate(), who, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Clarify the stated scope and source conflict",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: first.reviewId, packetDigest: first.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
		const second = await f.workflow.prepare(await f.candidate("r2"), who, first.packetDigest);
		await assert.rejects(
			f.workflow.decide(first.reviewId, first.packetDigest, "approve", "Old revision", f.reviewer),
			/revision_mismatch/,
		);
		await f.workflow.decide(
			second.reviewId,
			second.packetDigest,
			"reject",
			"Sources do not resolve the legal question",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: second.reviewId, packetDigest: second.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
	} finally {
		f.close();
	}
});

test("changed contract text or enrolled reviewer authority invalidates previous human approval", async () => {
	for (const change of ["source", "reviewer"] as const) {
		const f = await reviewFixture();
		try {
			const pending = await f.workflow.prepare(await f.candidate(), who, null);
			const approved = await f.workflow.decide(
				pending.reviewId,
				pending.packetDigest,
				"approve",
				"Exact source-bound private memo",
				f.reviewer,
			);
			if (change === "source") {
				f.corpus.documents[0].sections[0].text = "A revised contract requires fresh analysis.";
				f.texts.set("corpus", JSON.stringify(f.corpus));
				f.bind();
			} else {
				f.policy.reviewerIds = [];
			}
			await assert.rejects(
				f.workflow.execute(
					{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
					who,
				),
			);
		} finally {
			f.close();
		}
	}
});

test("installed qualification and mandatory gates cannot be replaced by a model's eval claims", async () => {
	const f = await reviewFixture();
	let unqualified: LegalReviewWorkflow | undefined;
	try {
		unqualified = new LegalReviewWorkflow(`${f.directory}-unqualified`, {
			...f.options,
			qualificationGuard: undefined,
		});
		const pending = await unqualified.prepare(await f.candidate(), who, null);
		await assert.rejects(
			unqualified.decide(pending.reviewId, pending.packetDigest, "approve", "Model claims pass", f.reviewer),
			/qualification/,
		);
		f.policy.requiredGates = [];
		await assert.rejects(f.workflow.prepare(await f.candidate(), who, null), /required_gates/);
	} finally {
		unqualified?.close();
		rmSync(`${f.directory}-unqualified`, { recursive: true, force: true });
		f.close();
	}
});

test("review context cannot omit or duplicate evidence or omit the working memo", async () => {
	const f = await reviewFixture();
	try {
		for (const alter of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.selectedEvidence.pop();
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.selectedEvidence[1] = c.context.selectedEvidence[0];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.workingArtifactRefs = [];
			},
		]) {
			const candidate = await f.candidate();
			alter(candidate);
			await assert.rejects(f.workflow.prepare(candidate, who, null), /context_binding_mismatch/);
		}
	} finally {
		f.close();
	}
});
