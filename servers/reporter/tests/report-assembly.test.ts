import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assembleReport } from "../src/report-assembly.js";

// Authored fixtures exercise fidelity; they do not certify geological conclusions.
const records = JSON.parse(readFileSync(new URL("fixtures/employee.json", import.meta.url), "utf8"));
const task = {
	...records.task,
	scope: { ...records.task.scope, employeeId: "employee.reporter" },
	inputs: [records.finalWork.artifact],
};
const requirements = {
	audience: "Asset owner",
	purpose: "Review supplied evidence",
	templateId: "private-review-v1",
	disclosures: ["Fixture; not reserve certification"],
};
function source() {
	const work = structuredClone(records.finalWork);
	work.findings = [
		{
			id: "finding.net-pay",
			basis: "measured",
			value: 0,
			unit: "ft",
			evidenceIds: [work.evidence[0].id],
			assumptionIds: [],
		},
		{
			id: "finding.irr",
			basis: "assumed",
			value: 0.12,
			unit: "fraction",
			evidenceIds: [],
			assumptionIds: [work.assumptions[0].id],
		},
		{
			id: "finding.porosity",
			basis: "unknown",
			value: null,
			unit: "fraction",
			reason: "Curve absent",
			evidenceIds: [],
			assumptionIds: [],
		},
	];
	return work;
}
test("zero net pay and confidence retain their distinct meanings, and IRR declares its scale", () => {
	const work = source();
	work.confidence = 0;
	const result = assembleReport(task, [work], requirements);
	assert.match(result.markdown, /finding.net-pay: 0 ft/);
	assert.match(result.markdown, /irr: 12% \(source: 0\.12 fraction; assumed\)/);
	assert.match(result.markdown, /Source confidence: 0 \(fraction\)/);
	assert.match(result.markdown, /porosity: unavailable.*Curve absent/);
	assert.equal(result.work.confidence, undefined);
	assert.equal(result.work.review.status, "unreviewed");
	assert.equal(result.work.status, "ready_for_review");
});
test("missing confidence and missing metrics cannot become defaults or favorable insights", () => {
	const work = source();
	delete work.confidence;
	const result = assembleReport(task, [work], requirements);
	assert.match(result.markdown, /Source confidence: unavailable/);
	assert.doesNotMatch(result.markdown, /85%|90%|supports proceeding|high confidence|PROCEED/);
	assert.equal(
		result.work.findings.some((f: { id: string }) => f.id.endsWith("npv")),
		false,
	);
});
test("confidence cannot be treated as net pay", () => {
	const work = source();
	work.findings = work.findings.filter((f: { id: string }) => f.id !== "finding.net-pay");
	work.confidence = 0.9;
	assert.doesNotMatch(assembleReport(task, [work], requirements).markdown, /finding.net-pay:/);
});
test("percent IRR is not multiplied again", () => {
	const work = source();
	work.findings[1].value = 12;
	work.findings[1].unit = "percent";
	assert.match(assembleReport(task, [work], requirements).markdown, /irr: 12 percent/);
});
test("conflicting findings, assumptions, blockers and source revisions stay visible", () => {
	const a = source();
	const b = source();
	b.artifact.id += ".second";
	b.findings[0].value = 14;
	b.uncertainty = "Independent measurement conflicts";
	const result = assembleReport({ ...task, inputs: [a.artifact, b.artifact] }, [a, b], requirements);
	assert.match(result.markdown, /finding.net-pay: 0 ft/);
	assert.match(result.markdown, /finding.net-pay: 14 ft/);
	assert.match(result.markdown, /Independent measurement conflicts/);
	assert.match(result.markdown, /Conflicting findings: finding.net-pay/);
	assert.equal(result.work.status, "blocked");
	assert.equal(result.work.assumptions.length, 2);
	assert.match(result.markdown, /Fixture; not reserve certification/);
	assert.match(result.markdown, /Revision: r1/);
});
test("incomplete or unreviewed inputs defer and no input is not completion", () => {
	assert.throws(() => assembleReport(task, [], requirements), /missing_sources/);
	const work = source();
	work.review.status = "unreviewed";
	assert.throws(() => assembleReport(task, [work], requirements), /approval_required|invalid_contract/);
});
test("another customer or asset and repeated source identities are rejected", () => {
	for (const field of ["customerId", "assetId"]) {
		const work = source();
		work.scope[field] = "other";
		assert.throws(() => assembleReport(task, [work], requirements), /source_scope/);
	}
	assert.throws(() => assembleReport(task, [source(), source()], requirements), /duplicate_source/);
});
test("unsupported publication parameters and missing audience/disclosures are rejected", () => {
	assert.throws(
		() => assembleReport(task, [source()], { ...requirements, outputPath: "/tmp/report" }),
		/invalid_requirements/,
	);
	assert.throws(() => assembleReport(task, [source()], { ...requirements, audience: "" }), /invalid_requirements/);
	assert.throws(() => assembleReport(task, [source()], { ...requirements, disclosures: [] }), /invalid_requirements/);
});
test("malformed source cannot promote forged findings", () => {
	const work = source();
	work.findings[0].value = Number.NaN;
	assert.throws(() => assembleReport(task, [work], requirements));
});

test("configured organizations can assign their own employee identities to the reporting role", () => {
	const custom = { ...task, scope: { ...task.scope, employeeId: "employee.acme-reports" } };
	assert.equal(assembleReport(custom, [source()], requirements).work.scope.employeeId, "employee.acme-reports");
});
