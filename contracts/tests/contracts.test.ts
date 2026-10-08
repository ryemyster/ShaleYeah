import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CONTRACT_VERSION, ContractValidationError, validateContract } from "../src/index.js";

const records = JSON.parse(readFileSync(new URL("../fixtures/records.json", import.meta.url), "utf8"));
const cases = JSON.parse(readFileSync(new URL("../fixtures/cases.json", import.meta.url), "utf8"));
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
