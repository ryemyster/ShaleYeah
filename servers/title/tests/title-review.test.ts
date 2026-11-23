import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { TitleReviewWorkflow } from "../src/review-workflow.js";
import { reviewFixture } from "./fixtures/review.js";
import { who } from "./fixtures/title.js";

test("a separately enrolled title reviewer inspects exact sources and private recording resumes once after restart", async () => {
	const f = await reviewFixture();
	let reopened: TitleReviewWorkflow | undefined;
	try {
		const pending = await f.workflow.prepare(await f.candidate(), who, null);
		await assert.rejects(f.workflow.inspect(pending.reviewId, who), /authority_denied/);
		const inspected = await f.workflow.inspect(pending.reviewId, f.reviewer);
		assert.equal(inspected.packet.sources.length, 3);
		assert.equal(inspected.packet.title.titleClearance, false);
		assert.equal(inspected.packet.title.professionalAcceptance, false);
		assert.ok(inspected.packet.sources.some((s) => s.text.includes("Élodie 🛢 LLC")));
		assert.ok(inspected.packet.sources.some((s) => s.text.includes("requiredInstrumentRefs")));
		await assert.rejects(
			f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Self approval", who),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Reviewed this exact private packet; no title clearance or external authority",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new TitleReviewWorkflow(f.directory, f.options);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const result = await reopened.execute(request, who);
		assert.equal(result.stored, true);
		assert.match(result.uri, /^urn:title:/);
		assert.deepEqual(await reopened.execute(request, who), result);
		assert.equal(reopened.findingCount(), 1);
		f.revoke();
		await assert.rejects(reopened.execute(request, who));
	} finally {
		reopened?.close();
		f.close();
	}
});

test("forged source citations, fractions, coverage, work or clearance cannot prepare a private review", async () => {
	const f = await reviewFixture();
	try {
		for (const alter of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.title.observations[0].citations[0].quote = "The agent owns all title";
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.title.netRevenue[0].netRevenueInterest = "1/1";
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.title.coverage.coveredQuestionIds = [];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				Object.assign(c.title, { titleClearance: true });
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.work.findings[0].value = "model-invented-value";
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

test("the employee's own cited observation survives review without replacing canonical source arithmetic", async () => {
	const f = await reviewFixture();
	try {
		f.proposal.observations[0].statement =
			"The supplied operating transfer is depth-limited; ask the reviewer to assess its legal effect.";
		const pending = await f.workflow.prepare(await f.candidate(), who, null);
		const inspected = await f.workflow.inspect(pending.reviewId, f.reviewer);
		assert.equal(inspected.packet.title.observations[0].statement, f.proposal.observations[0].statement);
		assert.equal(inspected.packet.title.netRevenue[0].netRevenueInterest, "5/16");
		assert.equal(inspected.packet.title.titleClearance, false);
	} finally {
		f.close();
	}
});

test("request changes and rejection cannot approve an earlier revision or authorize recording", async () => {
	const f = await reviewFixture();
	try {
		const first = await f.workflow.prepare(await f.candidate(), who, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Clarify the supplied chain and scope",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: first.reviewId, packetDigest: first.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
		const second = await f.workflow.prepare(await f.candidate("r2"), who, first.packetDigest);
		await assert.rejects(
			f.workflow.decide(first.reviewId, first.packetDigest, "approve", "Old packet", f.reviewer),
			/revision_mismatch/,
		);
		await f.workflow.decide(second.reviewId, second.packetDigest, "reject", "Source chain is not accepted", f.reviewer);
		await assert.rejects(
			f.workflow.execute({ reviewId: second.reviewId, packetDigest: second.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
	} finally {
		f.close();
	}
});

test("changed instrument bytes or reviewer enrollment invalidates a prior approval", async () => {
	for (const change of ["source", "reviewer"] as const) {
		const f = await reviewFixture();
		try {
			const pending = await f.workflow.prepare(await f.candidate(), who, null);
			const approved = await f.workflow.decide(
				pending.reviewId,
				pending.packetDigest,
				"approve",
				"Exact supplied-source packet",
				f.reviewer,
			);
			if (change === "source") {
				f.corpus.documents[0].sections[0].text = "A revised opening claim needs fresh examination.";
				f.texts.set("corpus", JSON.stringify(f.corpus));
				f.bind();
			} else f.policy.reviewerIds = [];
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

test("missing installed qualification and removed mandatory gates cannot be waived by claimed passing evals", async () => {
	const f = await reviewFixture();
	let unqualified: TitleReviewWorkflow | undefined;
	try {
		unqualified = new TitleReviewWorkflow(`${f.directory}-unqualified`, {
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

test("review context cannot omit or duplicate source evidence or substitute another working artifact", async () => {
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
