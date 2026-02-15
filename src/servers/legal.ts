#!/usr/bin/env node

/**
 * Legal MCP Server - DRY Refactored
 * Legatus Juridicus - Master Legal Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

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
				const riskLevel =
					args.projectType === "exploration" ? "High" : args.projectType === "development" ? "Medium" : "Low";

				const analysis = {
					jurisdiction: args.jurisdiction,
					project: args.projectType,
					legal: {
						permits: {
							required: ["Drilling permits", "Environmental clearances", "Land use approvals", "Water usage permits"],
							timeline: "4-6 months for standard approvals",
							complexity: riskLevel,
						},
						compliance: {
							environmental: ["NEPA review", "State environmental laws", "Local ordinances"],
							safety: ["OSHA requirements", "DOT regulations", "State safety codes"],
							taxation: ["Severance taxes", "Property taxes", "Income tax implications"],
						},
						risks: {
							regulatory: `${riskLevel} - ${args.projectType} projects in ${args.jurisdiction}`,
							contractual: "Standard oil & gas contract risks",
							environmental: "Manageable with proper compliance",
							title: args.assets.length > 1 ? "Complex - multiple assets" : "Standard",
						},
					},
					recommendations: [
						`Engage local counsel in ${args.jurisdiction}`,
						"Complete title examination before proceeding",
						"Obtain all required permits before operations",
						"Implement comprehensive compliance program",
					],
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
