import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeLASCurve, computeRMSE_NRMSE } from "../src/tools/curve-qc.js";

const publicSample = fileURLToPath(new URL("reference/lasio-0.32/sample_2.0.las", import.meta.url));
test("curve CLI reports measured statistics without inventing a fitted reference or error score", () => {
	const result = analyzeLASCurve(publicSample, "RHOB");
	assert.equal(result.validPoints, 3);
	assert.equal(result.meanValue, 2550);
	assert.equal(result.rmse, undefined);
	assert.equal(result.nrmse, undefined);
});
test("missing curve/file is an explicit failure with unknown statistics and no path reflection", () => {
	assert.equal(analyzeLASCurve(publicSample, "ABSENT").meanValue, null);
	const missing = analyzeLASCurve(`${publicSample}.private-missing`, "RHOB");
	assert.equal(missing.meanValue, null);
	assert.ok(!missing.error?.includes("private-missing"));
});
test("RMSE compares explicitly supplied paired reference data; zero stays zero and undefined metrics stay unknown", () => {
	assert.deepEqual(computeRMSE_NRMSE([1, 2], [2, 3]), { rmse: 1, nrmse: 1 });
	assert.deepEqual(computeRMSE_NRMSE([0, 1], [0, 1]), { rmse: 0, nrmse: 0 });
	assert.equal(computeRMSE_NRMSE([0, NaN, 2], [0, 1, 2]).rmse, 0);
	assert.ok(Number.isNaN(computeRMSE_NRMSE([], []).rmse));
	assert.ok(Number.isNaN(computeRMSE_NRMSE([1], [1]).nrmse));
});
