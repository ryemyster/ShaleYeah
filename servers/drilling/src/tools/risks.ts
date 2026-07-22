/**
 * Drilling risk assessment — geological, operational, and environmental risk scoring.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface DrillingRiskProfile {
	geologicalRisk: "High" | "Medium" | "Low";
	operationalRisk: "High" | "Medium" | "Low";
	environmentalRisk: "High" | "Medium" | "Low";
	overallRisk: "High" | "Medium" | "Low";
	mitigations: string[];
}

function highest(...risks: Array<"High" | "Medium" | "Low">): "High" | "Medium" | "Low" {
	if (risks.includes("High")) return "High";
	if (risks.includes("Medium")) return "Medium";
	return "Low";
}

export function deriveDrillingRiskProfile(
	wellType: "vertical" | "horizontal" | "directional",
	targetDepth: number,
	formation: string,
	environmentalConstraints: string[],
): DrillingRiskProfile {
	const geologicalRisk: "High" | "Medium" | "Low" = formation.toLowerCase().includes("shale") ? "Medium" : "Low";
	const isDeep = targetDepth > 12000;
	const isHorizontal = wellType === "horizontal";
	const operationalRisk: "High" | "Medium" | "Low" =
		isDeep && isHorizontal ? "High" : isDeep || isHorizontal ? "Medium" : "Low";
	const environmentalRisk: "High" | "Medium" | "Low" = environmentalConstraints.length > 0 ? "Medium" : "Low";
	const overallRisk = highest(geologicalRisk, operationalRisk, environmentalRisk);

	const mitigations: string[] = [];
	if (operationalRisk !== "Low") mitigations.push("Real-time pore pressure monitoring required");
	if (isHorizontal) mitigations.push("Torque and drag model before spud");
	if (geologicalRisk !== "Low") mitigations.push("Formation evaluation LWD suite recommended");
	if (environmentalConstraints.length > 0) mitigations.push("Environmental compliance officer on-site");
	if (mitigations.length === 0) mitigations.push("Standard risk management plan appropriate");

	return { geologicalRisk, operationalRisk, environmentalRisk, overallRisk, mitigations };
}

export async function synthesizeDrillingRisksWithLLM(params: {
	wellType: "vertical" | "horizontal" | "directional";
	targetDepth: number;
	formation: string;
	environmentalConstraints: string[];
}): Promise<DrillingRiskProfile> {
	const { wellType, targetDepth, formation, environmentalConstraints } = params;

	const prompt = `You are Perforator Maximus, a master drilling strategist.

Assess drilling risks for this well. Return a JSON object.

WELL:
Type: ${wellType}
Depth: ${targetDepth} ft
Formation: ${formation}
Environmental constraints: ${environmentalConstraints.join(", ") || "none"}

Return ONLY valid JSON in this exact shape:
{
  "geologicalRisk": "High" | "Medium" | "Low",
  "operationalRisk": "High" | "Medium" | "Low",
  "environmentalRisk": "High" | "Medium" | "Low",
  "overallRisk": "High" | "Medium" | "Low",
  "mitigations": ["<mitigation 1>", "<mitigation 2>"]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<DrillingRiskProfile>;
		const validRisks = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.overallRisk ?? "")) throw new Error("Invalid overallRisk");
		return {
			geologicalRisk: (validRisks.includes(parsed.geologicalRisk ?? "") ? parsed.geologicalRisk : "Low") as
				| "High"
				| "Medium"
				| "Low",
			operationalRisk: (validRisks.includes(parsed.operationalRisk ?? "") ? parsed.operationalRisk : "Low") as
				| "High"
				| "Medium"
				| "Low",
			environmentalRisk: (validRisks.includes(parsed.environmentalRisk ?? "") ? parsed.environmentalRisk : "Low") as
				| "High"
				| "Medium"
				| "Low",
			overallRisk: parsed.overallRisk as "High" | "Medium" | "Low",
			mitigations: parsed.mitigations ?? [],
		};
	} catch (_err) {
		return deriveDrillingRiskProfile(wellType, targetDepth, formation, environmentalConstraints);
	}
}
