import assert from "node:assert/strict";
import { test } from "node:test";
import { ReportReviewWorkflow } from "../src/review-workflow.js";

import { fixture } from "./fixtures/review-fixture.js";

test("human changes require a fresh exact revision; approved release survives restart and replays once", async () => {
	const f = fixture();
	let reopened: ReportReviewWorkflow | undefined;
	try {
		const first = await f.workflow.prepare(f.candidate(), f.requester, null);
		await f.workflow.decide(first.reviewId, first.packetDigest, "request_changes", "Update the purpose", f.reviewer);
		await assert.rejects(() => f.workflow.execute({ ...first, grantId: "forged" }, f.requester));
		f.edit();
		const second = await f.workflow.prepare(f.candidate(), f.requester, first.packetDigest);
		const approved = await f.workflow.decide(
			second.reviewId,
			second.packetDigest,
			"approve",
			"Reviewed the exact revised report",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new ReportReviewWorkflow(f.directory, f.options);
		const result = await reopened.execute(
			{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
			f.requester,
		);
		assert.equal(result.stored, true);
		assert.match(result.uri, /^urn:reporter:/);
		assert.deepEqual(
			await reopened.execute(
				{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
				f.requester,
			),
			result,
		);
		assert.equal(reopened.findingCount(), 1);
		f.receipt.current = false;
		await assert.rejects(
			() =>
				reopened!.execute(
					{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
					f.requester,
				),
			/access_denied/,
		);
	} finally {
		reopened?.close();
		f.close();
	}
});
test("invented prose, changed numbers, another template and employee self approval cannot release", async () => {
	const f = fixture();
	try {
		for (const change of ["prose", "value", "template"]) {
			const candidate = f.candidate();
			if (change === "prose") candidate.publication.markdown += "Proceed with development at 90% confidence.";
			if (change === "value") candidate.work.findings[0].value = 9999;
			if (change === "template")
				candidate.publication.requirements = { ...candidate.publication.requirements, audience: "Public investors" };
			await assert.rejects(() => f.workflow.prepare(candidate, f.requester, null), /fidelity|template/);
		}
		const prepared = await f.workflow.prepare(f.candidate(), f.requester, null);
		await assert.rejects(
			() => f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "I approve", f.requester),
			/authority_denied/,
		);
	} finally {
		f.close();
	}
});
