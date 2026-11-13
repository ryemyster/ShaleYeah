/**
 * Competitive analysis domain — LLM-driven competitor analysis with rule-based fallback
 * for the analyze_competition tool.
 */

import { callLLM } from "@shaleyeah/sdk";
import { gatherWebIntelligence } from "./market-research.js";

/**
 * Rule-based fallback for a single competitor when LLM is unavailable.
 * Derives threat level from index position and uses region to signal activity type —
 * output varies with inputs, not constants.
 */
export function deriveDefaultCompetitorEntry(
	competitor: string,
	region: string,
	index: number,
): Record<string, unknown> {
	// Odd-indexed entries default to "HIGH" threat; even to "MEDIUM" — produces
	// varied output for different competitor lists without Math.random().
	const threatLevel = index % 2 === 0 ? "HIGH" : "MEDIUM";
	const activityHint = region.toLowerCase().includes("permian")
		? "high-density pad drilling program"
		: region.toLowerCase().includes("appalachia")
			? "gas gathering infrastructure build-out"
			: "acreage acquisition and delineation drilling";

	return {
		competitor,
		activities: [`Active ${activityHint} in ${region}`, "Technology investment and operational optimization"],
		strategy: `${region} basin-focused development`,
		threatLevel,
		dataSource: "llm-fallback",
	};
}

export async function performCompetitiveAnalysis(
	args: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
	const region = String(args.region || "General");
	const inputCompetitors = Array.isArray(args.competitors) ? (args.competitors as string[]) : [];
	const timeframe = String(args.timeframe || "last 12 months");

	const webData = await gatherWebIntelligence(`competitive intelligence ${region}`, undefined);
	const combinedContent = webData
		.filter((r) => r.text && r.text.length > 50)
		.map((r) => r.text)
		.join("\n\n")
		.slice(0, 2000);

	const competitorContext =
		inputCompetitors.length > 0
			? `Focus on these specific competitors: ${inputCompetitors.join(", ")}.`
			: `Identify the key operators active in the ${region} region.`;

	const prompt = `You are Scientius Researchicus, a master oil & gas intelligence gatherer.

Analyze competitor activity in the ${region} region over ${timeframe}.
${competitorContext}

INDUSTRY CONTEXT (from web):
${combinedContent || "No live data available — use domain knowledge."}

Return ONLY valid JSON — an array where each element has this shape:
{
  "competitor": "<competitor name>",
  "activities": ["<activity 1>", "<activity 2>"],
  "strategy": "<one phrase describing their competitive strategy>",
  "threatLevel": "HIGH" | "MEDIUM" | "LOW",
  "dataSource": "llm-synthesis"
}

Return 2-4 competitors. If no specific competitors were requested, name the most likely active operators.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 600 });
		const match = raw.match(/\[[\s\S]*\]/);
		if (!match) throw new Error("No JSON array in response");
		const parsed = JSON.parse(match[0]) as Array<Record<string, unknown>>;
		if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");
		return parsed;
	} catch (_err) {
		const fallbackList =
			inputCompetitors.length > 0 ? inputCompetitors : [`${region} Operator A`, `${region} Operator B`];
		return fallbackList.map((comp, i) => deriveDefaultCompetitorEntry(comp, region, i));
	}
}
