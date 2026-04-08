#!/usr/bin/env node

/**
 * Risk Analysis MCP Server - DRY Refactored
 * Gaius Probabilis Assessor - Master Risk Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { type MCPServer, runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

interface LLMRiskInterpretation {
	topRisk: string;
	mitigationPriority: string;
	riskNarrative: string;
}

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
	interpretation?: LLMRiskInterpretation;
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
	directories: ["assessments", "monte-carlo", "mitigation", "compliance", "reports"],
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
				riskProfile: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
				analysisDepth: z.enum(["screening", "standard", "comprehensive"]).default("standard"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const assessment = await performRiskAssessment(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(assessment, null, 2));
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
						distribution: z.enum(["normal", "triangular", "uniform"]).default("triangular"),
					}),
					initialProduction: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z.enum(["normal", "triangular", "uniform"]).default("normal"),
					}),
					declineRate: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z.enum(["normal", "triangular", "uniform"]).default("normal"),
					}),
					capex: z.object({
						base: z.number(),
						min: z.number(),
						max: z.number(),
						distribution: z.enum(["normal", "triangular", "uniform"]).default("triangular"),
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

// ---------------------------------------------------------------------------
// Distribution samplers — exported for unit testing
// ---------------------------------------------------------------------------

/** Uniform distribution: sample from [min, max] */
export function sampleUniform(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

/**
 * Triangular distribution: inverse-CDF method.
 *   F⁻¹(u) for u < fc:  min + sqrt(u * (max-min) * (base-min))
 *   F⁻¹(u) for u ≥ fc:  max - sqrt((1-u) * (max-min) * (max-base))
 * where fc = (base - min) / (max - min)
 */
export function sampleTriangular(min: number, base: number, max: number): number {
	const u = Math.random();
	const fc = (base - min) / (max - min);
	if (u < fc) {
		return min + Math.sqrt(u * (max - min) * (base - min));
	}
	return max - Math.sqrt((1 - u) * (max - min) * (max - base));
}

/**
 * Normal distribution: Box-Muller transform.
 * Returns one sample; the paired sample is discarded for simplicity.
 */
export function sampleNormal(mean: number, stddev: number): number {
	// Box-Muller: two uniform samples → one standard normal
	const u1 = Math.random();
	const u2 = Math.random();
	const z0 = Math.sqrt(-2 * Math.log(u1 === 0 ? Number.EPSILON : u1)) * Math.cos(2 * Math.PI * u2);
	return mean + z0 * stddev;
}

type DistributionSpec = {
	base: number;
	min: number;
	max: number;
	distribution: "normal" | "triangular" | "uniform";
};

function sample(spec: DistributionSpec): number {
	const range = spec.max - spec.min;
	const stddev = range / 6; // treat [min,max] as ±3σ for normal
	switch (spec.distribution) {
		case "uniform":
			return sampleUniform(spec.min, spec.max);
		case "triangular":
			return sampleTriangular(spec.min, spec.base, spec.max);
		case "normal":
			return sampleNormal(spec.base, stddev);
	}
}

function percentile(sorted: number[], p: number): number {
	const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
	return sorted[idx];
}

function stdDev(values: number[]): number {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Domain-specific analysis functions
// ---------------------------------------------------------------------------

async function performRiskAssessment(args: {
	projectData: {
		geological?: { confidence?: number };
		technical?: Record<string, unknown>;
		economic?: { irr?: number };
		regulatory?: Record<string, unknown>;
	};
	riskProfile: string;
}): Promise<RiskAssessment> {
	const projectData = args.projectData;

	// Calculate risk scores for each category
	const riskCategories = {
		geological: assessGeologicalRisk(projectData.geological),
		technical: assessTechnicalRisk(projectData.technical),
		economic: assessEconomicRisk(projectData.economic),
		regulatory: assessRegulatoryRisk(projectData.regulatory),
		environmental: assessEnvironmentalRisk(projectData.regulatory),
		operational: assessOperationalRisk(projectData.technical),
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
	const overallRisk = Object.entries(riskCategories).reduce((sum, [category, risk]) => {
		return sum + risk * (weights[category as keyof typeof weights] || 0);
	}, 0);

	// Identify key risks
	const keyRisks = identifyKeyRisks(riskCategories, projectData);

	// LLM interpretation
	const interpretation = await synthesizeRiskInterpretationWithLLM({
		overallRisk,
		riskCategories,
		keyRisks,
		riskProfile: args.riskProfile,
	});

	// Generate mitigation strategies — LLM priority first
	const mitigationStrategies = [interpretation.mitigationPriority, ...generateMitigationStrategies(keyRisks)];

	return {
		overallRisk,
		riskCategories,
		keyRisks,
		mitigationStrategies,
		confidence: ServerUtils.calculateConfidence(0.85, 0.9),
		recommendation: generateRiskRecommendation(overallRisk, args.riskProfile),
		interpretation,
	};
}

export function performMonteCarloAnalysis(args: {
	variables: {
		oilPrice: DistributionSpec;
		initialProduction: DistributionSpec;
		declineRate: DistributionSpec;
		capex: DistributionSpec;
	};
	iterations: number;
	targetIRR: number;
}): MonteCarloAnalysis {
	const { iterations, variables, targetIRR } = args;

	// Simple DCF proxy: NPV ≈ (oilPrice * initialProduction * (1/declineRate) * 12 * 0.85) - capex
	// IRR proxy: derived from NPV relative to capex
	// These are representative approximations sufficient for probabilistic distribution shape.
	const npvSamples: number[] = new Array(iterations);
	const irrSamples: number[] = new Array(iterations);

	for (let i = 0; i < iterations; i++) {
		const price = sample(variables.oilPrice); // $/bbl
		const ip = sample(variables.initialProduction); // bbl/month initial
		const di = Math.max(0.01, sample(variables.declineRate)); // monthly decline (prevent div/0)
		const capex = Math.max(1, sample(variables.capex)); // dollars

		// Revenue proxy: sum of hyperbolic decline over 120 months (10yr), b=1.2
		// Using exponential decline approximation: EUR ≈ ip / di (bbl)
		const eur = ip / di; // equivalent EUR in months × bbl/month
		const revenue = price * eur * 0.85; // 85% NRI / opex haircut

		const npv = revenue - capex;
		const irr = npv > 0 ? (revenue / capex - 1) * (di * 12) : -di * 12; // annualized proxy

		npvSamples[i] = npv;
		irrSamples[i] = irr;
	}

	npvSamples.sort((a, b) => a - b);
	irrSamples.sort((a, b) => a - b);

	const npvMean = npvSamples.reduce((a, b) => a + b, 0) / iterations;
	const irrMean = irrSamples.reduce((a, b) => a + b, 0) / iterations;

	return {
		iterations,
		results: {
			npv: {
				mean: npvMean,
				p10: percentile(npvSamples, 0.1),
				p50: percentile(npvSamples, 0.5),
				p90: percentile(npvSamples, 0.9),
				stdDev: stdDev(npvSamples),
			},
			irr: {
				mean: irrMean,
				p10: percentile(irrSamples, 0.1),
				p50: percentile(irrSamples, 0.5),
				p90: percentile(irrSamples, 0.9),
				stdDev: stdDev(irrSamples),
			},
			probability: {
				positive_npv: npvSamples.filter((v) => v > 0).length / iterations,
				target_irr: irrSamples.filter((v) => v > targetIRR).length / iterations,
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
function assessGeologicalRisk(geoData: { confidence?: number } | null | undefined): number {
	if (!geoData) return 0.6;
	const confidence = geoData.confidence || 75;
	return Math.max(0.1, (100 - confidence) / 100);
}

export function assessTechnicalRisk(techData: Record<string, unknown> | null | undefined): number {
	if (!techData) return 0.5;
	const wellType = String(techData.wellType ?? "").toLowerCase();
	const depth = Number(techData.depth ?? 0);
	const typeRisk = wellType.includes("horizontal") ? 0.35 : wellType.includes("directional") ? 0.25 : 0.15;
	const depthRisk = depth > 12000 ? 0.2 : depth > 8000 ? 0.1 : 0.05;
	return Math.min(0.9, typeRisk + depthRisk);
}

function assessEconomicRisk(econData: { irr?: number } | null | undefined): number {
	if (!econData) return 0.7;
	const irr = econData.irr || 0.1;
	return Math.max(0.1, Math.min(0.8, (0.25 - irr) / 0.15));
}

export function assessRegulatoryRisk(regData: Record<string, unknown> | null | undefined): number {
	if (!regData) return 0.4;
	const jurisdiction = String(regData.jurisdiction ?? "").toLowerCase();
	const LOW_RISK = ["texas", "tx", "oklahoma", "ok", "wyoming", "wy"];
	const HIGH_RISK = ["california", "ca", "colorado", "co", "new mexico", "nm"];
	if (LOW_RISK.some((j) => jurisdiction.includes(j))) return 0.15;
	if (HIGH_RISK.some((j) => jurisdiction.includes(j))) return 0.55;
	return 0.35;
}

export function assessEnvironmentalRisk(regData: Record<string, unknown> | null | undefined): number {
	if (!regData) return 0.4;
	const jurisdiction = String(regData.jurisdiction ?? "").toLowerCase();
	const permitStatus = String(regData.permitStatus ?? "").toLowerCase();
	const baseRisk = jurisdiction.includes("california") || jurisdiction.includes("colorado") ? 0.6 : 0.3;
	const permitAdj = permitStatus.includes("approved") ? -0.1 : permitStatus.includes("pending") ? 0.1 : 0;
	return Math.min(0.9, Math.max(0.05, baseRisk + permitAdj));
}

export function assessOperationalRisk(techData: Record<string, unknown> | null | undefined): number {
	if (!techData) return 0.45;
	const wellType = String(techData.wellType ?? "").toLowerCase();
	const formation = String(techData.formation ?? "").toLowerCase();
	const typeRisk = wellType.includes("horizontal") ? 0.4 : wellType.includes("directional") ? 0.3 : 0.2;
	const formRisk = formation.includes("shale") || formation.includes("tight") ? 0.1 : 0;
	return Math.min(0.85, typeRisk + formRisk);
}

function identifyKeyRisks(
	riskCategories: Record<string, number>,
	_projectData: Record<string, unknown>,
): Array<{
	category: string;
	risk: string;
	probability: number;
	impact: number;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}> {
	const risks: Array<{
		category: string;
		risk: string;
		probability: number;
		impact: number;
		severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	}> = [];
	Object.entries(riskCategories).forEach(([category, risk]) => {
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

function generateMitigationStrategies(
	_keyRisks: Array<{ category: string; risk: string; probability: number; impact: number; severity: string }>,
): string[] {
	return [
		"Implement comprehensive monitoring and surveillance programs",
		"Develop contingency plans for identified risk scenarios",
		"Maintain adequate insurance coverage and financial reserves",
	];
}

function generateRiskRecommendation(overallRisk: number, riskProfile: string): string {
	if (overallRisk < 0.3) return "Low risk profile supports investment recommendation";
	if (overallRisk < 0.5) return `Moderate risk acceptable for ${riskProfile} risk profile`;
	if (overallRisk < 0.7) return "Elevated risk requires enhanced mitigation measures";
	return "High risk profile may warrant declining the opportunity";
}

// ---------------------------------------------------------------------------
// LLM synthesis
// ---------------------------------------------------------------------------

function deriveDefaultRiskInterpretation(
	overallRisk: number,
	riskCategories: Record<string, number>,
): LLMRiskInterpretation {
	const top = Object.entries(riskCategories).sort((a, b) => b[1] - a[1])[0];
	return {
		topRisk: `${top[0]} risk at ${(top[1] * 100).toFixed(0)}%`,
		mitigationPriority: `Address ${top[0]} risk before proceeding`,
		riskNarrative:
			overallRisk > 0.6
				? "High overall risk profile warrants enhanced due diligence and mitigation planning."
				: overallRisk > 0.4
					? "Moderate risk profile is manageable with standard mitigation measures."
					: "Low risk profile supports investment consideration.",
	};
}

async function synthesizeRiskInterpretationWithLLM(params: {
	overallRisk: number;
	riskCategories: Record<string, number>;
	keyRisks: Array<{ category: string; risk: string; probability: number; impact: number }>;
	riskProfile: string;
	monteCarloP50?: number;
}): Promise<LLMRiskInterpretation> {
	const { overallRisk, riskCategories, keyRisks, riskProfile, monteCarloP50 } = params;
	const categoryLines = Object.entries(riskCategories)
		.map(([k, v]) => `  ${k}: ${(v * 100).toFixed(1)}%`)
		.join("\n");
	const prompt = `You are Gaius Probabilis Assessor, Master Risk Strategist for oil and gas investments.

Risk assessment results:
- Overall risk score: ${(overallRisk * 100).toFixed(1)}%
- Investor risk profile: ${riskProfile}
${monteCarloP50 !== undefined ? `- Monte Carlo P50 NPV: $${monteCarloP50.toLocaleString()}` : ""}

Risk category breakdown:
${categoryLines}

Key risks identified:
${keyRisks.map((r) => `  - ${r.category}: ${r.risk} (probability ${(r.probability * 100).toFixed(0)}%, impact ${(r.impact * 100).toFixed(0)}%)`).join("\n")}

Return ONLY valid JSON with this exact structure:
{
  "topRisk": "<single most critical risk factor in one sentence>",
  "mitigationPriority": "<specific first action to mitigate that risk>",
  "riskNarrative": "<2-3 sentence plain-English risk summary for an investment memo>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in LLM response");
		const parsed = JSON.parse(match[0]) as LLMRiskInterpretation;
		if (typeof parsed.topRisk !== "string" || typeof parsed.riskNarrative !== "string") {
			throw new Error("Invalid LLM response shape");
		}
		return parsed;
	} catch {
		return deriveDefaultRiskInterpretation(overallRisk, riskCategories);
	}
}

// Create the server using factory
export const RiskAnalysisServer = ServerFactory.createServer(riskAnalysisTemplate);
export default RiskAnalysisServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (RiskAnalysisServer as unknown as new () => MCPServer)();
	runMCPServer(server);
}
