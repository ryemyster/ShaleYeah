/**
 * Development phase scheduling — breaks a well program into sequential phases
 * with milestones, durations, and investment per phase.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface DevelopmentPhase {
	phase: number;
	wells: number;
	duration: string;
	investment: number;
	keyMilestones: string[];
}

export interface PhaseSchedule {
	phases: DevelopmentPhase[];
	totalDuration: string;
	totalPhases: number;
	strategy: "Single phase" | "Phased development";
}

export function deriveDevelopmentPhases(wellCount: number, budget: number): PhaseSchedule {
	const phaseCount = Math.min(4, Math.ceil(wellCount / 10));
	const wellsPerPhase = Math.ceil(wellCount / phaseCount);
	const investmentPerPhase = Math.round(budget / phaseCount);

	const phases: DevelopmentPhase[] = Array.from({ length: phaseCount }, (_, i) => ({
		phase: i + 1,
		wells: Math.min(wellsPerPhase, wellCount - i * wellsPerPhase),
		duration: `${6 + i * 2} months`,
		investment: investmentPerPhase,
		keyMilestones: [
			"Permitting and approvals",
			"Site preparation",
			"Drilling operations",
			"Completion and testing",
			"Production startup",
		],
	}));

	return {
		phases,
		totalDuration: `${phaseCount * 8} months`,
		totalPhases: phaseCount,
		strategy: wellCount > 20 ? "Phased development" : "Single phase",
	};
}

export async function synthesizeDevelopmentPhasesWithLLM(params: {
	projectName: string;
	wellCount: number;
	budget: number;
	constraints: string[];
}): Promise<PhaseSchedule> {
	const { projectName, wellCount, budget, constraints } = params;
	const base = deriveDevelopmentPhases(wellCount, budget);

	const prompt = `You are Architectus Developmentus, a master oil & gas development strategist.

Create a phased development schedule for this project. Return a JSON object.

PROJECT:
Name: ${projectName}
Well count: ${wellCount}
Budget: $${(budget / 1_000_000).toFixed(1)}M
Constraints: ${constraints.length > 0 ? constraints.join(", ") : "None"}

Return ONLY valid JSON in this exact shape:
{
  "strategy": "Single phase" | "Phased development",
  "totalDuration": "<N> months",
  "phases": [
    {
      "phase": 1,
      "wells": <number>,
      "duration": "<N> months",
      "investment": <number>,
      "keyMilestones": ["<milestone 1>", "<milestone 2>"]
    }
  ]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 600 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<{
			strategy: string;
			totalDuration: string;
			phases: DevelopmentPhase[];
		}>;
		if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) throw new Error("No phases in response");
		return {
			phases: parsed.phases,
			totalDuration: parsed.totalDuration ?? base.totalDuration,
			totalPhases: parsed.phases.length,
			strategy:
				parsed.strategy === "Single phase" || parsed.strategy === "Phased development"
					? parsed.strategy
					: base.strategy,
		};
	} catch (_err) {
		return base;
	}
}
