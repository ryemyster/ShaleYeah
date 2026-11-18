import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generateTypeCurve } from "../src/type-curve.js";
import { analogInput, forecastInput } from "./fixtures/type-curve.js";

const close = (actual: number, expected: number, tolerance = 1e-8) =>
	assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const cohort = () => structuredClone(analogInput);

test("the documented synthetic request runs through the actual versioned calculation", () => {
	const input = JSON.parse(readFileSync(new URL("../examples/type-curve.json", import.meta.url), "utf8"));
	const result = generateTypeCurve(input);
	assert.equal(result.status, "available");
	assert.equal(result.evidenceKind, "contains_synthetic");
	close(result.cumulativeProduction.value!, 365000 * Math.log(1.5));
});

test("actual per-well rate histories determine the equal-well forecast and retain synthetic/source labels", () => {
	const result = generateTypeCurve(cohort());
	assert.equal(result.status, "available");
	assert.equal(result.method.id, "equal-well-mean-fixed-b-transformed-regression-v1");
	assert.equal(result.evidenceKind, "contains_synthetic");
	assert.deepEqual(result.inputRef, analogInput.inputRef);
	assert.deepEqual(result.assumptionRefs, analogInput.assumptionRefs);
	close(result.cumulativeProduction.value!, 547500 * Math.log(1.5));
	close(result.forecast[1].rate, 150 / 1.1);
	assert.equal(result.wells.length, 2);
	for (let i = 0; i < result.wells.length; i++) {
		const well = result.wells[i];
		assert.deepEqual(well.wellRef, analogInput.basis.analogWells[i].wellRef);
		assert.equal(well.evidenceKind, "synthetic");
		close(well.fit!.initialRate, 100 * (i + 1));
		close(well.fit!.nominalDecline, 0.1);
		close(well.fit!.rmseRate, 0);
		close(well.cumulativeProduction.value!, 365000 * (i + 1) * Math.log(1.5));
		assert.equal(well.interval!.end, 5);
	}
	const changed = cohort();
	changed.basis.analogWells[1].observations.forEach((point) => {
		point.rate *= 2;
	});
	close(generateTypeCurve(changed).forecast[0].rate, 250);
	assert.notEqual(generateTypeCurve(changed).cumulativeProduction.value, result.cumulativeProduction.value);
});

for (const bFactor of [0, 0.5, 1, 1.2, 2])
	test(`fixed-b fit recovers independently generated synthetic parameters: b=${bFactor}`, () => {
		const input = cohort();
		input.basis.bFactor = bFactor;
		input.basis.analogWells = [300, 500].map((qi, i) => ({
			wellRef: { id: `independent-${i}`, revision: "r2" },
			evidenceKind: "synthetic",
			observations: [0, 0.5, 1, 2].map((elapsedTime) => ({
				elapsedTime,
				rate:
					bFactor === 0 ? qi * Math.exp(-0.2 * elapsedTime) : qi / (1 + bFactor * 0.2 * elapsedTime) ** (1 / bFactor),
			})),
		}));
		const result = generateTypeCurve(input);
		assert.equal(result.status, "available");
		close(result.forecast[0].rate, 400);
		for (const well of result.wells) close(well.fit!.nominalDecline, 0.2);
	});

test("different histories and unequal coverage are fit per well rather than pooled into an older-well-biased mean", () => {
	const input = cohort();
	input.basis.analogWells[1].observations = [0, 0.25, 0.5].map((elapsedTime) => ({
		elapsedTime,
		rate: 200 / (1 + 0.5 * elapsedTime),
	}));
	const result = generateTypeCurve(input);
	assert.equal(result.status, "available");
	close(result.forecast[1].rate, (100 / 1.1 + 200 / 1.5) / 2);
	close(result.wells[1].fit!.nominalDecline, 0.5);
	assert.equal(result.uncertainty.status, "unavailable");
	assert.ok(!("statistics" in result));
});

test("near-zero fixed b recovers the exponential fit without losing the history through underflow", () => {
	for (const bFactor of [Number.MIN_VALUE, 1e-320]) {
		const input = cohort();
		input.basis.bFactor = bFactor;
		input.basis.analogWells.forEach((well) => {
			well.observations.forEach((point) => {
				point.rate = 300 * Math.exp(-0.2 * point.elapsedTime);
			});
		});
		const result = generateTypeCurve(input);
		assert.equal(result.status, "available");
		for (const well of result.wells) {
			close(well.fit!.initialRate, 300);
			close(well.fit!.nominalDecline, 0.2);
		}
	}
});

test("empty, insufficient, zero-rate, increasing and invalid fits cannot silently select a partial cohort or scenario", () => {
	const empty = cohort();
	empty.basis.analogWells = [];
	assert.equal(generateTypeCurve(empty).status, "unavailable");
	assert.equal(generateTypeCurve(empty).evidenceKind, "no_evidence");
	for (const observations of [
		[],
		[
			{ elapsedTime: 0, rate: 10 },
			{ elapsedTime: 1, rate: 9 },
		],
		[
			{ elapsedTime: 0, rate: 0 },
			{ elapsedTime: 1, rate: 0 },
			{ elapsedTime: 2, rate: 0 },
		],
		[
			{ elapsedTime: 0, rate: 1 },
			{ elapsedTime: 1, rate: 2 },
			{ elapsedTime: 2, rate: 3 },
		],
	]) {
		const input = cohort();
		input.basis.analogWells[1].observations = observations;
		const result = generateTypeCurve(input);
		assert.equal(result.status, "unavailable");
		assert.equal(result.cumulativeProduction.value, null);
		assert.deepEqual(result.forecast, []);
		assert.equal(result.basis, "analog-history");
		assert.equal(result.professionalAcceptance, false);
	}
});

test("unrepresentable analog fits/volumes cannot return a partial available cohort", () => {
	for (const rates of [
		[1e308, 9e307, 8e307],
		[1e308, 1, 1e-308],
		[1, 1, 0.01],
	]) {
		const input = cohort();
		input.basis.bFactor = 2;
		input.basis.analogWells[0].observations = rates.map((rate, elapsedTime) => ({ elapsedTime, rate }));
		const result = generateTypeCurve(input);
		assert.equal(result.status, "unavailable");
		assert.equal(result.cumulativeProduction.value, null);
		assert.deepEqual(result.forecast, []);
		assert.equal(result.wells[0].status, "unavailable");
	}
});

test("observed labels stay caller-supplied, exact IDs/revisions survive, residuals do not grant confidence or approval", () => {
	const input = cohort();
	input.basis.analogWells[0].wellRef = { id: "WELL/API 05-123", revision: "source-r7" };
	const observed = {
		...input,
		basis: {
			...input.basis,
			analogWells: input.basis.analogWells.map((well) => ({ ...well, evidenceKind: "observed" })),
		},
	};
	observed.basis.analogWells[0].observations = [100, 91, 83, 78].map((rate, elapsedTime) => ({ rate, elapsedTime }));
	const result = generateTypeCurve(observed);
	assert.equal(result.status, "available");
	assert.equal(result.evidenceKind, "caller_supplied_observations");
	assert.deepEqual(result.wells[0].wellRef, { id: "WELL/API 05-123", revision: "source-r7" });
	assert.ok(result.wells[0].fit!.rmseRate > 0);
	assert.ok(result.wells[0].fit!.rSquared.value! < 1);
	assert.equal(result.reviewStatus, "unreviewed");
	assert.equal(result.professionalAcceptance, false);
});

test("constant histories give zero decline but do not manufacture R-squared confidence", () => {
	const input = cohort();
	input.basis.analogWells.forEach((well) => {
		well.observations.forEach((point) => {
			point.rate = 100;
		});
	});
	const result = generateTypeCurve(input);
	assert.equal(result.status, "available");
	close(result.cumulativeProduction.value!, 182500);
	for (const well of result.wells) {
		assert.equal(well.fit!.nominalDecline, 0);
		assert.equal(well.fit!.rSquared.value, null);
	}
});

test("scenario assumptions remain distinct from analog evidence and cannot gain approval or percentiles", () => {
	const input = cohort();
	const result = generateTypeCurve({
		...input,
		basis: { kind: "scenario", initialRate: 100, nominalDecline: 0.1, bFactor: 1 },
	});
	assert.equal(result.basis, "scenario");
	assert.equal(result.evidenceKind, "assumptions_only");
	assert.equal(result.reviewStatus, "unreviewed");
	assert.equal(result.authorizesReserves, false);
	close(result.cumulativeProduction.value!, 365000 * Math.log(1.5));
	assert.deepEqual(result.wells, []);
	for (const key of ["statistics", "p10", "p50", "p90", "confidence", "approved"]) assert.ok(!(key in result));
	assert.throws(() => generateTypeCurve({ ...input, approved: true }));
	assert.throws(() => generateTypeCurve({ ...input, basis: { ...input.basis, approved: true } }));
});

test("duplicate identities/times, implicit age shifts, wrong units and horizon shorter than history are rejected", () => {
	for (const mutate of [
		(input: ReturnType<typeof cohort>) => {
			input.basis.analogWells[1].wellRef.id = input.basis.analogWells[0].wellRef.id;
		},
		(input: ReturnType<typeof cohort>) => {
			input.basis.analogWells[0].observations[1].elapsedTime = 0;
		},
		(input: ReturnType<typeof cohort>) => {
			input.basis.analogWells[0].observations[0].elapsedTime = 0.1;
		},
		(input: ReturnType<typeof cohort>) => {
			input.basis.analogWells[0].observations[3].elapsedTime = 6;
		},
	]) {
		const input = cohort();
		mutate(input);
		assert.throws(() => generateTypeCurve(input));
	}
	assert.throws(() => generateTypeCurve({ ...cohort(), rateUnit: "bbl/month" }));
	assert.throws(() => generateTypeCurve({ ...cohort(), nominalDecline: forecastInput.nominalDecline }));
});
