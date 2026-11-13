import assert from "node:assert/strict";
import { test } from "node:test";
import { QAInputs } from "../src/qa-inputs.js";
import { QAService } from "../src/qa-service.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("actual evaluation produces canonical private work and reports from immutable observed results", async () => {
	const f = fixture();
	try {
		const outcome = await f.service.run(f.request, f.principal);
		assert.equal(outcome.payload.status, "PASS");
		assert.equal(outcome.work.kind, "work-product");
		assert.equal(outcome.work.review.status, "unreviewed");
		const report = await f.service.report(outcome.resultRef, f.principal);
		assert.equal(report.summary.counts.passed, 1);
		assert.equal(report.summary.passRate, 1);
		assert.deepEqual(report.resultRef, outcome.resultRef);
		assert.ok(!Object.hasOwn(report, "confidence"));
		assert.ok(f.audits.length);
		assert.ok(!JSON.stringify(f.audits).includes('"netPay"'));
		f.source.grant.current = false;
		await assert.rejects(() => f.service.report(outcome.resultRef, f.principal), /access_denied/);
	} finally {
		f.close();
	}
});

test("approved profile hash seals rule content, including after service restart", async () => {
	const f = fixture();
	try {
		f.profile.rules[0].field = "differentField";
		await assert.rejects(() => new QAService(f.options).run(f.request, f.principal), /access_denied/);
	} finally {
		f.close();
	}
});

test("report export rescans saved content against the current secret policy", async () => {
	const f = fixture();
	try {
		const result = await f.service.run(f.request, f.principal);
		await assert.rejects(
			() => new QAService({ ...f.options, contentGuard: async () => false }).report(result.resultRef, f.principal),
			/unsafe_content/,
		);
	} finally {
		f.close();
	}
});

test("caller profile injection, self waiver, stale task/source versions and scope drift cannot evaluate or reuse results", async () => {
	const f = fixture();
	try {
		await assert.rejects(() => f.service.run({ ...f.request, rules: [], approved: true }, f.principal));
		await assert.rejects(() => f.service.run(f.request, { ...f.principal, subjectId: "other" }), /access_denied/);
		const result = await f.service.run(f.request, f.principal);
		f.profile.revision = "r2";
		await assert.rejects(() => f.service.report(result.resultRef, f.principal));
	} finally {
		f.close();
	}
});

test("source unavailable is untested; rights revoked during audit cannot commit a result", async () => {
	const f = fixture();
	try {
		const unavailable = new QAInputs({
			scope: f.task.scope,
			taskRevision: "r1",
			current: async () => undefined,
			contentGuard: async () => true,
			clock: f.options.clock,
		});
		const result = await new QAService({ ...f.options, inputs: unavailable }).run(f.request, f.principal);
		assert.equal(result.payload.status, "UNTESTED");
		assert.equal(result.payload.passRate, null);
		await assert.rejects(
			() =>
				new QAService({
					...f.options,
					audit: async () => {
						f.grant.current = false;
					},
				}).run(f.request, f.principal),
			/access_denied/,
		);
	} finally {
		f.close();
	}
});

test("extending a source grant cannot resurrect a stored result past its original source expiry", async () => {
	const f = fixture();
	try {
		f.source.grant.expiresAt = "2026-10-13T00:10:00Z";
		const result = await f.service.run(f.request, f.principal);
		f.source.grant.expiresAt = "2026-10-13T00:30:00Z";
		f.setTime("2026-10-13T00:11:00Z");
		await assert.rejects(() => f.service.report(result.resultRef, f.principal), /expired/);
	} finally {
		f.close();
	}
});

test("changing normalization under the same source byte identity invalidates prior result reuse", async () => {
	const f = fixture();
	try {
		const result = await f.service.run(f.request, f.principal);
		Object.assign(f.source.snapshot, { projection: { wellIdFinding: "finding.other" } });
		await assert.rejects(() => f.service.report(result.resultRef, f.principal), /revision_mismatch/);
	} finally {
		f.close();
	}
});

test("a cancelled task cannot run checks even if an old host grant is still marked current", async () => {
	const f = fixture();
	try {
		f.task.status = "cancelled";
		await assert.rejects(() => f.service.run(f.request, f.principal), /access_denied/);
	} finally {
		f.close();
	}
});

test("extending task authority during a run cannot extend the original result retention", async () => {
	const f = fixture();
	try {
		f.grant.expiresAt = "2026-10-13T00:10:00Z";
		const service = new QAService({
			...f.options,
			audit: async () => {
				f.grant.expiresAt = "2026-10-13T00:30:00Z";
			},
		});
		const result = await service.run(f.request, f.principal);
		f.setTime("2026-10-13T00:11:00Z");
		await assert.rejects(() => service.report(result.resultRef, f.principal), /expired/);
	} finally {
		f.close();
	}
});

test("a forged task or profile URI cannot make an exact-reference check look authorized", async () => {
	const f = fixture();
	try {
		await assert.rejects(() =>
			f.service.run({ ...f.request, taskRef: { ...f.request.taskRef, uri: "urn:forged:task" } }, f.principal),
		);
		await assert.rejects(() =>
			f.service.run({ ...f.request, profileRef: { ...f.request.profileRef, uri: "urn:forged:profile" } }, f.principal),
		);
	} finally {
		f.close();
	}
});
