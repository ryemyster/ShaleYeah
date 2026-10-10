#!/usr/bin/env node
/**
 * Development MCP Server — Architectus Developmentus, Master Development Strategist.
 * Thin facade — all domain logic lives in src/tools/.
 */

import fs from "node:fs/promises";
import { normalizeIdentifier, runMCPServer, ServerFactory, type ServerTemplate, ServerUtils } from "@shaleyeah/sdk";
import { z } from "zod";
import { deriveProgressReport } from "./tools/monitoring.js";
import { deriveDevelopmentPhases, synthesizeDevelopmentPhasesWithLLM } from "./tools/phases.js";
import { deriveDefaultDevelopmentOutlook, synthesizeDevelopmentOutlookWithLLM } from "./tools/planning.js";

// ---------------------------------------------------------------------------
// Backward-compat exports — existing tests import these from ../src/index.js
// ---------------------------------------------------------------------------

export type { DevelopmentProgress } from "./tools/monitoring.js";
export type { DevelopmentPhase, PhaseSchedule } from "./tools/phases.js";
export type { DevelopmentOutlook } from "./tools/planning.js";
export {
	deriveDefaultDevelopmentOutlook,
	deriveDefaultDevelopmentOutlook as synthesizeDevelopmentAnalysisWithLLM,
	deriveDevelopmentPhases,
	deriveProgressReport,
	synthesizeDevelopmentOutlookWithLLM,
	synthesizeDevelopmentPhasesWithLLM,
};

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
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawName = args.project.name;
				const rawLocation = args.project.location;
				const normalizedName = normalizeIdentifier(rawName);
				const normalizedLocation = normalizeIdentifier(rawLocation);
				const identifiersChanged = normalizedName !== rawName || normalizedLocation !== rawLocation;
				const matchInfo = identifiersChanged
					? { matchedAs: { name: normalizedName, location: normalizedLocation }, matchScore: 1.0 }
					: {};
				const normalizedProject = { ...args.project, name: normalizedName, location: normalizedLocation };
				const budget = args.constraints?.budget ?? 50_000_000;
				const technicalConstraints = args.constraints?.technical ?? [];

				const [schedule, outlook] = await Promise.all([
					synthesizeDevelopmentPhasesWithLLM({
						projectName: normalizedProject.name,
						wellCount: normalizedProject.wellCount,
						budget,
						constraints: technicalConstraints,
					}),
					synthesizeDevelopmentOutlookWithLLM({
						projectName: normalizedProject.name,
						wellCount: normalizedProject.wellCount,
						budget,
						technicalConstraints,
						totalDuration: `${Math.min(4, Math.ceil(normalizedProject.wellCount / 10)) * 8} months`,
					}),
				]);

				const analysis = {
					project: normalizedProject,
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
							management: Math.ceil(normalizedProject.wellCount / 20),
							engineering: Math.ceil(normalizedProject.wellCount / 10),
							operations: Math.ceil(normalizedProject.wellCount / 5),
						},
						equipment: {
							rigs: Math.min(3, Math.ceil(normalizedProject.wellCount / 15)),
							completionUnits: Math.ceil(normalizedProject.wellCount / 25),
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
						peakProduction: Math.round(normalizedProject.reserves * 0.15),
						plantLife: "25-30 years",
					},
					confidence: ServerUtils.calculateConfidence(0.85, 0.88),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return { ...analysis, ...matchInfo };
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
				// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
				matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
			}),
			async (args) => {
				const rawProjectName = args.projectName;
				const normalizedProjectName = normalizeIdentifier(rawProjectName);
				const matchInfo =
					normalizedProjectName !== rawProjectName ? { matchedAs: normalizedProjectName, matchScore: 1.0 } : {};
				const schedule = await synthesizeDevelopmentPhasesWithLLM({
					projectName: normalizedProjectName,
					wellCount: args.wellCount,
					budget: args.budget,
					constraints: args.constraints,
				});
				return { ...schedule, ...matchInfo, confidence: ServerUtils.calculateConfidence(0.87, 0.9) };
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
