import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { evaluateQARules } from "../src/tools/qa-rules.js";

const scope = { customerId: "operator-fixture", assetId: "well-1", taskId: "task-qa", employeeId: "employee.qa" };
const instant = "2026-10-13T00:00:00.000Z";
function fixture() {
	const row = {
		id: "row.1",
		assetId: "well-1",
		wellId: "wellbore.1",
		period: "2026-10",
		asOf: instant,
		fields: { netPay: { value: 0, unit: "ft", basis: "measured" } },
	};
	const data = { schemaVersion: "0.1.0", kind: "normalized-qa-data", rows: [row] };
	const source = (id: string, input = data) => {
		const bytes = new TextEncoder().encode(JSON.stringify(input));
		return {
			scope,
			evidence: {
				id,
				revision: "r1",
				uri: `urn:fixture:${id}`,
				hash: { algorithm: "sha256", value: createHash("sha256").update(bytes).digest("hex") },
				asOf: instant,
				accessClassification: "restricted",
				usagePolicy: { id: "policy.fixture", version: "r1" },
			},
			bytes,
		};
	};
	const common = {
		revision: "r1",
		sourceId: "source.input",
		severity: "critical",
		repairOwner: "data-owner",
		applicable: true,
	};
	const rules = [
		{ ...common, id: "rule.complete", type: "completeness", field: "netPay" },
		{
			...common,
			id: "rule.correct",
			type: "correctness",
			field: "netPay",
			referenceSourceId: "source.reference",
			tolerance: 0,
		},
		{ ...common, id: "rule.units", type: "units", field: "netPay", expectedUnit: "ft" },
		{ ...common, id: "rule.identity", type: "identity", expectedAssetId: "well-1", expectedWellId: "wellbore.1" },
		{ ...common, id: "rule.duplicates", type: "duplication", keys: ["wellId", "period"] },
		{ ...common, id: "rule.fresh", type: "freshness", maxAgeSeconds: 3600 },
		{ ...common, id: "rule.provenance", type: "provenance" },
		{
			...common,
			id: "rule.conflict",
			type: "contradiction",
			field: "netPay",
			referenceSourceId: "source.reference",
			tolerance: 0,
		},
	];
	const profile = { schemaVersion: "0.1.0", id: "qa.normalized", revision: "r1", rules };
	return {
		row,
		data,
		source,
		profile,
		run: (snapshots = [source("source.input"), source("source.reference")]) =>
			evaluateQARules({ scope, profile, snapshots, evaluatedAt: instant }),
	};
}

test("all eight configured dimensions execute on actual zero-valued source data with explicit denominators", () => {
	const f = fixture(),
		result = f.run();
	assert.equal(result.status, "PASS");
	assert.equal(result.results.length, 8);
	assert.deepEqual(result.counts, {
		total: 8,
		applicable: 8,
		evaluated: 8,
		passed: 8,
		failed: 0,
		untested: 0,
		errors: 0,
		notApplicable: 0,
	});
	assert.equal(result.passRate, 1);
	assert.equal(result.coverage, 1);
	assert.ok(
		result.results.every(
			(r: { status: string; evidence: unknown[]; rule: unknown; profile: unknown; repairOwner: string }) =>
				r.status === "PASS" && r.evidence.length && r.rule && r.profile && r.repairOwner === "data-owner",
		),
	);
	assert.ok(!Object.hasOwn(result, "confidence"));
});

for (const [dimension, mutate] of [
	[
		"completeness",
		(f: ReturnType<typeof fixture>) => {
			f.row.fields.netPay.value = null as unknown as number;
		},
	],
	[
		"correctness",
		(f: ReturnType<typeof fixture>) => {
			f.row.fields.netPay.value = 10;
		},
	],
	[
		"units",
		(f: ReturnType<typeof fixture>) => {
			f.row.fields.netPay.unit = "m";
		},
	],
	[
		"identity",
		(f: ReturnType<typeof fixture>) => {
			f.row.wellId = "wellbore.other";
		},
	],
	[
		"duplication",
		(f: ReturnType<typeof fixture>) => {
			f.data.rows.push({ ...structuredClone(f.row), id: "row.2" });
		},
	],
	[
		"freshness",
		(f: ReturnType<typeof fixture>) => {
			f.row.asOf = "2026-10-12T00:00:00.000Z";
		},
	],
	[
		"contradiction",
		(f: ReturnType<typeof fixture>) => {
			f.row.fields.netPay.value = 25;
		},
	],
] as const) {
	test(`${dimension} records a reproducible located defect against a valid counterpart`, () => {
		const f = fixture(),
			reference = f.source("source.reference");
		mutate(f);
		const result = f.run([f.source("source.input"), reference]);
		const defect = result.results.find((r: { type: string }) => r.type === dimension)!;
		assert.equal(defect.status, "FAIL");
		assert.ok(
			defect.defects.length &&
				defect.defects.every((d: { location: string; reason: string }) => d.location && d.reason),
		);
		assert.equal(result.status, "FAIL");
		assert.ok(result.passRate < 1);
	});
}

test("provenance compares retrieved bytes with declared hash and cannot assess other rules from corrupt bytes", () => {
	const f = fixture(),
		input = f.source("source.input");
	input.evidence.hash.value = "0".repeat(64);
	const result = f.run([input, f.source("source.reference")]);
	assert.equal(result.results.find((r: { type: string }) => r.type === "provenance")!.status, "FAIL");
	assert.ok(
		result.results
			.filter((r: { type: string }) => r.type !== "provenance")
			.every((r: { status: string }) => r.status === "ERROR"),
	);
});

test("absent and reference-missing inputs are untested, never successful validation", () => {
	const f = fixture(),
		empty = f.run([]);
	assert.equal(empty.status, "UNTESTED");
	assert.equal(empty.passRate, null);
	assert.equal(empty.coverage, 0);
	assert.equal(empty.counts.untested, 8);
	const partial = f.run([f.source("source.input")]);
	assert.equal(partial.status, "UNTESTED");
	assert.equal(partial.counts.untested, 2);
});

test("reference comparisons cannot join absent identities or treat a changed measurement basis as agreement", () => {
	const f = fixture();
	for (const key of ["assetId", "wellId", "period"] as const) delete (f.row as Partial<typeof f.row>)[key];
	const result = f.run();
	assert.ok(
		result.results
			.filter((r: { type: string }) => ["correctness", "contradiction"].includes(r.type))
			.every((r: { status: string }) => r.status === "UNTESTED"),
	);
	const basis = fixture(),
		reference = basis.source("source.reference");
	basis.row.fields.netPay.basis = "assumed";
	assert.ok(
		basis
			.run([basis.source("source.input"), reference])
			.results.filter((r: { type: string }) => ["correctness", "contradiction"].includes(r.type))
			.every((r: { status: string }) => r.status === "UNTESTED"),
	);
});

test("zero rules, no data rows and all not-applicable rules have no success or invented rate", () => {
	const f = fixture();
	f.profile.rules = [];
	assert.equal(f.run().passRate, null);
	assert.notEqual(f.run().status, "PASS");
	const excluded = fixture();
	excluded.profile.rules.forEach((r) => {
		r.applicable = false;
	});
	assert.equal(excluded.run().status, "NOT_APPLICABLE");
	assert.equal(excluded.run().coverage, null);
	const noRows = fixture();
	noRows.data.rows = [];
	assert.notEqual(noRows.run().status, "PASS");
});

test("confirmed defects survive a partially untestable rule and coverage retains the missing denominator", () => {
	const f = fixture(),
		reference = f.source("source.reference");
	f.profile.rules = f.profile.rules.filter((rule) => rule.type === "correctness");
	f.row.fields.netPay.value = 10;
	f.data.rows.push({ ...structuredClone(f.row), id: "row.2", wellId: "wellbore.missing" });
	const result = f.run([f.source("source.input"), reference]);
	assert.equal(result.status, "FAIL");
	assert.equal(result.counts.failed, 1);
	assert.deepEqual(result.results[0].rowCounts, { total: 2, evaluated: 1, passed: 0, failed: 1, untested: 1 });
	assert.equal(result.coverage, 0);
	assert.equal(result.results[0].defects.length, 2);
});

test("invalid profile code/rule versions, malformed sources and cross-scope snapshots fail explicitly", () => {
	const f = fixture();
	assert.throws(() =>
		evaluateQARules({
			scope,
			profile: { ...f.profile, script: "process.exit(0)" },
			snapshots: [],
			evaluatedAt: instant,
		}),
	);
	assert.throws(() =>
		evaluateQARules({
			scope,
			profile: { ...f.profile, rules: [{ ...f.profile.rules[0], type: "script", code: "approve()" }] },
			snapshots: [],
			evaluatedAt: instant,
		}),
	);
	assert.throws(() =>
		evaluateQARules({ scope, profile: { ...f.profile, schemaVersion: "99.0.0" }, snapshots: [], evaluatedAt: instant }),
	);
	const foreign = f.source("source.input");
	foreign.scope = { ...scope, customerId: "other-customer" };
	assert.throws(() => f.run([foreign]));
	const malformed = f.source("source.input");
	malformed.bytes = new TextEncoder().encode("not JSON");
	malformed.evidence.hash.value = createHash("sha256").update(malformed.bytes).digest("hex");
	assert.equal(f.run([malformed]).status, "ERROR");
});

test("bounded defect detail preserves total failing rows and references join by exact indexed identity", () => {
	const f = fixture();
	const reference = f.source("source.reference");
	f.profile.rules = f.profile.rules.filter((rule) => rule.type === "correctness");
	f.row.fields.netPay.value = 5;
	f.data.rows = Array.from({ length: 500 }, (_, index) => ({ ...structuredClone(f.row), id: `row.${index}` }));
	const result = f.run([f.source("source.input"), reference]);
	assert.equal(result.results[0].rowCounts.failed, 500);
	assert.equal(result.results[0].defects.length, 100);
	assert.equal(result.results[0].omittedDefects, 400);
	assert.equal(result.coverage, 1);
});
