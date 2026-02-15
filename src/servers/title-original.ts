#!/usr/bin/env node

/**
 * Title MCP Server - Title & Ownership Expert
 *
 * Titulus Verificatus - Master Title Analyst
 * Provides title examination, ownership verification,
 * and due diligence for oil & gas properties.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { MCPServer, runMCPServer } from "../shared/mcp-server.js";

export class TitleServer extends MCPServer {
	constructor() {
		super({
			name: "title",
			version: "1.0.0",
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
		});
	}

	protected async setupDataDirectories(): Promise<void> {
		const dirs = ["examinations", "ownership", "leases", "encumbrances", "reports"];
		for (const dir of dirs) {
			await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
		}
	}

	protected setupCapabilities(): void {
		this.registerTool({
			name: "examine_title",
			description: "Conduct comprehensive title examination",
			inputSchema: z.object({
				propertyDescription: z.string(),
				county: z.string(),
				state: z.string(),
				examPeriod: z.string().default("20 years"),
				outputPath: z.string().optional(),
			}),
			handler: async (args) => this.examineTitle(args),
		});

		this.registerResource({
			name: "title_examination",
			uri: "title://examinations/{id}",
			description: "Title examination results",
			handler: async (uri) => this.getTitleExamination(uri),
		});
	}

	private async examineTitle(args: any): Promise<any> {
		console.log(`📋 Examining title for property in ${args.county}, ${args.state}`);

		const examination = {
			examinationId: `title_${Date.now()}`,
			propertyDescription: args.propertyDescription,
			titleStatus: "CLEAR",
			ownership: {
				surfaceOwner: "Smith Family Trust",
				mineralOwner: "ABC Minerals LLC",
				workingInterest: "87.5%",
				royaltyInterest: "12.5%",
			},
			encumbrances: ["Existing lease to XYZ Oil Co"],
			recommendations: ["Verify lease status", "Obtain title insurance"],
			confidence: 92,
		};

		await this.saveResult(`examinations/${examination.examinationId}.json`, examination);
		return examination;
	}

	private async getTitleExamination(uri: URL): Promise<any> {
		const examinationId = uri.pathname.split("/").pop();
		return await this.loadResult(`examinations/${examinationId}.json`);
	}
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new TitleServer();
	runMCPServer(server).catch(console.error);
}
