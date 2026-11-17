#!/usr/bin/env node
import { constants } from "node:fs";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
	type MCPServer,
	ModelProviderError,
	normalizeIdentifier,
	runMCPServer,
	ServerFactory,
	type ServerRuntimeOptions,
	type ServerTemplate,
} from "@shaleyeah/sdk";
import { z } from "zod";
import {
	analyzeMarketConditions,
	competitorQuerySchema,
	type MarketAnalysisOptions,
	marketQuerySchema,
	synthesizeCompetitorAnalysisWithLLM,
} from "./analysis.js";
import { loadMarketBinding } from "./configuration.js";
import { type MarketEmployeeOptions, marketEmployeeTools } from "./employee-tools.js";

export type { CompetitorProfile, MarketAnalysisOptions, MarketInterpretation } from "./analysis.js";
export {
	analyzeMarketConditions,
	synthesizeCompetitorAnalysisWithLLM,
	synthesizeMarketAnalysisWithLLM,
} from "./analysis.js";
export { loadMarketBinding } from "./configuration.js";
export type { MarketEmployeeOptions } from "./employee-tools.js";
export { marketEmployeeTools } from "./employee-tools.js";
export { buildMarketScenario } from "./market-scenario.js";
export { MarketScenarioService, MarketServiceError } from "./market-service.js";
export type { EiaPriceOptions, EiaPrices } from "./prices.js";
export { clearEiaCache, createEiaPriceClient, fetchEiaPrices } from "./prices.js";
export { MarketReviewWorkflow } from "./review-workflow.js";
export type { MarketSnapshotHookOptions } from "./source-hooks.js";
export { createMarketSnapshotHook } from "./source-hooks.js";

/** Host-only source/provider injection. MCP arguments contain queries, never source or approval assertions. */
export type MarketServerOptions = MarketAnalysisOptions & MarketEmployeeOptions & ServerRuntimeOptions;
export function createMarketTemplate(options: MarketServerOptions = {}): ServerTemplate {
	function advisoryOptions(principal?: { customerId: string; employeeId: string }): MarketAnalysisOptions {
		const runtime = options.modelRuntime;
		if (runtime) {
			const owner = runtime.publicProfile().owner;
			if (!principal || principal.customerId !== owner.customerId || principal.employeeId !== owner.employeeId)
				throw new ModelProviderError("owner");
		}
		return { ...options, modelRuntime: runtime?.fork?.() ?? runtime };
	}
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
			...marketEmployeeTools(options),
			ServerFactory.createAnalysisTool(
				"analyze_market_conditions",
				"Read dated benchmark observations, explicit assumptions and unreviewed advisory interpretation; missing evidence stays unavailable.",
				marketInput,
				async (input: unknown, context) => {
					const args = marketInput.parse(input),
						region = normalizeIdentifier(args.region);
					const analysis = await analyzeMarketConditions(
						{ commodity: args.commodity, region, timeframe: args.timeframe },
						advisoryOptions(context?.principal ?? options.localPrincipal),
					);
					await exportReport(args.outputPath, analysis);
					return { ...analysis, ...(region !== args.region ? { matchedAs: region, matchScore: 1 } : {}) };
				},
			),
			ServerFactory.createAnalysisTool(
				"competitive_analysis",
				"Return permitted host-source company metrics and explicit reviewed assumptions. Names and model output cannot supply factual metrics or commercial authority.",
				competitorInput,
				async (input: unknown, context) => {
					const args = competitorInput.parse(input),
						market = normalizeIdentifier(args.market);
					const competitors = await synthesizeCompetitorAnalysisWithLLM(
						{ competitors: args.competitors, market, metrics: args.metrics },
						advisoryOptions(context?.principal ?? options.localPrincipal),
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
export const MarketServer = function (options: MarketServerOptions = {}) {
	if (!new.target) throw new Error("Market Server requires constructor invocation");
	const server = new (ServerFactory.createServer(createMarketTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: MarketServerOptions): MCPServer };
export default MarketServer;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.MARKET_CONFIG_FILE;
		runMCPServer(new MarketServer(file ? await loadMarketBinding(file) : {}));
	} catch {
		console.error("Market startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
