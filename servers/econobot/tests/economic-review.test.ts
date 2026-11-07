import assert from "node:assert/strict";
import { test } from "node:test";
import { EconomicScenarioWorkflow } from "../src/review-workflow.js";
import { reviewFixture } from "./fixtures/review.js";
import { who } from "./fixtures/scenario.js";

test("human inspects actual complete financial evidence and private save survives restart exactly once", async () => {
	const f = await reviewFixture();
	let reopened: EconomicScenarioWorkflow | undefined;
	try {
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		await assert.rejects(f.workflow.inspect(prepared.reviewId, who), /authority_denied/);
		const preview = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(preview.packet.sources.length, 7);
		assert.ok(preview.packet.sources.some((source) => source.text.includes("netOperatingExpense")));
		await assert.rejects(
			f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Self approval", who),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Reviewed exact source basis",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new EconomicScenarioWorkflow(f.directory, f.options);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const result = await reopened.execute(request, who);
		assert.equal(result.stored, true);
		assert.match(result.uri, /^urn:economics:/);
		assert.deepEqual(await reopened.execute(request, who), result);
		assert.equal(reopened.findingCount(), 1);
		f.revoke("evidence.prices");
		await assert.rejects(reopened.execute(request, who), /source_unavailable|verification_unavailable/);
	} finally {
		reopened?.close();
		f.close();
	}
});

test("invented numerical truth or capital authority is rejected before creating a review", async () => {
	const f = await reviewFixture();
	try {
		const invented = await f.candidate();
		invented.scenario.scenarios[0].economics.npv.value = 999999;
		await assert.rejects(f.workflow.prepare(invented, who, null), /source_fidelity_mismatch/);
		const work = await f.candidate();
		work.work.findings[0].value = 999999;
		await assert.rejects(f.workflow.prepare(work, who, null), /source_fidelity_mismatch/);
		const authority = await f.candidate();
		Object.assign(authority.scenario, { authorizesInvestment: true });
		await assert.rejects(f.workflow.prepare(authority, who, null), /source_fidelity_mismatch/);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("request changes and rejection cannot be converted into execution or stale approval", async () => {
	const f = await reviewFixture();
	try {
		const first = await f.workflow.prepare(await f.candidate(), who, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Use another exact work revision",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: first.reviewId, packetDigest: first.packetDigest, grantId: "invented" }, who),
			/approval_required/,
		);
		const second = await f.workflow.prepare(await f.candidate("r2"), who, first.packetDigest);
		await assert.rejects(
			f.workflow.decide(first.reviewId, first.packetDigest, "approve", "Old version", f.reviewer),
			/revision_mismatch/,
		);
		await f.workflow.decide(second.reviewId, second.packetDigest, "reject", "Financial basis rejected", f.reviewer);
		await assert.rejects(
			f.workflow.execute({ reviewId: second.reviewId, packetDigest: second.packetDigest, grantId: "invented" }, who),
			/approval_required/,
		);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("changed financial assumptions and task inputs invalidate a previously approved scenario", async () => {
	const f = await reviewFixture();
	try {
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Exact old basis",
			f.reviewer,
		);
		f.current.scenarios[0].discountRate = 0.2;
		await assert.rejects(
			f.workflow.execute(
				{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
				who,
			),
			/source_fidelity_mismatch/,
		);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("a missing trusted qualification guard cannot approve a candidate with claimed passing evals", async () => {
	const f = await reviewFixture();
	let unqualified: EconomicScenarioWorkflow | undefined;
	try {
		f.workflow.close();
		unqualified = new EconomicScenarioWorkflow(f.directory, { ...f.options, qualificationGuard: undefined });
		const prepared = await unqualified.prepare(await f.candidate(), who, null);
		await assert.rejects(
			unqualified.decide(prepared.reviewId, prepared.packetDigest, "approve", "Claimed passing labels", f.reviewer),
			/qualification/,
		);
		assert.equal(unqualified.findingCount(), 0);
	} finally {
		unqualified?.close();
		f.close();
	}
});
test("native context may order exact evidence differently but cannot omit, duplicate or replace it", async () => {
	const f = await reviewFixture();
	try {
		const candidate = await f.candidate();
		candidate.context.selectedEvidence = [...candidate.context.selectedEvidence].reverse();
		const prepared = await f.workflow.prepare(candidate, who, null);
		assert.equal(prepared.state, "awaiting-review");
		for (const mutation of ["missing", "duplicate", "hash", "work"]) {
			const wrong: typeof candidate = JSON.parse(JSON.stringify(candidate));
			if (mutation === "missing") wrong.context.selectedEvidence.pop();
			if (mutation === "duplicate") wrong.context.selectedEvidence[0] = wrong.context.selectedEvidence[1];
			if (mutation === "hash") wrong.context.selectedEvidence[0].hash.value = "0".repeat(64);
			if (mutation === "work") wrong.context.workingArtifactRefs = [];
			await assert.rejects(f.workflow.prepare(wrong, who, prepared.packetDigest), /context_binding_mismatch/);
		}
	} finally {
		f.close();
	}
});
