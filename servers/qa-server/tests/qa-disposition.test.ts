import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { validateContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { deriveQADisposition } from "../src/qa-disposition.js";
import { qaProfileSchema } from "../src/tools/qa-rules.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("a proposed human exception preserves the independently observed failure and original result", async () => {
	const f = fixture();
	try {
		f.profile.rules[0].field = "missingField";
		f.grant.profileHash = createHash("sha256")
			.update(reviewJson(qaProfileSchema.parse(f.profile)))
			.digest("hex");
		const run = await f.service.run(f.request, f.principal);
		const report = await f.service.report(run.resultRef, f.principal);
		assert.equal(report.summary.status, "FAIL");
		const proposal = {
			action: "accept_exception",
			reason: "Owner to review this bounded exception",
			repairOwner: "data-owner",
			expiresAt: "2026-10-13T00:05:00Z",
		};
		const result = deriveQADisposition(report, proposal, "r1");
		validateContract(result.work);
		assert.equal(result.work.status, "ready_for_review");
		assert.notDeepEqual(result.work.artifact, report.work.artifact);
		assert.deepEqual(result.disposition.observedReport, report);
		assert.equal(result.disposition.observedReport.summary.status, "FAIL");
		assert.equal(result.disposition.observedReport.summary.counts.failed, 1);
		assert.equal(result.disposition.approvalAllowed, false);
		assert.equal((await f.service.report(run.resultRef, f.principal)).summary.status, "FAIL");
		assert.deepEqual(deriveQADisposition(report, proposal, "r1"), result);
	} finally {
		f.close();
	}
});

test("zero-valued observed input remains measured and a repair request is a new unreviewed product", async () => {
	const f = fixture();
	try {
		const run = await f.service.run(f.request, f.principal);
		const report = await f.service.report(run.resultRef, f.principal);
		const result = deriveQADisposition(
			report,
			{
				action: "request_repair",
				reason: "Review the observed packet",
				repairOwner: "data-owner",
				expiresAt: "2026-10-13T00:05:00Z",
			},
			"r1",
		);
		assert.equal(report.summary.counts.passed, 1);
		assert.deepEqual(result.work.evidence, report.work.evidence);
		assert.deepEqual(result.work.inputs, report.work.inputs);
		assert.equal(result.work.review.status, "unreviewed");
		assert.equal(result.disposition.observedReport.summary.status, "PASS");
	} finally {
		f.close();
	}
});

test("a malformed result or source correction/approval injection cannot become a disposition", async () => {
	const f = fixture();
	try {
		const run = await f.service.run(f.request, f.principal);
		const report = await f.service.report(run.resultRef, f.principal);
		const proposal = {
			action: "defer",
			reason: "Await owner review",
			repairOwner: "data-owner",
			expiresAt: "2026-10-13T00:05:00Z",
		};
		for (const patch of [{ action: "repair_source" }, { approved: true }, { reason: "" }, { expiresAt: "invalid" }])
			assert.throws(() => deriveQADisposition(report, { ...proposal, ...patch }, "r1"));
		assert.throws(() =>
			deriveQADisposition({ ...report, summary: { ...report.summary, status: "CERTIFIED" } }, proposal, "r1"),
		);
	} finally {
		f.close();
	}
});
