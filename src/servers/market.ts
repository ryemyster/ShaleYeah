#!/usr/bin/env node

/**
 * Market MCP Server - DRY Refactored
 * Mercatus Analyticus - Master Market Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// EIA API client — exported for testing
// ---------------------------------------------------------------------------

export interface EiaPrices {
	oilPrice: number; // WTI $/bbl
	gasPrice: number; // Henry Hub $/MMBtu
	dataSource: "eia" | "stub";
	fetchedAt: Date;
}

// Stub fallback constants — documented mid-cycle values
const STUB_OIL_PRICE = 75.0;
const STUB_GAS_PRICE = 3.5;

const EIA_BASE = "https://api.eia.gov/v2";
const WTI_SERIES = "RWTC";
const HH_SERIES = "RNGWHHD";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedPrices: EiaPrices | null = null;

/** Clear the in-memory price cache — used in tests and for manual refresh. */
export function clearEiaCache(): void {
	cachedPrices = null;
}

async function fetchSeriesPrice(apiKey: string, seriesId: string, endpoint: string): Promise<number> {
	const url =
		`${EIA_BASE}/${endpoint}/data/` +
		`?frequency=daily&data[0]=value&series_id=${seriesId}` +
		`&sort[0][column]=period&sort[0][direction]=desc&length=1` +
		`&api_key=${apiKey}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`EIA ${seriesId}: HTTP ${res.status}`);
	const json = (await res.json()) as { response: { data: Array<{ value: string }> } };
	const raw = json?.response?.data?.[0]?.value;
	const price = Number(raw);
	if (!Number.isFinite(price) || price <= 0) throw new Error(`EIA ${seriesId}: invalid price value "${raw}"`);
	return price;
}

/**
 * Fetch WTI and Henry Hub spot prices from the EIA API.
 * Falls back to stub constants if EIA_API_KEY is absent or the request fails.
 * Results are cached for 1 hour.
 */
export async function fetchEiaPrices(): Promise<EiaPrices> {
	// Return cache if fresh
	if (cachedPrices && Date.now() - cachedPrices.fetchedAt.getTime() < CACHE_TTL_MS) {
		return cachedPrices;
	}

	const apiKey = process.env.EIA_API_KEY;
	if (!apiKey) {
		return { oilPrice: STUB_OIL_PRICE, gasPrice: STUB_GAS_PRICE, dataSource: "stub", fetchedAt: new Date() };
	}

	try {
		const [oilPrice, gasPrice] = await Promise.all([
			fetchSeriesPrice(apiKey, WTI_SERIES, "petroleum/pri/spt"),
			fetchSeriesPrice(apiKey, HH_SERIES, "natural-gas/pri/fut"),
		]);
		cachedPrices = { oilPrice, gasPrice, dataSource: "eia", fetchedAt: new Date() };
		return cachedPrices;
	} catch {
		return { oilPrice: STUB_OIL_PRICE, gasPrice: STUB_GAS_PRICE, dataSource: "stub", fetchedAt: new Date() };
	}
}

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

export interface MarketInterpretation {
	trend: string;
	volatility: number;
	outlook: string;
	competitiveActivity: string;
}

/**
 * Rule-based market interpretation — fallback when the API is unavailable.
 * Uses actual prices passed in so output varies with input (not hardcoded).
 */
export function deriveDefaultMarketInterpretation(oilPrice: number, gasPrice: number): MarketInterpretation {
	// Trend based on price relative to mid-cycle benchmarks ($70 oil, $3 gas)
	const trend = oilPrice > 80 ? "bullish" : oilPrice < 65 ? "bearish" : "neutral";
	// Volatility estimate: higher prices correlate with higher uncertainty
	const volatility = oilPrice > 80 ? 0.22 : oilPrice < 65 ? 0.28 : 0.18;

	return {
		trend,
		volatility,
		outlook: `Oil at $${oilPrice.toFixed(2)}/bbl and gas at $${gasPrice.toFixed(2)}/MMBtu suggest ${trend} near-term conditions.`,
		competitiveActivity: trend === "bullish" ? "Elevated — high prices attracting new entrants" : "Moderate",
	};
}

/**
 * Ask Claude (Mercatus Analyticus) to interpret the current price environment
 * and provide a 12-month outlook. Falls back to deriveDefaultMarketInterpretation()
 * if the API is unavailable.
 */
export async function synthesizeMarketAnalysisWithLLM(params: {
	oilPrice: number;
	gasPrice: number;
	commodity: string;
	region: string;
	timeframe: string;
}): Promise<MarketInterpretation> {
	const { oilPrice, gasPrice, commodity, region, timeframe } = params;

	const prompt = `You are Mercatus Analyticus, a master oil & gas market strategist.

Interpret the current commodity price environment and return a JSON object.

MARKET DATA:
WTI Oil Price: $${oilPrice.toFixed(2)}/bbl
Henry Hub Gas Price: $${gasPrice.toFixed(2)}/MMBtu
Commodity focus: ${commodity}
Region: ${region}
Timeframe: ${timeframe}

Return ONLY valid JSON in this exact shape:
{
  "trend": "bullish" | "bearish" | "neutral",
  "volatility": <number between 0.05 and 0.50>,
  "outlook": "<one sentence 12-month price outlook>",
  "competitiveActivity": "<one sentence on competitor activity given these prices>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<MarketInterpretation>;
		const validTrends = ["bullish", "bearish", "neutral"];
		if (!validTrends.includes(parsed.trend ?? "")) throw new Error("Invalid trend");
		return {
			trend: parsed.trend as string,
			volatility: typeof parsed.volatility === "number" ? parsed.volatility : 0.18,
			outlook: parsed.outlook ?? "",
			competitiveActivity: parsed.competitiveActivity ?? "",
		};
	} catch (_err) {
		return deriveDefaultMarketInterpretation(oilPrice, gasPrice);
	}
}

const marketTemplate: ServerTemplate = {
	name: "market",
	description: "Market Analysis MCP Server",
	persona: {
		name: "Mercatus Analyticus",
		role: "Master Market Strategist",
		expertise: [
			"Commodity price analysis and forecasting",
			"Supply and demand modeling",
			"Market trend identification",
			"Competitive landscape assessment",
			"Economic cycle analysis",
		],
	},
	directories: ["prices", "forecasts", "trends", "competitors", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"analyze_market_conditions",
			"Analyze current market conditions and trends",
			z.object({
				commodity: z.enum(["oil", "gas", "both"]),
				region: z.string(),
				timeframe: z.enum(["current", "1year", "5year", "10year"]).default("1year"),
				factors: z.array(z.string()).optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const prices = await fetchEiaPrices();

				// Ask Claude to interpret the live EIA price environment.
				// Falls back to rule-based interpretation if API is unavailable.
				const interpretation = await synthesizeMarketAnalysisWithLLM({
					oilPrice: prices.oilPrice,
					gasPrice: prices.gasPrice,
					commodity: args.commodity,
					region: args.region,
					timeframe: args.timeframe,
				});

				const analysis = {
					market: {
						commodity: args.commodity,
						region: args.region,
						timeframe: args.timeframe,
						analysisDate: new Date().toISOString(),
						dataSource: prices.dataSource,
					},
					current: {
						oil:
							args.commodity !== "gas"
								? {
										price: prices.oilPrice,
										trend: interpretation.trend,
										volatility: interpretation.volatility,
									}
								: undefined,
						gas:
							args.commodity !== "oil"
								? {
										price: prices.gasPrice,
										trend: interpretation.trend,
										volatility: interpretation.volatility,
									}
								: undefined,
					},
					outlook: interpretation.outlook,
					competitiveActivity: interpretation.competitiveActivity,
					forecast: {
						shortTerm: "6-month outlook remains volatile due to geopolitical factors",
						mediumTerm: "1-2 year fundamentals support current pricing levels",
						longTerm: "Energy transition creates structural changes in demand",
					},
					risks: {
						supply: ["Geopolitical disruptions", "Production cuts", "Infrastructure constraints"],
						demand: ["Economic slowdown", "Seasonal variations", "Alternative energy adoption"],
						regulatory: ["Environmental policies", "Carbon pricing", "Trade restrictions"],
					},
					opportunities: ["Regional price differentials", "Seasonal demand patterns", "Infrastructure development"],
					confidence: ServerUtils.calculateConfidence(0.75, 0.8),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"competitive_analysis",
			"Analyze competitive landscape and positioning",
			z.object({
				competitors: z.array(z.string()),
				market: z.string(),
				metrics: z.array(z.string()).default(["market_share", "production", "costs"]),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = {
					market: args.market,
					// Stub: representative competitor profile — replace with real operator database
					competitors: args.competitors.map((comp: string) => ({
						name: comp,
						marketShare: 15.0, // stub: 15% — replace with production data lookup
						production: 25000, // stub: 25,000 BOE/d — replace with operator data
						avgCosts: 22.5, // stub: $22.50/BOE — replace with public filing data
						strategy: "optimization", // stub — replace with operator activity analysis
						strengths: "operational efficiency", // stub — replace with operator analysis
					})),
					landscape: {
						concentration: "Moderately concentrated",
						barriers: ["Capital requirements", "Technical expertise", "Regulatory compliance"],
						trends: ["Digital transformation", "ESG focus", "Operational efficiency"],
					},
					positioning: {
						recommendation: "Focus on operational excellence and strategic partnerships",
						opportunities: ["Technology adoption", "Vertical integration", "Geographic expansion"],
					},
					confidence: ServerUtils.calculateConfidence(0.82, 0.75),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
	],
};

export const MarketServer = ServerFactory.createServer(marketTemplate);
export default MarketServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new MarketServer();
	runMCPServer(server);
}
