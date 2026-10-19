import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCashFlows, cashFlowInputSchema } from "../src/cash-flow.js";

const input = (cashFlows: number[], discountRate = 0.1) => ({
	contractVersion: "0.1.0",
	cashFlows,
	discountRate,
	currency: "USD",
	periodUnit: "year",
	inputRef: { id: "cash-flow.reviewed", revision: "r1" },
	assumptionRefs: [{ id: "assumptions.operator", revision: "r1" }],
});
const close = (actual: number | null, expected: number, tolerance = 1e-8) => {
	assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test("published independent NPV and IRR examples share the declared time-zero convention", () => {
	const npv = calculateCashFlows(input([-40000, 5000, 8000, 12000, 30000], 0.08));
	close(npv.npv.value, 3065.22267, 1e-5);
	const irr = calculateCashFlows(input([-100, 39, 59, 55, 20]));
	close(irr.irr.value, 0.2809484211599611);
	assert.equal(irr.payback.value, 3);
	assert.equal(irr.timing, "time-zero-then-period-end");
	assert.equal(irr.periodUnit, "year");
	assert.equal(irr.currency, "USD");
	assert.deepEqual(irr.inputRef, input([]).inputRef);
});

for (const [flows, expected] of [
	[[-100, 0, 0, 74], -0.0954958303489728],
	[[-100, 1000], 9],
	[[100, -110], 0.1],
	[[0, -100, 110], 0.1],
	[[-100, 100], 0],
] as const) {
	test(`IRR retains negative, high, reversed or delayed rates: ${JSON.stringify(flows)}`, () => {
		const result = calculateCashFlows(input([...flows]));
		assert.equal(result.irr.status, "available");
		close(result.irr.value, expected);
		assert.ok(result.irr.relativeResidual! <= 1e-10);
		close(calculateCashFlows(input([...flows], result.irr.value!)).npv.value, 0, 1e-6);
	});
}

test("zero flows and zero discount stay literal; unrecovered payback is unavailable", () => {
	const result = calculateCashFlows(input([-100, 0, 50], 0));
	close(result.npv.value, -50);
	assert.equal(result.cashFlows[1], 0);
	assert.equal(result.payback.status, "unavailable");
	assert.equal(result.payback.value, null);
	assert.equal(result.payback.reason, "not_recovered");
	assert.equal(calculateCashFlows(input([0, 0])).irr.reason, "indeterminate");
	assert.equal(calculateCashFlows(input([0, 0])).payback.reason, "no_initial_investment");
});

for (const flows of [
	[1, 2],
	[-1, -2],
])
	test(`same-sign flows have no IRR: ${flows}`, () => {
		const result = calculateCashFlows(input(flows));
		assert.equal(result.irr.status, "unavailable");
		assert.equal(result.irr.reason, "no_solution");
		assert.equal(result.irr.value, null);
	});

test("non-conventional sign changes defer instead of selecting a convenient root", () => {
	const result = calculateCashFlows(input([-100, 230, -132]));
	assert.equal(result.irr.reason, "ambiguous_series");
	assert.equal(result.irr.value, null);
	assert.equal(result.reviewStatus, "unreviewed");
	assert.equal(result.authorizesInvestment, false);
});

test("bounded convergence and numeric range cannot return plausible successful rates", () => {
	assert.equal(calculateCashFlows(input([-100, 39, 59, 55, 20]), { maxIterations: 1 }).irr.reason, "nonconvergent");
	assert.equal(calculateCashFlows(input([-1, 1e12])).irr.reason, "outside_solver_bounds");
	assert.equal(calculateCashFlows(input([Number.MAX_VALUE, Number.MAX_VALUE], 0)).npv.reason, "numeric_range");
	assert.throws(() => calculateCashFlows(input([-1, 2]), { maxIterations: 0 }));
});

test("missing, nonfinite, unbounded or mismatched period inputs fail before calculation", () => {
	for (const changes of [
		{ cashFlows: [] },
		{ cashFlows: [1] },
		{ cashFlows: [null, 2] },
		{ cashFlows: [NaN, 2] },
		{ cashFlows: [Infinity, 2] },
		{ cashFlows: Array(602).fill(0) },
		{ discountRate: -1 },
		{ periodUnit: undefined },
		{ periodUnit: "day" },
		{ currency: undefined },
		{ currency: "usd" },
		{ periods: ["2020", "2022"] },
		{ inputRef: undefined },
		{ assumptionRefs: undefined },
		{ approved: true },
		{ contractVersion: "9" },
	])
		assert.equal(cashFlowInputSchema.safeParse({ ...input([-1, 2]), ...changes }).success, false);
	assert.throws(() => calculateCashFlows({ ...input([-1, 2]), currency: "" }));
});

test("monthly rates remain monthly and results cannot mutate caller data", () => {
	const request = { ...input([-100, 110]), periodUnit: "month" };
	const original = structuredClone(request);
	const result = calculateCashFlows(request);
	assert.equal(result.periodUnit, "month");
	close(result.irr.value, 0.1);
	result.cashFlows[0] = 99;
	assert.deepEqual(request, original);
});
