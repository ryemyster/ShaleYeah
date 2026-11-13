#!/usr/bin/env node

/**
 * Infrastructure MCP Server
 * Structura Ingenious — Master Infrastructure Architect
 *
 * Four focused tools replacing the original monolithic plan_infrastructure:
 *   plan_pipeline     — gathering/transmission routing, capacity, takeaway risk
 *   size_facilities   — batteries, separators, compressors, SWD wells
 *   estimate_costs    — pipeline + facility + compression + SWD CAPEX
 *   assess_compliance — permits, approval timeline, environmental risk
 */

import {
	callLLM,
	normalizeIdentifier,
	runMCPServer,
	ServerFactory,
	type ServerTemplate,
	ServerUtils,
} from "@shaleyeah/sdk";
import { z } from "zod";
import {
	type ComplianceAssessment,
	deriveComplianceAssessment,
	synthesizeComplianceAssessmentWithLLM,
} from "./tools/compliance.js";
import {
	deriveInfrastructureCostEstimate,
	type InfrastructureCostEstimate,
	synthesizeCostEstimateWithLLM,
} from "./tools/cost-estimation.js";
import { deriveFacilitySizing, type FacilitySizing, synthesizeFacilitySizingWithLLM } from "./tools/facilities.js";
import { derivePipelinePlan, type PipelinePlan, synthesizePipelinePlanWithLLM } from "./tools/pipeline.js";

export type { ComplianceAssessment, FacilitySizing, InfrastructureCostEstimate, PipelinePlan };
export {
	deriveComplianceAssessment,
	deriveFacilitySizing,
	deriveInfrastructureCostEstimate,
	derivePipelinePlan,
	synthesizeComplianceAssessmentWithLLM,
	synthesizeCostEstimateWithLLM,
	synthesizeFacilitySizingWithLLM,
	synthesizePipelinePlanWithLLM,
};

// Backward-compatibility shim — existing tests import this interface and helper.
export interface InfrastructureInterpretation {
	takeawayRisk: string;
	keyConstraints: string[];
	recommendation: string;
}

export function deriveDefaultInfrastructureInterpretation(
	wellCount: number,
	expectedProduction: number,
	location: string,
): InfrastructureInterpretation {
	const plan = derivePipelinePlan(wellCount, expectedProduction, location);
	return {
		takeawayRisk: plan.takeawayRisk,
		keyConstraints: [
			`${wellCount} wells require ${plan.gatheringMiles} miles of gathering line`,
			wellCount > 20 || expectedProduction > 10000
				? "Large project — phased infrastructure buildout recommended"
				: "Single-phase buildout feasible",
			plan.takeawayRisk === "High"
				? "Remote location — midstream access may require new pipeline"
				: "Existing midstream infrastructure accessible",
		],
		recommendation: plan.recommendation,
	};
}

export async function synthesizeInfrastructureAnalysisWithLLM(params: {
	wellCount: number;
	expectedProduction: number;
	location: string;
	totalCost: number;
}): Promise<InfrastructureInterpretation> {
	const { wellCount, expectedProduction, location } = params;
	try {
		const plan = await synthesizePipelinePlanWithLLM({ wellCount, expectedProduction, location });
		return {
			takeawayRisk: plan.takeawayRisk,
			keyConstraints: [plan.recommendation],
			recommendation: plan.recommendation,
		};
	} catch {
		return deriveDefaultInfrastructureInterpretation(wellCount, expectedProduction, location);
	}
}

const infrastructureTemplate: ServerTemplate = {
	name: "infrastructure",
	description: "Infrastructure Planning MCP Server — pipeline, facilities, costs, and compliance",
	persona: {
		name: "Structura Ingenious",
		role: "Master Infrastructure Architect",
		expertise: [
			"Pipeline and gathering system design",
			"Surface facility sizing and layout",
			"Infrastructure capital cost estimation",
			"Permitting and regulatory compliance",
			"Midstream takeaway capacity planning",
		],
	},
	directories: ["plans", "capacity", "costs", "compliance", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"plan_pipeline",
			"Plan gathering and transmission pipeline infrastructure — routing, capacity, and takeaway risk",
			z.object({
				wellCount: z.number().describe("Number of wells to connect"),
				expectedProduction: z.number().describe("Expected total production in BOPD"),
				location: z.string().describe("Project location (state, basin, or county)"),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawLocation = args.location;
				const normalizedLocation = normalizeIdentifier(rawLocation);
				const matchInfo = normalizedLocation !== rawLocation ? { matchedAs: normalizedLocation, matchScore: 1.0 } : {};
				const result = await synthesizePipelinePlanWithLLM({
					wellCount: args.wellCount,
					expectedProduction: args.expectedProduction,
					location: normalizedLocation,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.85, 0.9) };
			},
		),
		ServerFactory.createAnalysisTool(
			"size_facilities",
			"Size surface facilities — batteries, separators, compressors, and salt water disposal wells",
			z.object({
				wellCount: z.number().describe("Number of wells"),
				expectedProduction: z.number().describe("Expected total production in BOPD"),
				location: z.string().describe("Project location"),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawLocation = args.location;
				const normalizedLocation = normalizeIdentifier(rawLocation);
				const matchInfo = normalizedLocation !== rawLocation ? { matchedAs: normalizedLocation, matchScore: 1.0 } : {};
				const result = await synthesizeFacilitySizingWithLLM({
					wellCount: args.wellCount,
					expectedProduction: args.expectedProduction,
					location: normalizedLocation,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.85, 0.9) };
			},
		),
		ServerFactory.createAnalysisTool(
			"estimate_costs",
			"Estimate infrastructure capital costs (CAPEX) — pipelines, facilities, compression, and SWD",
			z.object({
				wellCount: z.number().describe("Number of wells"),
				compressors: z.number().describe("Number of compressor units required"),
				swdWells: z.number().describe("Number of salt water disposal wells required"),
				location: z.string().describe("Project location"),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawLocation = args.location;
				const normalizedLocation = normalizeIdentifier(rawLocation);
				const matchInfo = normalizedLocation !== rawLocation ? { matchedAs: normalizedLocation, matchScore: 1.0 } : {};
				const result = await synthesizeCostEstimateWithLLM({
					wellCount: args.wellCount,
					compressors: args.compressors,
					swdWells: args.swdWells,
					location: normalizedLocation,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.85, 0.9) };
			},
		),
		ServerFactory.createAnalysisTool(
			"assess_compliance",
			"Assess permitting and regulatory compliance requirements — permits, timeline, and environmental risks",
			z.object({
				wellCount: z.number().describe("Number of wells"),
				location: z.string().describe("Project location (state, basin, or county)"),
				environmentalConstraints: z
					.array(z.string())
					.optional()
					.default([])
					.describe("Known environmental constraints or sensitivities"),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawLocation = args.location;
				const normalizedLocation = normalizeIdentifier(rawLocation);
				const matchInfo = normalizedLocation !== rawLocation ? { matchedAs: normalizedLocation, matchScore: 1.0 } : {};
				const result = await synthesizeComplianceAssessmentWithLLM({
					wellCount: args.wellCount,
					location: normalizedLocation,
					environmentalConstraints: args.environmentalConstraints ?? [],
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.8, 0.85) };
			},
		),
	],
};

export const InfrastructureServer = ServerFactory.createServer(infrastructureTemplate);
export default InfrastructureServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new InfrastructureServer();
	runMCPServer(server);
}
