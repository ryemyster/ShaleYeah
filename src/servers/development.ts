#!/usr/bin/env node
/**
 * Development MCP Server - DRY Refactored
 * Architectus Developmentus - Master Development Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import {
	ServerFactory,
	type ServerTemplate,
	ServerUtils,
} from "../shared/server-factory.js";

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

				const analysis = {
					project: args.project,
					development: {
						strategy:
							args.project.wellCount > 20
								? "Phased development"
								: "Single phase",
						phases: Array.from({ length: phaseCount }, (_, i) => ({
							phase: i + 1,
							wells: Math.min(
								wellsPerPhase,
								args.project.wellCount - i * wellsPerPhase,
							),
							duration: `${6 + i * 2} months`,
							investment: Math.round(
								(args.constraints?.budget || 50000000) / phaseCount,
							),
							keyMilestones: [
								"Permitting and approvals",
								"Site preparation",
								"Drilling operations",
								"Completion and testing",
								"Production startup",
							],
						})),
						schedule: {
							totalDuration: `${phaseCount * 8} months`,
							criticalPath: [
								"Environmental approvals",
								"Drilling permits",
								"Equipment procurement",
							],
							riskFactors: args.constraints?.technical || [
								"Weather delays",
								"Equipment availability",
							],
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
						capex: Math.round((args.constraints?.budget || 50000000) * 1.1),
						timeToPayback: "18-24 months",
						peakProduction: Math.round(args.project.reserves * 0.15),
						plantLife: "25-30 years",
					},
					confidence: ServerUtils.calculateConfidence(0.85, 0.88),
				};

				if (args.outputPath) {
					await fs.writeFile(
						args.outputPath,
						JSON.stringify(analysis, null, 2),
					);
				}

				return analysis;
			},
		),
		ServerFactory.createAnalysisTool(
			"monitor_development_progress",
			"Monitor and analyze development project progress",
			z.object({
				projectId: z.string(),
				metrics: z
					.array(z.string())
					.default(["schedule", "budget", "safety", "quality"]),
				reportingPeriod: z
					.enum(["weekly", "monthly", "quarterly"])
					.default("monthly"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const analysis = {
					project: args.projectId,
					period: args.reportingPeriod,
					performance: {
						schedule: {
							status: Math.random() > 0.3 ? "On track" : "Behind schedule",
							variance: Math.round((Math.random() - 0.5) * 20),
							criticalIssues: Math.random() > 0.7 ? ["Weather delays"] : [],
						},
						budget: {
							status: Math.random() > 0.2 ? "Within budget" : "Over budget",
							variance: Math.round((Math.random() - 0.5) * 15),
							majorVariances: Math.random() > 0.8 ? ["Equipment costs"] : [],
						},
						safety: {
							incidents: Math.floor(Math.random() * 3),
							daysWithoutIncident: Math.floor(Math.random() * 90),
							complianceStatus: "Full compliance",
						},
						quality: {
							wellSuccess: Math.round((0.85 + Math.random() * 0.1) * 100),
							reworkRequired: Math.floor(Math.random() * 2),
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
					await fs.writeFile(
						args.outputPath,
						JSON.stringify(analysis, null, 2),
					);
				}

				return analysis;
			},
		),
	],
};

export const DevelopmentServer =
	ServerFactory.createServer(developmentTemplate);
export default DevelopmentServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new DevelopmentServer();
	runMCPServer(server);
}
