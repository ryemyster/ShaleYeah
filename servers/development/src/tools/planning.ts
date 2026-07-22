/**
 * Development project risk outlook — schedule and budget risk assessment.
 * Deterministic fallback uses well count, budget, and constraint signals.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface DevelopmentOutlook {
	scheduleRisk: "High" | "Medium" | "Low";
	budgetRisk: "High" | "Medium" | "Low";
	criticalPath: string[];
	recommendation: string;
}

export function deriveDefaultDevelopmentOutlook(
	wellCount: number,
	budget: number,
	technicalConstraints: string[],
): DevelopmentOutlook {
	const isLarge = wellCount > 20;
	const isTightBudget = budget < wellCount * 2_000_000;
	const hasConstraints = technicalConstraints.length > 0;

	const scheduleRisk: "High" | "Medium" | "Low" = isLarge ? "Medium" : "Low";
	const budgetRisk: "High" | "Medium" | "Low" = isTightBudget ? "High" : hasConstraints ? "Medium" : "Low";

	return {
		scheduleRisk,
		budgetRisk,
		criticalPath: [
			"Environmental approvals",
			"Drilling permits",
			isLarge ? "Phased rig mobilization" : "Equipment procurement",
		],
		recommendation: `${isLarge ? "Phased development recommended" : "Single-phase feasible"}. ${isTightBudget ? "Budget is tight — monitor AFE variance closely." : "Budget appears adequate for scope."}`,
	};
}

export async function synthesizeDevelopmentOutlookWithLLM(params: {
	projectName: string;
	wellCount: number;
	budget: number;
	technicalConstraints: string[];
	totalDuration: string;
}): Promise<DevelopmentOutlook> {
	const { projectName, wellCount, budget, technicalConstraints, totalDuration } = params;
	const base = deriveDefaultDevelopmentOutlook(wellCount, budget, technicalConstraints);

	const prompt = `You are Architectus Developmentus, a master oil & gas development strategist.

Assess the schedule and budget risks for this development project. Return a JSON object.

PROJECT:
Name: ${projectName}
Well count: ${wellCount}
Total budget: $${(budget / 1_000_000).toFixed(1)}M
Total duration: ${totalDuration}
Technical constraints: ${technicalConstraints.length > 0 ? technicalConstraints.join(", ") : "None specified"}

Return ONLY valid JSON in this exact shape:
{
  "scheduleRisk": "High" | "Medium" | "Low",
  "budgetRisk": "High" | "Medium" | "Low",
  "criticalPath": ["<milestone 1>", "<milestone 2>", "<milestone 3>"],
  "recommendation": "<one sentence development strategy recommendation>"
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<{
			scheduleRisk: string;
			budgetRisk: string;
			criticalPath: string[];
			recommendation: string;
		}>;
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.scheduleRisk ?? "") || !validRisks.includes(parsed.budgetRisk ?? ""))
			throw new Error("Invalid risk level");
		return {
			scheduleRisk: parsed.scheduleRisk as "High" | "Medium" | "Low",
			budgetRisk: parsed.budgetRisk as "High" | "Medium" | "Low",
			criticalPath: parsed.criticalPath ?? base.criticalPath,
			recommendation: parsed.recommendation ?? base.recommendation,
		};
	} catch (_err) {
		return base;
	}
}
