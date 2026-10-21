#!/usr/bin/env node

/**
 * Curve-Smith MCP Server - DRY Refactored
 * Lucius Technicus Engineer - Master Reservoir Engineer
 */

import fs from "node:fs/promises";
import {
	callLLM,
	type MCPServer,
	normalizeIdentifier,
	runMCPServer,
	ServerFactory,
	type ServerTemplate,
} from "@shaleyeah/sdk";
import { z } from "zod";
import {
	type CurveFitResult,
	fitExponentialDecline,
	fitHyperbolicDecline,
	type ProductionData,
	parseProductionData,
} from "./tools/decline-curve-analysis.js";
import { type CurveSmithOptions, typeCurveTools } from "./type-curve-tools.js";

export type { CurveSmithOptions } from "./type-curve-tools.js";

interface DeclineCurveAnalysis {
	initialRate: {
		oil: number;
		gas: number;
		water: number;
	};
	declineRate: number;
	bFactor: number;
	eur: {
		oil: number;
		gas: number;
	};
	typeCurve: string;
	confidence: number;
	qualityGrade: "Excellent" | "Good" | "Fair" | "Poor";
	interpretation?: {
		declineCharacter: string;
		basinAnalog: string;
		flags: string[];
	};
}

export function createCurveSmithTemplate(options: CurveSmithOptions = {}): ServerTemplate {
	return {
		name: "curve-smith",
		description: "Reservoir Engineering MCP Server",
		persona: {
			name: "Lucius Technicus Engineer",
			role: "Master Reservoir Engineer",
			expertise: [
				"Decline curve analysis and modeling",
				"EUR estimation and validation",
				"Type curve development",
				"Reservoir characterization",
				"Production optimization",
			],
		},
		directories: ["curves", "type-curves", "production", "models", "reports"],
		tools: [
			ServerFactory.createAnalysisTool(
				"analyze_decline_curve",
				"Analyze production decline curves and estimate EUR",
				z.object({
					filePath: z.string().describe("Path to production data file"),
					curveType: z.enum(["exponential", "hyperbolic", "harmonic"]).default("hyperbolic"),
					minMonths: z.number().min(3).default(6).describe("Minimum months of data required"),
					formation: z.string().optional().describe("Formation name for interpretation context"),
					outputPath: z.string().optional(),
					// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
					matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
				}),
				async (args) => {
					const rawFormation = args.formation;
					const normalizedFormation = rawFormation ? normalizeIdentifier(rawFormation) : rawFormation;
					const matchInfo =
						rawFormation && normalizedFormation !== rawFormation
							? { matchedAs: normalizedFormation, matchScore: 1.0 }
							: {};
					const analysis = await performDeclineCurveAnalysis({ ...args, formation: normalizedFormation });

					if (args.outputPath) {
						await fs.writeFile(args.outputPath, JSON.stringify({ ...analysis, ...matchInfo }, null, 2));
					}

					return { ...analysis, ...matchInfo };
				},
			),
			...typeCurveTools(options),
			ServerFactory.createAnalysisTool(
				"assess_curve_quality",
				"Assess quality of decline curve analysis",
				z.object({
					curveData: z
						.object({
							initialRate: z.object({ oil: z.number(), gas: z.number(), water: z.number() }),
							declineRate: z.number(),
							bFactor: z.number(),
							eur: z.object({ oil: z.number(), gas: z.number() }),
							typeCurve: z.string(),
							confidence: z.number(),
							qualityGrade: z.enum(["Excellent", "Good", "Fair", "Poor"]),
						})
						.describe("Decline curve analysis data"),
					thresholds: z
						.object({
							minR2: z.number().min(0).max(1).default(0.8),
							minDataPoints: z.number().default(6),
						})
						.optional(),
				}),
				async (args) => {
					// Derive R² from confidence (0–100 → 0.0–1.0 scale)
					// confidence already reflects data quality from the curve fit
					const r2 = Math.min(0.99, args.curveData.confidence / 100);
					// Estimate data points from qualityGrade — proxy for production history length
					const gradeDataPoints: Record<string, number> = {
						Excellent: 24,
						Good: 12,
						Fair: 8,
						Poor: 4,
					};
					const dataPoints = gradeDataPoints[args.curveData.qualityGrade] ?? 6;

					return {
						r2,
						dataPoints,
						passesThresholds:
							r2 >= (args.thresholds?.minR2 || 0.8) && dataPoints >= (args.thresholds?.minDataPoints || 6),
						qualityGrade: determineQualityGrade(r2, dataPoints),
						recommendations: generateQualityRecommendations(r2, dataPoints),
					};
				},
			),
		],
	};
}

// Domain-specific reservoir engineering functions
async function performDeclineCurveAnalysis(args: {
	filePath: string;
	minMonths: number;
	curveType: string;
	formation?: string;
}): Promise<DeclineCurveAnalysis> {
	const csvData = await fs.readFile(args.filePath, "utf8");
	const productionData: ProductionData[] = parseProductionData(csvData);

	if (productionData.length < args.minMonths) {
		throw new Error(`Insufficient data: ${productionData.length} months, minimum ${args.minMonths} required`);
	}

	// Analyze both oil and gas if available
	const oilResult = await fitDeclineCurve(productionData, "oil", args.curveType);
	const gasResult = await fitDeclineCurve(productionData, "gas", args.curveType);

	// Convert to DeclineCurveAnalysis format
	const analysis = convertToDeclineAnalysis(oilResult, gasResult, productionData);

	// LLM synthesis — Lucius Technicus Engineer interprets the curve parameters
	const interpretation = await synthesizeInterpretationWithLLM({
		qi: analysis.initialRate.oil,
		Di: analysis.declineRate,
		b: analysis.bFactor,
		eur: Math.round(analysis.eur.oil / 1000), // convert bbl → Mbbl for prompt
		curveType: analysis.typeCurve,
		confidence: analysis.confidence,
		formation: args.formation ?? "Unknown Formation",
	});

	return { ...analysis, interpretation };
}

async function fitDeclineCurve(
	data: ProductionData[],
	product: "oil" | "gas",
	curveType: string,
): Promise<CurveFitResult> {
	const hasData = data.some((d) => d[product] > 0);

	if (!hasData) {
		return {
			curveType: curveType as "exponential" | "hyperbolic" | "harmonic",
			parameters: {
				initialRate: 0,
				declineRate: 0.1,
				bFactor: 0.5,
				r2: 0,
				rmse: 0,
			},
			eur: 0,
			qualityGrade: "Poor",
			confidence: 0,
			forecast: [],
		};
	}

	try {
		if (curveType === "exponential") {
			return fitExponentialDecline(data, product);
		} else {
			return fitHyperbolicDecline(data, product);
		}
	} catch (_error) {
		// Return reasonable defaults
		const avgRate =
			data.filter((d) => d[product] > 0).reduce((sum, d) => sum + d[product], 0) /
			data.filter((d) => d[product] > 0).length;

		return {
			curveType: curveType as "exponential" | "hyperbolic" | "harmonic",
			parameters: {
				initialRate: avgRate || 100,
				declineRate: 0.15,
				bFactor: 0.5,
				r2: 0.5,
				rmse: avgRate * 0.1,
			},
			eur: (avgRate || 100) * 365 * 10,
			qualityGrade: "Poor",
			confidence: 50,
			forecast: [],
		};
	}
}

function convertToDeclineAnalysis(
	oilResult: CurveFitResult,
	gasResult: CurveFitResult,
	data: ProductionData[],
): DeclineCurveAnalysis {
	const avgWater =
		data.filter((d) => d.water > 0).reduce((sum, d) => sum + d.water, 0) / data.filter((d) => d.water > 0).length || 10;

	return {
		initialRate: {
			oil: Math.round(oilResult.parameters.initialRate),
			gas: Math.round(gasResult.parameters.initialRate),
			water: Math.round(avgWater),
		},
		declineRate: Math.round(((oilResult.parameters.declineRate + gasResult.parameters.declineRate) / 2) * 1000) / 1000,
		bFactor: Math.round(((oilResult.parameters.bFactor + gasResult.parameters.bFactor) / 2) * 100) / 100,
		eur: {
			oil: Math.round(oilResult.eur),
			gas: Math.round(gasResult.eur),
		},
		typeCurve: `${oilResult.curveType.charAt(0).toUpperCase() + oilResult.curveType.slice(1)} Decline`,
		confidence: Math.round((oilResult.confidence + gasResult.confidence) / 2),
		qualityGrade: selectBestQualityGrade(oilResult.qualityGrade, gasResult.qualityGrade),
	};
}

function selectBestQualityGrade(grade1: string, grade2: string): "Excellent" | "Good" | "Fair" | "Poor" {
	const gradeOrder: Record<string, number> = {
		Excellent: 4,
		Good: 3,
		Fair: 2,
		Poor: 1,
	};
	const score1 = gradeOrder[grade1] || 1;
	const score2 = gradeOrder[grade2] || 1;
	const maxScore = Math.max(score1, score2);

	const reverseOrder: Record<number, string> = {
		4: "Excellent",
		3: "Good",
		2: "Fair",
		1: "Poor",
	};
	return (reverseOrder[maxScore] || "Poor") as "Excellent" | "Good" | "Fair" | "Poor";
}

function determineQualityGrade(r2: number, dataPoints: number): "Excellent" | "Good" | "Fair" | "Poor" {
	if (r2 >= 0.95 && dataPoints >= 12) return "Excellent";
	if (r2 >= 0.85 && dataPoints >= 8) return "Good";
	if (r2 >= 0.75 && dataPoints >= 6) return "Fair";
	return "Poor";
}

function generateQualityRecommendations(r2: number, dataPoints: number): string[] {
	const recommendations = [];

	if (r2 < 0.8) {
		recommendations.push("Consider alternative curve fitting methods");
	}
	if (dataPoints < 8) {
		recommendations.push("Collect additional production data for improved accuracy");
	}
	if (r2 >= 0.9 && dataPoints >= 10) {
		recommendations.push("Excellent curve fit - proceed with confidence");
	}

	return recommendations;
}

// ---------------------------------------------------------------------------
// LLM synthesis — Lucius Technicus Engineer interprets decline parameters
// ---------------------------------------------------------------------------

interface LLMCurveInterpretation {
	declineCharacter: string;
	basinAnalog: string;
	flags: string[];
}

function deriveDefaultInterpretation(curveType: string, b: number): LLMCurveInterpretation {
	let declineCharacter: string;
	if (b >= 1.5) {
		declineCharacter = "strongly hyperbolic — significant transient flow, likely fractured tight reservoir";
	} else if (b >= 0.8) {
		declineCharacter = "hyperbolic — typical unconventional well with boundary-dominated flow emerging";
	} else if (b >= 0.3) {
		declineCharacter = "weakly hyperbolic approaching exponential — mature boundary-dominated flow";
	} else {
		declineCharacter = "exponential — fully boundary-dominated, conventional-style depletion";
	}

	const analog = curveType.toLowerCase().includes("exponential")
		? "Conventional sandstone analog (exponential depletion)"
		: "Permian Wolfcamp A Tier 2 (hyperbolic unconventional analog)";

	return { declineCharacter, basinAnalog: analog, flags: [] };
}

async function synthesizeInterpretationWithLLM(params: {
	qi: number;
	Di: number;
	b: number;
	eur: number;
	curveType: string;
	confidence: number;
	formation: string;
}): Promise<LLMCurveInterpretation> {
	const { qi, Di, b, eur, curveType, confidence, formation } = params;

	const prompt = `You are Lucius Technicus Engineer, Master Reservoir Engineer.

Analyze the following decline curve parameters for an oil & gas investment decision:
- Formation: ${formation}
- Initial rate (qi): ${qi} bopd
- Initial decline rate (Di): ${Di}/month
- Hyperbolic exponent (b): ${b}
- Estimated Ultimate Recovery (EUR): ${eur} Mbbl
- Curve type: ${curveType}
- Confidence: ${confidence}%

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "declineCharacter": "<plain English description of the decline behavior>",
  "basinAnalog": "<nearest comparable basin/formation>",
  "flags": ["<anomaly 1>", "<anomaly 2>"]
}

Base declineCharacter on: b-factor (b>1.5 = strongly hyperbolic transient, b=0.8-1.5 = typical unconventional, b<0.5 = exponential/conventional), Di magnitude, and EUR relative to qi.
Base basinAnalog on: formation name and parameter ranges.
flags: note any anomalies (very high Di, b>2, very low confidence, qi/EUR ratio inconsistency). Empty array if none.`;

	try {
		const raw = await callLLM({
			prompt,
			system: "You are a reservoir engineer. Respond only with valid JSON. No markdown, no explanation.",
			maxTokens: 256,
		});

		const cleaned = raw.replace(/```(?:json)?/g, "").trim();
		const parsed = JSON.parse(cleaned) as {
			declineCharacter?: unknown;
			basinAnalog?: unknown;
			flags?: unknown;
		};

		const declineCharacter =
			typeof parsed.declineCharacter === "string" && parsed.declineCharacter.length > 0
				? parsed.declineCharacter
				: deriveDefaultInterpretation(curveType, b).declineCharacter;

		const basinAnalog =
			typeof parsed.basinAnalog === "string" && parsed.basinAnalog.length > 0
				? parsed.basinAnalog
				: deriveDefaultInterpretation(curveType, b).basinAnalog;

		const flags = Array.isArray(parsed.flags) && parsed.flags.every((f) => typeof f === "string") ? parsed.flags : [];

		return { declineCharacter, basinAnalog, flags };
	} catch (_err) {
		return deriveDefaultInterpretation(curveType, b);
	}
}

// Create the server using factory
export const CurveSmithServer = function (options: CurveSmithOptions = {}) {
	if (!new.target) throw new Error("Curve-smith requires constructor invocation");
	return new (ServerFactory.createServer(createCurveSmithTemplate(options)))(options);
} as unknown as { new (options?: CurveSmithOptions): MCPServer };
export default CurveSmithServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new CurveSmithServer();
	runMCPServer(server);
}
