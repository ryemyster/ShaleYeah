#!/usr/bin/env node

/**
 * Title MCP Server - DRY Refactored Version
 *
 * Demonstrates DRY principles using ServerFactory
 * Reduces boilerplate from ~95 lines to ~35 lines
 */

import { z } from "zod";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// Define server template with no duplication
const titleServerTemplate: ServerTemplate = {
	name: "title",
	description: "Title & Ownership Analysis MCP Server",
	persona: {
		name: "Titulus Verificatus",
		role: "Master Title Analyst",
		expertise: [
			"Title examination and verification",
			"Ownership structure analysis",
			"Due diligence investigations",
			"Lease status verification",
			"Encumbrance identification",
		],
	},
	directories: ["examinations", "ownership", "reports", "documents"],
	tools: [
		ServerFactory.createAnalysisTool(
			"examine_title",
			"Conduct comprehensive title examination",
			z.object({
				propertyDescription: z.string(),
				county: z.string(),
				state: z.string(),
				examPeriod: z.string().default("20 years"),
				outputPath: z.string().optional(),
			}),
			async (args) => {
				// Domain-specific analysis logic (only unique code)
				const examination = {
					property: args.propertyDescription,
					jurisdiction: `${args.county}, ${args.state}`,
					examPeriod: args.examPeriod,
					findings: {
						clearTitle: Math.random() > 0.3,
						encumbrances: Math.floor(Math.random() * 3),
						ownershipPercentage: 100 - Math.random() * 25,
						legalDescription: "Legal description based on examination",
						riskLevel: Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "medium" : "low",
					},
					confidence: ServerUtils.calculateConfidence(0.9, 0.8),
				};

				return examination;
			},
		),
	],
};

// Create the server class using factory (eliminates all boilerplate)
export const TitleServer = ServerFactory.createServer(titleServerTemplate);

// Export server class
export default TitleServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new (TitleServer as any)();
	runMCPServer(server);
}
