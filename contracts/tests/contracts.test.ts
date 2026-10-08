import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CONTRACT_VERSION, ContractValidationError, validateContract } from "../src/index.js";

const authority = JSON.parse(readFileSync(new URL("../fixtures/authority-review.json", import.meta.url), "utf8"));
const baseRecords = JSON.parse(readFileSync(new URL("../fixtures/records.json", import.meta.url), "utf8"));
assert(
	Object.keys(authority.records).every((name) => !Object.hasOwn(baseRecords, name)),
	"authority fixture shadows a base record",
);
const records = {
	...baseRecords,
	...authority.records,
};
const cases = [
	...JSON.parse(readFileSync(new URL("../fixtures/cases.json", import.meta.url), "utf8")),
	...authority.validationCases,
];
for (const fixture of cases) {
	test(fixture.name, () => {
		const value = structuredClone(records[fixture.record]);
		for (const patch of fixture.patches ?? []) {
			let target = value;
			for (const key of patch.path.slice(0, -1)) target = target[key];
			const key = patch.path.at(-1);
			if (patch.remove) delete target[key];
			else target[key] = patch.value;
		}
		const before = JSON.stringify(value);
		if (fixture.valid) assert.deepEqual(validateContract(value, fixture.options), value);
		else
			assert.throws(
				() => validateContract(value, fixture.options),
				(error) => {
					assert(error instanceof ContractValidationError);
					assert.equal(error.code, fixture.code);
					assert(!error.message.includes("example-secret-sentinel"));
					return true;
				},
			);
		assert.equal(JSON.stringify(value), before, "validation must not mutate the record");
	});
}

test("contract version and zero confidence survive validation", () => {
	assert.equal(CONTRACT_VERSION, "0.1.0");
	const value = validateContract(records.work);
	assert.equal(value.kind, "work-product");
	if (value.kind === "work-product") assert.equal(value.confidence, 0);
});

test("non-JSON values cannot carry framework objects", () => {
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	for (const value of [
		undefined,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		() => null,
		new Date(),
		cycle,
		{ ...records.charter, aliases: [undefined] },
		{ ...records.charter, aliases: Array(1) },
		{ ...records.charter, [Symbol("frameworkState")]: "private" },
	]) {
		assert.throws(() => validateContract(value), ContractValidationError);
	}
});

test("authority reference binds the task, reviewed product, source and human decision", () => {
	const control = authority.control;
	assert.deepEqual(control.scope, records.work.scope);
	assert.equal(control.taskRevision, records.task.revision);
	assert.deepEqual(control.productRef, records.work.artifact);
	assert.deepEqual(control.requestRef, { id: records.saveRequest.id, revision: records.saveRequest.revision });
	assert.deepEqual(control.decisionRef, { id: records.saveDecision.id, revision: records.saveDecision.revision });
	assert.deepEqual(records.saveDecision.requestRef, control.requestRef);
	assert.deepEqual(records.saveDecision.productRef, control.productRef);
	assert.deepEqual(records.saveRequest.productRef, control.productRef);
	assert.deepEqual(control.reviewer, records.saveDecision.reviewer);
	assert.deepEqual(control.reviewer.authorityPolicy, records.saveRequest.reviewerPolicy);
	assert.deepEqual(control.inputs, records.work.inputs);
	assert.deepEqual(control.evidence, records.work.evidence);
	assert.deepEqual(control.assumptions, records.work.assumptions);
	assert.deepEqual(control.auditRef, records.saveDecision.auditRef);
	assert.equal(records.saveDecision.decision, "approve");
	assert(records.saveRequest.requestedDecision.includes(control.operation.name));
	assert(records.saveRequest.requestedDecision.includes(control.operation.target));
});
