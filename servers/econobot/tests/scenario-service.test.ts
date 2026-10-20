import assert from "node:assert/strict";
import { test } from "node:test";
import { EconomicScenarioError } from "../src/scenario-service.js";
import { basisKeys, fixture, ref, who } from "./fixtures/scenario.js";

const blocked = (code: string) => (error: unknown) => error instanceof EconomicScenarioError && error.code === code;

test("all financial basis sources are resolved and visible in source-linked work", async () => {
	const { service, basis } = fixture();
	const inspected = await service.inspect(ref, who);
	assert.equal(inspected.sourceArtifacts.length, 7);
	const result = await service.calculate(ref, { id: "base", revision: "r1" }, who);
	assert.ok(Math.abs(result.economics.npv.value!) < 1e-8);
	assert.ok(Math.abs(result.economics.irr.value! - 0.1) < 1e-8);
	assert.equal(result.economics.authorizesInvestment, false);
	assert.deepEqual(result.basis, basis);
	const comparison = await service.compare(ref, ["base", "low"], who);
	assert.ok(comparison.scenarios[1].economics.npv.value! < comparison.scenarios[0].economics.npv.value!);
	const draft = await service.draft(ref, ["base", "low"], "r1", who);
	assert.equal(draft.work.status, "ready_for_review");
	assert.equal(draft.work.review.status, "unreviewed");
	assert.equal(draft.scenario.authorizesInvestment, false);
	assert.equal(draft.work.evidence.length, 7);
	assert.deepEqual(
		new Set(draft.work.evidence.map((item) => item.id)),
		new Set(inspected.sourceArtifacts.map((item) => item.evidence.id)),
	);
	const preview = await service.readSource(basis.priceDeckRef, who);
	assert.match(preview.text, /base,1,50,USD,bbl/);
	const snapshot = await service.reviewSource(basis.costRef.id, who);
	assert.match(new TextDecoder().decode(snapshot.bytes), /netOperatingExpense/);
});

test("unresolved, stale-revision or revoked basis evidence cannot become a reviewed scenario", async () => {
	for (const key of basisKeys) {
		const { service, current, revoke } = fixture();
		const saved = current.scenarios[0].basis[key];
		current.scenarios[0].basis[key] = { id: "nonexistent.basis", revision: "r1" };
		await assert.rejects(service.draft(ref, ["base"], "r1", who), blocked("basis_source_missing"));
		current.scenarios[0].basis[key] = { ...saved, revision: "old" };
		await assert.rejects(service.draft(ref, ["base"], "r1", who), blocked("basis_source_missing"));
		current.scenarios[0].basis[key] = saved;
		revoke(saved.id);
		await assert.rejects(service.draft(ref, ["base"], "r1", who));
	}
});

test("ownership and price basis must match the actual authorized source", async () => {
	const { service, current } = fixture();
	current.scenarios[0].basis.workingInterest = 0.6;
	await assert.rejects(service.calculate(ref, { id: "base", revision: "r1" }, who), blocked("ownership_mismatch"));
	current.scenarios[0].basis.workingInterest = 0.5;
	current.scenarios[0].basis.priceDeckAsOf = "2026-10-19T01:00:00Z";
	await assert.rejects(service.calculate(ref, { id: "base", revision: "r1" }, who), blocked("price_source_mismatch"));
});

test("authority changes after source reads block publication of the assembled result", async () => {
	const f = fixture();
	f.setGuard(async (text) => {
		if (text.includes('"cashFlowSourceRef"')) f.revoke("evidence.prices");
		return true;
	});
	await assert.rejects(f.service.inspect(ref, who), blocked("revision_mismatch"));
});

test("task, scenario, currency and period mismatches block work", async () => {
	const { service, current, texts, bind } = fixture();
	await assert.rejects(service.calculate({ ...ref, revision: "r0" }, { id: "base", revision: "r1" }, who));
	await assert.rejects(service.calculate(ref, { id: "base", revision: "r0" }, who));
	await assert.rejects(service.inspect(ref, { ...who, employeeId: "foreign" }));
	await assert.rejects(service.compare(ref, ["base", "base"], who));
	current.scenarios[0].currency = "CAD";
	await assert.rejects(service.calculate(ref, { id: "base", revision: "r1" }, who), blocked("unit_mismatch"));
	current.scenarios[0].currency = "USD";
	texts.set("cash-flows", "scenarioId,scenarioRevision,period,netCashFlow\nbase,r1,0,-100\nbase,r1,2,110\n");
	bind();
	await assert.rejects(service.calculate(ref, { id: "base", revision: "r1" }, who), blocked("period_mismatch"));
});

test("changed assumptions require current task/input revisions and a new scenario packet", async () => {
	const { service, current, texts, bind, revoke } = fixture();
	const first = await service.draft(ref, ["base"], "r1", who);
	texts.set("assumptions", "category,statement\nbasis,Revised operator assumptions; review again\n");
	bind();
	current.task.revision = "r2";
	await assert.rejects(service.draft(ref, ["base"], "r2", who), blocked("revision_mismatch"));
	const revised = await service.draft({ ...ref, revision: "r2" }, ["base"], "r2", who);
	assert.notDeepEqual(first.scenario, revised.scenario);
	revoke();
	await assert.rejects(service.draft({ ...ref, revision: "r2" }, ["base"], "r3", who));
});

test("malformed values, missing rows and irregular periods fail content validation", async () => {
	for (const [rows, code] of [
		["", "invalid_cash_flow_rows"],
		["base,r1,0,\nbase,r1,1,110\n", "invalid_cash_flow_rows"],
		["base,r1,0,-100\nbase,r1,1,NaN\n", "invalid_cash_flow_rows"],
		["base,r1,0,-100\nbase,r1,0,110\n", "period_mismatch"],
	] as const) {
		const { service, texts, bind } = fixture();
		texts.set("cash-flows", `scenarioId,scenarioRevision,period,netCashFlow\n${rows}`);
		bind();
		await assert.rejects(service.calculate(ref, { id: "base", revision: "r1" }, who), blocked(code));
	}
});
