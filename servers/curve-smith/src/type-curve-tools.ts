import { callLLM, type LLMCallOptions, ServerFactory, type ServerRuntimeOptions } from "@shaleyeah/sdk";
import { z } from "zod";
import { calculateForecast, forecastInputSchema } from "./arps.js";
import { generateTypeCurve, typeCurveInputSchema } from "./type-curve.js";

export interface CurveSmithOptions extends ServerRuntimeOptions {
	/** Host-owned settings; tool arguments cannot select credentials or turn on an ambient provider. */
	synthesis?: Pick<LLMCallOptions, "apiKey" | "model" | "maxTokens">;
	invokeLLM?: typeof callLLM;
}

async function interpret(result: ReturnType<typeof generateTypeCurve>, options: CurveSmithOptions) {
	const unavailable = (reason: string) => ({ status: "unavailable", reason, reviewStatus: "unreviewed" });
	if (result.status !== "available") return unavailable("calculation_unavailable");
	if (!options.synthesis) return unavailable("not_configured");
	// Send a numeric summary, never raw histories, formation text or source identifiers.
	const summary = {
		product: result.product,
		rateUnit: result.rateUnit,
		timeBasis: result.timeBasis,
		horizon: result.horizon,
		economicLimitRate: result.economicLimitRate,
		method: result.method,
		basis: result.basis,
		evidenceKind: result.evidenceKind,
		cumulativeProduction: result.cumulativeProduction,
		volumeUnit: result.volumeUnit,
		volumeBasis: result.volumeBasis,
		forecast: result.forecast,
		uncertainty: result.uncertainty,
		reviewStatus: result.reviewStatus,
		professionalAcceptance: false,
		authorizesReserves: false,
	};
	try {
		const text = await (options.invokeLLM ?? callLLM)({
			...options.synthesis,
			maxTokens: options.synthesis.maxTokens ?? 512,
			system:
				"Explain the supplied modeled production for a human reviewer. Never change numbers, fill missing evidence, invent percentiles, certify reserves, approve assumptions or authorize action. This is unreviewed interpretation; unavailable uncertainty remains unavailable.",
			prompt: `Explain this unreviewed finite-interval calculation. Daily rates and the declared time conversion are distinct.\n${JSON.stringify(summary)}`,
		});
		if (
			typeof text !== "string" ||
			!text.trim() ||
			Buffer.byteLength(text) > 32768 ||
			(options.synthesis.apiKey && text.includes(options.synthesis.apiKey))
		)
			return unavailable("provider_unavailable");
		return { status: "available", text, reviewStatus: "unreviewed" };
	} catch {
		return unavailable("provider_unavailable");
	}
}

export function typeCurveTools(options: CurveSmithOptions = {}) {
	return [
		ServerFactory.createAnalysisTool(
			"generate_type_curve",
			"Fit source-referenced analog daily-rate histories with a declared fixed-b Arps method, or calculate an explicit parameter scenario. Returns finite modeled volume; uncertainty and professional approval remain unavailable.",
			typeCurveInputSchema.safeExtend({ includeInterpretation: z.boolean().default(false) }),
			async (args) => {
				const { includeInterpretation, ...input } = args;
				const result = generateTypeCurve(input);
				return {
					...result,
					interpretation: includeInterpretation
						? await interpret(result, options)
						: { status: "not_requested", reviewStatus: "unreviewed" },
				};
			},
		),
		ServerFactory.createAnalysisTool(
			"calculate_eur",
			"Calculate finite modeled Arps volume from versioned explicit parameters, daily-rate units, declared time basis, horizon and cutoff. This tool name does not certify ultimate recovery or reserves; no implicit gas/oil conversion.",
			forecastInputSchema,
			async (args) => calculateForecast(args),
		),
	];
}
