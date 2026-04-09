#!/usr/bin/env node

/**
 * Legal MCP Server - DRY Refactored
 * Legatus Juridicus - Master Legal Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

/**
 * Rule-based regulatory risk rating — used as fallback when the API is unavailable.
 * Returns "High" / "Medium" / "Low" based on jurisdiction and project type.
 * Different inputs must produce different outputs so tests can verify determinism.
 */
export function deriveDefaultRegulatoryRisk(jurisdiction: string, projectType: string): string {
	const highRiskJurisdictions = ["california", "colorado", "new mexico"];
	const jLower = jurisdiction.toLowerCase();
	const isHighJurisdiction = highRiskJurisdictions.some((j) => jLower.includes(j));

	if (projectType === "exploration" || isHighJurisdiction) return "High";
	if (projectType === "development") return "Medium";
	return "Low";
}

/**
 * Ask Claude (Legatus Juridicus) to assess the legal and regulatory exposure
 * for a given jurisdiction and project type. Falls back to rule-based risk rating
 * when the API is unavailable.
 */
export async function synthesizeLegalAnalysisWithLLM(params: {
	jurisdiction: string;
	projectType: string;
	assets: string[];
}): Promise<{ regulatoryRisk: string; keyRisks: string[]; recommendations: string[] }> {
	const { jurisdiction, projectType, assets } = params;

	const prompt = `You are Legatus Juridicus, a master oil & gas legal strategist.

Analyze the regulatory and legal exposure for this project and return a JSON object.

PROJECT:
Jurisdiction: ${jurisdiction}
Project type: ${projectType}
Assets: ${assets.join(", ")}

Return ONLY valid JSON in this exact shape:
{
  "regulatoryRisk": "High" | "Medium" | "Low",
  "keyRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"]
}

Base your assessment on actual regulatory conditions in ${jurisdiction} for ${projectType} projects.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 400 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as {
			regulatoryRisk?: string;
			keyRisks?: string[];
			recommendations?: string[];
		};
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.regulatoryRisk ?? "")) throw new Error("Invalid regulatoryRisk");
		return {
			regulatoryRisk: parsed.regulatoryRisk as string,
			keyRisks: parsed.keyRisks ?? [],
			recommendations: parsed.recommendations ?? [],
		};
	} catch (_err) {
		// API unavailable — fall back to rule-based risk rating
		return {
			regulatoryRisk: deriveDefaultRegulatoryRisk(jurisdiction, projectType),
			keyRisks: [
				`${projectType} regulatory compliance in ${jurisdiction}`,
				"Environmental permit requirements",
				"Title and ownership verification",
			],
			recommendations: [
				`Engage local counsel in ${jurisdiction}`,
				"Complete title examination before proceeding",
				"Obtain all required permits before operations",
			],
		};
	}
}

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
			"Analyze legal framework and compliance requirements",
			z.object({
				jurisdiction: z.string(),
				projectType: z.enum(["exploration", "development", "production", "abandonment"]),
				assets: z.array(z.string()),
				timeline: z.string().optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				// Ask Claude to assess real regulatory exposure for this jurisdiction and project type.
				// Falls back to rule-based risk rating if the API is unavailable.
				const llmResult = await synthesizeLegalAnalysisWithLLM({
					jurisdiction: args.jurisdiction,
					projectType: args.projectType,
					assets: args.assets,
				});

				const analysis = {
					jurisdiction: args.jurisdiction,
					project: args.projectType,
					legal: {
						permits: {
							required: ["Drilling permits", "Environmental clearances", "Land use approvals", "Water usage permits"],
							timeline: "4-6 months for standard approvals",
							complexity: llmResult.regulatoryRisk,
						},
						compliance: {
							environmental: ["NEPA review", "State environmental laws", "Local ordinances"],
							safety: ["OSHA requirements", "DOT regulations", "State safety codes"],
							taxation: ["Severance taxes", "Property taxes", "Income tax implications"],
						},
						risks: {
							regulatory: `${llmResult.regulatoryRisk} - ${args.projectType} projects in ${args.jurisdiction}`,
							keyRisks: llmResult.keyRisks,
							contractual: "Standard oil & gas contract risks",
							environmental: "Manageable with proper compliance",
							title: args.assets.length > 1 ? "Complex - multiple assets" : "Standard",
						},
					},
					recommendations: llmResult.recommendations,
					confidence: ServerUtils.calculateConfidence(0.88, 0.85),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"review_contract",
			"Review and analyze contract terms",
			z.object({
				contractType: z.enum(["lease", "JOA", "purchase", "service", "farmout"]),
				keyTerms: z.array(z.string()),
				parties: z.array(z.string()),
				riskProfile: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = {
					contract: {
						type: args.contractType,
						parties: args.parties,
						riskProfile: args.riskProfile,
					},
					terms: {
						financial: args.keyTerms.filter(
							(t: string) =>
								t.toLowerCase().includes("payment") ||
								t.toLowerCase().includes("royalty") ||
								t.toLowerCase().includes("bonus"),
						),
						operational: args.keyTerms.filter(
							(t: string) => t.toLowerCase().includes("drilling") || t.toLowerCase().includes("operation"),
						),
						legal: args.keyTerms.filter(
							(t: string) => t.toLowerCase().includes("liability") || t.toLowerCase().includes("indemnity"),
						),
					},
					assessment: {
						overall:
							args.riskProfile === "conservative"
								? "Low Risk"
								: args.riskProfile === "moderate"
									? "Medium Risk"
									: "High Risk",
						negotiability: "Standard terms with room for negotiation",
						recommendations: [
							"Review indemnification clauses carefully",
							"Negotiate favorable payment terms",
							"Ensure clear operational responsibilities",
						],
					},
					confidence: ServerUtils.calculateConfidence(0.85, 0.9),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
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
