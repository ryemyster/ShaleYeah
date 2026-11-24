import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseLASFile } from "../src/tools/las-parse.js";
import { reviewLAS } from "../src/tools/las-review.js";

const oracle = JSON.parse(fs.readFileSync(new URL("reference/oracle.json", import.meta.url), "utf8"));
for (const reference of oracle.cases) {
	test(`pinned independent parser sample: ${reference.file}`, () => {
		const file = fileURLToPath(new URL(`reference/${reference.file}`, import.meta.url));
		assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), reference.sha256);
		if (reference.geowizDiagnostic) {
			assert.throws(() => parseLASFile(file), { code: reference.geowizDiagnostic });
			return;
		}
		const result = parseLASFile(file);
		assert.equal(Number(result.version), Number(reference.reference.version));
		assert.equal(result.depth_start, reference.reference.start);
		assert.equal(result.depth_stop, reference.reference.stop);
		assert.equal(result.depth_step, reference.reference.step);
		assert.equal(result.null_value, reference.reference.null);
		assert.deepEqual(
			result.curves.map(({ name, unit }) => ({ name, unit })),
			reference.reference.curves,
		);
		assert.deepEqual(
			result.depth_data.map((_, index) =>
				result.curves.map((curve) => (Number.isNaN(curve.data[index]) ? null : curve.data[index])),
			),
			reference.reference.data,
		);
		assert.equal(
			reviewLAS(result).derived.densityPorosity,
			null,
			"unitless MDEN cannot become a calibrated density assumption",
		);
	});
}

test("signed zero and small negative observations survive an explicitly corrected test derivative", () => {
	const reference = oracle.cases.find((entry: { file: string }) => entry.file.endsWith("small-neg-values.las"));
	const original = fs.readFileSync(new URL(`reference/${reference.file}`, import.meta.url), "utf8");
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "geowiz-public-derivative-"));
	try {
		const file = path.join(directory, "corrected-stop.las");
		fs.writeFileSync(file, original.replace("1660.0000", "1669.7500"));
		const parsed = parseLASFile(file);
		assert.deepEqual(
			parsed.curves[2].data,
			reference.reference.data.map((row: number[]) => row[2]),
		);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
