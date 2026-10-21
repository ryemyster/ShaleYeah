import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const sample = fileURLToPath(new URL("reference/lasio-0.32/sample_2.0.las", import.meta.url));
function run(module: string, args: string[]) {
	return spawnSync(
		process.execPath,
		["--import", "tsx", fileURLToPath(new URL(`../src/tools/${module}.ts`, import.meta.url)), ...args],
		{ encoding: "utf8", timeout: 10000 },
	);
}
test("real LAS CLI emits measured JSON or a unit-bearing summary", () => {
	for (const flag of ["--json", "--summary"]) {
		const result = run("las-parse", [sample, flag]);
		assert.equal(result.status, 0, result.stderr);
		const output = JSON.parse(result.stdout);
		assert.equal(output.rows, 3);
		assert.equal(output.depth_unit, "M");
		assert.equal(output.curves.length, 8);
	}
});
test("real CLI input/layout errors fail instead of displaying guessed measurements", () => {
	for (const args of [
		[],
		[`${sample}.missing`],
		[fileURLToPath(new URL("reference/lasio-0.32/sample_2.0_wrapped.las", import.meta.url))],
	]) {
		const result = run("las-parse", args);
		assert.equal(result.status, 1);
		assert.equal(result.stdout, "");
	}
});
test("real curve CLI reports explicit unknowns and refuses invalid command syntax", () => {
	for (const curve of ["RHOB", "ABSENT"]) {
		const result = run("curve-qc", [sample, `CURVE=${curve}`]);
		assert.equal(result.status, 0, result.stderr);
		const value = JSON.parse(result.stdout);
		assert.equal(value.meanValue, curve === "RHOB" ? 2550 : null);
		assert.equal(value.rmse, undefined);
	}
	for (const args of [[], [`${sample}.missing`, "CURVE=RHOB"], [sample, "RHOB"], [sample, "CURVE="]]) {
		const result = run("curve-qc", args);
		assert.equal(result.status, 1);
	}
});
