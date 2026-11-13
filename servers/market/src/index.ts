#!/usr/bin/env node
import { constants } from "node:fs";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { normalizeIdentifier, runMCPServer, ServerFactory, type ServerTemplate } from "@shaleyeah/sdk";
import { z } from "zod";
import {
	analyzeMarketConditions,
	competitorQuerySchema,
	type MarketAnalysisOptions,
	marketQuerySchema,
	synthesizeCompetitorAnalysisWithLLM,
} from "./analysis.js";

export type { CompetitorProfile, MarketAnalysisOptions, MarketInterpretation } from "./analysis.js";
export {
	analyzeMarketConditions,
	synthesizeCompetitorAnalysisWithLLM,
	synthesizeMarketAnalysisWithLLM,
} from "./analysis.js";
export type { EiaPriceOptions, EiaPrices } from "./prices.js";
export { clearEiaCache, createEiaPriceClient, fetchEiaPrices } from "./prices.js";

/** Host-only source/provider injection. MCP arguments contain queries, never source or approval assertions. */
export function createMarketTemplate(options: MarketAnalysisOptions = {}): ServerTemplate {
	const shared = {
		outputPath: z.string().min(1).max(4096).optional(),
		matchThreshold: z.number().min(0).max(1).optional(),
	};
	const marketInput = marketQuerySchema
		.extend({ ...shared, factors: z.array(z.string().max(256)).max(32).optional() })
		.strict();
	const competitorInput = z
		.object({
			competitors: competitorQuerySchema.shape.competitors,
			market: competitorQuerySchema.shape.market,
			metrics: competitorQuerySchema.shape.metrics,
			...shared,
		})
		.strict();
	async function exportReport(outputPath: string | undefined, analysis: unknown) {
		if (outputPath) {
			try {
				const handle = await fs.open(
					outputPath,
					constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
					0o600,
				);
				try {
					await handle.writeFile(JSON.stringify(analysis, null, 2));
					await handle.sync();
				} finally {
					await handle.close();
				}
			} catch {
				throw new Error("Market advisory export unavailable");
			}
		}
	}
	return {
		name: "market",
		description: "Dated market observations and separately labeled advisory interpretation",
		persona: {
			name: "Mercatus Analyticus",
			role: "Market analysis support",
			expertise: ["Dated commodity benchmarks", "Source-backed competitor metrics", "Explicit scenario assumptions"],
		},
		directories: ["prices", "competitors", "reports"],
		tools: [
			ServerFactory.createAnalysisTool(
				"analyze_market_conditions",
				"Read dated benchmark observations, explicit assumptions and unreviewed advisory interpretation; missing evidence stays unavailable.",
				marketInput,
				async (input: unknown) => {
					const args = marketInput.parse(input),
						region = normalizeIdentifier(args.region);
					const analysis = await analyzeMarketConditions(
						{ commodity: args.commodity, region, timeframe: args.timeframe },
						options,
					);
					await exportReport(args.outputPath, analysis);
					return { ...analysis, ...(region !== args.region ? { matchedAs: region, matchScore: 1 } : {}) };
				},
			),
			ServerFactory.createAnalysisTool(
				"competitive_analysis",
				"Return permitted host-source company metrics and explicit reviewed assumptions. Names and model output cannot supply factual metrics or commercial authority.",
				competitorInput,
				async (input: unknown) => {
					const args = competitorInput.parse(input),
						market = normalizeIdentifier(args.market);
					const competitors = await synthesizeCompetitorAnalysisWithLLM(
						{ competitors: args.competitors, market, metrics: args.metrics },
						options,
					);
					const analysis = {
						market,
						competitors,
						reviewStatus: "unreviewed",
						commercialAuthority: false,
						sourceAuthority: "operator-attested",
					};
					await exportReport(args.outputPath, analysis);
					return { ...analysis, ...(market !== args.market ? { matchedAs: market, matchScore: 1 } : {}) };
				},
			),
		],
	};
}
export const MarketServer = ServerFactory.createServer(createMarketTemplate());
export default MarketServer;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runMCPServer(new MarketServer());
