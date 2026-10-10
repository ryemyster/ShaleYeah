#!/usr/bin/env node
/**
 * Legal MCP Server — Legatus Juridicus, Master Legal Strategist.
 * Thin facade — all domain logic lives in src/tools/.
 */

import { normalizeIdentifier, runMCPServer, ServerFactory, type ServerTemplate, ServerUtils } from "@shaleyeah/sdk";
import { z } from "zod";
import { deriveComplianceRequirements, synthesizeComplianceRequirementsWithLLM } from "./tools/compliance.js";
import { deriveContractReview, synthesizeContractReviewWithLLM } from "./tools/contract.js";
import { deriveRegulatoryAssessment, synthesizeRegulatoryAssessmentWithLLM } from "./tools/regulatory.js";

// ---------------------------------------------------------------------------
// Backward-compat exports — existing tests import these from ../src/index.js
// ---------------------------------------------------------------------------

export function deriveDefaultRegulatoryRisk(jurisdiction: string, projectType: string): string {
	return deriveRegulatoryAssessment(
		jurisdiction,
		projectType as "exploration" | "development" | "production" | "abandonment",
	).regulatoryRisk;
}

export async function synthesizeLegalAnalysisWithLLM(params: {
	jurisdiction: string;
	projectType: string;
	assets: string[];
}): Promise<{ regulatoryRisk: string; keyRisks: string[]; recommendations: string[] }> {
	return synthesizeRegulatoryAssessmentWithLLM({
		jurisdiction: params.jurisdiction,
		projectType: params.projectType as "exploration" | "development" | "production" | "abandonment",
		assets: params.assets,
	});
}

export type { ComplianceRequirements } from "./tools/compliance.js";
export { deriveComplianceRequirements, synthesizeComplianceRequirementsWithLLM } from "./tools/compliance.js";
export type { ContractReview } from "./tools/contract.js";
export { deriveContractReview, synthesizeContractReviewWithLLM } from "./tools/contract.js";
// Re-export tool types and functions for consumers
export type { RegulatoryAssessment } from "./tools/regulatory.js";
export { deriveRegulatoryAssessment, synthesizeRegulatoryAssessmentWithLLM } from "./tools/regulatory.js";

// ---------------------------------------------------------------------------
// Server template
// ---------------------------------------------------------------------------

const projectTypeSchema = z.enum(["exploration", "development", "production", "abandonment"]);

const legalTemplate: ServerTemplate = {
	name: "legal",
	description: "Legal Analysis MCP Server",
	persona: {
		name: "Legatus Juridicus",
		role: "Master Legal Strategist",
		expertise: [
			"Contract analysis and negotiation",
			"Regulatory compliance assessment",
			"Risk identification and mitigation",
			"Lease and title review",
			"Environmental legal matters",
		],
	},
	directories: ["contracts", "compliance", "risks", "opinions", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"analyze_legal_framework",
			"Analyze regulatory and legal exposure for a jurisdiction and project type",
			z.object({
				jurisdiction: z.string(),
				projectType: projectTypeSchema,
				assets: z.array(z.string()),
				timeline: z.string().optional(),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const normalizedAssets = args.assets.map(normalizeIdentifier);
				const assetsChanged = args.assets.some((a: string) => normalizeIdentifier(a) !== a);
				const matchInfo = assetsChanged ? { matchedAs: normalizedAssets, matchScore: 1.0 } : {};
				const result = await synthesizeRegulatoryAssessmentWithLLM({
					jurisdiction: args.jurisdiction,
					projectType: args.projectType,
					assets: normalizedAssets,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.88, 0.85) };
			},
		),

		ServerFactory.createAnalysisTool(
			"review_contract",
			"Review and assess risk in oil & gas contract terms",
			z.object({
				contractType: z.enum(["lease", "JOA", "purchase", "service", "farmout"]),
				keyTerms: z.array(z.string()),
				parties: z.array(z.string()),
				riskProfile: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const normalizedParties = args.parties.map(normalizeIdentifier);
				const partiesChanged = args.parties.some((a: string) => normalizeIdentifier(a) !== a);
				const matchInfo = partiesChanged ? { matchedAs: normalizedParties, matchScore: 1.0 } : {};
				const result = await synthesizeContractReviewWithLLM({
					contractType: args.contractType,
					keyTerms: args.keyTerms,
					parties: normalizedParties,
					riskProfile: args.riskProfile,
				});
				return { ...result, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.85, 0.9) };
			},
		),

		ServerFactory.createAnalysisTool(
			"assess_compliance",
			"Assess environmental, safety, and tax compliance requirements for a project",
			z.object({
				jurisdiction: z.string(),
				projectType: projectTypeSchema,
				assetCount: z.number().int().positive(),
			}),
			async (args) => {
				const result = await synthesizeComplianceRequirementsWithLLM({
					jurisdiction: args.jurisdiction,
					projectType: args.projectType,
					assetCount: args.assetCount,
				});
				return { ...result, confidence: ServerUtils.calculateConfidence(0.82, 0.88) };
			},
		),
	],
};

export const LegalServer = ServerFactory.createServer(legalTemplate);
export default LegalServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new LegalServer();
	runMCPServer(server);
}
