#!/usr/bin/env node

/**
 * Infrastructure MCP Server - DRY Refactored
 * Structura Ingenious - Master Infrastructure Architect
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

export interface InfrastructureInterpretation {
	takeawayRisk: string;
	keyConstraints: string[];
	recommendation: string;
}

/**
 * Rule-based infrastructure interpretation — fallback when the API is unavailable.
 * Output varies with well count and production so tests can verify determinism.
 */
export function deriveDefaultInfrastructureInterpretation(
	wellCount: number,
	expectedProduction: number,
	location: string,
): InfrastructureInterpretation {
	const isLargeProject = wellCount > 20 || expectedProduction > 10000;
	const isRemote = !["texas", "oklahoma", "kansas"].some((s) => location.toLowerCase().includes(s));

	return {
		takeawayRisk: isRemote ? "High" : isLargeProject ? "Medium" : "Low",
		keyConstraints: [
			`${wellCount} wells require ${Math.ceil(wellCount * 1.2)} miles of gathering line`,
			isLargeProject ? "Large project — phased infrastructure buildout recommended" : "Single-phase buildout feasible",
			isRemote
				? "Remote location — midstream access may require new pipeline"
				: "Existing midstream infrastructure accessible",
		],
		recommendation: `${isRemote ? "Secure midstream contract before committing capital." : "Standard gathering buildout."} ${isLargeProject ? "Phase infrastructure to match production ramp." : "Single phase appropriate for project scale."}`,
	};
}

/**
 * Ask Claude (Structura Ingenious) to assess takeaway constraints and midstream risk.
 * Falls back to deriveDefaultInfrastructureInterpretation() if the API is unavailable.
 */
export async function synthesizeInfrastructureAnalysisWithLLM(params: {
	wellCount: number;
	expectedProduction: number;
	location: string;
	totalCost: number;
}): Promise<InfrastructureInterpretation> {
	const { wellCount, expectedProduction, location, totalCost } = params;

	const prompt = `You are Structura Ingenious, a master infrastructure architect for oil & gas projects.

Assess the infrastructure and takeaway constraints for this project. Return a JSON object.

PROJECT:
Well count: ${wellCount}
Expected production: ${expectedProduction} bopd
Location: ${location}
Estimated infrastructure cost: $${(totalCost / 1_000_000).toFixed(2)}M

Return ONLY valid JSON in this exact shape:
{
  "takeawayRisk": "High" | "Medium" | "Low",
  "keyConstraints": ["<constraint 1>", "<constraint 2>", "<constraint 3>"],
  "recommendation": "<one sentence infrastructure recommendation>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<InfrastructureInterpretation>;
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.takeawayRisk ?? "")) throw new Error("Invalid takeawayRisk");
		return {
			takeawayRisk: parsed.takeawayRisk as string,
			keyConstraints: parsed.keyConstraints ?? [],
			recommendation: parsed.recommendation ?? "",
		};
	} catch (_err) {
		return deriveDefaultInfrastructureInterpretation(wellCount, expectedProduction, location);
	}
}

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
				const totalCost = Math.round(args.projectScope.wellCount * 430000);

				// Ask Claude to assess takeaway constraints and midstream risk.
				// Falls back to rule-based interpretation if API is unavailable.
				const interpretation = await synthesizeInfrastructureAnalysisWithLLM({
					wellCount: args.projectScope.wellCount,
					expectedProduction: args.projectScope.expectedProduction,
					location: args.projectScope.location,
					totalCost,
				});

				const analysis = {
					project: args.projectScope,
					interpretation,
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
							total: totalCost,
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
