import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	ContractValidationError,
	validateConnectorConfiguration,
	validateContract,
	validateSourceContract,
} from "../src/index.js";

const records = JSON.parse(readFileSync(new URL("../fixtures/data-connectors.json", import.meta.url), "utf8"));

test("JSON source 0.2.0 is explicit; old LAS/CSV 0.1.0 and employee records remain closed", () => {
	const record = { ...structuredClone(records.artifact), format: "json" };
	assert.throws(() => validateSourceContract(record), ContractValidationError);
	record.contractVersion = "0.2.0";
	assert.deepEqual(validateSourceContract(record), record);
	assert.throws(() => validateContract(record), ContractValidationError);
	assert.throws(() => validateSourceContract({ ...record, format: "csv" }), ContractValidationError);
	assert.throws(() => validateSourceContract({ ...record, contractVersion: "0.3.0" }), ContractValidationError);
});

test("existing employee 0.1.0 profile remains closed when a separate connector profile is introduced", () => {
	assert.throws(() => validateContract(records.manifest), ContractValidationError);
});
for (const [name, record] of Object.entries(records)) {
	if (name === "configuration") continue;
	test(`portable data connector ${name} round-trips without framework state`, () => {
		assert.deepEqual(validateSourceContract(record), record);
	});
}

test("private connector configuration is validated independently of wire records", () => {
	assert.deepEqual(validateConnectorConfiguration(records.configuration), records.configuration);
	assert.throws(() => validateContract(records.configuration), ContractValidationError);
	const variants: unknown[] = [
		null,
		new Date(),
		{ ...records.configuration, contractVersion: "2.0.0" },
		{ ...records.configuration, secret: "example-secret-sentinel" },
	];
	for (const mutate of [
		(value: typeof records.configuration) => {
			value.manifest.owner.customerId = "different";
		},
		(value: typeof records.configuration) => {
			value.grant.scope.taskId = "different";
		},
		(value: typeof records.configuration) => {
			value.sources.push(value.sources[0]);
		},
		(value: typeof records.configuration) => {
			value.sources[0].units.push({ ...value.sources[0].units[0], unit: "M" });
		},
		(value: typeof records.configuration) => {
			value.sources[0].evidence.uri = "https://user:password@example.com/log";
		},
		(value: typeof records.configuration) => {
			value.manifest.formats = ["csv"];
		},
	]) {
		const value = structuredClone(records.configuration);
		mutate(value);
		variants.push(value);
	}
	for (const value of variants) assert.throws(() => validateConnectorConfiguration(value), ContractValidationError);
});

test("source artifact rejects a different byte hash and credential-bearing URI", () => {
	for (const change of [
		(value: typeof records.artifact) => {
			value.artifact.revision = "changed";
		},
		(value: typeof records.artifact) => {
			value.evidence.uri = "https://example.com/log?api_key=example-secret-sentinel";
		},
		(value: typeof records.artifact) => {
			value.retrievedAt = "2026-10-06T12:00:00Z";
		},
		(value: typeof records.artifact) => {
			value.units.push(value.units[0]);
		},
	]) {
		const value = structuredClone(records.artifact);
		change(value);
		assert.throws(
			() => validateSourceContract(value),
			(error) => error instanceof ContractValidationError && !error.message.includes("example-secret-sentinel"),
		);
	}
});
