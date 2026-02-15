#!/usr/bin/env node

/**
 * Infrastructure MCP Server - DRY Refactored
 * Structura Ingenious - Master Infrastructure Architect
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

const infrastructureTemplate: ServerTemplate = {
	name: "infrastructure",
	description: "Infrastructure Planning MCP Server",
	persona: {
		name: "Structura Ingenious",
		role: "Master Infrastructure Architect",
		expertise: [
			"Pipeline and facility design",
			"Capacity planning and optimization",
			"Infrastructure integration",
			"Cost estimation and budgeting",
			"Regulatory compliance planning",
		],
	},
	directories: ["plans", "capacity", "costs", "compliance", "reports"],
	tools: [
		ServerFactory.createAnalysisTool(
			"plan_infrastructure",
			"Plan infrastructure for development project",
			z.object({
				projectScope: z.object({
					expectedProduction: z.number(),
					wellCount: z.number(),
					location: z.string(),
				}),
				requirements: z.array(z.string()),
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
				const analysis = {
					project: args.projectScope,
					infrastructure: {
						pipelines: {
							gathering: `${Math.round(args.projectScope.wellCount * 1.2)} miles`,
							transmission: "12 miles to existing network",
							capacity: `${Math.round(args.projectScope.expectedProduction * 1.1)} bopd`,
						},
						facilities: {
							batteries: Math.ceil(args.projectScope.wellCount / 8),
							separators: Math.ceil(args.projectScope.wellCount / 4),
							compressors: Math.ceil(args.projectScope.expectedProduction / 5000),
						},
						costs: {
							pipelines: Math.round(args.projectScope.wellCount * 250000),
							facilities: Math.round(args.projectScope.wellCount * 180000),
							total: Math.round(args.projectScope.wellCount * 430000),
						},
					},
					compliance: {
						permits: ["Pipeline ROW", "Facility Construction", "Environmental"],
						timeline: "6-8 months for approvals",
						risks: args.constraints?.environmental || [],
					},
					confidence: ServerUtils.calculateConfidence(0.85, 0.9),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
				}

				return analysis;
			},
		),
	],
};

export const InfrastructureServer = ServerFactory.createServer(infrastructureTemplate);
export default InfrastructureServer;

if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new InfrastructureServer();
	runMCPServer(server);
}
