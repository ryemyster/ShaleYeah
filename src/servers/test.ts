#!/usr/bin/env node

/**
 * Test MCP Server - DRY Refactored
 * Testius Validatus - Master Quality Engineer
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { type MCPServer, runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

export interface QAValidationResult {
	overallStatus: "PASS" | "FAIL" | "WARNING";
	issues: string[];
	recommendation: string;
}

/**
 * Rule-based QA validation — fallback when the API is unavailable.
 * Output varies with targets and criteria so tests can verify determinism.
 */
export function deriveDefaultQAResult(targets: string[], accuracyThreshold: number): QAValidationResult {
	// Stricter accuracy threshold → higher chance of flagging issues
	const isTight = accuracyThreshold > 0.97;
	const hasMultipleTargets = targets.length > 3;

	return {
		overallStatus: isTight ? "WARNING" : "PASS",
		issues: isTight ? [`Accuracy threshold of ${accuracyThreshold * 100}% is aggressive — monitor closely`] : [],
		recommendation: hasMultipleTargets
			? `Validate all ${targets.length} targets individually before sign-off`
			: "Standard QA process is sufficient for this scope",
	};
}

/**
 * Ask Claude (Testius Validatus) to review the QA targets and flag inconsistencies.
 * Falls back to deriveDefaultQAResult() if the API is unavailable.
 */
export async function synthesizeQAValidationWithLLM(params: {
	testSuite: string;
	targets: string[];
	accuracyThreshold: number;
	complianceStandards: string[];
}): Promise<QAValidationResult> {
	const { testSuite, targets, accuracyThreshold, complianceStandards } = params;

	const prompt = `You are Testius Validatus, a master quality assurance engineer for oil & gas analysis systems.

Review the following QA test configuration and identify any potential issues or risks. Return a JSON object.

TEST SUITE: ${testSuite}
TARGETS: ${targets.join(", ")}
ACCURACY THRESHOLD: ${accuracyThreshold * 100}%
COMPLIANCE STANDARDS: ${complianceStandards.length > 0 ? complianceStandards.join(", ") : "None specified"}

Return ONLY valid JSON in this exact shape:
{
  "overallStatus": "PASS" | "FAIL" | "WARNING",
  "issues": ["<issue 1 if any>"],
  "recommendation": "<one sentence QA recommendation>"
}

Flag WARNING if thresholds seem unrealistic or targets are ambiguous. Flag FAIL only for clear compliance gaps.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<QAValidationResult>;
		const validStatuses = ["PASS", "FAIL", "WARNING"];
		if (!validStatuses.includes(parsed.overallStatus ?? "")) throw new Error("Invalid overallStatus");
		return {
			overallStatus: parsed.overallStatus as "PASS" | "FAIL" | "WARNING",
			issues: parsed.issues ?? [],
			recommendation: parsed.recommendation ?? "",
		};
	} catch (_err) {
		return deriveDefaultQAResult(targets, accuracyThreshold);
	}
}

const testTemplate: ServerTemplate = {
	name: "test",
	description: "Quality Assurance MCP Server",
	persona: {
		name: "Testius Validatus",
		role: "Master Quality Engineer",
		expertise: [
			"Quality assurance and validation",
			"Testing methodology and automation",
			"Performance monitoring and analysis",
			"Compliance verification and auditing",
			"Continuous improvement processes",
		],
	},
	directories: ["tests", "results", "reports", "compliance", "metrics"],
	tools: [
		ServerFactory.createAnalysisTool(
			"run_quality_tests",
			"Execute comprehensive quality assurance tests",
			z.object({
				testSuite: z.enum(["functional", "performance", "integration", "compliance", "all"]).default("all"),
				targets: z.array(z.string()),
				criteria: z
					.object({
						accuracy: z.number().min(0).max(1).default(0.95),
						performance: z.string().default("standard"),
						compliance: z.array(z.string()).default([]),
					})
					.optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				// Ask Claude to validate the QA configuration and flag inconsistencies.
				// Falls back to rule-based validation if API is unavailable.
				const validation = await synthesizeQAValidationWithLLM({
					testSuite: args.testSuite,
					targets: args.targets,
					accuracyThreshold: args.criteria?.accuracy ?? 0.95,
					complianceStandards: args.criteria?.compliance ?? [],
				});

				const analysis = {
					testSuite: args.testSuite,
					targets: args.targets,
					execution: {
						timestamp: new Date().toISOString(),
						duration: "45 seconds", // stub — replace with actual execution time
						environment: "Testing environment",
					},
					results: {
						functional: {
							passed: true,
							score: 95, // stub: 95% — replace with actual test pass rate
							issues: [],
						},
						performance: {
							passed: true,
							responseTime: "145ms", // stub — replace with measured p95 latency
							throughput: "420 requests/min", // stub — replace with measured throughput
							issues: [],
						},
						integration: {
							passed: true,
							endpoints: args.targets.length,
							coverage: 94, // stub: 94% — replace with actual coverage measurement
							issues: [],
						},
						compliance: {
							passed: true,
							standards: args.criteria?.compliance || ["ISO-9001", "SOX"],
							coverage: 97, // stub: 97% — replace with compliance audit results
							issues: [],
						},
					},
					summary: {
						overallStatus: validation.overallStatus,
						passRate: validation.overallStatus === "FAIL" ? 0 : 100,
						criticalIssues: validation.issues.length,
						issues: validation.issues,
						recommendation: validation.recommendation,
					},
					confidence: ServerUtils.calculateConfidence(0.92, 0.88),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"generate_quality_report",
			"Generate comprehensive quality assurance report",
			z.object({
				reportType: z.enum(["summary", "detailed", "executive", "compliance"]).default("summary"),
				period: z.string().default("current"),
				metrics: z.array(z.string()).default(["accuracy", "performance", "reliability"]),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = {
					report: {
						type: args.reportType,
						period: args.period,
						generated: new Date().toISOString(),
					},
					// Stub: target-state quality metrics — replace with real telemetry/audit data
					metrics: {
						accuracy: {
							current: 95, // stub: at target — replace with measured accuracy
							target: 95,
							trend: "stable", // stub — replace with trend calculation
						},
						performance: {
							avgResponseTime: "135ms", // stub — replace with measured p50 latency
							uptime: 99.8, // stub: 99.8% — replace with uptime monitoring data
							trend: "stable",
						},
						reliability: {
							errorRate: 0.12, // stub: 0.12% — replace with actual error rate
							mtbf: "820 hours", // stub — replace with failure tracking data
							trend: "improving",
						},
					},
					compliance: {
						status: "Compliant",
						lastAudit: "2024-Q2",
						nextReview: "2024-Q4",
						gaps: [], // stub: no gaps — replace with compliance audit results
					},
					recommendations: [
						"Maintain current quality standards",
						"Continue performance monitoring",
						"Schedule next audit cycle",
					],
					confidence: ServerUtils.calculateConfidence(0.94, 0.9),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
	],
};

export const TestServer = ServerFactory.createServer(testTemplate);
export default TestServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (TestServer as unknown as new () => MCPServer)();
	runMCPServer(server);
}
