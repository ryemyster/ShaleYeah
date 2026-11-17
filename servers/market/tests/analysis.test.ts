import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeMarketConditions, synthesizeCompetitorAnalysisWithLLM } from "../src/analysis.js";
import { createEiaPriceClient } from "../src/prices.js";
import { bundle, competitorQuery, eiaRow, NOW, narrative } from "./fixtures/evidence.js";

const clock = () => new Date(NOW);
const readSources = async () => structuredClone(bundle);
const priceSource = () =>
	createEiaPriceClient({
		clock,
		apiKey: () => "fixture-key",
		fetch: async (input) => new Response(JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD"))),
	}).fetch;
const query = { commodity: "both" as const, region: "Permian", timeframe: "current" as const };

test("availability distinguishes partial facts, assumption-only data and metrics that were not requested", async () => {
	const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock,
		readSources,
		llm: async () => narrative(),
	});
	assert.equal(result[0].status, "partial");
	assert.equal(result[1].status, "assumption-only");
	const subset = await synthesizeCompetitorAnalysisWithLLM(
		{ ...competitorQuery, metrics: ["production"] },
		{ clock, readSources, llm: async () => narrative("Acme", ["obs.acme.production"]) },
	);
	assert.equal(subset[0].status, "available");
	assert.equal(subset[0].metrics.costs.reason, "not_requested");
});

test("a failed price-provider callback preserves permitted host observations and hides private details", async () => {
	const record = {
		...bundle.records[0],
		id: "obs.wti",
		subject: { kind: "commodity", name: "WTI" },
		metric: "price",
		unit: "USD/bbl",
	};
	let result: Awaited<ReturnType<typeof analyzeMarketConditions>> | undefined;
	try {
		result = await analyzeMarketConditions(
			{ ...query, commodity: "oil" },
			{
				clock,
				readSources: async () => ({ ...bundle, records: [record] }),
				prices: async () => {
					throw new Error("fixture-private-provider-detail");
				},
				llm: async () =>
					JSON.stringify({
						summary: "A supplied zero benchmark observation",
						evidenceIds: ["obs.wti"],
						limitations: [],
					}),
			},
		);
	} catch {
		/* The assertion below requires a safe source result, not a raw provider exception. */
	}
	assert.equal(result?.current.oil?.price, 0);
	assert.ok(!JSON.stringify(result).includes("fixture-private-provider-detail"));
});

test("eligible actual price data reaches the configured interpreter with source identity and no credential", async () => {
	let called = false;
	const result = await analyzeMarketConditions(query, {
		clock,
		prices: priceSource(),
		llm: async ({ prompt }) => {
			called = true;
			assert.ok(prompt.includes("eia.PET.RWTC.D"));
			assert.ok(prompt.includes("2026-11-12"));
			assert.ok(!prompt.includes("fixture-key"));
			return JSON.stringify({
				summary: "These are two dated benchmark observations, not a regional forecast.",
				evidenceIds: ["eia.PET.RWTC.D", "eia.NG.RNGWHHD.D"],
				limitations: ["Unreviewed interpretation"],
			});
		},
	});
	assert.ok(called);
	assert.equal(result.current.oil?.price, 82.5);
	assert.equal(result.current.gas?.price, 3.75);
	assert.equal(result.current.oil?.observation.observedAt, "2026-11-12");
	assert.equal(result.interpretation.status, "available");
	assert.equal(result.interpretation.reviewStatus, "unreviewed");
	assert.equal(result.commercialAuthority, false);
	assert.ok(!("confidence" in result));
	assert.ok(!("forecast" in result));
});

test("missing sources defer interpretation without a model request", async () => {
	let calls = 0;
	const prices = createEiaPriceClient({ clock, apiKey: () => undefined }).fetch;
	const result = await analyzeMarketConditions(query, {
		clock,
		prices,
		llm: async () => {
			calls++;
			throw new Error("must not call");
		},
	});
	assert.equal(result.status, "unavailable");
	assert.equal(result.current.oil?.price, null);
	assert.equal(result.interpretation.status, "unavailable");
	assert.equal(calls, 0);
});

test("host observations work without EIA access and assumptions never become observed current prices", async () => {
	const oil = {
		...structuredClone(bundle.records[0]),
		id: "obs.wti",
		subject: { kind: "commodity", name: "WTI" },
		metric: "price",
		value: 0,
		unit: "USD/bbl",
	};
	const gas = {
		...structuredClone(bundle.records[2]),
		id: "scenario.hh",
		subject: { kind: "commodity", name: "HenryHub" },
		metric: "price",
		value: 4,
		unit: "USD/MMBtu",
	};
	const result = await analyzeMarketConditions(query, {
		clock,
		readSources: async () => ({ ...bundle, records: [oil, gas] }),
		prices: createEiaPriceClient({ clock, apiKey: () => undefined }).fetch,
		llm: async () =>
			JSON.stringify({
				summary: "One actual observation and one explicit scenario assumption.",
				evidenceIds: ["obs.wti", "scenario.hh"],
				limitations: [],
			}),
	});
	assert.equal(result.current.oil?.price, 0);
	assert.equal(result.current.gas?.price, null);
	assert.equal(result.current.gas?.assumptions[0].value, 4);
	assert.equal(result.current.gas?.assumptions[0].status, "assumed");
	assert.equal(result.current.gas?.assumptions[0].observedAt, null);
});

test("malformed, invented or unsupported model output leaves the canonical source values intact", async () => {
	for (const response of [
		"not json",
		"```json\n{}\n```",
		JSON.stringify({ summary: "Forecast", volatility: 0.18, evidenceIds: ["eia.PET.RWTC.D"], limitations: [] }),
		JSON.stringify({ summary: "Unknown source", evidenceIds: ["source.forged"], limitations: [] }),
	]) {
		const result = await analyzeMarketConditions(query, { clock, prices: priceSource(), llm: async () => response });
		assert.equal(result.current.oil?.price, 82.5);
		assert.equal(result.interpretation.status, "unavailable");
	}
	const failed = await analyzeMarketConditions(query, {
		clock,
		prices: priceSource(),
		llm: async () => {
			throw new Error("private-provider-detail");
		},
	});
	assert.equal(failed.current.gas?.price, 3.75);
	assert.ok(!JSON.stringify(failed).includes("private-provider-detail"));
});

test("new/stale source data after asynchronous interpretation cannot retain a prior narrative", async () => {
	let now = new Date(NOW);
	const source = createEiaPriceClient({
		clock: () => new Date(now),
		apiKey: () => "fixture-key",
		fetch: async (input) => new Response(JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD"))),
	});
	const result = await analyzeMarketConditions(query, {
		clock: () => new Date(now),
		prices: source.fetch,
		llm: async () => {
			now = new Date("2026-12-01T00:00:00.000Z");
			return JSON.stringify({ summary: "This is no longer current", evidenceIds: ["eia.PET.RWTC.D"], limitations: [] });
		},
	});
	assert.equal(result.current.oil?.price, null);
	assert.equal(result.current.oil?.observation.status, "stale");
	assert.equal(result.interpretation.status, "unavailable");
});

test("unknown company/market, stale facts, ambiguous facts and malformed host configuration stay unavailable", async () => {
	for (const sources of [
		{ ...bundle, records: bundle.records.map((x) => ({ ...x, subject: { ...x.subject, market: "Appalachia" } })) },
		{ ...bundle, records: bundle.records.slice(0, 2).map((x) => ({ ...x, observedAt: "2000-01-01" })) },
		{
			...bundle,
			records: [{ ...bundle.records[0] }, { ...bundle.records[0], id: "obs.acme.other-production", value: 999 }],
		},
		{ bad: "invalid" },
	]) {
		const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
			clock,
			readSources: async () => sources,
			llm: async () => narrative(),
		});
		assert.equal(result[0].production, null);
		assert.equal(result[0].interpretation.status, "unavailable");
	}
});

test("provider failures preserve facts and do not synthesize strategy, strengths or numeric confidence", async () => {
	const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
		clock,
		readSources,
		llm: async () => {
			throw new Error("private-provider-error");
		},
	});
	assert.equal(result[0].production, 0);
	assert.equal(result[0].avgCosts, 12.25);
	assert.equal(result[0].interpretation.status, "unavailable");
	assert.ok(!("strategy" in result[0]));
	assert.ok(!("strengths" in result[0]));
	assert.ok(!("confidence" in result[0]));
	assert.ok(!JSON.stringify(result).includes("private-provider-error"));
});

test("duplicate/foreign model narratives and oversized responses cannot attach to a company's facts", async () => {
	for (const response of [
		narrative("Unknown"),
		JSON.stringify({
			narratives: [
				{ name: "Acme", summary: "A", evidenceIds: ["obs.acme.production"] },
				{ name: "Acme", summary: "B", evidenceIds: ["obs.acme.production"] },
			],
			limitations: [],
		}),
		"x".repeat(65000),
	]) {
		const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
			clock,
			readSources,
			llm: async () => response,
		});
		assert.equal(result[0].production, 0);
		assert.equal(result[0].interpretation.status, "unavailable");
	}
});

test("advisory interpretation stays unavailable without an explicitly configured model runtime", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	delete process.env.ANTHROPIC_API_KEY;
	try {
		const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, { clock, readSources });
		assert.equal(result[0].production, 0);
		assert.equal(result[0].interpretation.status, "unavailable");
	} finally {
		if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
	}
});

test("configured credentials in source or model text cannot enter returned material", async () => {
	const saved = process.env.ANTHROPIC_API_KEY;
	const secret = "fixture-guard-credential";
	process.env.ANTHROPIC_API_KEY = secret;
	try {
		const unsafe = structuredClone(bundle);
		unsafe.records[0].source!.id = secret;
		let called = false;
		const denied = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
			clock,
			readSources: async () => unsafe,
			llm: async () => {
				called = true;
				return narrative();
			},
		});
		assert.equal(denied[0].production, null);
		assert.equal(called, false);
		assert.ok(!JSON.stringify(denied).includes(secret));
		const echoed = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
			clock,
			readSources,
			llm: async () =>
				JSON.stringify({
					narratives: [{ name: "Acme", summary: secret, evidenceIds: ["obs.acme.production"] }],
					limitations: [],
				}),
		});
		assert.equal(echoed[0].production, 0);
		assert.equal(echoed[0].interpretation.status, "unavailable");
		assert.ok(!JSON.stringify(echoed).includes(secret));
	} finally {
		if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = saved;
	}
});
