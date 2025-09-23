#!/usr/bin/env node

/**
 * Reporter MCP Server - DRY Refactored
 * Scriptor Reporticus Maximus - Master Report Generator
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import {
	ServerFactory,
	type ServerTemplate,
} from "../shared/server-factory.js";
import type {
	InvestmentCriteria,
	AnalysisInputs,
} from "../shared/types.js";

interface LocalInvestmentDecision {
	recommendation: "PROCEED" | "REJECT" | "DEFER";
	confidence: number;
	keyMetrics: {
		npv: number;
		irr: number;
		payback: number;
		netPay: number;
	};
	riskFactors: string[];
	nextSteps: string[];
}

interface LocalExecutiveReport {
	reportId: string;
	title: string;
	executiveSummary: string;
	keyFindings: string[];
	recommendation: LocalInvestmentDecision;
	appendices: string[];
}

const reporterTemplate: ServerTemplate = {
	name: "reporter",
	description: "Executive Reporting MCP Server",
	persona: {
		name: "Scriptor Reporticus Maximus",
		role: "Master Report Generator",
		expertise: [
			"Executive report writing and synthesis",
			"Investment decision frameworks",
			"Data visualization and presentation",
			"Risk communication and mitigation",
			"Strategic recommendation development",
		],
	},
	directories: ["reports", "decisions", "templates", "charts", "archives"],
	tools: [
		ServerFactory.createAnalysisTool(
			"generate_investment_decision",
			"Generate comprehensive investment decision from analysis results",
			z.object({
				tractName: z.string().describe("Investment tract name"),
				analysisResults: z.object({
					geological: z.any().optional(),
					economic: z.any().optional(),
					engineering: z.any().optional(),
					risk: z.any().optional(),
				}),
				decisionCriteria: z
					.object({
						minNPV: z.number().default(1000000),
						minIRR: z.number().default(0.15),
						maxPayback: z.number().default(24),
					})
					.optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const decision = generateInvestmentDecision(args);

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
			"create_executive_report",
			"Create comprehensive executive report",
			z.object({
				tractName: z.string(),
				decision: z.any(),
				reportType: z
					.enum(["executive", "technical", "board"])
					.default("executive"),
				includeCharts: z.boolean().default(true),
				includeAppendices: z.boolean().default(true),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const report = createExecutiveReport(args);

				if (args.outputPath) {
					const markdown = formatReportAsMarkdown(report);
					await fs.writeFile(args.outputPath, markdown);
				}

				return report;
			},
		),
		ServerFactory.createAnalysisTool(
			"synthesize_analysis",
			"Synthesize multiple domain expert analyses into unified insights",
			z.object({
				analyses: z.array(
					z.object({
						domain: z.string(),
						results: z.any(),
						confidence: z.number(),
					}),
				),
				synthesisType: z
					.enum(["summary", "detailed", "comparison"])
					.default("summary"),
			}),
			async (args) => {
				return synthesizeAnalysis(args.analyses);
			},
		),
	],
};

// Domain-specific reporting functions
function generateInvestmentDecision(args: {
	analysisResults: AnalysisInputs;
	decisionCriteria?: InvestmentCriteria;
}): LocalInvestmentDecision {
	const results = args.analysisResults;
	const criteria = args.decisionCriteria;

	const keyMetrics = {
		npv: results.economic?.npv || 0,
		irr: results.economic?.irr || 0,
		payback: results.economic?.paybackMonths || 0,
		netPay: results.geological?.confidenceLevel || 0,
	};

	let recommendation: "PROCEED" | "REJECT" | "DEFER" = "DEFER";
	let confidence = 75;

	if (
		keyMetrics.npv >= (criteria?.minNPV ?? 0) &&
		keyMetrics.irr >= (criteria?.minIRR ?? 0) &&
		keyMetrics.payback <= (criteria?.maxPayback ?? 999)
	) {
		recommendation = "PROCEED";
		confidence = 85;
	} else if (keyMetrics.npv < 0 || keyMetrics.irr < 0.1) {
		recommendation = "REJECT";
		confidence = 90;
	}

	const riskFactors = [];
	if (keyMetrics.payback > 18) riskFactors.push("Long payback period");
	if (keyMetrics.irr < 0.2) riskFactors.push("Moderate IRR");
	if (!results.geological) riskFactors.push("Limited geological data");

	const nextSteps = [];
	if (recommendation === "PROCEED") {
		nextSteps.push("Finalize drilling program", "Secure permits and approvals");
	} else if (recommendation === "DEFER") {
		nextSteps.push("Gather additional data", "Reassess market conditions");
	}

	return {
		recommendation,
		confidence,
		keyMetrics,
		riskFactors,
		nextSteps,
	};
}

function createExecutiveReport(args: {
	decision: LocalInvestmentDecision;
	tractName?: string;
	includeAppendices?: boolean;
}): LocalExecutiveReport {
	const decision = args.decision;

	return {
		reportId: `report_${Date.now()}`,
		title: `Investment Analysis: ${args.tractName || 'Unknown Tract'}`,
		executiveSummary: generateExecutiveSummary(args.tractName || "Unknown Tract", decision),
		keyFindings: generateKeyFindings(decision),
		recommendation: decision,
		appendices: args.includeAppendices
			? [
					"Geological Analysis Details",
					"Economic Model Assumptions",
					"Risk Assessment Matrix",
					"Competitive Analysis",
				]
			: [],
	};
}

function synthesizeAnalysis(analyses: AnalysisInputs[]): Record<string, unknown> {
	const overallConfidence = calculateOverallConfidence(analyses);
	const keyInsights = extractKeyInsights(analyses);
	const riskFactors = identifyRiskFactors(analyses);

	return {
		overallConfidence,
		keyInsights,
		riskFactors,
		recommendations: generateSynthesisRecommendations(overallConfidence),
		domainSummaries: analyses.map((analysis) => ({
			domain: 'analysis',
			confidence: analysis.economic?.confidence || analysis.geological?.confidenceLevel || 75,
			keyPoints: [
				`Confidence: ${analysis.economic?.confidence || analysis.geological?.confidenceLevel || 75}%`,
				"Analysis supports investment thesis",
			],
		})),
	};
}

function calculateOverallConfidence(analyses: AnalysisInputs[]): number {
	if (analyses.length === 0) return 0;
	const totalConfidence = analyses.reduce(
		(sum, analysis) => sum + (('confidence' in analysis && typeof analysis.confidence === 'number') ? analysis.confidence : 75),
		0,
	);
	return Math.round(totalConfidence / analyses.length);
}

function extractKeyInsights(analyses: AnalysisInputs[]): string[] {
	const insights = [];
	for (const analysis of analyses) {
		if ('geological' in analysis && analysis.geological) {
			insights.push(`Strong geological foundation with analysis results`);
		} else if ('economic' in analysis && analysis.economic) {
			insights.push(`Economic returns show positive indicators`);
		} else if ('engineering' in analysis && analysis.engineering) {
			insights.push(`Engineering analysis indicates development potential`);
		}
	}
	return insights;
}

function identifyRiskFactors(analyses: AnalysisInputs[]): string[] {
	const risks = [];
	for (const analysis of analyses) {
		if (analysis.risk) {
			risks.push(...analysis.risk.riskFactors.map(rf => rf.description));
		}
		if (analysis.geological?.investmentPerspective?.keyRisks) {
			risks.push(...analysis.geological.investmentPerspective.keyRisks);
		}
	}
	return risks;
}

function generateSynthesisRecommendations(avgConfidence: number): string[] {
	if (avgConfidence > 85) {
		return ["Proceed with development as planned"];
	} else if (avgConfidence > 75) {
		return ["Proceed with enhanced monitoring"];
	} else {
		return ["Consider additional data gathering"];
	}
}

function generateExecutiveSummary(tractName: string, decision: LocalInvestmentDecision): string {
	return `Investment analysis for ${tractName} indicates ${decision.recommendation} with ${decision.confidence}% confidence. Key economic metrics show NPV of $${(decision.keyMetrics.npv / 1000000).toFixed(1)}M and IRR of ${decision.keyMetrics.irr}%.`;
}

function generateKeyFindings(decision: LocalInvestmentDecision): string[] {
	return [
		`Economic analysis supports ${decision.recommendation} recommendation`,
		`Net pay of ${decision.keyMetrics.netPay} ft indicates reservoir potential`,
		`Payback period of ${decision.keyMetrics.payback} months within range`,
		`Risk factors include: ${decision.riskFactors.join(", ")}`,
	];
}

function formatReportAsMarkdown(report: LocalExecutiveReport): string {
	return `# ${report.title}

## Executive Summary
${report.executiveSummary}

## Key Findings
${report.keyFindings.map((finding) => `- ${finding}`).join("\n")}

## Recommendation
**${report.recommendation.recommendation}** - Confidence: ${report.recommendation.confidence}%

### Key Metrics
- NPV: $${(report.recommendation.keyMetrics.npv / 1000000).toFixed(1)}M
- IRR: ${report.recommendation.keyMetrics.irr}%
- Payback: ${report.recommendation.keyMetrics.payback} months
- Net Pay: ${report.recommendation.keyMetrics.netPay} ft

### Risk Factors
${report.recommendation.riskFactors.map((risk) => `- ${risk}`).join("\n")}

### Next Steps
${report.recommendation.nextSteps.map((step) => `- ${step}`).join("\n")}

---
*Generated by Shale Yeah 2025*`;
}

// Create the server using factory
export const ReporterServer = ServerFactory.createServer(reporterTemplate);
export default ReporterServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (ReporterServer as any)();
	runMCPServer(server);
}
