#!/usr/bin/env node

/**
 * Decision MCP Server - DRY Refactored
 * Augustus Decidius Maximus - Supreme Investment Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import {
	ServerFactory,
	type ServerTemplate,
} from "../shared/server-factory.js";
import type {
	AnalysisInputs,
	InvestmentCriteria,
	PortfolioAsset,
} from "../shared/types.js";

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
					geological: z.any().optional(),
					economic: z.any().optional(),
					engineering: z.any().optional(),
					risk: z.any().optional(),
					legal: z.any().optional(),
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
				const decision = evaluateInvestmentOpportunity(args);

				if (args.outputPath) {
					await fs.writeFile(
						args.outputPath,
						JSON.stringify(decision, null, 2),
					);
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
				strategy: z
					.enum(["AGGRESSIVE", "CONSERVATIVE", "OPPORTUNISTIC"])
					.default("CONSERVATIVE"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const strategy = developBidStrategy(args);

				if (args.outputPath) {
					await fs.writeFile(
						args.outputPath,
						JSON.stringify(strategy, null, 2),
					);
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

// Domain-specific investment decision functions
function evaluateInvestmentOpportunity(args: {
	analysisInputs: AnalysisInputs;
	investmentCriteria?: InvestmentCriteria;
}): InvestmentDecision {
	const inputs = args.analysisInputs;
	const criteria = args.investmentCriteria;

	// Extract key metrics
	const npv = inputs.economic?.npv || 0;
	const irr = inputs.economic?.irr || 0;
	const payback = inputs.economic?.paybackMonths || 999;
	const riskScore = inputs.risk?.overallRisk || 0.5;

	// Decision logic
	let decision: "INVEST" | "PASS" | "CONDITIONAL" = "PASS";
	let confidence = 75;
	const reasoning: string[] = [];
	const riskFactors: string[] = [];
	const upside: string[] = [];
	const conditions: string[] = [];

	// Evaluate against criteria
	if (
		npv >= (criteria?.minNPV ?? 0) &&
		irr >= (criteria?.minIRR ?? 0) &&
		payback <= (criteria?.maxPayback ?? 999)
	) {
		if (riskScore <= (criteria?.maxRisk ?? 1)) {
			decision = "INVEST";
			confidence = 85;
			reasoning.push(
				`Strong economics: NPV $${(npv / 1000000).toFixed(1)}M, IRR ${(irr * 100).toFixed(1)}%`,
			);
			reasoning.push(
				`Acceptable risk profile: ${(riskScore * 100).toFixed(1)}% risk score`,
			);
		} else {
			decision = "CONDITIONAL";
			confidence = 70;
			reasoning.push("Economics meet thresholds but risk is elevated");
			conditions.push("Additional risk mitigation required");
			conditions.push("Enhanced monitoring and contingency planning");
		}
	} else {
		decision = "PASS";
		confidence = 80;
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
	if (riskScore > 0.6) riskFactors.push("Elevated overall risk score");
	if (payback > 18) riskFactors.push("Extended payback period");
	if (!inputs.geological) riskFactors.push("Limited geological data available");

	// Identify upside potential
	if (irr > 0.25)
		upside.push("Strong IRR indicates significant upside potential");
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
		(inputs.economic as { p10: number }).p10 > npv * 1.5
	)
		upside.push("Significant upside in P10 scenario");

	return {
		decision,
		confidence,
		recommendedBid: calculateRecommendedBid(npv, decision),
		maxBid: calculateMaxBid(npv, decision),
		reasoning,
		riskFactors,
		upside,
		conditions: conditions.length > 0 ? conditions : undefined,
		timeline: determineTimeline(decision, riskScore),
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

function assessPortfolioFit(args: {
	opportunity: PortfolioAsset;
	currentPortfolio?: PortfolioAsset[];
}): PortfolioFit {
	const opportunity = args.opportunity;
	const portfolio = args.currentPortfolio || [];

	// Calculate diversification score
	const formations = portfolio.map((p: PortfolioAsset) => p.formation);
	const locations = portfolio.map((p: PortfolioAsset) => p.location);

	const formationDiversity = !formations.includes(opportunity.formation)
		? 20
		: 0;
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
			synergies.push(
				`Operational synergies with existing ${asset.location} operations`,
			);
		}
		if (asset.formation === opportunity.formation) {
			synergies.push(
				`Technical expertise transfer from ${asset.formation} experience`,
			);
		}
	});

	const totalScore =
		formationDiversity + locationDiversity + strategicScore + 30; // Base score

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
function calculateRecommendedBid(npv: number, decision: string): number {
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
	return riskScore > 0.6
		? "45-60 days with enhanced due diligence"
		: "30-45 days standard timeline";
}

function generateBidReasoning(
	valuation: { npv: number; irr: number },
	strategy: string,
	multiplier: number,
): string {
	return `${strategy} strategy applies ${(multiplier * 100).toFixed(0)}% of NPV ($${(valuation.npv / 1000000).toFixed(1)}M) with IRR of ${(valuation.irr * 100).toFixed(1)}%`;
}

function generatePortfolioRecommendation(
	score: number,
	strategic: boolean,
): string {
	if (score >= 80)
		return "Strong fit - high recommendation for portfolio inclusion";
	if (score >= 60)
		return "Good fit - recommend inclusion with standard evaluation";
	if (strategic)
		return "Strategic value despite lower fit score - consider for inclusion";
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
