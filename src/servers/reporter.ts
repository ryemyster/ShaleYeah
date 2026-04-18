#!/usr/bin/env node

/**
 * Reporter MCP Server - DRY Refactored
 * Scriptor Reporticus Maximus - Master Report Generator
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate } from "../shared/server-factory.js";
import type { AnalysisInputs, InvestmentCriteria } from "../shared/types.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

/**
 * Count the number of words in an executive summary string.
 * Used by tests to verify summaries stay under 500 words.
 */
export function countWordsInSummary(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

/**
 * Rule-based executive summary fallback — used when the Anthropic API is
 * unavailable (demo mode, no API key, network error, etc.).
 *
 * Must include actual numbers from the input so tests can verify
 * the output isn't just a hardcoded template string.
 */
export function deriveDefaultExecutiveSummary(params: {
	tractName: string;
	recommendation: "PROCEED" | "REJECT" | "DEFER";
	npv: number | undefined;
	irr: number | undefined;
	paybackMonths: number | undefined;
	confidence: number;
}): string {
	const { tractName, recommendation, npv, irr, paybackMonths, confidence } = params;
	const npvM = npv !== undefined ? (npv / 1_000_000).toFixed(1) : "N/A";
	const irrPct = irr !== undefined ? (irr * 100).toFixed(1) : "N/A";

	const actionMap: Record<string, string> = {
		PROCEED: "supports proceeding with development",
		REJECT: "does not support investment at this time",
		DEFER: "warrants additional data gathering before commitment",
	};
	const action = actionMap[recommendation] ?? "requires further review";

	return (
		`Investment analysis for ${tractName} ${action}. ` +
		`Recommendation: ${recommendation} (${confidence}% confidence). ` +
		`Key metrics: NPV $${npvM}M, IRR ${irrPct}%, payback ${paybackMonths !== undefined ? `${paybackMonths} months` : "N/A"}. ` +
		`This assessment is based on all available domain expert inputs including geological, ` +
		`economic, decline curve, and risk analysis results.`
	);
}

// ---------------------------------------------------------------------------
// LLM synthesis
// ---------------------------------------------------------------------------

/**
 * Ask Claude (Scriptor Reporticus Maximus) to write an investment-grade
 * executive summary from the key metrics and upstream analysis results.
 *
 * Returns a plain-English summary under 500 words. Falls back to
 * deriveDefaultExecutiveSummary() if the API is unavailable.
 */
async function synthesizeReportWithLLM(params: {
	tractName: string;
	recommendation: "PROCEED" | "REJECT" | "DEFER";
	npv: number | undefined;
	irr: number | undefined;
	paybackMonths: number | undefined;
	confidence: number;
	riskFactors: string[];
	nextSteps: string[];
	keyFindings: string[];
}): Promise<string> {
	const { tractName, recommendation, npv, irr, paybackMonths, confidence, riskFactors, nextSteps, keyFindings } =
		params;

	const npvM = npv !== undefined ? (npv / 1_000_000).toFixed(2) : "N/A";
	const irrPct = irr !== undefined ? (irr * 100).toFixed(1) : "N/A";

	const prompt = `You are Scriptor Reporticus Maximus, a master oil & gas investment report writer.

Write a professional executive summary for the following investment analysis. The summary must:
- Be under 500 words
- Read like a real analyst report — use specific numbers, domain vocabulary, coherent narrative
- Lead with the recommendation and confidence level
- Include a brief financial case (NPV, IRR, payback)
- Mention the top 2-3 risk factors
- Close with recommended next steps

INVESTMENT DATA:
Tract: ${tractName}
Recommendation: ${recommendation} (confidence: ${confidence}%)
NPV: $${npvM}M
IRR: ${irrPct}%
Payback: ${paybackMonths !== undefined ? `${paybackMonths} months` : "N/A"}
Key findings: ${keyFindings.slice(0, 3).join("; ")}
Top risks: ${riskFactors.slice(0, 3).join("; ")}
Next steps: ${nextSteps.slice(0, 3).join("; ")}

Return ONLY the executive summary text. No JSON, no headers, no preamble.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 600 });
		const summary = raw.trim();

		// Sanity check — must be non-empty and mention the tract name or recommendation
		if (summary.length > 50 && (summary.includes(tractName) || summary.includes(recommendation))) {
			return summary;
		}

		// Response came back but failed basic validation — use fallback
		return deriveDefaultExecutiveSummary({ tractName, recommendation, npv, irr, paybackMonths, confidence });
	} catch (_err) {
		// API unavailable (no key, network down, etc.) — fall back to rule-based summary
		// so demo mode and CI still produce a usable report.
		return deriveDefaultExecutiveSummary({ tractName, recommendation, npv, irr, paybackMonths, confidence });
	}
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

interface LocalInvestmentDecision {
	recommendation: "PROCEED" | "REJECT" | "DEFER";
	confidence: number;
	keyMetrics: {
		npv: number | undefined;
		irr: number | undefined;
		payback: number | undefined;
		netPay: number | undefined;
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
					await fs.writeFile(args.outputPath, JSON.stringify(decision, null, 2));
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
				reportType: z.enum(["executive", "technical", "board"]).default("executive"),
				includeCharts: z.boolean().default(true),
				includeAppendices: z.boolean().default(true),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const report = createExecutiveReport(args);

				// Replace the template-generated executive summary with an LLM-authored
				// analyst narrative that includes real numbers and domain vocabulary.
				// Falls back to the rule-based summary if the API is unavailable.
				const d = report.recommendation;
				report.executiveSummary = await synthesizeReportWithLLM({
					tractName: args.tractName,
					recommendation: d.recommendation,
					npv: d.keyMetrics.npv,
					irr: d.keyMetrics.irr,
					paybackMonths: d.keyMetrics.payback,
					confidence: d.confidence,
					riskFactors: d.riskFactors,
					nextSteps: d.nextSteps,
					keyFindings: report.keyFindings,
				});

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
				synthesisType: z.enum(["summary", "detailed", "comparison"]).default("summary"),
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

	// Use explicit undefined checks — missing economic data is absent, not zero.
	// A missing NPV of 0 would look like a failed investment and skew the recommendation.
	const keyMetrics = {
		npv: results.economic?.npv ?? undefined,
		irr: results.economic?.irr ?? undefined,
		payback: results.economic?.paybackMonths ?? undefined,
		netPay: results.geological?.confidenceLevel ?? undefined,
	};

	let recommendation: "PROCEED" | "REJECT" | "DEFER" = "DEFER";
	let confidence = 75;

	// Missing economic fields produce DEFER — unknown data should not force a PROCEED or REJECT.
	if (
		keyMetrics.npv !== undefined &&
		keyMetrics.irr !== undefined &&
		keyMetrics.payback !== undefined &&
		keyMetrics.npv >= (criteria?.minNPV ?? 0) &&
		keyMetrics.irr >= (criteria?.minIRR ?? 0) &&
		keyMetrics.payback <= (criteria?.maxPayback ?? 999)
	) {
		recommendation = "PROCEED";
		confidence = 85;
	} else if (
		keyMetrics.npv !== undefined &&
		keyMetrics.irr !== undefined &&
		(keyMetrics.npv < 0 || keyMetrics.irr < 0.1)
	) {
		recommendation = "REJECT";
		confidence = 90;
	}

	const riskFactors = [];
	if (keyMetrics.payback !== undefined && keyMetrics.payback > 18) riskFactors.push("Long payback period");
	if (keyMetrics.irr !== undefined && keyMetrics.irr < 0.2) riskFactors.push("Moderate IRR");
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
		title: `Investment Analysis: ${args.tractName || "Unknown Tract"}`,
		executiveSummary: generateExecutiveSummary(args.tractName || "Unknown Tract", decision),
		keyFindings: generateKeyFindings(decision),
		recommendation: decision,
		appendices: args.includeAppendices
			? ["Geological Analysis Details", "Economic Model Assumptions", "Risk Assessment Matrix", "Competitive Analysis"]
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
			domain: "analysis",
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
		(sum, analysis) =>
			sum + ("confidence" in analysis && typeof analysis.confidence === "number" ? analysis.confidence : 75),
		0,
	);
	return Math.round(totalConfidence / analyses.length);
}

function extractKeyInsights(analyses: AnalysisInputs[]): string[] {
	const insights = [];
	for (const analysis of analyses) {
		if ("geological" in analysis && analysis.geological) {
			insights.push(`Strong geological foundation with analysis results`);
		} else if ("economic" in analysis && analysis.economic) {
			insights.push(`Economic returns show positive indicators`);
		} else if ("engineering" in analysis && analysis.engineering) {
			insights.push(`Engineering analysis indicates development potential`);
		}
	}
	return insights;
}

function identifyRiskFactors(analyses: AnalysisInputs[]): string[] {
	const risks = [];
	for (const analysis of analyses) {
		if (analysis.risk) {
			risks.push(...analysis.risk.riskFactors.map((rf) => rf.description));
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
	const npvStr = decision.keyMetrics.npv !== undefined ? `$${(decision.keyMetrics.npv / 1000000).toFixed(1)}M` : "N/A";
	const irrStr = decision.keyMetrics.irr !== undefined ? `${decision.keyMetrics.irr}%` : "N/A";
	return `Investment analysis for ${tractName} indicates ${decision.recommendation} with ${decision.confidence}% confidence. Key economic metrics show NPV of ${npvStr} and IRR of ${irrStr}.`;
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
- NPV: ${report.recommendation.keyMetrics.npv !== undefined ? `$${(report.recommendation.keyMetrics.npv / 1000000).toFixed(1)}M` : "N/A"}
- IRR: ${report.recommendation.keyMetrics.irr !== undefined ? `${report.recommendation.keyMetrics.irr}%` : "N/A"}
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
	const server = new ReporterServer();
	runMCPServer(server);
}
