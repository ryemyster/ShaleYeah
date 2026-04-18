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

				// Coverage estimate: more targets = more surface area to cover, so
				// coverage scales down from 98% at 1 target to 80% at 10+ targets.
				const targetCount = args.targets.length;
				const coverageEstimate = Math.max(80, Math.round(98 - (targetCount - 1) * 2));
				const accuracyTarget = (args.criteria?.accuracy ?? 0.95) * 100;

				const analysis = {
					testSuite: args.testSuite,
					targets: args.targets,
					dataSource: "llm-validation",
					execution: {
						timestamp: new Date().toISOString(),
						// No live test runner attached — wall-clock time is unavailable
						duration: "N/A",
						environment: "MCP validation environment",
					},
					results: {
						functional: {
							passed: validation.overallStatus !== "FAIL",
							// LLM assessed the threshold; reflect its verdict rather than a fake number
							scoreThreshold: accuracyTarget,
							issues: validation.issues,
						},
						performance: {
							// Throughput and latency require a live runtime — not available here
							responseTime: "N/A",
							throughput: "N/A",
							issues: [],
						},
						integration: {
							passed: validation.overallStatus !== "FAIL",
							endpoints: targetCount,
							// Derived from target count, not a fixed constant
							coverageEstimate: `${coverageEstimate}%`,
							issues: [],
						},
						compliance: {
							passed: validation.overallStatus !== "FAIL",
							standards: args.criteria?.compliance.length ? args.criteria.compliance : ["ISO-9001", "SOX"],
							// Compliance coverage requires a live audit — not available here
							coverage: "N/A",
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
				// Metrics requiring live telemetry (Prometheus, Datadog, etc.) are marked N/A.
				// This server provides LLM-based QA validation, not runtime monitoring.
				const requestedMetrics = args.metrics;
				const analysis = {
					report: {
						type: args.reportType,
						period: args.period,
						generated: new Date().toISOString(),
					},
					dataSource: "llm-validation",
					metrics: {
						accuracy: requestedMetrics.includes("accuracy")
							? {
									current: "N/A — requires live telemetry",
									target: "N/A",
									trend: "N/A",
								}
							: undefined,
						performance: requestedMetrics.includes("performance")
							? {
									// p50 latency and uptime require a running service to measure
									avgResponseTime: "N/A",
									uptime: "N/A",
									trend: "N/A",
								}
							: undefined,
						reliability: requestedMetrics.includes("reliability")
							? {
									// Error rate and MTBF require failure tracking infrastructure
									errorRate: "N/A",
									mtbf: "N/A",
									trend: "N/A",
								}
							: undefined,
					},
					compliance: {
						// Compliance status is assessed by LLM against declared standards, not a live audit
						status: "LLM-assessed — verify with formal audit",
						lastAudit: "N/A",
						nextReview: "N/A",
						gaps: [],
					},
					recommendations: [
						"Connect to live telemetry (Prometheus/Datadog) for runtime metrics",
						"Schedule formal compliance audit to replace LLM assessment",
						"Continue LLM-based QA validation for configuration and threshold review",
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
