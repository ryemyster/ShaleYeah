import assert from "node:assert/strict";
import { test } from "node:test";
import { QADispositionWorkflow } from "../src/review-workflow.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("the backend drafts exact source-bound work so the model cannot invent artifact hashes or approve defects", async () => {
	const f = await fixture();
	try {
		const expected = f.candidate();
		const actual = await f.workflow.draft(f.report.resultRef, expected.disposition.proposal, "r1", f.requester);
		assert.deepEqual(actual.work, expected.work);
		assert.deepEqual(actual.disposition, expected.disposition);
		assert.equal(actual.disposition.observedReport.summary.status, "FAIL");
		assert.equal(actual.disposition.approvalAllowed, false);
		f.policy.revoked = true;
		await assert.rejects(
			() => f.workflow.draft(f.report.resultRef, expected.disposition.proposal, "r1", f.requester),
			/authority_denied/,
		);
	} finally {
		f.close();
	}
});

test("authenticated owner disposition survives restart, records once and keeps the original FAIL", async () => {
	const f = await fixture();
	let reopened: QADispositionWorkflow | undefined;
	try {
		const prepared = await f.workflow.prepare(f.candidate(), f.requester, null);
		await assert.rejects(
			() => f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Self approval", f.requester),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Reviewed the scoped exception; FAIL remains",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new QADispositionWorkflow(f.directory, f.options);
		const execution = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const result = await reopened.execute(execution, f.requester);
		assert.equal(result.stored, true);
		assert.match(result.uri, /^urn:qa:/);
		assert.deepEqual(await reopened.execute(execution, f.requester), result);
		assert.equal(reopened.findingCount(), 1);
		assert.equal((await f.service.report(f.report.resultRef, f.principal)).summary.status, "FAIL");
		f.source.grant.current = false;
		await assert.rejects(() => reopened!.execute(execution, f.requester), /access_denied/);
	} finally {
		reopened?.close();
		f.close();
	}
});

test("invented passing results, changed disposition policy and expired exceptions fail closed", async () => {
	const f = await fixture();
	try {
		const invented = f.candidate();
		invented.disposition.observedReport.summary.status = "PASS";
		await assert.rejects(() => f.workflow.prepare(invented, f.requester, null), /fidelity/);
		f.dispositionPolicy.allowCriticalExceptions = false;
		await assert.rejects(() => f.workflow.prepare(f.candidate(), f.requester, null), /exception_denied/);
		f.dispositionPolicy.allowCriticalExceptions = true;
		const prepared = await f.workflow.prepare(f.candidate(), f.requester, null);
		f.setTime("2026-10-13T00:06:00Z");
		await assert.rejects(
			() => f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Too late", f.reviewer),
			/expired/,
		);
	} finally {
		f.close();
	}
});

test("task/profile revision change invalidates an already prepared disposition", async () => {
	const f = await fixture();
	try {
		const prepared = await f.workflow.prepare(f.candidate(), f.requester, null);
		f.profile.revision = "r2";
		await assert.rejects(() => f.workflow.status(prepared.reviewId, f.requester), /access_denied|revision_mismatch/);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("human requested changes require a new exact work revision before disposition continuation", async () => {
	const f = await fixture();
	try {
		const first = await f.workflow.prepare(f.candidate(), f.requester, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Clarify the bounded exception rationale",
			f.reviewer,
		);
		const candidate = f.candidate();
		const { deriveQADisposition } = await import("../src/qa-disposition.js");
		Object.assign(
			candidate,
			deriveQADisposition(
				f.report,
				{
					...candidate.disposition.proposal,
					reason: "Confirmed repair owner; failed source retained until correction",
				},
				"r2",
				f.dispositionPolicy,
			),
		);
		const second = await f.workflow.prepare(candidate, f.requester, first.packetDigest);
		await assert.rejects(
			() => f.workflow.decide(first.reviewId, first.packetDigest, "approve", "Old revision", f.reviewer),
			/revision_mismatch/,
		);
		const approved = await f.workflow.decide(
			second.reviewId,
			second.packetDigest,
			"approve",
			"Reviewed the revised private rationale",
			f.reviewer,
		);
		assert.equal(
			(
				await f.workflow.execute(
					{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
					f.requester,
				)
			).stored,
			true,
		);
		assert.equal((await f.service.report(f.report.resultRef, f.principal)).summary.counts.failed, 1);
	} finally {
		f.close();
	}
});
