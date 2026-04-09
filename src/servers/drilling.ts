#!/usr/bin/env node
/**
 * Drilling MCP Server - DRY Refactored
 * Perforator Maximus - Master Drilling Strategist
 */

import fs from "node:fs/promises";
import { z } from "zod";
import { callLLM } from "../shared/llm-client.js";
import { runMCPServer } from "../shared/mcp-server.js";
import { ServerFactory, type ServerTemplate, ServerUtils } from "../shared/server-factory.js";

// ---------------------------------------------------------------------------
// Exported helpers (used by tests)
// ---------------------------------------------------------------------------

export interface DrillingInterpretation {
	programRisk: string;
	keyConsiderations: string[];
	recommendation: string;
}

/**
 * Rule-based drilling interpretation — fallback when the API is unavailable.
 * Uses actual well parameters so output differs across inputs.
 */
export function deriveDefaultDrillingInterpretation(
	wellType: string,
	targetDepth: number,
	formation: string,
): DrillingInterpretation {
	const isDeep = targetDepth > 12000;
	const isHorizontal = wellType === "horizontal";
	const riskLevel = isDeep && isHorizontal ? "High" : isDeep || isHorizontal ? "Medium" : "Low";

	return {
		programRisk: riskLevel,
		keyConsiderations: [
			`${wellType} well to ${targetDepth}ft in ${formation}`,
			isDeep ? "Deep target — elevated pore pressure risk" : "Moderate depth — standard drilling hazards apply",
			isHorizontal ? "Lateral section requires careful torque and drag management" : "Vertical profile — standard BHA",
		],
		recommendation: `Proceed with ${riskLevel.toLowerCase()}-risk mitigation plan. ${isHorizontal ? "Optimize lateral length vs. cost." : "Standard casing program appropriate."}`,
	};
}

/**
 * Ask Claude (Perforator Maximus) to interpret the drilling program and flag risks.
 * Falls back to deriveDefaultDrillingInterpretation() if the API is unavailable.
 */
export async function synthesizeDrillingAnalysisWithLLM(params: {
	wellType: string;
	targetDepth: number;
	formation: string;
	estimatedDays: number;
	totalCost: number;
}): Promise<DrillingInterpretation> {
	const { wellType, targetDepth, formation, estimatedDays, totalCost } = params;

	const prompt = `You are Perforator Maximus, a master drilling strategist.

Interpret this drilling program and identify the key risks and recommendations. Return a JSON object.

WELL PROGRAM:
Well type: ${wellType}
Target depth: ${targetDepth} ft
Formation: ${formation}
Estimated drill time: ${estimatedDays} days
Total estimated cost: $${(totalCost / 1_000_000).toFixed(2)}M

Return ONLY valid JSON in this exact shape:
{
  "programRisk": "High" | "Medium" | "Low",
  "keyConsiderations": ["<risk or consideration 1>", "<risk or consideration 2>", "<risk or consideration 3>"],
  "recommendation": "<one sentence drilling program recommendation>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<DrillingInterpretation>;
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.programRisk ?? "")) throw new Error("Invalid programRisk");
		return {
			programRisk: parsed.programRisk as string,
			keyConsiderations: parsed.keyConsiderations ?? [],
			recommendation: parsed.recommendation ?? "",
		};
	} catch (_err) {
		return deriveDefaultDrillingInterpretation(wellType, targetDepth, formation);
	}
}

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

				const estimatedDays = Math.ceil(
					args.wellParameters.targetDepth / (args.wellParameters.wellType === "horizontal" ? 400 : 600),
				);
				const totalCost = Math.round(wellCost * 1.8);

				// Ask Claude to interpret the program and flag formation-specific risks.
				// Falls back to rule-based interpretation if API is unavailable.
				const interpretation = await synthesizeDrillingAnalysisWithLLM({
					wellType: args.wellParameters.wellType,
					targetDepth: args.wellParameters.targetDepth,
					formation: args.wellParameters.formation,
					estimatedDays,
					totalCost,
				});

				const analysis = {
					well: args.wellParameters,
					location: args.location,
					drilling: {
						estimatedDays,
						mudProgram: `${args.wellParameters.formation} optimized system`,
						casingProgram: [
							'20" conductor to 100ft',
							'13 3/8" surface to 2,000ft',
							args.wellParameters.wellType === "horizontal" ? '9 5/8" intermediate to TD' : '7" production to TD',
						],
						completion:
							args.wellParameters.wellType === "horizontal" ? "Multi-stage fracturing" : "Conventional completion",
					},
					costs: {
						drilling: Math.round(wellCost),
						completion: Math.round(wellCost * 0.6),
						facilities: Math.round(wellCost * 0.2),
						total: totalCost,
					},
					risks: {
						geological: args.wellParameters.formation.includes("shale") ? "Medium" : "Low",
						operational: interpretation.programRisk,
						environmental: args.constraints?.environmental?.length > 0 ? "Medium" : "Low",
					},
					interpretation,
					confidence: ServerUtils.calculateConfidence(0.82, 0.88),
				};

				if (args.outputPath) {
					await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
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
