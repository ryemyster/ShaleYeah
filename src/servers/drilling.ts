#!/usr/bin/env node
/**
 * Drilling MCP Server - DRY Refactored
 * Perforator Maximus - Master Drilling Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import {
	ServerFactory,
	type ServerTemplate,
	ServerUtils,
} from "../shared/server-factory.js";

const drillingTemplate: ServerTemplate = {
	name: "drilling",
	description: "Drilling Operations MCP Server",
	persona: {
		name: "Perforator Maximus",
		role: "Master Drilling Strategist",
		expertise: [
			"Drilling program design",
			"Well trajectory optimization",
			"Drilling risk assessment",
			"Cost estimation and budgeting",
			"Technical troubleshooting",
		],
	},
	directories: ["programs", "trajectories", "costs", "operations", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"design_drilling_program",
			"Design comprehensive drilling program",
			z.object({
				wellParameters: z.object({
					targetDepth: z.number(),
					wellType: z.enum(["vertical", "horizontal", "directional"]),
					formation: z.string(),
				}),
				location: z.object({
					latitude: z.number(),
					longitude: z.number(),
					surface: z.string(),
				}),
				constraints: z
					.object({
						budget: z.number().optional(),
						timeline: z.string().optional(),
						environmental: z.array(z.string()).optional(),
					})
					.optional(),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				const wellCost =
					args.wellParameters.targetDepth *
					(args.wellParameters.wellType === "horizontal"
						? 180
						: args.wellParameters.wellType === "directional"
							? 140
							: 120);

				const analysis = {
					well: args.wellParameters,
					location: args.location,
					drilling: {
						estimatedDays: Math.ceil(
							args.wellParameters.targetDepth /
								(args.wellParameters.wellType === "horizontal" ? 400 : 600),
						),
						mudProgram: `${args.wellParameters.formation} optimized system`,
						casingProgram: [
							'20" conductor to 100ft',
							'13 3/8" surface to 2,000ft',
							args.wellParameters.wellType === "horizontal"
								? '9 5/8" intermediate to TD'
								: '7" production to TD',
						],
						completion:
							args.wellParameters.wellType === "horizontal"
								? "Multi-stage fracturing"
								: "Conventional completion",
					},
					costs: {
						drilling: Math.round(wellCost),
						completion: Math.round(wellCost * 0.6),
						facilities: Math.round(wellCost * 0.2),
						total: Math.round(wellCost * 1.8),
					},
					risks: {
						geological: args.wellParameters.formation.includes("shale")
							? "Medium"
							: "Low",
						operational: "Standard for formation type",
						environmental:
							args.constraints?.environmental?.length > 0 ? "Medium" : "Low",
					},
					confidence: ServerUtils.calculateConfidence(0.82, 0.88),
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

export const DrillingServer = ServerFactory.createServer(drillingTemplate);
export default DrillingServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new DrillingServer();
	runMCPServer(server);
}
