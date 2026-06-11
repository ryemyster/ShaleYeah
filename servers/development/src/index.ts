#!/usr/bin/env node
/**
 * Development MCP Server — Architectus Developmentus, Master Development Strategist.
 * Thin facade — all domain logic lives in src/tools/.
 */

import fs from "node:fs/promises";
import { runMCPServer, ServerFactory, type ServerTemplate, ServerUtils } from "@shaleyeah/sdk";
import { z } from "zod";

import { deriveDefaultDevelopmentOutlook, synthesizeDevelopmentOutlookWithLLM } from "./tools/planning.js";
import { deriveDevelopmentPhases, synthesizeDevelopmentPhasesWithLLM } from "./tools/phases.js";
import { deriveProgressReport } from "./tools/monitoring.js";

// ---------------------------------------------------------------------------
// Backward-compat exports — existing tests import these from ../src/index.js
// ---------------------------------------------------------------------------

export { deriveDefaultDevelopmentOutlook };
export type { DevelopmentOutlook } from "./tools/planning.js";
export type { DevelopmentPhase, PhaseSchedule } from "./tools/phases.js";
export type { DevelopmentProgress } from "./tools/monitoring.js";

export { deriveDefaultDevelopmentOutlook as synthesizeDevelopmentAnalysisWithLLM };
export { deriveDevelopmentPhases, synthesizeDevelopmentPhasesWithLLM };
export { deriveProgressReport };
export { synthesizeDevelopmentOutlookWithLLM };

// ---------------------------------------------------------------------------
// Server template
// ---------------------------------------------------------------------------

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
				const budget = args.constraints?.budget ?? 50_000_000;
				const technicalConstraints = args.constraints?.technical ?? [];

				const [schedule, outlook] = await Promise.all([
					synthesizeDevelopmentPhasesWithLLM({
						projectName: args.project.name,
						wellCount: args.project.wellCount,
						budget,
						constraints: technicalConstraints,
					}),
					synthesizeDevelopmentOutlookWithLLM({
						projectName: args.project.name,
						wellCount: args.project.wellCount,
						budget,
						technicalConstraints,
						totalDuration: `${Math.min(4, Math.ceil(args.project.wellCount / 10)) * 8} months`,
					}),
				]);

				const analysis = {
					project: args.project,
					outlook,
					development: {
						strategy: schedule.strategy,
						phases: schedule.phases,
						schedule: {
							totalDuration: schedule.totalDuration,
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
			"estimate_project_timeline",
			"Estimate phased development timeline and milestones for a well program",
			z.object({
				projectName: z.string(),
				wellCount: z.number().int().positive(),
				budget: z.number().positive(),
				constraints: z.array(z.string()).default([]),
			}),
			async (args) => {
				const schedule = await synthesizeDevelopmentPhasesWithLLM({
					projectName: args.projectName,
					wellCount: args.wellCount,
					budget: args.budget,
					constraints: args.constraints,
				});
				return { ...schedule, confidence: ServerUtils.calculateConfidence(0.87, 0.9) };
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
				const progress = deriveProgressReport(args.projectId, args.reportingPeriod);
				const result = { ...progress, confidence: ServerUtils.calculateConfidence(0.9, 0.85) };

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
				}

				return result;
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
