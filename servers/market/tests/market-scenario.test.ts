import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import * as market from "../src/index.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./fixtures/market-scenario-oracles.json", import.meta.url), "utf8"));
interface ScenarioResult {
	proposal: { summary: string };
	status: "ready-for-review" | "blocked";
	reviewStatus: "unreviewed";
	commercialAuthority: false;
	comparison: {
		unit: string;
		rows: {
			period: string;
			benchmarkValue: number | null;
			realizedNativeValue: number | null;
			realizedValue: number | null;
			differential: number | null;
		}[];
		coverage: { required: number; aligned: number; missing: string[] };
		meanDifferential: number | null;
	};
	seriesMetadata: { id: string; location: string; unit: string; retrievedAt: string; vintage: string | null }[];
	scenarios: { id: string; period: string; price: number | null; basis: "operator-scenario" }[];
	blockers: string[];
}
function builder() {
	const implementation = (market as unknown as { buildMarketScenario?: (input: unknown) => ScenarioResult })
		.buildMarketScenario;
	assert.equal(typeof implementation, "function", "Market must implement the source-bound scenario packet");
	assert.ok(implementation);
	return implementation;
}
const build = (input: unknown): ScenarioResult => builder()(input);
const input = () => structuredClone(frozen.input);
function close(actual: number | null, expected: number) {
	assert.equal(typeof actual, "number");
	assert.ok(actual !== null && Math.abs(actual - expected) < 1e-12, `${actual} differs from ${expected}`);
}

test("market scenario control preserves dated observations and independently labeled heat-content arithmetic", () => {
	const supplied = input();
	const result = build(supplied);
	assert.equal(result.status, "ready-for-review");
	assert.equal(result.reviewStatus, "unreviewed");
	assert.equal(result.commercialAuthority, false);
	assert.deepEqual(
		result.comparison.rows.map((row) => row.period),
		frozen.expected.periods,
	);
	for (const [index, row] of result.comparison.rows.entries()) {
		close(row.benchmarkValue, frozen.expected.benchmarkValues[index]);
		close(row.realizedNativeValue, frozen.expected.realizedNativeValues[index]);
		close(row.realizedValue, frozen.expected.realizedValues[index]);
		close(row.differential, frozen.expected.differentials[index]);
	}
	close(result.comparison.meanDifferential, frozen.expected.meanDifferential);
	assert.deepEqual(result.comparison.coverage, { required: 2, aligned: 2, missing: [] });
	assert.deepEqual(supplied, frozen.input, "analysis cannot mutate the source packet");
});

test("future commercial scenarios stay assumptions and cannot grant approval or become observed spot prices", () => {
	const result = build(input());
	for (const scenario of result.scenarios) {
		assert.equal(scenario.basis, "operator-scenario");
		assert.equal(scenario.period, "2026-12");
		close(scenario.price, frozen.expected.scenarioPrices[scenario.id]);
	}
	assert.equal(result.commercialAuthority, false);
	assert.equal(result.reviewStatus, "unreviewed");
});

test("the exact unreviewed proposal is retained for reproducible human review", () => {
	const supplied = input();
	const result = build(supplied);
	assert.deepEqual(result.proposal, supplied.proposal);
	result.proposal.summary = "A separate caller's local edit";
	assert.deepEqual(supplied.proposal, frozen.input.proposal);
});

test("benchmark location and native regional units survive the comparison", () => {
	const result = build(input());
	assert.equal(result.seriesMetadata.find((series) => series.id === "henry-hub")?.location, "Henry Hub");
	assert.equal(result.seriesMetadata.find((series) => series.id === "operator-appalachia")?.unit, "USD/Mcf");
	assert.equal(result.comparison.unit, "USD/MMBtu");
	assert.equal(result.seriesMetadata[0].retrievedAt, "2026-11-13T06:00:00.000Z");
	assert.equal(result.seriesMetadata[0].vintage, "2026-11-12T22:00:00.000Z");
});

test("missing heat content stays unavailable without a national-average conversion fallback", () => {
	const supplied = input();
	supplied.series.series[1].heatContent = null;
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("conversion_unavailable"));
	assert.equal(result.comparison.rows[0].realizedValue, null);
	assert.equal(result.comparison.meanDifferential, null);
	close(result.comparison.rows[0].realizedNativeValue, 2.94);
});

test("a foreign-region heat-content factor cannot normalize the requested realized series", () => {
	const supplied = input();
	supplied.series.series[1].heatContent.location = "Permian";
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("conversion_unavailable"));
	assert.equal(result.comparison.rows[0].realizedValue, null);
});

test("a missing required period remains a gap instead of being silently forward-filled", () => {
	const supplied = input();
	supplied.series.series[1].observations.pop();
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.deepEqual(result.comparison.coverage, { required: 2, aligned: 1, missing: ["2026-11-12"] });
	assert.equal(result.comparison.rows[1].realizedValue, null);
	assert.equal(result.comparison.meanDifferential, null);
});

test("a fresh retrieval cannot renew stale source observation periods", () => {
	const supplied = input();
	supplied.mandate.maxObservationAgeSeconds = 3600;
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("observation_stale"));
	assert.equal(result.comparison.rows[0].benchmarkValue, null);
});

test("monthly series cannot satisfy a daily observation mandate", () => {
	const supplied = input();
	supplied.series.series[0].frequency = "monthly";
	supplied.series.series[0].observations = [{ period: "2026-10", value: 3.25 }];
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("frequency_mismatch"));
});

test("a different region's realized prices cannot satisfy the requested region", () => {
	const supplied = input();
	supplied.series.series[1].location = "Permian";
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("region_mismatch"));
});

test("zero and negative observed values survive without clamping or replacement", () => {
	const supplied = input();
	supplied.series.series[0].observations = [
		{ period: "2026-11-11", value: 0 },
		{ period: "2026-11-12", value: -1 },
	];
	supplied.series.series[1].observations = [
		{ period: "2026-11-11", value: 0 },
		{ period: "2026-11-12", value: -1.05 },
	];
	const result = build(supplied);
	assert.equal(result.status, "ready-for-review");
	close(result.comparison.rows[0].benchmarkValue, 0);
	close(result.comparison.rows[0].realizedValue, 0);
	close(result.comparison.rows[1].realizedValue, -1);
});

test("missing required scenario assumptions remain blocked rather than being invented", () => {
	const supplied = input();
	supplied.assumptions.scenarios.pop();
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("scenario_missing"));
});

test("a future source vintage cannot support an earlier analysis as-of", () => {
	const supplied = input();
	supplied.series.series[0].vintage = "2026-11-14T00:00:00.000Z";
	const result = build(supplied);
	assert.equal(result.status, "blocked");
	assert.ok(result.blockers.includes("vintage_unavailable"));
});

test("observation periods cannot follow their claimed capture or publication boundary", () => {
	for (const boundary of ["capture", "publication"]) {
		const supplied = input();
		supplied.series.series[0].vintage = "2026-11-10T00:00:00.000Z";
		if (boundary === "capture") supplied.series.series[0].retrievedAt = "2026-11-10T12:00:00.000Z";
		const result = build(supplied);
		assert.equal(result.status, "blocked");
		assert.ok(result.blockers.includes("future_observation"));
		assert.equal(result.comparison.rows[0].benchmarkValue, null);
	}
});

test("model-supplied numeric fact fields and unknown evidence cannot replace source data", () => {
	const execute = builder();
	const supplied = input();
	supplied.proposal.price = 999999;
	assert.throws(() => execute(supplied), { name: "MarketScenarioError" });
	delete supplied.proposal.price;
	supplied.proposal.evidenceSeriesIds.push("foreign-series");
	assert.throws(() => execute(supplied), { name: "MarketScenarioError" });
});

test("duplicate observation periods and nonfinite source values are invalid inputs", () => {
	const execute = builder();
	const supplied = input();
	supplied.series.series[0].observations.push(structuredClone(supplied.series.series[0].observations[0]));
	assert.throws(() => execute(supplied), { name: "MarketScenarioError" });
	const nonfinite = input();
	nonfinite.series.series[0].observations[0].value = Infinity;
	assert.throws(() => execute(nonfinite), { name: "MarketScenarioError" });
});
