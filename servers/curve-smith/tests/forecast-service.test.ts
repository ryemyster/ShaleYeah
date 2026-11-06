import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductionForecastService } from "../src/forecast-service.js";
import { forecastFixture, ref, who } from "./fixtures/forecast.js";

const near = (actual: number, expected: number) =>
	assert.ok(Math.abs(actual / expected - 1) < 1e-9, `${actual} != ${expected}`);

test("actual source histories drive modeled and future-only forecasts; held-out rates are not trained on", async () => {
	const f = forecastFixture();
	const result = await f.service.calculate(ref, { id: "base", revision: "r1" }, who);
	near(result.calculation.modeled.cumulativeProduction.value!, 365000 * Math.log(1.5));
	near(result.calculation.remaining[0].cumulativeProduction.value!, 365000 * Math.log(1.5 / 1.3));
	assert.equal(result.calculation.modeled.wells[0].fit!.observationCount, 3);
	assert.equal(result.calculation.validation[0].holdoutCount, 1);
	assert.ok(result.calculation.validation[0].relativeRmse.value! < 1e-10);
	assert.equal(result.calculation.authorizesReserves, false);
	assert.equal(result.sourceArtifacts.length, 3);
	f.history.wells[0].observations[3].rate *= 1.5;
	f.texts.set("history", JSON.stringify(f.history));
	f.bind();
	const changed = await f.service.calculate(ref, { id: "base", revision: "r1" }, who);
	near(changed.calculation.modeled.cumulativeProduction.value!, result.calculation.modeled.cumulativeProduction.value!);
	assert.ok(changed.calculation.validation[0].relativeRmse.value! > 0.1);
	assert.equal(changed.calculation.quality.status, "failed");
});

test("work and comparisons retain all source/assumption revisions and never approve reserves", async () => {
	const f = forecastFixture();
	const comparison = await f.service.compare(ref, ["base", "alternative"], who);
	assert.equal(comparison.forecasts.length, 2);
	const candidate = await f.service.draft(ref, ["base"], "r1", who);
	assert.equal(candidate.work.status, "ready_for_review");
	assert.deepEqual(candidate.work.review, { status: "unreviewed", decisionRefs: [] });
	assert.equal(candidate.work.inputs.length, 3);
	assert.ok(candidate.work.findings.every((finding) => finding.basis !== "observed"));
	assert.equal(candidate.forecast.authorizesReserves, false);
	assert.ok(candidate.work.assumptions.length > 0);
	await assert.rejects(() => f.service.compare(ref, ["base", "base"], who));
	await assert.rejects(() => f.service.calculate({ ...ref, revision: "old" }, { id: "base", revision: "r1" }, who));
	await assert.rejects(() => f.service.calculate(ref, { id: "missing", revision: "r1" }, who));
});

test("unknown units, non-well grain, ambiguous totals, time mismatches, shut-ins and stale observation dates defer", async () => {
	const changes: ((f: ReturnType<typeof forecastFixture>) => void)[] = [
		(f) => {
			f.history.rateUnit = "bbl/month";
		},
		(f) => {
			f.history.sourceGrain = "lease";
		},
		(f) => {
			f.history.observationKind = "period-volume";
		},
		(f) => {
			f.history.wells[0].observations[1].observedAt = "2023-02-01T00:00:00Z";
		},
		(f) => {
			f.history.wells[0].observations[1].operation = "shut-in";
		},
		(f) => {
			f.history.formation = "Different formation";
		},
		(f) => {
			f.basis.wells[0].revision = "different-completion";
		},
	];
	for (const change of changes) {
		const f = forecastFixture();
		change(f);
		f.texts.set("history", JSON.stringify(f.history));
		f.texts.set("basis", JSON.stringify(f.basis));
		f.bind();
		await assert.rejects(() => f.service.calculate(ref, { id: "base", revision: "r1" }, who));
	}
	const stale = forecastFixture();
	stale.setClock(() => new Date("2026-02-01T00:00:00Z"));
	await assert.rejects(() => stale.service.inspect(ref, who));
});

test("minimum history and validation thresholds come from referenced configuration and cannot be silent defaults", async () => {
	const f = forecastFixture();
	f.assumptions.forecasts[0].minimumTrainingObservations = 4;
	f.texts.set("assumptions", JSON.stringify(f.assumptions));
	f.bind();
	const result = await f.service.calculate(ref, { id: "base", revision: "r1" }, who);
	assert.equal(result.calculation.quality.status, "failed");
	const blocked = await f.service.draft(ref, ["base"], "r2", who);
	assert.equal(blocked.work.status, "blocked");
	assert.ok(blocked.work.blockers.length > 0);
	assert.equal(blocked.forecast.reviewStatus, "unreviewed");
});

test("source revocation, forged bytes/scope, content guards and current task changes block the executing path", async () => {
	const f = forecastFixture();
	f.revoke();
	await assert.rejects(() => f.service.inspect(ref, who));
	for (const options of [
		{ fetchSource: async () => ({ ...f.fetched("evidence.history"), bytes: Buffer.from("forged") }) },
		{ contentGuard: async () => false },
		{ current: async () => ({ ...(await f.options.current()), authorityRevision: "invalid" }) },
	]) {
		const service = new ProductionForecastService({ ...f.options, ...options });
		await assert.rejects(() => service.inspect(ref, who));
	}
	const changed = forecastFixture();
	changed.setGuard(async () => {
		changed.current.task.revision = "r2";
		return true;
	});
	await assert.rejects(() => changed.service.inspect(ref, who));
});

test("bounded source pages and metadata preserve identity and reject unknown/revoked inputs", async () => {
	const f = forecastFixture(),
		source = f.current.historySourceRef;
	const page = await f.service.readSource(source, who, 0, 20);
	assert.equal(page.text.length, 20);
	assert.equal(page.nextOffset, 20);
	assert.equal((await f.service.sourceMetadata(source, "read", who)).sourceArtifact.artifact.id, source.id);
	assert.ok((await f.service.reviewSource(source.id, who)).bytes.byteLength > 0);
	await assert.rejects(() => f.service.readSource(source, who, -1, 20));
	await assert.rejects(() => f.service.readSource({ id: "unknown", revision: "r1" }, who));
	f.revoke();
	await assert.rejects(() => f.service.sourceMetadata(source, "export", who));
});

test("source and task authority must remain current through the final content guard", async () => {
	const f = forecastFixture();
	f.setGuard(async (text) => {
		if (text.includes('"work"')) f.revoke();
		return true;
	});
	await assert.rejects(() => f.service.draft(ref, ["base"], "r1", who));
});

test("rate units, identities, complete histories and current source envelopes are required", async () => {
	const changes: ((f: ReturnType<typeof forecastFixture>) => void)[] = [
		(f) => {
			f.history.product = "gas";
		},
		(f) => {
			f.history.wells.push(structuredClone(f.history.wells[0]));
		},
		(f) => {
			f.history.wells[0].observations[1].rate = 0;
		},
		(f) => {
			f.history.wells[0].observations[1].elapsedTime = 0;
		},
		(f) => {
			f.assumptions.forecasts.push(structuredClone(f.assumptions.forecasts[0]));
		},
		(f) => {
			f.assumptions.forecasts[0].fitUntil = 6;
		},
	];
	for (const change of changes) {
		const f = forecastFixture();
		change(f);
		for (const [key, value] of [
			["history", f.history],
			["basis", f.basis],
			["assumptions", f.assumptions],
		] as const)
			f.texts.set(key, JSON.stringify(value));
		f.bind();
		await assert.rejects(() => f.service.calculate(ref, { id: "base", revision: "r1" }, who));
	}
	const f = forecastFixture();
	await assert.rejects(() => f.service.inspect(ref, { ...who, customerId: "other" }));
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(() => f.service.inspect(ref, who, controller.signal));
	for (const alteration of [
		(source: ReturnType<typeof f.fetched>) => {
			source.artifact.byteLength += 1;
		},
		(source: ReturnType<typeof f.fetched>) => {
			source.artifact.evidence.asOf = "2030-01-01T00:00:00Z";
		},
		(source: ReturnType<typeof f.fetched>) => {
			source.artifact.units = [];
		},
	]) {
		const service = new ProductionForecastService({
			...f.options,
			fetchSource: async (reference) => {
				const source = f.fetched(reference.id);
				alteration(source);
				return source;
			},
		});
		await assert.rejects(() => service.inspect(ref, who));
	}
});

test("large valid forecast grids and operating limitations retain full evidence without overflowing work text", async () => {
	const f = forecastFixture();
	f.assumptions.forecasts[0].forecastTimes = Array.from({ length: 601 }, (_, i) => i / 120);
	f.basis.operatingBasis = `Operator-declared operating basis: ${"x".repeat(2000)}`;
	f.basis.limitations = Array.from({ length: 32 }, (_, i) => `Limitation ${i}: ${"y".repeat(2000)}`);
	f.texts.set("basis", JSON.stringify(f.basis));
	f.texts.set("assumptions", JSON.stringify(f.assumptions));
	f.bind();
	const result = await f.service.draft(ref, ["base"], "r1", who);
	assert.equal(result.work.status, "ready_for_review");
	assert.deepEqual(result.forecast.basis.limitations, f.basis.limitations);
	assert.equal(result.forecast.forecasts[0].modeled.forecast.length, 601);
	assert.equal(result.work.evidence.length, 3);
});

test("insufficient fitting history still reports actual observed training and holdout counts", async () => {
	const f = forecastFixture();
	f.assumptions.forecasts[0].fitUntil = 1;
	f.texts.set("assumptions", JSON.stringify(f.assumptions));
	f.bind();
	const result = await f.service.calculate(ref, { id: "base", revision: "r1" }, who);
	assert.equal(result.calculation.validation[0].trainingCount, 2);
	assert.equal(result.calculation.validation[0].holdoutCount, 2);
	assert.equal(result.calculation.validation[0].fitRelativeRmse.status, "unavailable");
	assert.equal(result.calculation.quality.status, "failed");
	assert.equal(result.calculation.remaining[0].cumulativeProduction.value, null);
});

test("input discovery gives identities and actual coverage while full history is loaded in bounded pages", async () => {
	const f = forecastFixture();
	const packet = await f.service.inspect(ref, who);
	assert.equal(packet.history.wells[0].observationCount, 4);
	assert.ok(!("observations" in packet.history.wells[0]));
	assert.equal(packet.forecasts[0].forecastPointCount, 4);
	assert.ok(!("forecastTimes" in packet.forecasts[0]));
	assert.equal(packet.basis.limitationCount, 1);
	const detail = await f.service.readSource(f.current.historySourceRef, who, 0, 32000);
	assert.deepEqual(JSON.parse(detail.text), f.history);
});
