#!/usr/bin/env node
/**
 * Drilling MCP Server — Perforator Maximus, Master Drilling Strategist.
 * Thin facade — all domain logic lives in src/tools/.
 */

import { normalizeIdentifier, runMCPServer, ServerFactory, type ServerTemplate, ServerUtils } from "@shaleyeah/sdk";
import { z } from "zod";
import { deriveWellCostBreakdown, synthesizeWellCostsWithLLM } from "./tools/costs.js";
import { deriveDrillingProgram, synthesizeDrillingProgramWithLLM } from "./tools/program.js";
import { deriveDrillingRiskProfile, synthesizeDrillingRisksWithLLM } from "./tools/risks.js";

// ---------------------------------------------------------------------------
// Backward-compat exports — existing tests import these from ../src/index.js
// ---------------------------------------------------------------------------

export interface DrillingInterpretation {
	programRisk: string;
	keyConsiderations: string[];
	recommendation: string;
}

export function deriveDefaultDrillingInterpretation(
	wellType: string,
	targetDepth: number,
	formation: string,
): DrillingInterpretation {
	return deriveDrillingProgram(wellType as "vertical" | "horizontal" | "directional", targetDepth, formation);
}

export async function synthesizeDrillingAnalysisWithLLM(params: {
	wellType: string;
	targetDepth: number;
	formation: string;
	estimatedDays: number;
	totalCost: number;
}): Promise<DrillingInterpretation> {
	return synthesizeDrillingProgramWithLLM({
		wellType: params.wellType as "vertical" | "horizontal" | "directional",
		targetDepth: params.targetDepth,
		formation: params.formation,
	});
}

export type { WellCostBreakdown } from "./tools/costs.js";
export { deriveWellCostBreakdown, synthesizeWellCostsWithLLM } from "./tools/costs.js";
// Re-export tool types for consumers
export type { DrillingProgram } from "./tools/program.js";
export { deriveDrillingProgram, synthesizeDrillingProgramWithLLM } from "./tools/program.js";
export type { DrillingRiskProfile } from "./tools/risks.js";
export { deriveDrillingRiskProfile, synthesizeDrillingRisksWithLLM } from "./tools/risks.js";

// ---------------------------------------------------------------------------
// Server template
// ---------------------------------------------------------------------------

const wellParamsSchema = z.object({
	targetDepth: z.number(),
	wellType: z.enum(["vertical", "horizontal", "directional"]),
	formation: z.string(),
});

const drillingTemplate: ServerTemplate = {
	name: "drilling",
	description: "Drilling Operations MCP Server",
	persona: {
		name: "Perforator Maximus",
		role: "Master Drilling Strategist",
		expertise: [
			"Drilling program design",
			"Well trajectory optimization",
			"Drilling risk assessment",
			"Cost estimation and budgeting",
			"Technical troubleshooting",
		],
	},
	directories: ["programs", "trajectories", "costs", "operations", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"design_drilling_program",
			"Design comprehensive drilling program with casing schedule and mud program",
			z.object({
				wellParameters: wellParamsSchema,
				constraints: z
					.object({
						budget: z.number().optional(),
						timeline: z.string().optional(),
					})
					.optional(),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawFormation = args.wellParameters.formation;
				const normalizedFormation = normalizeIdentifier(rawFormation);
				const matchInfo =
					normalizedFormation !== rawFormation ? { matchedAs: normalizedFormation, matchScore: 1.0 } : {};
				const result = await synthesizeDrillingProgramWithLLM({
					wellType: args.wellParameters.wellType,
					targetDepth: args.wellParameters.targetDepth,
					formation: normalizedFormation,
					budget: args.constraints?.budget,
					timeline: args.constraints?.timeline,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.82, 0.88) };
			},
		),

		ServerFactory.createAnalysisTool(
			"estimate_well_costs",
			"Estimate drilling, completion, and facilities cost breakdown for a well",
			z.object({
				wellParameters: wellParamsSchema,
				location: z.string().optional(),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawFormation = args.wellParameters.formation;
				const normalizedFormation = normalizeIdentifier(rawFormation);
				const matchInfo =
					normalizedFormation !== rawFormation ? { matchedAs: normalizedFormation, matchScore: 1.0 } : {};
				const result = await synthesizeWellCostsWithLLM({
					wellType: args.wellParameters.wellType,
					targetDepth: args.wellParameters.targetDepth,
					formation: normalizedFormation,
					location: args.location ?? "unspecified",
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.8, 0.85) };
			},
		),

		ServerFactory.createAnalysisTool(
			"assess_drilling_risks",
			"Assess geological, operational, and environmental drilling risks with mitigations",
			z.object({
				wellParameters: wellParamsSchema,
				environmentalConstraints: z.array(z.string()).optional(),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawFormation = args.wellParameters.formation;
				const normalizedFormation = normalizeIdentifier(rawFormation);
				const matchInfo =
					normalizedFormation !== rawFormation ? { matchedAs: normalizedFormation, matchScore: 1.0 } : {};
				const result = await synthesizeDrillingRisksWithLLM({
					wellType: args.wellParameters.wellType,
					targetDepth: args.wellParameters.targetDepth,
					formation: normalizedFormation,
					environmentalConstraints: args.environmentalConstraints ?? [],
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.8, 0.88) };
			},
		),
	],
};

export const DrillingServer = ServerFactory.createServer(drillingTemplate);
export default DrillingServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new DrillingServer();
	runMCPServer(server);
}
