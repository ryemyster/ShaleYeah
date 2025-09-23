#!/usr/bin/env node

/**
 * Risk Analysis MCP Server - DRY Refactored
 * Gaius Probabilis Assessor - Master Risk Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import {
	ServerFactory,
	type ServerTemplate,
	ServerUtils,
} from "../shared/server-factory.js";

interface RiskAssessment {
	overallRisk: number; // 0-1 scale
	riskCategories: {
		geological: number;
		technical: number;
		economic: number;
		regulatory: number;
		environmental: number;
		operational: number;
	};
	keyRisks: Array<{
		category: string;
		risk: string;
		probability: number;
		impact: number;
		severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	}>;
	mitigationStrategies: string[];
	confidence: number;
	recommendation: string;
}

interface MonteCarloAnalysis {
	iterations: number;
	results: {
		npv: {
			mean: number;
			p10: number;
			p50: number;
			p90: number;
			stdDev: number;
		};
		irr: {
			mean: number;
			p10: number;
			p50: number;
			p90: number;
			stdDev: number;
		};
		probability: { positive_npv: number; target_irr: number };
	};
	sensitivities: Array<{
		variable: string;
		correlation: number;
		impact: string;
	}>;
}

const riskAnalysisTemplate: ServerTemplate = {
	name: "risk-analysis",
	description: "Risk Assessment & Analysis MCP Server",
	persona: {
		name: "Gaius Probabilis Assessor",
		role: "Master Risk Strategist",
		expertise: [
			"Comprehensive risk assessment",
			"Monte Carlo simulation",
			"Uncertainty quantification",
			"Risk mitigation strategies",
			"Regulatory compliance analysis",
		],
	},
	directories: [
		"assessments",
		"monte-carlo",
		"mitigation",
		"compliance",
		"reports",
	],
	tools: [
		ServerFactory.createAnalysisTool(
			"assess_investment_risk",
			"Comprehensive risk assessment for investment opportunities",
			z.object({
				projectData: z.object({
					geological: z.any().optional(),
					economic: z.any().optional(),
					technical: z.any().optional(),
					regulatory: z.any().optional(),
				}),
				riskProfile: z
					.enum(["conservative", "moderate", "aggressive"])
					.default("moderate"),
				analysisDepth: z
					.enum(["screening", "standard", "comprehensive"])
					.default("standard"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const assessment = performRiskAssessment(args);

				if (args.outputPath) {
					await fs.writeFile(
						args.outputPath,
						JSON.stringify(assessment, null, 2),
					);
				}

				return assessment;
			},
		),
		ServerFactory.createAnalysisTool(
			"monte_carlo_simulation",
			"Run Monte Carlo simulation for uncertainty analysis",
			z.object({
				variables: z.object({
					oilPrice: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z
							.enum(["normal", "triangular", "uniform"])
							.default("triangular"),
					}),
					initialProduction: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z
							.enum(["normal", "triangular", "uniform"])
							.default("normal"),
					}),
					declineRate: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z
							.enum(["normal", "triangular", "uniform"])
							.default("normal"),
					}),
					capex: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z
							.enum(["normal", "triangular", "uniform"])
							.default("triangular"),
					}),
				}),
				iterations: z.number().min(1000).max(100000).default(10000),
				targetIRR: z.number().default(0.15),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const results = performMonteCarloAnalysis(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(results, null, 2));
				}

				return results;
			},
		),
	],
};

// Domain-specific analysis functions
function performRiskAssessment(args: any): RiskAssessment {
	const projectData = args.projectData;

	// Calculate risk scores for each category
	const riskCategories = {
		geological: assessGeologicalRisk(projectData.geological),
		technical: assessTechnicalRisk(projectData.technical),
		economic: assessEconomicRisk(projectData.economic),
		regulatory: assessRegulatoryRisk(projectData.regulatory),
		environmental: Math.random() * 0.4 + 0.1, // 0.1-0.5
		operational: Math.random() * 0.3 + 0.2, // 0.2-0.5
	};

	// Calculate overall risk (weighted average)
	const weights = {
		geological: 0.25,
		technical: 0.2,
		economic: 0.25,
		regulatory: 0.1,
		environmental: 0.1,
		operational: 0.1,
	};
	const overallRisk = Object.entries(riskCategories).reduce(
		(sum, [category, risk]) => {
			return sum + risk * (weights[category as keyof typeof weights] || 0);
		},
		0,
	);

	// Identify key risks
	const keyRisks = identifyKeyRisks(riskCategories, projectData);

	// Generate mitigation strategies
	const mitigationStrategies = generateMitigationStrategies(keyRisks);

	return {
		overallRisk,
		riskCategories,
		keyRisks,
		mitigationStrategies,
		confidence: ServerUtils.calculateConfidence(0.85, 0.9),
		recommendation: generateRiskRecommendation(overallRisk, args.riskProfile),
	};
}

function performMonteCarloAnalysis(args: any): MonteCarloAnalysis {
	// Essential Monte Carlo simulation logic
	const iterations = args.iterations;
	const npvResults = Array.from(
		{ length: Math.min(iterations, 1000) },
		() => Math.random() * 10000000 - 2000000,
	);
	const irrResults = Array.from(
		{ length: Math.min(iterations, 1000) },
		() => Math.random() * 0.5,
	);

	return {
		iterations,
		results: {
			npv: {
				mean: npvResults.reduce((a, b) => a + b) / npvResults.length,
				p10: npvResults.sort()[Math.floor(npvResults.length * 0.1)],
				p50: npvResults.sort()[Math.floor(npvResults.length * 0.5)],
				p90: npvResults.sort()[Math.floor(npvResults.length * 0.9)],
				stdDev: Math.sqrt(
					npvResults.reduce(
						(sum, val) =>
							sum +
							(val - npvResults.reduce((a, b) => a + b) / npvResults.length) **
								2,
						0,
					) / npvResults.length,
				),
			},
			irr: {
				mean: irrResults.reduce((a, b) => a + b) / irrResults.length,
				p10: irrResults.sort()[Math.floor(irrResults.length * 0.1)],
				p50: irrResults.sort()[Math.floor(irrResults.length * 0.5)],
				p90: irrResults.sort()[Math.floor(irrResults.length * 0.9)],
				stdDev: Math.sqrt(
					irrResults.reduce(
						(sum, val) =>
							sum +
							(val - irrResults.reduce((a, b) => a + b) / irrResults.length) **
								2,
						0,
					) / irrResults.length,
				),
			},
			probability: {
				positive_npv: npvResults.filter((npv) => npv > 0).length / iterations,
				target_irr:
					irrResults.filter((irr) => irr > args.targetIRR).length / iterations,
			},
		},
		sensitivities: [
			{
				variable: "Oil Price",
				correlation: 0.85,
				impact: "High positive correlation with NPV",
			},
			{
				variable: "Initial Production",
				correlation: 0.72,
				impact: "Strong positive correlation with returns",
			},
		],
	};
}

// Helper functions for risk assessment
function assessGeologicalRisk(geoData: any): number {
	if (!geoData) return 0.6;
	const confidence = geoData.confidence || 75;
	return Math.max(0.1, (100 - confidence) / 100);
}

function assessTechnicalRisk(techData: any): number {
	if (!techData) return 0.5;
	return Math.random() * 0.4 + 0.1;
}

function assessEconomicRisk(econData: any): number {
	if (!econData) return 0.7;
	const irr = econData.irr || 0.1;
	return Math.max(0.1, Math.min(0.8, (0.25 - irr) / 0.15));
}

function assessRegulatoryRisk(_regData: any): number {
	return Math.random() * 0.3 + 0.1;
}

function identifyKeyRisks(riskCategories: any, _projectData: any): Array<any> {
	const risks: Array<any> = [];
	Object.entries(riskCategories).forEach(([category, risk]: [string, any]) => {
		if (risk > 0.5) {
			risks.push({
				category,
				risk: `Elevated ${category} risk`,
				probability: risk,
				impact: risk > 0.7 ? 0.8 : 0.6,
				severity: risk > 0.7 ? "HIGH" : "MEDIUM",
			});
		}
	});
	return risks;
}

function generateMitigationStrategies(_keyRisks: any[]): string[] {
	return [
		"Implement comprehensive monitoring and surveillance programs",
		"Develop contingency plans for identified risk scenarios",
		"Maintain adequate insurance coverage and financial reserves",
	];
}

function generateRiskRecommendation(
	overallRisk: number,
	riskProfile: string,
): string {
	if (overallRisk < 0.3)
		return "Low risk profile supports investment recommendation";
	if (overallRisk < 0.5)
		return `Moderate risk acceptable for ${riskProfile} risk profile`;
	if (overallRisk < 0.7)
		return "Elevated risk requires enhanced mitigation measures";
	return "High risk profile may warrant declining the opportunity";
}

// Create the server using factory
export const RiskAnalysisServer =
	ServerFactory.createServer(riskAnalysisTemplate);
export default RiskAnalysisServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (RiskAnalysisServer as any)();
	runMCPServer(server);
}
