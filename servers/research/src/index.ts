#!/usr/bin/env node

/**
 * Research MCP Server
 * Scientius Researchicus - Master Intelligence Gatherer
 *
 * Tools: conduct_market_research, analyze_competition
 * Domain logic lives in src/tools/market-research.ts and src/tools/competitive-analysis.ts.
 */

import fs from "node:fs/promises";
import { type MCPServer, normalizeIdentifier, runMCPServer, ServerFactory, type ServerTemplate } from "@shaleyeah/sdk";
import { z } from "zod";
import { performCompetitiveAnalysis } from "./tools/competitive-analysis.js";
import { performMarketResearch } from "./tools/market-research.js";

// Re-export test helpers so existing tests can import from src/index.js
export { deriveDefaultCompetitorEntry } from "./tools/competitive-analysis.js";
export { deriveDefaultResearchSummary, synthesizeResearchWithLLM } from "./tools/market-research.js";

const researchTemplate: ServerTemplate = {
	name: "research",
	description: "Market Intelligence & Research MCP Server",
	persona: {
		name: "Scientius Researchicus",
		role: "Master Intelligence Gatherer",
		expertise: [
			"Web research and data collection",
			"Competitive intelligence analysis",
			"Market trend identification",
			"Technology scouting and assessment",
			"Industry report synthesis",
		],
	},
	directories: ["research", "competitive", "markets", "technology", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"conduct_market_research",
			"Conduct comprehensive market research on oil & gas topics",
			z.object({
				topic: z.string().describe("Research topic or question"),
				scope: z.enum(["local", "regional", "national", "global"]).default("regional"),
				timeframe: z.enum(["current", "historical", "forecast"]).default("current"),
				sources: z.array(z.string()).optional().describe("Preferred data sources"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const research = await performMarketResearch(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(research, null, 2));
				}

				return research;
			},
		),
		ServerFactory.createAnalysisTool(
			"analyze_competition",
			"Analyze competitive landscape and activities",
			z.object({
				region: z.string().describe("Geographic region of interest"),
				competitors: z.array(z.string()).optional().describe("Specific competitors to analyze"),
				analysisType: z.enum(["activities", "strategy", "performance", "comprehensive"]).default("comprehensive"),
				timeframe: z.string().default("last 12 months"),
				outputPath: z.string().optional(),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawRegion = args.region;
				const normalizedRegion = normalizeIdentifier(rawRegion);
				const matchInfo = normalizedRegion !== rawRegion ? { matchedAs: normalizedRegion, matchScore: 1.0 } : {};
				const analysis = await performCompetitiveAnalysis({ ...args, region: normalizedRegion });

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return { ...analysis, ...matchInfo };
			},
		),
	],
};

// Create the server using factory
export const ResearchServer = ServerFactory.createServer(researchTemplate);
export default ResearchServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (ResearchServer as unknown as new () => MCPServer)();
	runMCPServer(server);
}
