import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearEiaCache, fetchEiaPrices, synthesizeCompetitorAnalysisWithLLM } from "../src/index.js";
import { bundle, competitorQuery, eiaRow, NOW, narrative } from "./fixtures/evidence.js";

const savedFetch = globalThis.fetch;
const savedKey = process.env.EIA_API_KEY;
const savedModelKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
	clearEiaCache();
	delete process.env.EIA_API_KEY;
	delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
	globalThis.fetch = savedFetch;
	if (savedKey === undefined) delete process.env.EIA_API_KEY;
	else process.env.EIA_API_KEY = savedKey;
	if (savedModelKey === undefined) delete process.env.ANTHROPIC_API_KEY;
	else process.env.ANTHROPIC_API_KEY = savedModelKey;
	clearEiaCache();
});

test("missing EIA access never produces a current price or an observation date", async () => {
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		throw new Error("must not fetch");
	};
	const prices = await fetchEiaPrices();
	assert.equal(prices.oilPrice, null);
	assert.equal(prices.gasPrice, null);
	assert.equal(prices.dataSource, "unavailable");
	assert.equal(prices.oil.observedAt, null);
	assert.equal(prices.oil.reason, "access_not_configured");
	assert.equal(calls, 0);
});

test("EIA transport failures cannot become mid-cycle price observations or expose credentials", async () => {
	process.env.EIA_API_KEY = "fixture-secret-never-output";
	globalThis.fetch = async () => {
		throw new Error("fixture-secret-never-output");
	};
	const prices = await fetchEiaPrices();
	assert.equal(prices.oilPrice, null);
	assert.equal(prices.gasPrice, null);
	assert.ok(!JSON.stringify(prices).includes(process.env.EIA_API_KEY));
});

test("a new retrieval cannot renew a stale EIA observation", async () => {
	process.env.EIA_API_KEY = "fixture-key";
	globalThis.fetch = async (input) =>
		new Response(JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD", "82.50", "2000-01-01")));
	const prices = await fetchEiaPrices();
	assert.equal(prices.oilPrice, null);
	assert.equal(prices.oil.value, 82.5);
	assert.equal(prices.oil.observedAt, "2000-01-01");
	assert.equal(prices.oil.status, "stale");
});

test("one failed benchmark does not fabricate or discard the other observed benchmark", async () => {
	process.env.EIA_API_KEY = "fixture-key";
	const today = new Date().toISOString().slice(0, 10);
	globalThis.fetch = async (input) =>
		String(input).includes("RWTC")
			? new Response(JSON.stringify(eiaRow("RWTC", "0", today)))
			: new Response("Unavailable", { status: 503 });
	const prices = await fetchEiaPrices();
	assert.equal(prices.oilPrice, 0);
	assert.equal(prices.gasPrice, null);
	assert.equal(prices.oil.observedAt, today);
	assert.equal(prices.dataSource, "partial");
});

test("names alone produce no company production, costs or market share", async () => {
	const profiles = await synthesizeCompetitorAnalysisWithLLM({
		...competitorQuery,
		competitors: ["A", "A Very Long Corporate Name"],
	});
	for (const profile of profiles) {
		assert.equal(profile.production, null);
		assert.equal(profile.avgCosts, null);
		assert.equal(profile.marketShare, null);
		assert.equal(profile.interpretation.status, "unavailable");
		assert.equal(profile.commercialAuthority, false);
	}
});

test("host source facts survive while reviewed scenario values remain assumptions", async () => {
	let calls = 0;
	const profiles = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock: () => new Date(NOW),
		readSources: async () => structuredClone(bundle),
		llm: async () => {
			calls++;
			return narrative();
		},
	});
	assert.equal(profiles[0].production, 0);
	assert.equal(profiles[0].avgCosts, 12.25);
	assert.equal(profiles[0].marketShare, null);
	assert.equal(profiles[0].metrics.production.observedAt, "2026-11-12");
	assert.equal(profiles[0].metrics.production.source.id, "source.acme.report");
	assert.equal(profiles[0].interpretation.basis, "model-interpretation");
	assert.equal(profiles[0].interpretation.reviewStatus, "unreviewed");
	assert.equal(profiles[1].production, null);
	assert.equal(profiles[1].metrics.production.value, 500);
	assert.equal(profiles[1].metrics.production.status, "assumed");
	assert.equal(profiles[1].metrics.production.observedAt, null);
	assert.equal(calls, 1);
});

test("invented model metrics never override supplied observations", async () => {
	const profiles = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock: () => new Date(NOW),
		readSources: async () => structuredClone(bundle),
		llm: async () =>
			JSON.stringify({
				narratives: [{ name: "Acme", production: 999999, summary: "Invented", evidenceIds: ["obs.acme.production"] }],
				limitations: [],
			}),
	});
	assert.equal(profiles[0].production, 0);
	assert.equal(profiles[0].interpretation.status, "unavailable");
	assert.equal(profiles[0].metrics.production.source.id, "source.acme.report");
});

test("foreign company evidence and changed source rights cannot authorize returned analysis", async () => {
	const profiles = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock: () => new Date(NOW),
		readSources: async () => structuredClone(bundle),
		llm: async () => narrative("Beta", ["obs.acme.production"]),
	});
	assert.equal(profiles[1].production, null);
	assert.equal(profiles[1].interpretation.status, "unavailable");
	let revoked = false;
	const changed = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock: () => new Date(NOW),
		readSources: async () => ({ ...structuredClone(bundle), rights: revoked ? "denied" : bundle.rights }),
		llm: async () => {
			revoked = true;
			return narrative();
		},
	});
	assert.equal(changed[0].production, null);
	assert.equal(changed[0].interpretation.status, "unavailable");
});
