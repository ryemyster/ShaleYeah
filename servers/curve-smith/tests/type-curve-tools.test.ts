import assert from "node:assert/strict";
import { test } from "node:test";
import { createCurveSmithTemplate } from "../src/index.js";
import { analogInput, forecastInput } from "./fixtures/type-curve.js";

const tool = (name: string, options = {}) => {
	const result = createCurveSmithTemplate(options).tools.find((candidate) => candidate.name === name);
	assert.ok(result);
	return result;
};
const run = (name: string, args: unknown, options = {}) => {
	const selected = tool(name, options);
	return selected.handler(selected.inputSchema.parse(args));
};

test("actual type-curve and volume handlers share the verified kernel and cannot fabricate confidence", async () => {
	const curve = await run("generate_type_curve", analogInput);
	assert.equal(curve.success, true);
	assert.equal(curve.metadata.confidence, null);
	assert.ok(Math.abs(curve.analysis.cumulativeProduction.value - 547500 * Math.log(1.5)) < 1e-6);
	assert.equal(curve.analysis.interpretation.status, "not_requested");
	const volume = await run("calculate_eur", forecastInput);
	assert.equal(volume.success, true);
	assert.equal(volume.analysis.volumeUnit, "bbl");
	assert.equal(volume.analysis.authorizesReserves, false);
	assert.equal(volume.metadata.confidence, null);
});

test("versioned tool schemas reject identifier-only tiers, silent GOR and model/provider approval arguments", () => {
	assert.throws(() =>
		tool("generate_type_curve").inputSchema.parse({ formation: "Wolfcamp", analogWells: ["id"], tier: 1 }),
	);
	assert.throws(() =>
		tool("calculate_eur").inputSchema.parse({ initialRateOil: 100, initialRateGas: 200, declineRate: 0.1, bFactor: 1 }),
	);
	assert.throws(() =>
		tool("generate_type_curve").inputSchema.parse({ ...analogInput, synthesis: { apiKey: "tool-supplied" } }),
	);
	assert.throws(() => tool("generate_type_curve").inputSchema.parse({ ...analogInput, approved: true }));
});

test("a missing production file cannot reach the deleted fixed-tier fallback", async () => {
	const result = await run("analyze_decline_curve", { filePath: "/unavailable-shaleyeah-fixture/no-production.csv" });
	assert.equal(result.success, false);
	assert.ok(!("analysis" in result));
});

test("unconfigured interpretation and unavailable calculation remain explicit without provider calls", async () => {
	const unconfigured = await run("generate_type_curve", { ...analogInput, includeInterpretation: true });
	assert.equal(unconfigured.analysis.interpretation.reason, "not_configured");
	let calls = 0;
	const missing = await run(
		"generate_type_curve",
		{ ...analogInput, basis: { ...analogInput.basis, analogWells: [] }, includeInterpretation: true },
		{
			synthesis: { model: "configured" },
			invokeLLM: async () => {
				calls++;
				return "invented success";
			},
		},
	);
	assert.equal(calls, 0);
	assert.equal(missing.analysis.status, "unavailable");
	assert.equal(missing.analysis.cumulativeProduction.value, null);
	assert.equal(missing.analysis.interpretation.reason, "calculation_unavailable");
});

test("configured callLLM receives calculated numbers and units, but no raw histories or source identifiers", async () => {
	let calls = 0;
	const result = await run(
		"generate_type_curve",
		{ ...analogInput, includeInterpretation: true },
		{
			synthesis: { model: "host-selected" },
			invokeLLM: async (options: { model?: string; prompt: string; system?: string }) => {
				calls++;
				assert.equal(options.model, "host-selected");
				assert.ok(options.prompt.includes('"authorizesReserves":false'));
				assert.ok(options.prompt.includes('"daysPerUnit":365'));
				assert.ok(!options.prompt.includes("fixture.well-1"));
				assert.ok(!options.prompt.includes("observations"));
				assert.ok(!options.prompt.includes("Synthetic formation"));
				return '{"cumulativeProduction":999999,"p90":999999,"approved":true}';
			},
		},
	);
	assert.equal(calls, 1);
	assert.equal(result.analysis.interpretation.status, "available");
	assert.equal(result.analysis.interpretation.reviewStatus, "unreviewed");
	assert.ok(Math.abs(result.analysis.cumulativeProduction.value - 547500 * Math.log(1.5)) < 1e-6);
	assert.equal(result.analysis.professionalAcceptance, false);
	assert.equal(result.analysis.authorizesReserves, false);
	assert.ok(!("p90" in result.analysis));
});

test("provider failures, empty/oversized answers and echoed host keys cannot replace a calculation", async () => {
	for (const text of ["", "x".repeat(32769), "fixture-credential-only"]) {
		const result = await run(
			"generate_type_curve",
			{ ...analogInput, includeInterpretation: true },
			{ synthesis: { apiKey: "fixture-credential-only" }, invokeLLM: async () => text },
		);
		assert.equal(result.analysis.interpretation.status, "unavailable");
		assert.equal(result.analysis.status, "available");
		assert.ok(!JSON.stringify(result).includes("fixture-credential-only"));
	}
	const failed = await run(
		"generate_type_curve",
		{ ...analogInput, includeInterpretation: true },
		{
			synthesis: { model: "configured" },
			invokeLLM: async () => {
				throw new Error("private-provider-failure");
			},
		},
	);
	assert.equal(failed.analysis.interpretation.reason, "provider_unavailable");
	assert.ok(!JSON.stringify(failed).includes("private-provider-failure"));
	const noKey = await run(
		"generate_type_curve",
		{ ...analogInput, includeInterpretation: true },
		{ synthesis: { apiKey: "" } },
	);
	assert.equal(noKey.analysis.interpretation.reason, "provider_unavailable");
});
