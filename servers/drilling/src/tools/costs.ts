/**
 * Well cost estimation — drilling, completion, and facilities breakdown.
 * Rates are industry-representative constants for onshore US unconventional wells.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface WellCostBreakdown {
	drillingCost: number;
	completionCost: number;
	facilitiesCost: number;
	totalCost: number;
	costPerFoot: number;
	estimatedDays: number;
}

// Drilling cost per foot by well type (onshore US unconventional, 2024 basis)
const COST_PER_FOOT: Record<"vertical" | "horizontal" | "directional", number> = {
	horizontal: 180,
	directional: 140,
	vertical: 120,
};

export function deriveWellCostBreakdown(
	wellType: "vertical" | "horizontal" | "directional",
	targetDepth: number,
): WellCostBreakdown {
	const costPerFoot = COST_PER_FOOT[wellType];
	const drillingCost = Math.round(targetDepth * costPerFoot);
	const completionCost = Math.round(drillingCost * 0.6);
	const facilitiesCost = Math.round(drillingCost * 0.2);
	const totalCost = Math.round((drillingCost + completionCost + facilitiesCost) * 1.0);
	const estimatedDays = Math.ceil(targetDepth / (wellType === "horizontal" ? 400 : 600));

	return {
		drillingCost,
		completionCost,
		facilitiesCost,
		totalCost,
		costPerFoot,
		estimatedDays,
	};
}

export async function synthesizeWellCostsWithLLM(params: {
	wellType: "vertical" | "horizontal" | "directional";
	targetDepth: number;
	formation: string;
	location: string;
}): Promise<WellCostBreakdown> {
	const { wellType, targetDepth, formation, location } = params;
	const base = deriveWellCostBreakdown(wellType, targetDepth);

	const prompt = `You are Perforator Maximus, a master drilling strategist.

Estimate well costs for this project. Return a JSON object.

WELL:
Type: ${wellType}
Depth: ${targetDepth} ft
Formation: ${formation}
Location: ${location}

Baseline estimate: $${(base.totalCost / 1_000_000).toFixed(2)}M total

Return ONLY valid JSON in this exact shape:
{
  "drillingCost": <number in dollars>,
  "completionCost": <number in dollars>,
  "facilitiesCost": <number in dollars>,
  "totalCost": <number in dollars>,
  "costPerFoot": <number>,
  "estimatedDays": <number>
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 250 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<WellCostBreakdown>;
		if (typeof parsed.totalCost !== "number") throw new Error("Missing totalCost");
		return {
			drillingCost: parsed.drillingCost ?? base.drillingCost,
			completionCost: parsed.completionCost ?? base.completionCost,
			facilitiesCost: parsed.facilitiesCost ?? base.facilitiesCost,
			totalCost: parsed.totalCost,
			costPerFoot: parsed.costPerFoot ?? base.costPerFoot,
			estimatedDays: parsed.estimatedDays ?? base.estimatedDays,
		};
	} catch (_err) {
		return base;
	}
}
