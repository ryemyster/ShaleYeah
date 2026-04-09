#!/usr/bin/env node
/**
 * Development MCP Server - DRY Refactored
 * Architectus Developmentus - Master Development Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

export interface DevelopmentOutlook {
	scheduleRisk: string;
	budgetRisk: string;
	criticalPath: string[];
	recommendation: string;
}

/**
 * Rule-based development outlook — fallback when the API is unavailable.
 * Output varies with well count, budget, and constraints so tests confirm determinism.
 */
export function deriveDefaultDevelopmentOutlook(
	wellCount: number,
	budget: number,
	technicalConstraints: string[],
): DevelopmentOutlook {
	const isLarge = wellCount > 20;
	const isTightBudget = budget < wellCount * 2_000_000; // less than $2M per well
	const hasConstraints = technicalConstraints.length > 0;

	return {
		scheduleRisk: isLarge ? "Medium" : "Low",
		budgetRisk: isTightBudget ? "High" : hasConstraints ? "Medium" : "Low",
		criticalPath: [
			"Environmental approvals",
			"Drilling permits",
			isLarge ? "Phased rig mobilization" : "Equipment procurement",
		],
		recommendation: `${isLarge ? "Phased development recommended" : "Single-phase feasible"}. ${isTightBudget ? "Budget is tight — monitor AFE variance closely." : "Budget appears adequate for scope."}`,
	};
}

/**
 * Ask Claude (Architectus Developmentus) to assess schedule and budget risks.
 * Falls back to deriveDefaultDevelopmentOutlook() if the API is unavailable.
 */
export async function synthesizeDevelopmentAnalysisWithLLM(params: {
	projectName: string;
	wellCount: number;
	budget: number;
	technicalConstraints: string[];
	totalDuration: string;
}): Promise<DevelopmentOutlook> {
	const { projectName, wellCount, budget, technicalConstraints, totalDuration } = params;

	const prompt = `You are Architectus Developmentus, a master oil & gas development strategist.

Assess the schedule and budget risks for this development project. Return a JSON object.

PROJECT:
Name: ${projectName}
Well count: ${wellCount}
Total budget: $${(budget / 1_000_000).toFixed(1)}M
Total duration: ${totalDuration}
Technical constraints: ${technicalConstraints.length > 0 ? technicalConstraints.join(", ") : "None specified"}

Return ONLY valid JSON in this exact shape:
{
  "scheduleRisk": "High" | "Medium" | "Low",
  "budgetRisk": "High" | "Medium" | "Low",
  "criticalPath": ["<milestone 1>", "<milestone 2>", "<milestone 3>"],
  "recommendation": "<one sentence development strategy recommendation>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<DevelopmentOutlook>;
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.scheduleRisk ?? "") || !validRisks.includes(parsed.budgetRisk ?? ""))
			throw new Error("Invalid risk level");
		return {
			scheduleRisk: parsed.scheduleRisk as string,
			budgetRisk: parsed.budgetRisk as string,
			criticalPath: parsed.criticalPath ?? [],
			recommendation: parsed.recommendation ?? "",
		};
	} catch (_err) {
		return deriveDefaultDevelopmentOutlook(wellCount, budget, technicalConstraints);
	}
}

const developmentTemplate: ServerTemplate = {
	name: "development",
	description: "Development Planning MCP Server",
	persona: {
		name: "Architectus Developmentus",
		role: "Master Development Strategist",
		expertise: [
			"Development planning and optimization",
			"Resource allocation and scheduling",
			"Project management and coordination",
			"Technology integration and innovation",
			"Performance monitoring and improvement",
		],
	},
	directories: ["plans", "schedules", "resources", "monitoring", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"create_development_plan",
			"Create comprehensive development plan for oil & gas project",
			z.object({
				project: z.object({
					name: z.string(),
					location: z.string(),
					reserves: z.number(),
					wellCount: z.number(),
				}),
				timeline: z.string().optional(),
				constraints: z
					.object({
						budget: z.number().optional(),
						environmental: z.array(z.string()).optional(),
						technical: z.array(z.string()).optional(),
					})
					.optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const phaseCount = Math.min(4, Math.ceil(args.project.wellCount / 10));
				const wellsPerPhase = Math.ceil(args.project.wellCount / phaseCount);
				const budget = args.constraints?.budget ?? 50_000_000;
				const technicalConstraints = args.constraints?.technical ?? [];
				const totalDuration = `${phaseCount * 8} months`;

				// Ask Claude to assess schedule and budget risks for this project.
				// Falls back to rule-based outlook if API is unavailable.
				const outlook = await synthesizeDevelopmentAnalysisWithLLM({
					projectName: args.project.name,
					wellCount: args.project.wellCount,
					budget,
					technicalConstraints,
					totalDuration,
				});

				const analysis = {
					project: args.project,
					outlook,
					development: {
						strategy: args.project.wellCount > 20 ? "Phased development" : "Single phase",
						phases: Array.from({ length: phaseCount }, (_, i) => ({
							phase: i + 1,
							wells: Math.min(wellsPerPhase, args.project.wellCount - i * wellsPerPhase),
							duration: `${6 + i * 2} months`,
							investment: Math.round(budget / phaseCount),
							keyMilestones: [
								"Permitting and approvals",
								"Site preparation",
								"Drilling operations",
								"Completion and testing",
								"Production startup",
							],
						})),
						schedule: {
							totalDuration,
							criticalPath: outlook.criticalPath,
							riskFactors:
								technicalConstraints.length > 0 ? technicalConstraints : ["Weather delays", "Equipment availability"],
						},
					},
					resources: {
						personnel: {
							management: Math.ceil(args.project.wellCount / 20),
							engineering: Math.ceil(args.project.wellCount / 10),
							operations: Math.ceil(args.project.wellCount / 5),
						},
						equipment: {
							rigs: Math.min(3, Math.ceil(args.project.wellCount / 15)),
							completionUnits: Math.ceil(args.project.wellCount / 25),
							supportEquipment: "Standard oilfield equipment package",
						},
						infrastructure: {
							access: "New roads and pads required",
							utilities: "Power and water distribution",
							facilities: "Central battery and gathering system",
						},
					},
					economics: {
						capex: Math.round(budget * 1.1),
						timeToPayback: "18-24 months",
						peakProduction: Math.round(args.project.reserves * 0.15),
						plantLife: "25-30 years",
					},
					confidence: ServerUtils.calculateConfidence(0.85, 0.88),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"monitor_development_progress",
			"Monitor and analyze development project progress",
			z.object({
				projectId: z.string(),
				metrics: z.array(z.string()).default(["schedule", "budget", "safety", "quality"]),
				reportingPeriod: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = {
					project: args.projectId,
					period: args.reportingPeriod,
					performance: {
						// Stub: representative healthy project — replace with real project management data
						schedule: {
							status: "On track", // stub — replace with project schedule data
							variance: 3, // stub: 3 days ahead — replace with actual vs planned dates
							criticalIssues: [], // stub — replace with open issue tracking
						},
						budget: {
							status: "Within budget", // stub — replace with AFE tracking data
							variance: 2, // stub: 2% under — replace with actual vs AFE
							majorVariances: [], // stub — replace with variance analysis
						},
						safety: {
							incidents: 0, // stub: zero incidents — replace with safety management system
							daysWithoutIncident: 45, // stub: 45 days — replace with actual safety log
							complianceStatus: "Full compliance",
						},
						quality: {
							wellSuccess: 92, // stub: 92% — replace with actual well completion results
							reworkRequired: 0, // stub — replace with QC tracking data
							standards: "Meeting all specifications",
						},
					},
					recommendations: [
						"Continue current operational approach",
						"Monitor weather conditions closely",
						"Maintain safety protocols",
					],
					confidence: ServerUtils.calculateConfidence(0.9, 0.85),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
	],
};

export const DevelopmentServer = ServerFactory.createServer(developmentTemplate);
export default DevelopmentServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new DevelopmentServer();
	runMCPServer(server);
}
