import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createCurveSmithTemplate } from "../src/index.js";

test("native adoption retires the unscoped legacy file-fitting tool", () => {
	const names = createCurveSmithTemplate().tools.map((tool) => tool.name);
	assert.ok(
		!names.includes("analyze_decline_curve"),
		"source-linked forecasting must replace the old file path/fallback surface",
	);
	assert.ok(names.includes("generate_type_curve"));
	assert.ok(names.includes("calculate_eur"));
});

test("native adoption retires proxy quality scores rather than presenting them as observed fit diagnostics", () => {
	const names = createCurveSmithTemplate().tools.map((tool) => tool.name);
	assert.ok(
		!names.includes("assess_curve_quality"),
		"confidence/grade proxies are not measured R-squared or history counts",
	);
});

test("displaced file-fitting source and generated artifacts cannot enter an extraction archive", () => {
	assert.equal(existsSync(new URL("../src/tools/decline-curve-analysis.ts", import.meta.url)), false);
	assert.equal(existsSync(new URL("../dist/tools/decline-curve-analysis.js", import.meta.url)), false);
});
