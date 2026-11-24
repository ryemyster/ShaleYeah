import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { decodeQAData } from "../src/tools/qa-data.js";
import { evaluateQARules } from "../src/tools/qa-rules.js";

const original = JSON.parse(readFileSync(new URL("fixtures/work.json", import.meta.url), "utf8"));
const recipient = { ...original.scope, taskId: "task.qa", employeeId: "employee.qa" };
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

test("canonical work projection preserves literal zero, unknowns, assumptions and original finding locations", () => {
	const work = structuredClone(original);
	work.findings[0].value = 0;
	const decoded = decodeQAData(bytes(work), recipient);
	assert.equal(decoded.rows[0].fields[work.findings[0].id].value, 0);
	assert.equal(decoded.rows[0].fields[work.findings[2].id].value, null);
	assert.equal(decoded.rows[0].fields[work.findings[1].id].basis, "assumed");
	assert.deepEqual(decoded.rows[0].fields[work.findings[1].id].assumptionIds, work.findings[1].assumptionIds);
	assert.equal(decoded.rows[0].fields[work.findings[0].id].location, "/findings/0/value");
	assert.equal(decoded.rows[0].wellId, undefined);
	assert.equal(decoded.rows[0].period, undefined);
	assert.equal(decoded.rows[0].assetId, work.scope.assetId);
});

test("well and period join keys come only from configured measured findings, never display names or ingestion time", () => {
	const work = structuredClone(original);
	for (const [id, value] of [
		["finding.well", "wellbore.1"],
		["finding.period", "2026-10"],
	])
		work.findings.push({
			id,
			value,
			basis: "measured",
			unit: "not_applicable",
			evidenceIds: [work.evidence[0].id],
			assumptionIds: [],
		});
	const decoded = decodeQAData(bytes(work), recipient, {
		wellIdFinding: "finding.well",
		periodFinding: "finding.period",
	});
	assert.equal(decoded.rows[0].wellId, "wellbore.1");
	assert.equal(decoded.rows[0].period, "2026-10");
	assert.equal(decoded.rows[0].asOf, work.evidence[0].asOf);
});

test("unsupported formats, invalid canonical records, cross-customer data and executable projection config are rejected", () => {
	assert.throws(() => decodeQAData(new TextEncoder().encode("~Version\nVERS. 2.0"), recipient));
	assert.throws(() => decodeQAData(bytes({ ...original, contractVersion: "99.0.0" }), recipient));
	assert.throws(() =>
		decodeQAData(bytes({ ...original, scope: { ...original.scope, customerId: "other" } }), recipient),
	);
	assert.throws(() => decodeQAData(bytes(original), recipient, { script: "approve()" }));
});

test("work-product defect points to the original finding rather than a nonexistent normalized row", () => {
	const work = structuredClone(original),
		sourceBytes = bytes(work);
	const result = evaluateQARules({
		scope: recipient,
		evaluatedAt: "2026-10-13T00:00:00Z",
		profile: {
			schemaVersion: "0.1.0",
			id: "profile.qa",
			revision: "r1",
			rules: [
				{
					id: "rule.units",
					revision: "r1",
					type: "units",
					sourceId: "source.work",
					severity: "major",
					repairOwner: "producing-owner",
					applicable: true,
					field: work.findings[0].id,
					expectedUnit: "wrong-unit",
				},
			],
		},
		snapshots: [
			{
				scope: recipient,
				bytes: sourceBytes,
				evidence: {
					id: "source.work",
					revision: "r1",
					uri: "urn:fixture:work",
					hash: { algorithm: "sha256", value: createHash("sha256").update(sourceBytes).digest("hex") },
					asOf: "2026-10-13T00:00:00Z",
					accessClassification: "restricted",
					usagePolicy: { id: "policy.fixture", version: "r1" },
				},
			},
		],
	});
	assert.equal(result.results[0].status, "FAIL");
	assert.equal(result.results[0].defects[0].location, "/findings/0/unit");
});
