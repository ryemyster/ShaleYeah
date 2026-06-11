/**
 * Regulatory risk assessment for oil & gas projects.
 * Covers US jurisdiction-specific risk and key regulatory exposure.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface RegulatoryAssessment {
	regulatoryRisk: "High" | "Medium" | "Low";
	keyRisks: string[];
	recommendations: string[];
	requiredPermits: string[];
	approvalTimelineMonths: number;
}

// Jurisdictions with elevated regulatory burden for O&G
const HIGH_RISK_JURISDICTIONS = ["california", "colorado", "new mexico"];

export function deriveRegulatoryAssessment(
	jurisdiction: string,
	projectType: "exploration" | "development" | "production" | "abandonment",
): RegulatoryAssessment {
	const jLower = jurisdiction.toLowerCase();
	const isHighJurisdiction = HIGH_RISK_JURISDICTIONS.some((j) => jLower.includes(j));

	let regulatoryRisk: "High" | "Medium" | "Low";
	if (projectType === "exploration" || isHighJurisdiction) regulatoryRisk = "High";
	else if (projectType === "development") regulatoryRisk = "Medium";
	else regulatoryRisk = "Low";

	const approvalTimelineMonths = regulatoryRisk === "High" ? 12 : regulatoryRisk === "Medium" ? 6 : 3;

	const requiredPermits = ["Drilling/Operations Permit", "Environmental Clearance", "Land Use Approval"];
	if (projectType === "exploration") requiredPermits.push("Exploration License");
	if (isHighJurisdiction) requiredPermits.push("State-Specific Regulatory Filing");

	return {
		regulatoryRisk,
		keyRisks: [
			`${projectType} regulatory compliance in ${jurisdiction}`,
			"Environmental permit requirements",
			"Title and ownership verification",
		],
		recommendations: [
			`Engage local counsel in ${jurisdiction}`,
			"Complete title examination before proceeding",
			"Obtain all required permits before operations",
		],
		requiredPermits,
		approvalTimelineMonths,
	};
}

export async function synthesizeRegulatoryAssessmentWithLLM(params: {
	jurisdiction: string;
	projectType: "exploration" | "development" | "production" | "abandonment";
	assets: string[];
}): Promise<RegulatoryAssessment> {
	const { jurisdiction, projectType, assets } = params;

	const prompt = `You are Legatus Juridicus, a master oil & gas legal strategist.

Analyze the regulatory and legal exposure for this project. Return a JSON object.

PROJECT:
Jurisdiction: ${jurisdiction}
Project type: ${projectType}
Assets: ${assets.join(", ")}

Return ONLY valid JSON in this exact shape:
{
  "regulatoryRisk": "High" | "Medium" | "Low",
  "keyRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 400 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<{
			regulatoryRisk: string;
			keyRisks: string[];
			recommendations: string[];
		}>;
		const validRisks: string[] = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.regulatoryRisk ?? "")) throw new Error("Invalid regulatoryRisk");

		const base = deriveRegulatoryAssessment(jurisdiction, projectType);
		return {
			...base,
			regulatoryRisk: parsed.regulatoryRisk as "High" | "Medium" | "Low",
			keyRisks: parsed.keyRisks ?? base.keyRisks,
			recommendations: parsed.recommendations ?? base.recommendations,
		};
	} catch (_err) {
		return deriveRegulatoryAssessment(jurisdiction, projectType);
	}
}
