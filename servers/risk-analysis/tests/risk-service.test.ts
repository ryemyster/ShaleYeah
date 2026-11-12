import assert from "node:assert/strict";
import { test } from "node:test";
import { RiskAssessmentService } from "../src/risk-service.js";
import { now, ref, riskFixture, who } from "./fixtures/risk.js";

test("all exact sources drive risk work, actual quantities, comparisons and unreviewed authority", async () => {
	const f = riskFixture();
	const result = await f.service.draft(ref, { id: "joint.fixture", revision: "r1" }, "r1", who);
	assert.equal(result.risk.summary.expectedLoss, 80);
	assert.equal(result.risk.correlations[0].correlation.value, 0.375);
	assert.equal(result.work.findings[0].value, 80);
	assert.equal(result.work.status, "ready_for_review");
	assert.equal(result.work.review.status, "unreviewed");
	assert.equal(result.risk.riskAccepted, false);
	assert.deepEqual(result.work.inputs, f.current.task.inputs);
	assert.equal(result.work.evidence.length, 3);
	assert.equal(result.sourceArtifacts.length, 3);
	const comparison = await f.service.compare(
		ref,
		[
			{ id: "joint.fixture", revision: "r1" },
			{ id: "joint.stress", revision: "r1" },
		],
		who,
	);
	assert.deepEqual(
		comparison.analyses.map((item) => item.summary.expectedLoss),
		[80, 160],
	);
	await assert.rejects(() =>
		f.service.compare(
			ref,
			[
				{ id: "joint.fixture", revision: "r1" },
				{ id: "joint.fixture", revision: "r1" },
			],
			who,
		),
	);
	await assert.rejects(() => f.service.calculate(ref, { id: "missing", revision: "r1" }, who));
});

test("missing evidence and policy failures remain explicit blockers without invented risk probabilities", async () => {
	const f = riskFixture();
	f.register.entries[0].evidenceState = "missing";
	f.register.entries[0].evidenceRefs = [];
	f.register.entries[1].severity = "critical";
	f.texts.set("register", JSON.stringify(f.register));
	f.bind();
	const result = await f.service.draft(ref, { id: "joint.fixture", revision: "r1" }, "r1", who);
	assert.equal(result.work.status, "blocked");
	assert.deepEqual(
		result.work.blockers.map((item) => item.message),
		["unsupported-evidence", "unmitigated-severe-risk-limit"],
	);
	assert.deepEqual(
		result.work.blockers.map((item) => item.code),
		["missing_input", "approval_required"],
	);
	assert.equal(result.risk.summary.expectedLoss, 80);
});

test("source hashes, scope, current task and grants remain authoritative at final delivery", async () => {
	for (const change of [
		(f: ReturnType<typeof riskFixture>) => {
			f.revoke();
		},
		(f: ReturnType<typeof riskFixture>) => {
			f.current.task.revision = "changed";
		},
		(f: ReturnType<typeof riskFixture>) => {
			f.setClock(() => new Date(now.getTime() + 86401 * 1000));
		},
	]) {
		const f = riskFixture();
		change(f);
		await assert.rejects(() => f.service.calculate(ref, { id: "joint.fixture", revision: "r1" }, who));
	}
	const f = riskFixture();
	let calls = 0;
	f.setGuard(async () => {
		if (++calls === 7) f.revoke();
		return true;
	});
	await assert.rejects(() => f.service.draft(ref, { id: "joint.fixture", revision: "r1" }, "r1", who));
	const g = riskFixture();
	const service = new RiskAssessmentService({
		...g.options,
		fetchSource: async (r, p, op) => {
			const fetched = await g.fetchSource(r, p, op);
			fetched.bytes[0] ^= 1;
			return fetched;
		},
	});
	await assert.rejects(() => service.calculate(ref, { id: "joint.fixture", revision: "r1" }, who));
});

test("unit and revision ambiguity, secret content and actor mismatch cannot reach a useful result", async () => {
	const f = riskFixture();
	f.scenarios.models[0].currency = "CAD";
	f.texts.set("scenarios", JSON.stringify(f.scenarios));
	f.bind();
	await assert.rejects(() => f.service.calculate(ref, { id: "joint.fixture", revision: "r1" }, who));
	const g = riskFixture();
	g.setGuard(async () => false);
	await assert.rejects(() => g.service.inspect(ref, who));
	await assert.rejects(() => g.service.inspect(ref, { ...who, customerId: "foreign" }));
	await assert.rejects(() => g.service.inspect(ref, { ...who, scopes: [] }));
});

test("bounded discovery, source detail and permission metadata retain current identities", async () => {
	const f = riskFixture();
	const inputs = await f.service.inspect(ref, who);
	assert.equal(inputs.register.entryCount, 2);
	assert.equal(inputs.models.length, 2);
	assert.ok(inputs.models.every((model) => !Object.hasOwn(model, "states")));
	const page = await f.service.readSource(f.current.scenariosSourceRef, who, 0, 40);
	assert.equal(page.text.length, 40);
	assert.equal(page.nextOffset, 40);
	const metadata = await f.service.sourceMetadata(f.current.registerSourceRef, "export", who);
	assert.equal(metadata.sourceArtifact.artifact.id, "evidence.register");
	const review = await f.service.reviewSource("evidence.register", who);
	assert.ok(review.bytes.length > 0);
	f.revoke();
	await assert.rejects(() => f.service.readSource(f.current.registerSourceRef, who));
});

test("a model identity must leave room for canonical derived finding identifiers", async () => {
	for (const id of ["m".repeat(128), "joint model"]) {
		const f = riskFixture();
		f.scenarios.models[0].modelRef.id = id;
		f.texts.set("scenarios", JSON.stringify(f.scenarios));
		f.bind();
		await assert.rejects(() => f.service.calculate(ref, f.scenarios.models[0].modelRef, who));
	}
});
