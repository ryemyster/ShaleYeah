import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("configured labeled fixtures qualify eight dimensions with separate detection metrics and no professional claim", () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-qualification-"));
	try {
		const file = path.join(directory, "report.json");
		execFileSync(process.execPath, ["scripts/qualify.mjs", "--report", file]);
		const report = JSON.parse(readFileSync(file, "utf8"));
		assert.equal(report.status, "passed");
		assert.equal(report.professionalAcceptance, false);
		assert.equal(report.cases.length, 22);
		assert.equal(report.detection.precision, 1);
		assert.equal(report.detection.recall, 1);
		assert.equal(report.reviewerEffortSeconds, null);
		assert.ok(!Object.hasOwn(report, "sourceCoverage"));
		assert.equal(report.fixtureHash.length, 64);
	} finally {
		rmSync(directory, { recursive: true });
	}
});
