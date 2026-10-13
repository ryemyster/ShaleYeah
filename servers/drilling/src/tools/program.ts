/**
 * Drilling program design — casing, mud, completion, and schedule.
 * Deterministic fallback keeps tests independent of the Anthropic API.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface DrillingProgram {
	wellType: "vertical" | "horizontal" | "directional";
	targetDepth: number;
	formation: string;
	estimatedDays: number;
	casingProgram: string[];
	mudProgram: string;
	completionType: string;
	programRisk: "High" | "Medium" | "Low";
	keyConsiderations: string[];
	recommendation: string;
}

export function deriveDrillingProgram(
	wellType: "vertical" | "horizontal" | "directional",
	targetDepth: number,
	formation: string,
): DrillingProgram {
	const isDeep = targetDepth > 12000;
	const isHorizontal = wellType === "horizontal";
	const programRisk: "High" | "Medium" | "Low" =
		isDeep && isHorizontal ? "High" : isDeep || isHorizontal ? "Medium" : "Low";

	const estimatedDays = Math.ceil(targetDepth / (isHorizontal ? 400 : 600));

	const casingProgram = [
		'20" conductor to 100ft',
		'13 3/8" surface to 2,000ft',
		isHorizontal ? '9 5/8" intermediate to TD' : '7" production to TD',
	];

	return {
		wellType,
		targetDepth,
		formation,
		estimatedDays,
		casingProgram,
		mudProgram: `${formation} optimized system`,
		completionType: isHorizontal ? "Multi-stage fracturing" : "Conventional completion",
		programRisk,
		keyConsiderations: [
			`${wellType} well to ${targetDepth}ft in ${formation}`,
			isDeep ? "Deep target — elevated pore pressure risk" : "Moderate depth — standard drilling hazards apply",
			isHorizontal ? "Lateral section requires careful torque and drag management" : "Vertical profile — standard BHA",
		],
		recommendation: `Proceed with ${programRisk.toLowerCase()}-risk mitigation plan. ${isHorizontal ? "Optimize lateral length vs. cost." : "Standard casing program appropriate."}`,
	};
}

export async function synthesizeDrillingProgramWithLLM(params: {
	wellType: "vertical" | "horizontal" | "directional";
	targetDepth: number;
	formation: string;
	budget?: number;
	timeline?: string;
}): Promise<DrillingProgram> {
	const { wellType, targetDepth, formation, budget, timeline } = params;

	const prompt = `You are Perforator Maximus, a master drilling strategist.

Design a drilling program and flag key risks. Return a JSON object.

WELL PARAMETERS:
Well type: ${wellType}
Target depth: ${targetDepth} ft
Formation: ${formation}
${budget ? `Budget: $${(budget / 1_000_000).toFixed(2)}M` : ""}
${timeline ? `Timeline: ${timeline}` : ""}

Return ONLY valid JSON in this exact shape:
{
  "programRisk": "High" | "Medium" | "Low",
  "keyConsiderations": ["<consideration 1>", "<consideration 2>", "<consideration 3>"],
  "recommendation": "<one sentence drilling program recommendation>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<
			Pick<DrillingProgram, "programRisk" | "keyConsiderations" | "recommendation">
		>;
		const validRisks: string[] = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.programRisk ?? "")) throw new Error("Invalid programRisk");

		const base = deriveDrillingProgram(wellType, targetDepth, formation);
		return {
			...base,
			programRisk: parsed.programRisk as "High" | "Medium" | "Low",
			keyConsiderations: parsed.keyConsiderations ?? base.keyConsiderations,
			recommendation: parsed.recommendation ?? base.recommendation,
		};
	} catch (_err) {
		return deriveDrillingProgram(wellType, targetDepth, formation);
	}
}
