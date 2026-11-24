import assert from "node:assert/strict";
import { test } from "node:test";
import { RiskReviewWorkflow } from "../src/review-workflow.js";
import { reviewFixture } from "./fixtures/review.js";
import { who } from "./fixtures/risk.js";

test("enrolled owner inspects all actual risk inputs, approves an exact packet, and resumes one private record after restart", async () => {
	const f = await reviewFixture();
	let reopened: RiskReviewWorkflow | undefined;
	try {
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		await assert.rejects(f.workflow.inspect(prepared.reviewId, who), /authority_denied/);
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.sources.length, 3);
		assert.ok(packet.packet.sources.some((source) => source.text.includes("escalateSeverities")));
		assert.ok(packet.packet.sources.some((source) => source.text.includes("exhaustiveWithinDeclaredModel")));
		await assert.rejects(
			f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Self acceptance", who),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Owner reviewed exact hypothetical assumptions and risk policy",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new RiskReviewWorkflow(f.directory, f.options);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const outcome = await reopened.execute(request, who);
		assert.equal(outcome.stored, true);
		assert.match(outcome.uri, /^urn:risk:/);
		assert.deepEqual(await reopened.execute(request, who), outcome);
		assert.equal(reopened.findingCount(), 1);
		f.revoke();
		await assert.rejects(reopened.execute(request, who));
	} finally {
		reopened?.close();
		f.close();
	}
});

test("invented loss, correlations, policy coverage or self-acceptance cannot create a review", async () => {
	const f = await reviewFixture();
	try {
		for (const change of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.risk.summary.expectedLoss = 81;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.risk.correlations[0].correlation.value = 0.85;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.risk.coverage.status = "failed";
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.risk.riskAccepted = true;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.work.findings[0].value = 81;
			},
		]) {
			const candidate = await f.candidate();
			change(candidate);
			await assert.rejects(f.workflow.prepare(candidate, who, null), /source_fidelity_mismatch/);
		}
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("request-changes and rejection cannot become execution or approval of a retired revision", async () => {
	const f = await reviewFixture();
	try {
		const first = await f.workflow.prepare(await f.candidate(), who, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Revise the declared dependence basis",
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
			"Risk owner rejects this basis",
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

test("changed policy or joint-state sources invalidate prior human authority", async () => {
	const f = await reviewFixture();
	try {
		const pending = await f.workflow.prepare(await f.candidate(), who, null);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Exact previous risk inputs",
			f.reviewer,
		);
		f.riskPolicy.maxExpectedLoss = 10;
		f.texts.set("policy", JSON.stringify(f.riskPolicy));
		f.bind();
		await assert.rejects(
			f.workflow.execute(
				{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
				who,
			),
		);
	} finally {
		f.close();
	}
});

test("model eval claims cannot replace installed qualification and review gates cannot be removed", async () => {
	const f = await reviewFixture();
	let unqualified: RiskReviewWorkflow | undefined;
	try {
		unqualified = new RiskReviewWorkflow(`${f.directory}-unqualified`, { ...f.options, qualificationGuard: undefined });
		const pending = await unqualified.prepare(await f.candidate(), who, null);
		await assert.rejects(
			unqualified.decide(pending.reviewId, pending.packetDigest, "approve", "Claimed model pass", f.reviewer),
			/qualification/,
		);
		f.policy.requiredGates = [];
		await assert.rejects(f.workflow.prepare(await f.candidate(), who, null), /required_gates/);
	} finally {
		unqualified?.close();
		f.close();
	}
});

test("review context cannot omit, duplicate, replace or silently share the work's source evidence", async () => {
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
