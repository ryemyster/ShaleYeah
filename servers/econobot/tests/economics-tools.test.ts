import assert from "node:assert/strict";
import { test } from "node:test";
import { createEconobotTemplate } from "../src/index.js";

const input = {
	contractVersion: "0.1.0",
	cashFlows: [-100, 110],
	discountRate: 0.1,
	currency: "USD",
	periodUnit: "year",
	inputRef: { id: "source.cash-flows", revision: "r1" },
	assumptionRefs: [],
};
const tool = (name: string, options = {}) => {
	const found = createEconobotTemplate(options).tools.find((item) => item.name === name);
	assert.ok(found);
	return found;
};
const run = (name: string, args: unknown, options = {}) => {
	const selected = tool(name, options);
	return selected.handler(selected.inputSchema.parse(args));
};

test("actual DCF tool uses the versioned calculator and does not turn unavailable IRR into failure or approval", async () => {
	const result = await run("calculate_dcf", { ...input, cashFlows: [-100, -10] });
	assert.equal(result.success, true);
	assert.equal(result.analysis.irr.reason, "no_solution");
	assert.equal(result.analysis.irr.value, null);
	assert.equal(result.analysis.authorizesInvestment, false);
	assert.equal(result.metadata.confidence, null);
});

test("missing legacy timing/source data and invented file paths cannot select a synthetic-success fallback", () => {
	assert.throws(() => tool("calculate_dcf").inputSchema.parse({ cashFlows: [-100, 110], discountRate: 0.1 }));
	assert.throws(() =>
		tool("analyze_economics").inputSchema.parse({ filePath: "/unavailable.csv", dataType: "production" }),
	);
	assert.throws(() =>
		tool("sensitivity_analysis").inputSchema.parse({ baseCase: { oilPrice: 75 }, ranges: {}, scenarios: 100 }),
	);
});

test("analysis uses the same numbers; unconfigured synthesis is explicit and cannot approve spending", async () => {
	const dcf = await run("calculate_dcf", input);
	const result = await run("analyze_economics", { input, includeInterpretation: true });
	assert.deepEqual(result.analysis.economics, dcf.analysis);
	assert.equal(result.analysis.interpretation.status, "unavailable");
	assert.equal(result.analysis.interpretation.reason, "not_configured");
	assert.equal((await run("analyze_economics", { input })).analysis.interpretation.status, "not_requested");
});

test("configured synthesis receives computed values but cannot change them, including on provider failure", async () => {
	let calls = 0;
	const invokeLLM = async (options: { prompt: string; model?: string; apiKey?: string }) => {
		calls++;
		assert.equal(options.model, "operator-selected");
		assert.ok(options.prompt.includes('"authorizesInvestment":false'));
		return '{"npv":999999,"recommendation":"PROCEED"}';
	};
	const result = await run(
		"analyze_economics",
		{ input, includeInterpretation: true },
		{ synthesis: { model: "operator-selected" }, invokeLLM },
	);
	assert.equal(calls, 1);
	assert.ok(Math.abs(result.analysis.economics.npv.value) < 1e-10);
	assert.equal(result.analysis.interpretation.reviewStatus, "unreviewed");
	assert.equal(result.analysis.economics.authorizesInvestment, false);
	const failed = await run(
		"analyze_economics",
		{ input, includeInterpretation: true },
		{
			synthesis: { model: "operator-selected" },
			invokeLLM: async () => {
				throw new Error("private-provider-detail");
			},
		},
	);
	assert.equal(failed.analysis.interpretation.reason, "provider_unavailable");
	assert.ok(!JSON.stringify(failed).includes("private-provider-detail"));
});

test("sensitivity compares only operator-supplied scenarios using the same timing and currency", async () => {
	const result = await run("sensitivity_analysis", {
		baseCase: input,
		scenarios: [{ id: "lower-return", input: { ...input, cashFlows: [-100, 90] } }],
	});
	assert.equal(result.analysis.scenarios.length, 1);
	assert.ok(result.analysis.scenarios[0].economics.npv.value < result.analysis.baseCase.npv.value);
	assert.equal(result.analysis.scenarios[0].economics.irr.status, "available");
	const mismatch = await run("sensitivity_analysis", {
		baseCase: input,
		scenarios: [{ id: "foreign", input: { ...input, currency: "CAD" } }],
	});
	assert.equal(mismatch.success, false);
	const period = await run("sensitivity_analysis", {
		baseCase: input,
		scenarios: [{ id: "monthly", input: { ...input, periodUnit: "month" } }],
	});
	assert.equal(period.success, false);
});

test("provider output limits and empty output cannot create a useful interpretation", async () => {
	for (const text of ["", "x".repeat(32769)]) {
		const result = await run(
			"analyze_economics",
			{ input, includeInterpretation: true },
			{ synthesis: { model: "configured" }, invokeLLM: async () => text },
		);
		assert.equal(result.analysis.interpretation.status, "unavailable");
	}
});

test("host credential leakage, duplicate scenarios and actual unconfigured legacy LLM calls fail safely", async () => {
	const secret = "fixture-credential-only";
	const unsafe = await run(
		"analyze_economics",
		{ input, includeInterpretation: true },
		{
			synthesis: { apiKey: secret },
			invokeLLM: async () => `Leaked ${secret}`,
		},
	);
	assert.equal(unsafe.analysis.interpretation.status, "unavailable");
	assert.ok(!JSON.stringify(unsafe).includes(secret));
	const noCredential = await run(
		"analyze_economics",
		{ input, includeInterpretation: true },
		{ synthesis: { apiKey: "" } },
	);
	assert.equal(noCredential.analysis.interpretation.reason, "provider_unavailable");
	const duplicate = await run("sensitivity_analysis", {
		baseCase: input,
		scenarios: [
			{ id: "same", input },
			{ id: "same", input },
		],
	});
	assert.equal(duplicate.success, false);
});
