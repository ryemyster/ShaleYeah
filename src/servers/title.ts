#!/usr/bin/env node

/**
 * Title MCP Server - DRY Refactored Version
 *
 * Demonstrates DRY principles using ServerFactory
 * Reduces boilerplate from ~95 lines to ~35 lines
 */

import { z } from "zod";
import { type MCPServer, runMCPServer } from "../shared/mcp-server.js";
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
						clearTitle: true, // stub: assumed clear — replace with county recorder lookup
						encumbrances: 1, // stub: 1 standard mortgage — replace with lien search
						ownershipPercentage: 87.5, // stub: 87.5% NPI — replace with title chain analysis
						legalDescription: "Legal description based on examination",
						riskLevel: "low", // stub — replace with title defect scoring
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
	const server = new (TitleServer as unknown as new () => MCPServer)();
	runMCPServer(server);
}
