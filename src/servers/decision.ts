#!/usr/bin/env node

/**
 * Decision MCP Server - DRY Refactored
 * Augustus Decidius Maximus - Supreme Investment Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate } from "../shared/server-factory.js";
import type { AnalysisInputs, InvestmentCriteria, PortfolioAsset } from "../shared/types.js";

// The shape Claude returns when it synthesizes all upstream data into a decision
interface LLMDecisionInterpretation {
	// Claude's final verdict — may upgrade or downgrade the rule-based preliminary call
	verdict: "INVEST" | "PASS" | "CONDITIONAL";
	// The single most critical risk Claude identified across all domain inputs
	biggestRisk: string;
	// The single most compelling upside Claude identified
	biggestUpside: string;
	// 2-3 sentence plain-English rationale for an investment memo
	rationale: string;
}

interface InvestmentDecision {
	decision: "INVEST" | "PASS" | "CONDITIONAL";
	confidence: number;
	recommendedBid: number;
	maxBid: number;
	reasoning: string[];
	riskFactors: string[];
	upside: string[];
	conditions?: string[];
	timeline: string;
	// LLM-generated interpretation, present when Claude was available
	interpretation?: LLMDecisionInterpretation;
}

interface BidStrategy {
	recommendedBid: number;
	maxBid: number;
	bidIncrement: number;
	strategy: "AGGRESSIVE" | "CONSERVATIVE" | "OPPORTUNISTIC";
	reasoning: string;
}

interface PortfolioFit {
	score: number;
	strategic: boolean;
	diversification: number;
	synergies: string[];
	conflicts: string[];
	recommendation: string;
}

const decisionTemplate: ServerTemplate = {
	name: "decision",
	description: "Investment Decision MCP Server",
	persona: {
		name: "Augustus Decidius Maximus",
		role: "Supreme Investment Strategist",
		expertise: [
			"Final investment decision logic",
			"Strategic bid recommendations",
			"Portfolio optimization and fit analysis",
			"Risk-adjusted return evaluation",
			"Market timing and competitive positioning",
		],
	},
	directories: ["decisions", "bids", "portfolio", "strategies", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"make_investment_decision",
			"Make final investment decision based on all analysis inputs",
			z.object({
				analysisInputs: z.object({
					geological: z.object({ confidence: z.number().optional() }).passthrough().optional(),
					economic: z
						.object({ npv: z.number().optional(), irr: z.number().optional(), paybackMonths: z.number().optional() })
						.passthrough()
						.optional(),
					engineering: z.object({}).passthrough().optional(),
					risk: z.object({ overallRisk: z.number().optional() }).passthrough().optional(),
					legal: z.object({}).passthrough().optional(),
				}),
				investmentCriteria: z
					.object({
						minNPV: z.number().default(1000000),
						minIRR: z.number().default(0.15),
						maxPayback: z.number().default(24),
						maxRisk: z.number().default(0.7),
					})
					.optional(),
				marketConditions: z
					.object({
						oilPrice: z.number().optional(),
						gasPrice: z.number().optional(),
						competitiveActivity: z.string().optional(),
					})
					.optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const decision = await evaluateInvestmentOpportunity(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(decision, null, 2));
				}

				return decision;
			},
		),
		ServerFactory.createAnalysisTool(
			"calculate_bid_strategy",
			"Calculate optimal bidding strategy for lease acquisition",
			z.object({
				valuation: z.object({
					npv: z.number(),
					irr: z.number(),
					p10: z.number().optional(),
					p50: z.number().optional(),
					p90: z.number().optional(),
				}),
				marketData: z
					.object({
						recentSales: z.array(z.number()).optional(),
						competitorActivity: z.string().optional(),
						acreageAvailability: z.string().optional(),
					})
					.optional(),
				strategy: z.enum(["AGGRESSIVE", "CONSERVATIVE", "OPPORTUNISTIC"]).default("CONSERVATIVE"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const strategy = developBidStrategy(args);

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(strategy, null, 2));
				}

				return strategy;
			},
		),
		ServerFactory.createAnalysisTool(
			"analyze_portfolio_fit",
			"Analyze how opportunity fits within existing portfolio",
			z.object({
				opportunity: z.object({
					location: z.string(),
					formation: z.string(),
					acreage: z.number(),
					expectedReturns: z.object({
						npv: z.number(),
						irr: z.number(),
					}),
				}),
				currentPortfolio: z
					.array(
						z.object({
							name: z.string(),
							location: z.string(),
							formation: z.string(),
							status: z.string(),
						}),
					)
					.optional(),
				portfolioStrategy: z
					.object({
						diversificationTargets: z.array(z.string()).optional(),
						riskTolerance: z.number().optional(),
						growthTargets: z
							.object({
								production: z.number().optional(),
								reserves: z.number().optional(),
							})
							.optional(),
					})
					.optional(),
			}),
			async (args) => {
				return assessPortfolioFit(args);
			},
		),
	],
};

// Counts how many upstream domain results were actually provided.
// More complete input → higher confidence in the final decision.
// Checks the four domains available on AnalysisInputs: geological, economic, curve, and risk.
// Exported so tests can verify confidence scaling directly.
export function countDomainsPresent(inputs: AnalysisInputs): number {
	return [inputs.geological, inputs.economic, inputs.curve, inputs.risk].filter(Boolean).length;
}

// Rule-based fallback when Claude is unavailable (no API key, network down, etc.).
// Returns a structured interpretation derived purely from the rule-based scoring above.
function deriveDefaultDecisionInterpretation(
	decision: "INVEST" | "PASS" | "CONDITIONAL",
	reasoning: string[],
	riskFactors: string[],
	upside: string[],
): LLMDecisionInterpretation {
	return {
		verdict: decision,
		biggestRisk: riskFactors[0] ?? "No major risks identified",
		biggestUpside: upside[0] ?? "Standard return potential",
		rationale: reasoning[0] ?? "Decision based on quantitative threshold analysis.",
	};
}

// Sends all upstream analysis numbers to Claude and asks for a structured verdict.
// Falls back to deriveDefaultDecisionInterpretation if the API is unavailable.
async function synthesizeDecisionWithLLM(params: {
	analysisInputs: AnalysisInputs;
	investmentCriteria?: InvestmentCriteria;
	marketConditions?: { oilPrice?: number; gasPrice?: number; competitiveActivity?: string };
	ruleBasedDecision: "INVEST" | "PASS" | "CONDITIONAL";
	reasoning: string[];
	riskFactors: string[];
	upside: string[];
}): Promise<LLMDecisionInterpretation> {
	const {
		analysisInputs: inputs,
		investmentCriteria: criteria,
		marketConditions: market,
		ruleBasedDecision,
		reasoning,
		riskFactors,
		upside,
	} = params;

	const npv = inputs.economic?.npv ?? 0;
	const irr = inputs.economic?.irr ?? 0;
	const payback = inputs.economic?.paybackMonths ?? 0;
	const riskScore = inputs.risk?.overallRisk ?? 0;
	const geoConfidence = (inputs.geological as { confidence?: number } | undefined)?.confidence ?? 0;

	// Build a prompt that gives Augustus all the numbers — he must cite them, not speak generically
	const prompt = `You are Augustus Decidius Maximus, Supreme Investment Strategist for oil and gas.

Upstream analysis results:
- NPV: $${(npv / 1_000_000).toFixed(2)}M
- IRR: ${(irr * 100).toFixed(1)}%
- Payback: ${payback} months
- Overall risk score: ${(riskScore * 100).toFixed(1)}%
- Geological confidence: ${(geoConfidence * 100).toFixed(1)}%${market?.oilPrice !== undefined ? `\n- Oil price: $${market.oilPrice}/bbl` : ""}${market?.gasPrice !== undefined ? `\n- Gas price: $${market.gasPrice}/MMBtu` : ""}${market?.competitiveActivity !== undefined ? `\n- Market: ${market.competitiveActivity}` : ""}

Investment criteria thresholds:
- Min NPV: $${((criteria?.minNPV ?? 1_000_000) / 1_000_000).toFixed(1)}M
- Min IRR: ${((criteria?.minIRR ?? 0.15) * 100).toFixed(0)}%
- Max payback: ${criteria?.maxPayback ?? 24} months
- Max risk: ${((criteria?.maxRisk ?? 0.7) * 100).toFixed(0)}%

Rule-based preliminary verdict: ${ruleBasedDecision}
Rule-based reasoning: ${reasoning.join("; ")}
Risk factors: ${riskFactors.join("; ") || "none"}
Upside factors: ${upside.join("; ") || "none"}

Weigh all domain inputs. Cite specific numbers, not generic language. You may upgrade or downgrade the preliminary verdict if the full picture warrants it.
Return ONLY valid JSON with this exact structure:
{
  "verdict": "INVEST" | "PASS" | "CONDITIONAL",
  "biggestRisk": "<single most critical risk factor in one sentence>",
  "biggestUpside": "<single most compelling upside in one sentence>",
  "rationale": "<2-3 sentence plain-English rationale for an investment memo>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in LLM response");
		const parsed = JSON.parse(match[0]) as LLMDecisionInterpretation;
		if (!["INVEST", "PASS", "CONDITIONAL"].includes(parsed.verdict) || typeof parsed.rationale !== "string") {
			throw new Error("Invalid LLM response shape");
		}
		return parsed;
	} catch {
		// If the LLM is unavailable (no API key, network down, etc.),
		// fall back to the rule-based interpretation so the server still
		// returns something useful instead of crashing.
		return deriveDefaultDecisionInterpretation(ruleBasedDecision, reasoning, riskFactors, upside);
	}
}

// Domain-specific investment decision functions
async function evaluateInvestmentOpportunity(args: {
	analysisInputs: AnalysisInputs;
	investmentCriteria?: InvestmentCriteria;
	marketConditions?: { oilPrice?: number; gasPrice?: number; competitiveActivity?: string };
}): Promise<InvestmentDecision> {
	const inputs = args.analysisInputs;
	const criteria = args.investmentCriteria;

	// Extract key metrics with explicit undefined checks.
	// The old ?.field || 0 pattern silently defaulted to 0 when upstream data was missing —
	// a missing NPV of 0 would look like a failed investment and produce a PASS decision,
	// masking the fact that econobot never ran. With explicit undefined checks, absent data
	// produces a CONDITIONAL decision and surfaces the gap in the reasoning strings.
	const npv = inputs.economic?.npv ?? undefined;
	const irr = inputs.economic?.irr ?? undefined;
	const payback = inputs.economic?.paybackMonths ?? undefined;
	const riskScore = inputs.risk?.overallRisk ?? undefined;

	// Decision logic
	let decision: "INVEST" | "PASS" | "CONDITIONAL" = "PASS";
	const reasoning: string[] = [];
	const riskFactors: string[] = [];
	const upside: string[] = [];
	const conditions: string[] = [];

	// When core economic fields are absent, surface that gap explicitly rather than
	// silently treating missing data as zeros. A missing NPV is not a zero NPV.
	if (npv === undefined || irr === undefined) {
		decision = "CONDITIONAL";
		reasoning.push("Incomplete economic data — cannot make a definitive investment decision");
		if (npv === undefined) riskFactors.push("NPV not provided — econobot analysis may be missing");
		if (irr === undefined) riskFactors.push("IRR not provided — econobot analysis may be missing");
	} else if (
		npv >= (criteria?.minNPV ?? 0) &&
		irr >= (criteria?.minIRR ?? 0) &&
		(payback ?? 0) <= (criteria?.maxPayback ?? 999)
	) {
		if ((riskScore ?? 0.5) <= (criteria?.maxRisk ?? 1)) {
			decision = "INVEST";
			reasoning.push(`Strong economics: NPV $${(npv / 1000000).toFixed(1)}M, IRR ${(irr * 100).toFixed(1)}%`);
			reasoning.push(`Acceptable risk profile: ${((riskScore ?? 0.5) * 100).toFixed(1)}% risk score`);
		} else {
			decision = "CONDITIONAL";
			reasoning.push("Economics meet thresholds but risk is elevated");
			conditions.push("Additional risk mitigation required");
			conditions.push("Enhanced monitoring and contingency planning");
		}
	} else {
		decision = "PASS";
		reasoning.push("Economics do not meet minimum investment criteria");
		if (npv < (criteria?.minNPV ?? 0))
			reasoning.push(
				`NPV below threshold: $${(npv / 1000000).toFixed(1)}M < $${((criteria?.minNPV ?? 0) / 1000000).toFixed(1)}M`,
			);
		if (irr < (criteria?.minIRR ?? 0))
			reasoning.push(
				`IRR below threshold: ${(irr * 100).toFixed(1)}% < ${((criteria?.minIRR ?? 0) * 100).toFixed(1)}%`,
			);
	}

	// Identify risk factors
	if ((riskScore ?? 0) > 0.6) riskFactors.push("Elevated overall risk score");
	if ((payback ?? 0) > 18) riskFactors.push("Extended payback period");
	if (!inputs.geological) riskFactors.push("Limited geological data available");

	// Identify upside potential
	if ((irr ?? 0) > 0.25) upside.push("Strong IRR indicates significant upside potential");
	if (
		inputs.geological &&
		"confidence" in inputs.geological &&
		(inputs.geological as { confidence: number }).confidence > 85
	)
		upside.push("High geological confidence supports upside case");
	if (
		inputs.economic &&
		"p10" in inputs.economic &&
		(inputs.economic as { p10: number }).p10 &&
		npv !== undefined &&
		(inputs.economic as { p10: number }).p10 > npv * 1.5
	)
		upside.push("Significant upside in P10 scenario");

	// Confidence scales with how many upstream domains provided data.
	// A decision with all 4 core domains is much more trustworthy than one with only 1.
	const domainsPresent = countDomainsPresent(inputs);
	const confidence = Math.min(100, 50 + domainsPresent * 10);

	// Call Claude to synthesize all domain data into a plain-English verdict.
	// Falls back to rule-based defaults if the API is unavailable.
	const interpretation = await synthesizeDecisionWithLLM({
		analysisInputs: inputs,
		investmentCriteria: criteria,
		marketConditions: args.marketConditions,
		ruleBasedDecision: decision,
		reasoning,
		riskFactors,
		upside,
	});

	return {
		decision: interpretation.verdict,
		confidence,
		recommendedBid: calculateRecommendedBid(npv ?? 0, interpretation.verdict),
		maxBid: calculateMaxBid(npv ?? 0, interpretation.verdict),
		reasoning,
		riskFactors,
		upside,
		conditions: conditions.length > 0 ? conditions : undefined,
		timeline: determineTimeline(interpretation.verdict, riskScore ?? 0.5),
		interpretation,
	};
}

function developBidStrategy(args: {
	valuation: { npv: number; irr: number };
	strategy: "AGGRESSIVE" | "CONSERVATIVE" | "OPPORTUNISTIC";
}): BidStrategy {
	const valuation = args.valuation;
	const strategy = args.strategy;

	let bidMultiplier = 0.7; // Conservative starting point
	let maxMultiplier = 0.85;

	switch (strategy) {
		case "AGGRESSIVE":
			bidMultiplier = 0.85;
			maxMultiplier = 0.95;
			break;
		case "OPPORTUNISTIC":
			bidMultiplier = 0.6;
			maxMultiplier = 0.8;
			break;
		default:
			bidMultiplier = 0.7;
			maxMultiplier = 0.85;
			break;
	}

	const recommendedBid = valuation.npv * bidMultiplier;
	const maxBid = valuation.npv * maxMultiplier;

	return {
		recommendedBid: Math.round(recommendedBid),
		maxBid: Math.round(maxBid),
		bidIncrement: Math.round(recommendedBid * 0.05), // 5% increments
		strategy,
		reasoning: generateBidReasoning(valuation, strategy, bidMultiplier),
	};
}

function assessPortfolioFit(args: { opportunity: PortfolioAsset; currentPortfolio?: PortfolioAsset[] }): PortfolioFit {
	const opportunity = args.opportunity;
	const portfolio = args.currentPortfolio || [];

	// Calculate diversification score
	const formations = portfolio.map((p: PortfolioAsset) => p.formation);
	const locations = portfolio.map((p: PortfolioAsset) => p.location);

	const formationDiversity = !formations.includes(opportunity.formation) ? 20 : 0;
	const locationDiversity = !locations.includes(opportunity.location) ? 20 : 0;

	// Calculate strategic value
	const strategic =
		opportunity.expectedReturns &&
		typeof opportunity.expectedReturns === "object" &&
		"irr" in opportunity.expectedReturns &&
		typeof (opportunity.expectedReturns as { irr: number }).irr === "number"
			? (opportunity.expectedReturns as { irr: number }).irr > 0.2
			: false;
	const strategicScore = strategic ? 30 : 10;

	// Synergies and conflicts
	const synergies: string[] = [];
	const conflicts: string[] = [];

	portfolio.forEach((asset: PortfolioAsset) => {
		if (asset.location === opportunity.location) {
			synergies.push(`Operational synergies with existing ${asset.location} operations`);
		}
		if (asset.formation === opportunity.formation) {
			synergies.push(`Technical expertise transfer from ${asset.formation} experience`);
		}
	});

	const totalScore = formationDiversity + locationDiversity + strategicScore + 30; // Base score

	return {
		score: Math.min(totalScore, 100),
		strategic,
		diversification: (formationDiversity + locationDiversity) / 40,
		synergies,
		conflicts,
		recommendation: generatePortfolioRecommendation(totalScore, strategic),
	};
}

// Helper functions
// Exported for testing — verifies that INVEST produces a non-zero bid while PASS returns 0
export function calculateRecommendedBid(npv: number, decision: string): number {
	if (decision === "PASS") return 0;
	return Math.round(npv * 0.7); // Conservative 70% of NPV
}

function calculateMaxBid(npv: number, decision: string): number {
	if (decision === "PASS") return 0;
	return Math.round(npv * 0.85); // Maximum 85% of NPV
}

function determineTimeline(decision: string, riskScore: number): string {
	if (decision === "PASS") return "No timeline - opportunity declined";
	if (decision === "CONDITIONAL") return "60-90 days pending risk mitigation";
	return riskScore > 0.6 ? "45-60 days with enhanced due diligence" : "30-45 days standard timeline";
}

function generateBidReasoning(valuation: { npv: number; irr: number }, strategy: string, multiplier: number): string {
	return `${strategy} strategy applies ${(multiplier * 100).toFixed(0)}% of NPV ($${(valuation.npv / 1000000).toFixed(1)}M) with IRR of ${(valuation.irr * 100).toFixed(1)}%`;
}

function generatePortfolioRecommendation(score: number, strategic: boolean): string {
	if (score >= 80) return "Strong fit - high recommendation for portfolio inclusion";
	if (score >= 60) return "Good fit - recommend inclusion with standard evaluation";
	if (strategic) return "Strategic value despite lower fit score - consider for inclusion";
	return "Limited portfolio fit - requires exceptional economics to justify";
}

// Create the server using factory
export const DecisionServer = ServerFactory.createServer(decisionTemplate);
export default DecisionServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new DecisionServer();
	runMCPServer(server);
}
