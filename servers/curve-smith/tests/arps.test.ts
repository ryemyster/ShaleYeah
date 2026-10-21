import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateForecast } from "../src/arps.js";
import { forecastInput } from "./fixtures/type-curve.js";

const close = (actual: number, expected: number, tolerance = 1e-9) =>
	assert.ok(
		Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
		`${actual} != ${expected}`,
	);

// Independent test oracle: quadrature of rates, with a bisection cutoff search.
function integrate(qi: number, decline: number, b: number, horizon: number, cutoff: number, days: number) {
	const rate = (t: number) => (b === 0 ? qi * Math.exp(-decline * t) : qi * (1 + b * decline * t) ** (-1 / b));
	if (qi <= cutoff) return 0;
	let end = horizon;
	if (rate(end) < cutoff) {
		let left = 0,
			right = end;
		for (let i = 0; i < 100; i++) {
			const middle = (left + right) / 2;
			if (rate(middle) > cutoff) left = middle;
			else right = middle;
		}
		end = (left + right) / 2;
	}
	const steps = 20000,
		width = end / steps;
	let sum = rate(0) + rate(end);
	for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * rate(i * width);
	return (days * width * sum) / 3;
}

for (const bFactor of [0, 1e-12, 0.5, 1 - 1e-10, 1, 1 + 1e-10, 1.2, 2]) {
	for (const economicLimitRate of [0, 80]) {
		test(`finite Arps volume agrees with independent quadrature: b=${bFactor}, cutoff=${economicLimitRate}`, () => {
			const result = calculateForecast({ ...forecastInput, bFactor, economicLimitRate });
			assert.equal(result.status, "available");
			// Tiny b uses the separately verified continuous exponential limit in this oracle.
			const oracleB = bFactor < 1e-9 ? 0 : bFactor;
			close(result.cumulativeProduction.value!, integrate(100, 0.1, oracleB, 5, economicLimitRate, 365), 2e-9);
			assert.equal(result.volumeUnit, "bbl");
			assert.equal(result.professionalAcceptance, false);
		});
	}
}

test("closed-form harmonic, exponential, zero-decline and below-limit controls", () => {
	close(calculateForecast(forecastInput).cumulativeProduction.value!, 365000 * Math.log(1.5));
	close(calculateForecast({ ...forecastInput, bFactor: 0 }).cumulativeProduction.value!, 365000 * (1 - Math.exp(-0.5)));
	close(calculateForecast({ ...forecastInput, nominalDecline: 0 }).cumulativeProduction.value!, 182500);
	for (const initialRate of [0, 10]) {
		const result = calculateForecast({ ...forecastInput, initialRate, economicLimitRate: 10 });
		assert.equal(result.cumulativeProduction.value, 0);
		assert.equal(result.interval?.end, 0);
		assert.ok(result.forecast.every((point) => point.rate === 0 && point.cumulativeProduction === 0));
	}
});

test("rate cutoff truncates rates and cumulative volume without an implicit gas/oil ratio", () => {
	const oil = calculateForecast({ ...forecastInput, economicLimitRate: 80 });
	close(oil.interval!.end, 2.5);
	assert.equal(oil.interval!.reason, "economic_limit");
	close(oil.cumulativeProduction.value!, 365000 * Math.log(1.25));
	assert.equal(oil.forecast.at(-1)!.rate, 0);
	close(oil.forecast.at(-1)!.cumulativeProduction, oil.cumulativeProduction.value!);
	const gas = calculateForecast({ ...forecastInput, product: "gas", rateUnit: "Mcf/day", economicLimitRate: 80 });
	close(gas.cumulativeProduction.value!, oil.cumulativeProduction.value!);
	assert.equal(gas.volumeUnit, "Mcf");
});

test("explicit year, month and day conventions describe the same physical curve", () => {
	const yearly = calculateForecast(forecastInput);
	for (const [unit, daysPerUnit] of [
		["day", 1],
		["month", 30.4],
	] as const) {
		const scale = 365 / daysPerUnit;
		const converted = calculateForecast({
			...forecastInput,
			timeBasis: { unit, daysPerUnit },
			horizon: 5 * scale,
			nominalDecline: 0.1 / scale,
			forecastTimes: [0, scale, 5 * scale],
		});
		close(converted.cumulativeProduction.value!, yearly.cumulativeProduction.value!);
		close(converted.forecast[1].rate, yearly.forecast[1].rate);
	}
});

test("model limits remain stable near zero decline and close to the economic cutoff", () => {
	close(calculateForecast({ ...forecastInput, nominalDecline: 1e-18 }).cumulativeProduction.value!, 182500, 1e-12);
	const limited = calculateForecast({ ...forecastInput, economicLimitRate: 100 * (1 - 1e-12) });
	assert.equal(limited.status, "available");
	assert.ok(limited.cumulativeProduction.value! > 0 && limited.cumulativeProduction.value! < 1e-5);
	assert.equal(calculateForecast({ ...forecastInput, economicLimitRate: 101 }).cumulativeProduction.value, 0);
});

test("subnormal b and tiny D retain the representable exponential/constant limits", () => {
	for (const bFactor of [Number.MIN_VALUE, 1e-320, 1e-300]) {
		const result = calculateForecast({ ...forecastInput, bFactor });
		assert.equal(result.status, "available");
		close(result.cumulativeProduction.value!, 365000 * (1 - Math.exp(-0.5)), 1e-12);
		close(result.forecast[1].rate, 100 * Math.exp(-0.1), 1e-12);
	}
	const tiny = calculateForecast({ ...forecastInput, bFactor: 1e-300, nominalDecline: 1e-300 });
	assert.equal(tiny.status, "available");
	close(tiny.cumulativeProduction.value!, 182500, 1e-12);
});

test("a representable late rate is preserved when the exponential decay alone underflows", () => {
	const result = calculateForecast({
		...forecastInput,
		initialRate: 1e308,
		nominalDecline: 700,
		bFactor: 0,
		timeBasis: { unit: "day", daysPerUnit: 1 },
		horizon: 2,
		forecastTimes: [0, 1.05, 2],
	});
	assert.equal(result.status, "available");
	for (const point of result.forecast) {
		const expected = Math.exp(Math.log(1e308) - 700 * point.time);
		assert.ok(point.rate > 0);
		assert.ok(Math.abs(point.rate / expected - 1) < 1e-12);
	}
});

test("malformed units, missing revisions/horizon, unsupported authority and ambiguous time bases are rejected", () => {
	for (const changed of [
		{ horizon: undefined },
		{ inputRef: undefined },
		{ assumptionRefs: [] },
		{ nominalDecline: -1 },
		{ bFactor: -1 },
		{ bFactor: 3 },
		{ initialRate: Number.NaN },
		{ horizon: Infinity },
		{ rateUnit: "bbl/month" },
		{ product: "gas" },
		{ timeBasis: { unit: "day", daysPerUnit: 365 } },
		{ timeBasis: { unit: "month" } },
		{ forecastTimes: [1, 0] },
		{ forecastTimes: [1, 1] },
		{ forecastTimes: [0, 6] },
		{ approved: true },
		{ p90: 100 },
	])
		assert.throws(() => calculateForecast({ ...forecastInput, ...changed }), JSON.stringify(changed));
});

test("nonrepresentable volume is unavailable and cannot leak Infinity, NaN, confidence or ultimate reserves", () => {
	const result = calculateForecast({ ...forecastInput, initialRate: 1e308, nominalDecline: 0 });
	assert.equal(result.status, "unavailable");
	assert.equal(result.cumulativeProduction.value, null);
	assert.equal(result.cumulativeProduction.reason, "numeric_range");
	assert.deepEqual(result.forecast, []);
	assert.equal(result.reviewStatus, "unreviewed");
	assert.equal(result.authorizesReserves, false);
	assert.deepEqual(result.uncertainty, { status: "unavailable", reason: "no_uncertainty_model" });
	for (const key of ["eur", "p10", "p50", "p90", "confidence", "approved"]) assert.ok(!(key in result));
});
