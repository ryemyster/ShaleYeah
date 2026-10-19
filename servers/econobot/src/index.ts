#!/usr/bin/env node
import { callLLM, type LLMCallOptions, runMCPServer, ServerFactory, type ServerTemplate } from "@shaleyeah/sdk";
import { z } from "zod";
import { calculateCashFlows, cashFlowInputSchema } from "./cash-flow.js";

export { calculateCashFlows, cashFlowInputSchema } from "./cash-flow.js";
export interface EconobotOptions {
	/** Host configuration, never tool arguments. No ambient provider is enabled by default. */
	synthesis?: Pick<LLMCallOptions, "apiKey" | "model" | "maxTokens">;
	invokeLLM?: typeof callLLM;
}

async function interpret(economics: ReturnType<typeof calculateCashFlows>, options: EconobotOptions) {
	if (!options.synthesis) return { status: "unavailable", reason: "not_configured", reviewStatus: "unreviewed" };
	try {
		const text = await (options.invokeLLM ?? callLLM)({
			...options.synthesis,
			maxTokens: options.synthesis.maxTokens ?? 512,
			system:
				"Explain the supplied cash-flow calculations for a human reviewer. Never change numeric results, fill missing inputs, approve assumptions or authorize spending. Unavailable metrics remain unavailable.",
			prompt: `Explain this unreviewed calculation. Rates use its declared period, not an assumed annual period.\n${JSON.stringify(economics)}`,
		});
		if (typeof text !== "string" || !text.trim() || Buffer.byteLength(text) > 32768)
			throw new Error("Invalid interpretation");
		if (options.synthesis.apiKey && text.includes(options.synthesis.apiKey)) throw new Error("Unsafe interpretation");
		return { status: "available", text, reviewStatus: "unreviewed" };
	} catch {
		return { status: "unavailable", reason: "provider_unavailable", reviewStatus: "unreviewed" };
	}
}

export function createEconobotTemplate(options: EconobotOptions = {}): ServerTemplate {
	return {
		name: "econobot",
		description: "Explicit periodic cash-flow calculations; human review and capital authority remain separate",
		persona: {
			name: "Caesar Augustus Economicus",
			role: "Economic calculation tooling",
			expertise: ["Periodic discounted cash flows", "Residual-verified IRR", "Declared scenario comparisons"],
		},
		directories: [],
		tools: [
			ServerFactory.createAnalysisTool(
				"calculate_dcf",
				"Calculate versioned periodic NPV, bounded IRR and period-end payback from explicit source-linked cash flows. No approval or invented inputs.",
				cashFlowInputSchema,
				async (args) => calculateCashFlows(args),
			),
			ServerFactory.createAnalysisTool(
				"analyze_economics",
				"Calculate supplied cash flows with optional separately configured unreviewed interpretation. Legacy inferred price/cost/production files are unsupported.",
				z.object({ input: cashFlowInputSchema, includeInterpretation: z.boolean().default(false) }).strict(),
				async (args) => {
					const economics = calculateCashFlows(args.input);
					return {
						economics,
						interpretation: args.includeInterpretation
							? await interpret(economics, options)
							: { status: "not_requested", reviewStatus: "unreviewed" },
					};
				},
			),
			ServerFactory.createAnalysisTool(
				"sensitivity_analysis",
				"Compare explicit operator-supplied cash-flow scenarios in one currency and period convention. No generated price model or investment approval.",
				z
					.object({
						baseCase: cashFlowInputSchema,
						scenarios: z
							.array(z.object({ id: z.string().min(1).max(128), input: cashFlowInputSchema }).strict())
							.min(1)
							.max(100),
					})
					.strict(),
				async (args) => {
					const baseCase = calculateCashFlows(args.baseCase);
					const scenarios = args.scenarios as { id: string; input: z.infer<typeof cashFlowInputSchema> }[];
					if (new Set(scenarios.map((item) => item.id)).size !== scenarios.length)
						throw new Error("Duplicate scenario identity");
					if (
						scenarios.some(
							(item) => item.input.currency !== baseCase.currency || item.input.periodUnit !== baseCase.periodUnit,
						)
					)
						throw new Error("Scenario currency and period must match the base case");
					return {
						baseCase,
						scenarios: scenarios.map((item) => ({ id: item.id, economics: calculateCashFlows(item.input) })),
						reviewStatus: "unreviewed",
						authorizesInvestment: false,
					};
				},
			),
		],
	};
}

export const EconobotServer = ServerFactory.createServer(createEconobotTemplate());
export default EconobotServer;
if (import.meta.url === `file://${process.argv[1]}`) runMCPServer(new EconobotServer());
