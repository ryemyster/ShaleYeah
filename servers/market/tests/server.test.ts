import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { MarketAnalysisOptions } from "../src/analysis.js";
import { createMarketTemplate } from "../src/index.js";
import { createEiaPriceClient } from "../src/prices.js";
import { bundle, eiaRow, NOW, narrative } from "./fixtures/evidence.js";

const saved = {
	source: process.env.MARKET_SOURCE_FILE,
	eia: process.env.EIA_API_KEY,
	model: process.env.ANTHROPIC_API_KEY,
};
beforeEach(() => {
	delete process.env.MARKET_SOURCE_FILE;
	delete process.env.EIA_API_KEY;
	delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
	for (const [name, value] of [
		["MARKET_SOURCE_FILE", saved.source],
		["EIA_API_KEY", saved.eia],
		["ANTHROPIC_API_KEY", saved.model],
	]) {
		if (value === undefined) delete process.env[name!];
		else process.env[name!] = value;
	}
});
const clock = () => new Date(NOW);
async function invoke(name: string, arguments_: unknown, options: MarketAnalysisOptions = {}) {
	const template = createMarketTemplate(options);
	const tool = template.tools.find((tool) => tool.name === name);
	assert.ok(tool);
	return tool.handler(arguments_);
}

test("the existing public tools return explicit unavailability without fabricated facts or confidence", async () => {
	const result = await invoke("analyze_market_conditions", { commodity: "both", region: "Permian" });
	assert.equal(result.success, true);
	assert.equal(result.analysis.status, "unavailable");
	assert.equal(result.analysis.current.oil.price, null);
	assert.equal(result.analysis.current.gas.price, null);
	assert.equal(result.analysis.commercialAuthority, false);
	assert.equal(result.metadata.confidence, null);
	assert.equal(result.analysis.confidence, undefined);
	const companies = await invoke("competitive_analysis", { competitors: ["Acme"], market: "Permian" });
	assert.equal(companies.analysis.competitors[0].production, null);
	assert.equal(companies.analysis.competitors[0].marketShare, null);
	assert.equal(companies.analysis.competitors[0].avgCosts, null);
});

test("MCP arguments cannot supply source facts, reviewer identities or provider credentials", async () => {
	let reads = 0;
	for (const extra of [
		{ records: bundle.records },
		{ sourceFile: "/private/source.json" },
		{ reviewerId: "forged" },
		{ apiKey: "private-value" },
	]) {
		const result = await invoke(
			"competitive_analysis",
			{ competitors: ["Acme"], market: "Permian", ...extra },
			{
				readSources: async () => {
					reads++;
					return bundle;
				},
			},
		);
		assert.equal(result.success, false);
	}
	assert.equal(reads, 0);
	for (const args of [
		{ competitors: ["Acme", "Acme"], market: "Permian" },
		{ competitors: ["Acme"], market: "Permian", metrics: ["unknown"] },
	]) {
		assert.equal((await invoke("competitive_analysis", args)).success, false);
	}
});

test("real private operator data is used by the default public tool without granting model authority", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-host-"));
	try {
		const file = path.join(root, "sources.json");
		await fs.writeFile(file, JSON.stringify(bundle), { mode: 0o600 });
		process.env.MARKET_SOURCE_FILE = file;
		const result = await invoke(
			"competitive_analysis",
			{ competitors: ["Acme"], market: " Permian ", metrics: ["production", "costs"] },
			{ clock },
		);
		assert.equal(result.success, true);
		assert.equal(result.analysis.competitors[0].production, 0);
		assert.equal(result.analysis.competitors[0].avgCosts, 12.25);
		assert.equal(result.analysis.competitors[0].interpretation.status, "unavailable");
		assert.equal(result.analysis.reviewStatus, "unreviewed");
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("public market output preserves requested commodity, dates and unreviewed interpretation", async () => {
	const prices = createEiaPriceClient({
		clock,
		apiKey: () => "fixture-key",
		fetch: async (input) => new Response(JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD"))),
	}).fetch;
	const result = await invoke(
		"analyze_market_conditions",
		{ commodity: "gas", region: " Permian ", timeframe: "current" },
		{
			clock,
			prices,
			llm: async () =>
				JSON.stringify({ summary: "Dated gas benchmark only", evidenceIds: ["eia.NG.RNGWHHD.D"], limitations: [] }),
		},
	);
	assert.equal(result.success, true);
	assert.equal(result.analysis.current.oil, undefined);
	assert.equal(result.analysis.current.gas.price, 3.75);
	assert.equal(result.analysis.current.gas.observation.observedAt, "2026-11-12");
	assert.equal(result.analysis.interpretation.reviewStatus, "unreviewed");
});

test("explicit advisory exports are new private files and cannot overwrite data or follow links", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-output-"));
	try {
		const target = path.join(root, "report.json");
		const options = { clock, readSources: async () => structuredClone(bundle), llm: async () => narrative() };
		const args = { competitors: ["Acme"], market: "Permian", outputPath: target };
		assert.equal((await invoke("competitive_analysis", args, options)).success, true);
		const handle = await fs.open(target, "r");
		try {
			assert.equal((await handle.stat()).mode & 0o077, 0);
			assert.equal((await invoke("competitive_analysis", args, options)).success, false);
			const link = path.join(root, "link.json");
			await fs.symlink(target, link);
			assert.equal((await invoke("competitive_analysis", { ...args, outputPath: link }, options)).success, false);
			const content = JSON.parse(await handle.readFile("utf8"));
			assert.equal(content.competitors[0].production, 0);
			assert.equal(content.commercialAuthority, false);
		} finally {
			await handle.close();
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("market export failure is a safe failure without an output path in its error", async () => {
	const target = "/directory-that-is-not-present/market.json";
	const result = await invoke("analyze_market_conditions", { commodity: "oil", region: "Permian", outputPath: target });
	assert.equal(result.success, false);
	assert.ok(!JSON.stringify(result).includes(target));
});
