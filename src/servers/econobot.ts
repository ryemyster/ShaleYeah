#!/usr/bin/env node

/**
 * Econobot MCP Server - DRY Refactored
 * Caesar Augustus Economicus - Master Financial Strategist
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as ExcelJS from "exceljs";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { type MCPServer, runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

interface EconomicAnalysis {
	npv: number;
	irr: number;
	paybackMonths: number;
	roiMultiple: number;
	breakeven: {
		oilPrice: number;
		gasPrice: number;
	};
	confidence: number;
	recommendation: string;
}

const econobotTemplate: ServerTemplate = {
	name: "econobot",
	description: "Economic Analysis MCP Server",
	persona: {
		name: "Caesar Augustus Economicus",
		role: "Master Financial Strategist",
		expertise: [
			"DCF analysis and financial modeling",
			"NPV and IRR calculations",
			"Sensitivity and risk analysis",
			"Investment decision frameworks",
			"Economic data processing and validation",
		],
	},
	directories: ["analyses", "models", "sensitivity", "reports", "forecasts"],
	tools: [
		ServerFactory.createAnalysisTool(
			"analyze_economics",
			"Analyze economic data with DCF modeling",
			z.object({
				filePath: z.string().describe("Path to economic data file"),
				dataType: z.enum(["pricing", "costs", "production", "mixed"]),
				discountRate: z.number().min(0).max(1).default(0.1),
				analysisType: z.enum(["basic", "standard", "comprehensive"]).default("standard"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = await performEconomicAnalysis(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"calculate_dcf",
			"Calculate NPV and IRR from cash flows",
			z.object({
				cashFlows: z.array(z.number()).describe("Cash flows by period"),
				discountRate: z.number().min(0).max(1),
				periods: z.array(z.string()).optional(),
				currency: z.string().default("USD"),
			}),
			async (args) => {
				const npv = calculateNPV(args.cashFlows, args.discountRate);
				const irr = calculateIRR(args.cashFlows);
				const paybackPeriod = calculatePaybackPeriod(args.cashFlows);

				return {
					npv,
					irr,
					paybackPeriod,
					cashFlows: args.cashFlows,
					periods: args.periods || args.cashFlows.map((_: number, i: number) => `Period ${i}`),
				};
			},
		),
		ServerFactory.createAnalysisTool(
			"sensitivity_analysis",
			"Perform sensitivity analysis on key variables",
			z.object({
				baseCase: z.object({
					oilPrice: z.number(),
					gasPrice: z.number(),
					production: z.array(z.number()),
					costs: z.object({
						drilling: z.number(),
						completion: z.number(),
						operating: z.number(),
					}),
				}),
				ranges: z.object({
					oilPriceVariance: z.number().min(0).max(1).default(0.2),
					gasPriceVariance: z.number().min(0).max(1).default(0.3),
					productionVariance: z.number().min(0).max(1).default(0.15),
				}),
				scenarios: z.number().min(10).max(1000).default(100),
			}),
			async (args) => {
				return performSensitivityAnalysis(args);
			},
		),
	],
};

// Domain-specific economic analysis functions
async function performEconomicAnalysis(args: { filePath: string }): Promise<EconomicAnalysis> {
	try {
		const fileExt = path.extname(args.filePath).toLowerCase();
		let economicData: Record<string, unknown>;

		if (fileExt === ".xlsx" || fileExt === ".xls") {
			economicData = await processExcelFile(args.filePath);
		} else if (fileExt === ".csv") {
			economicData = await processCsvFile(args.filePath);
		} else {
			throw new Error(`Unsupported file type: ${fileExt}`);
		}

		return await analyzeEconomicData(economicData, args);
	} catch (_error) {
		// Return default analysis if file processing fails
		return generateDefaultAnalysis();
	}
}

async function processExcelFile(filePath: string): Promise<Record<string, unknown>> {
	try {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		const sheets: Record<string, unknown[]> = {};

		workbook.eachSheet((worksheet) => {
			const jsonData: any[][] = [];

			worksheet.eachRow((row, _rowNumber) => {
				const rowData: any[] = [];
				row.eachCell({ includeEmpty: true }, (cell) => {
					rowData.push(cell.value);
				});
				jsonData.push(rowData);
			});

			if (jsonData.length > 0) {
				const headers = jsonData[0] as string[];
				const rows = jsonData.slice(1).map((row: any) => {
					const obj: any = {};
					headers.forEach((header, index) => {
						obj[header] = row[index] || "";
					});
					return obj;
				});
				sheets[worksheet.name] = rows;
			}
		});

		return { source: "excel", sheets };
	} catch (error) {
		return { source: "excel", sheets: {}, error: String(error) };
	}
}

async function processCsvFile(filePath: string): Promise<any> {
	try {
		const csvContent = await fs.readFile(filePath, "utf8");
		const data = parseCsvContent(csvContent);
		return { source: "csv", data };
	} catch (error) {
		return { source: "csv", data: [], error: String(error) };
	}
}

function parseCsvContent(csvContent: string): any[] {
	const lines = csvContent.trim().split("\n");
	if (lines.length === 0) return [];

	const headers = lines[0].split(",").map((h) => h.trim());
	return lines.slice(1).map((line) => {
		const values = line.split(",").map((v) => v.trim());
		const obj: any = {};
		headers.forEach((header, index) => {
			const value = values[index] || "";
			const numValue = parseFloat(value);
			obj[header] = Number.isNaN(numValue) ? value : numValue;
		});
		return obj;
	});
}

async function analyzeEconomicData(data: any, args: any): Promise<EconomicAnalysis> {
	try {
		let pricingData: any[] = [];
		let costData: any[] = [];
		let productionData: any[] = [];

		if (data.source === "excel" && data.sheets) {
			const sheetNames = Object.keys(data.sheets);
			for (const sheetName of sheetNames) {
				if (sheetName.toLowerCase().includes("pric")) {
					pricingData = data.sheets[sheetName];
				} else if (sheetName.toLowerCase().includes("cost")) {
					costData = data.sheets[sheetName];
				} else if (sheetName.toLowerCase().includes("prod")) {
					productionData = data.sheets[sheetName];
				}
			}
		} else if (data.source === "csv") {
			const headers = data.data.length > 0 ? Object.keys(data.data[0]) : [];
			if (headers.some((h) => h.toLowerCase().includes("price"))) {
				pricingData = data.data;
			} else if (headers.some((h) => h.toLowerCase().includes("cost"))) {
				costData = data.data;
			} else {
				productionData = data.data;
			}
		}

		const { npv, irr, payback } = calculateDCFMetrics(pricingData, costData, productionData, args.discountRate);
		const breakeven = calculateBreakeven(costData, pricingData);
		const confidence = assessDataQuality(pricingData, costData, productionData);

		const roundedNpv = Math.round(npv);
		const roundedIrr = Math.round(irr * 10000) / 10000; // as decimal for LLM
		const roundedPayback = Math.round(payback);
		const roiMultiple = Math.round((npv / 1000000 + 1) * 100) / 100;

		const llmResult = await synthesizeRecommendationWithLLM({
			npv: roundedNpv,
			irr: roundedIrr,
			paybackMonths: roundedPayback,
			roiMultiple,
			oilBreakeven: breakeven.oil,
			gasBreakeven: breakeven.gas,
			confidence,
		});

		return {
			npv: roundedNpv,
			irr: Math.round(roundedIrr * 10000) / 100, // as percentage for output
			paybackMonths: roundedPayback,
			roiMultiple,
			breakeven: {
				oilPrice: breakeven.oil,
				gasPrice: breakeven.gas,
			},
			confidence,
			recommendation: llmResult.recommendation,
		};
	} catch (_error) {
		return generateDefaultAnalysis();
	}
}

function calculateDCFMetrics(
	pricing: any[],
	costs: any[],
	production: any[],
	discountRate: number,
): { npv: number; irr: number; payback: number } {
	const avgOilPrice = extractAverage(pricing, ["oil_price", "oil", "brent", "wti"]) || 75;
	const _avgGasPrice = extractAverage(pricing, ["gas_price", "gas", "henry_hub"]) || 3.5;
	const avgOpex = extractAverage(costs, ["opex", "operating_cost", "cost"]) || 25;
	const avgProduction = extractAverage(production, ["production", "volume", "rate"]) || 500;

	const years = 10;
	let npv = 0;
	let paybackYears = years;
	const initialInvestment = 5000000; // $5M typical well cost

	for (let year = 1; year <= years; year++) {
		const yearlyProduction = avgProduction * 0.85 ** (year - 1);
		const revenue = yearlyProduction * avgOilPrice * 365;
		const operatingCosts = yearlyProduction * avgOpex * 365;
		const netCashFlow = revenue - operatingCosts;
		const discountedCashFlow = netCashFlow / (1 + discountRate) ** year;

		npv += discountedCashFlow;

		if (npv >= initialInvestment && paybackYears === years) {
			paybackYears = year;
		}
	}

	npv -= initialInvestment;
	const totalCashFlow = npv + initialInvestment;
	const irr = (totalCashFlow / initialInvestment) ** (1 / years) - 1;

	return {
		npv,
		irr: Math.max(0, Math.min(irr, 1)),
		payback: paybackYears * 12,
	};
}

function calculateBreakeven(costs: any[], pricing: any[]): { oil: number; gas: number } {
	const avgOpex = extractAverage(costs, ["opex", "operating_cost", "cost"]) || 25;
	const avgGasPrice = extractAverage(pricing, ["gas_price", "gas", "henry_hub"]) || 3.5;

	return {
		oil: Math.round(avgOpex * 1.2 * 100) / 100,
		gas: Math.round(avgGasPrice * 0.8 * 100) / 100,
	};
}

function extractAverage(data: any[], fieldNames: string[]): number | null {
	if (!data || data.length === 0) return null;

	for (const fieldName of fieldNames) {
		const values = data
			.map((row) => {
				const value = row[fieldName] || row[fieldName.toUpperCase()] || row[fieldName.toLowerCase()];
				return typeof value === "number" ? value : parseFloat(value);
			})
			.filter((v) => !Number.isNaN(v));

		if (values.length > 0) {
			return values.reduce((sum, v) => sum + v, 0) / values.length;
		}
	}

	return null;
}

function assessDataQuality(pricing: any[], costs: any[], production: any[]): number {
	let score = 50;
	if (pricing.length > 0) score += 15;
	if (costs.length > 0) score += 15;
	if (production.length > 0) score += 15;
	if (pricing.length > 5) score += 5;
	if (costs.length > 5) score += 5;
	if (production.length > 5) score += 5;
	return Math.min(95, score);
}

function deriveRecommendation(npv: number, irr: number, confidence: number): string {
	if (npv > 1000000 && irr > 0.15 && confidence > 80) {
		return "PROCEED";
	} else if (npv > 0 && irr > 0.1 && confidence > 70) {
		return "CONDITIONAL";
	} else {
		return "DECLINE";
	}
}

interface LLMEconomicResult {
	recommendation: string;
	rationale: string;
}

/**
 * Synthesize investment recommendation via LLM using computed DCF metrics.
 * Falls back to rule-based recommendation when LLM is unavailable (demo mode, no API key).
 */
async function synthesizeRecommendationWithLLM(context: {
	npv: number;
	irr: number;
	paybackMonths: number;
	roiMultiple: number;
	oilBreakeven: number;
	gasBreakeven: number;
	confidence: number;
}): Promise<LLMEconomicResult> {
	const { npv, irr, paybackMonths, roiMultiple, oilBreakeven, gasBreakeven, confidence } = context;

	const prompt = `You are Caesar Augustus Economicus, a master petroleum financial strategist.

Evaluate this oil & gas investment opportunity:
- NPV (10% discount): $${npv.toLocaleString()}
- IRR: ${(irr * 100).toFixed(1)}%
- Payback period: ${paybackMonths} months
- ROI multiple: ${roiMultiple.toFixed(2)}x
- Oil breakeven: $${oilBreakeven.toFixed(2)}/bbl
- Gas breakeven: $${gasBreakeven.toFixed(2)}/mcf
- Data quality confidence: ${confidence}%

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "recommendation": "<PROCEED|CONDITIONAL|DECLINE>",
  "rationale": "<one sentence explaining the decision>"
}

Decision criteria:
- PROCEED: NPV > $1M AND IRR > 15% AND confidence > 80%
- CONDITIONAL: NPV > 0 AND IRR > 10% AND confidence > 70%
- DECLINE: otherwise`;

	try {
		const raw = await callLLM({
			prompt,
			system: "You are a petroleum economist. Respond only with valid JSON. No markdown, no explanation.",
			maxTokens: 256,
		});

		const cleaned = raw.replace(/```(?:json)?/g, "").trim();
		const parsed = JSON.parse(cleaned) as { recommendation?: unknown; rationale?: unknown };

		const validRecs = ["PROCEED", "CONDITIONAL", "DECLINE"];
		const recommendation =
			typeof parsed.recommendation === "string" && validRecs.includes(parsed.recommendation)
				? parsed.recommendation
				: deriveRecommendation(npv, irr, confidence);

		const rationale =
			typeof parsed.rationale === "string" && parsed.rationale.length > 0
				? parsed.rationale
				: `Based on NPV $${npv.toLocaleString()} and IRR ${(irr * 100).toFixed(1)}%`;

		return { recommendation, rationale };
	} catch (_err) {
		// LLM unavailable — fall back to rule-based decision
		return {
			recommendation: deriveRecommendation(npv, irr, confidence),
			rationale: `Based on NPV $${npv.toLocaleString()} and IRR ${(irr * 100).toFixed(1)}%`,
		};
	}
}

async function generateDefaultAnalysis(): Promise<EconomicAnalysis> {
	// No real data available — use LLM with mid-range defaults to produce a reasoned recommendation
	const npv = 0;
	const irr = 0;
	const paybackMonths = 0;
	const roiMultiple = 1.0;
	const oilBreakeven = 55.0;
	const gasBreakeven = 3.25;
	const confidence = ServerUtils.calculateConfidence(0.6, 0.8);

	const llmResult = await synthesizeRecommendationWithLLM({
		npv,
		irr,
		paybackMonths,
		roiMultiple,
		oilBreakeven,
		gasBreakeven,
		confidence,
	});

	return {
		npv,
		irr,
		paybackMonths,
		roiMultiple,
		breakeven: { oilPrice: oilBreakeven, gasPrice: gasBreakeven },
		confidence,
		recommendation: llmResult.recommendation,
	};
}

function calculateNPV(cashFlows: number[], discountRate: number): number {
	return cashFlows.reduce((npv, cashFlow, period) => {
		return npv + cashFlow / (1 + discountRate) ** period;
	}, 0);
}

function calculateIRR(cashFlows: number[]): number {
	let rate = 0.1;
	let increment = 0.01;

	for (let i = 0; i < 1000; i++) {
		const npv = calculateNPV(cashFlows, rate);
		if (Math.abs(npv) < 1) break;

		if (npv > 0) {
			rate += increment;
		} else {
			rate -= increment;
			increment /= 2;
		}
	}

	return Math.round(rate * 10000) / 100;
}

function calculatePaybackPeriod(cashFlows: number[]): number {
	let cumulative = 0;
	for (let i = 0; i < cashFlows.length; i++) {
		cumulative += cashFlows[i];
		if (cumulative >= 0) return i;
	}
	return cashFlows.length;
}

function performSensitivityAnalysis(args: any): any {
	const baseCase = args.baseCase;
	const scenarios = generateScenarios(baseCase, args.ranges, args.scenarios);

	const npvs = scenarios.map(
		(s: { oilPrice: number; gasPrice: number }) =>
			s.oilPrice * 100000 - baseCase.costs.drilling - baseCase.costs.completion,
	);
	const irrs = scenarios.map((s: { oilPrice: number; gasPrice: number }) =>
		Math.max(0, Math.min(0.5, (s.oilPrice - 45) / 100)),
	);

	return {
		baseCase,
		scenarios: scenarios.slice(0, 10),
		statistics: {
			npv: {
				mean: npvs.reduce((a, b) => a + b) / npvs.length,
				p10: percentile(npvs, 0.1),
				p90: percentile(npvs, 0.9),
			},
			irr: {
				mean: irrs.reduce((a, b) => a + b) / irrs.length,
				p10: percentile(irrs, 0.1),
				p90: percentile(irrs, 0.9),
			},
		},
	};
}

function generateScenarios(baseCase: any, ranges: any, count: number): any[] {
	const scenarios = [];

	for (let i = 0; i < count; i++) {
		const scenario = { ...baseCase };
		// Deterministic variation: evenly spaced across the variance range
		const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 to +1
		scenario.oilPrice = baseCase.oilPrice * (1 + t * ranges.oilPriceVariance);
		scenario.gasPrice = baseCase.gasPrice * (1 + t * ranges.gasPriceVariance);

		scenarios.push(scenario);
	}

	return scenarios;
}

function percentile(arr: number[], p: number): number {
	const sorted = arr.sort((a, b) => a - b);
	const index = p * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const weight = index % 1;

	return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Create the server using factory
export const EconobotServer = ServerFactory.createServer(econobotTemplate);
export default EconobotServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (EconobotServer as unknown as new () => MCPServer)();
	runMCPServer(server);
}
