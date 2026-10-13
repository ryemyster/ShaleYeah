/**
 * O&G compliance requirements — environmental, safety, and tax obligations by jurisdiction.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface ComplianceRequirements {
	environmentalRequirements: string[];
	safetyRequirements: string[];
	taxObligations: string[];
	complianceRisk: "High" | "Medium" | "Low";
	estimatedComplianceCost: "Low (<$100K)" | "Medium ($100K–$500K)" | "High (>$500K)";
}

// Jurisdictions with higher compliance cost burden
const HIGH_COST_JURISDICTIONS = ["california", "colorado", "new mexico"];

export function deriveComplianceRequirements(
	jurisdiction: string,
	projectType: "exploration" | "development" | "production" | "abandonment",
	assetCount: number,
): ComplianceRequirements {
	const jLower = jurisdiction.toLowerCase();
	const isHighCost = HIGH_COST_JURISDICTIONS.some((j) => jLower.includes(j));

	const complianceRisk: "High" | "Medium" | "Low" =
		isHighCost || projectType === "exploration"
			? "High"
			: assetCount > 5 || projectType === "development"
				? "Medium"
				: "Low";

	const estimatedComplianceCost: "Low (<$100K)" | "Medium ($100K–$500K)" | "High (>$500K)" =
		complianceRisk === "High" ? "High (>$500K)" : complianceRisk === "Medium" ? "Medium ($100K–$500K)" : "Low (<$100K)";

	const environmentalRequirements = ["NEPA review", "State environmental laws", "Local ordinances"];
	if (isHighCost) environmentalRequirements.push("Air quality monitoring program");
	if (projectType === "exploration") environmentalRequirements.push("Baseline environmental survey");

	const safetyRequirements = ["OSHA requirements", "DOT regulations", "State safety codes"];
	if (projectType === "development") safetyRequirements.push("Well control certification");

	const taxObligations = ["Severance taxes", "Property taxes", "Income tax implications"];
	if (!jLower.includes("texas") && !jLower.includes("oklahoma")) {
		taxObligations.push("State-specific extraction tax");
	}

	return {
		environmentalRequirements,
		safetyRequirements,
		taxObligations,
		complianceRisk,
		estimatedComplianceCost,
	};
}

export async function synthesizeComplianceRequirementsWithLLM(params: {
	jurisdiction: string;
	projectType: "exploration" | "development" | "production" | "abandonment";
	assetCount: number;
}): Promise<ComplianceRequirements> {
	const { jurisdiction, projectType, assetCount } = params;
	const base = deriveComplianceRequirements(jurisdiction, projectType, assetCount);

	const prompt = `You are Legatus Juridicus, a master oil & gas legal strategist.

Assess compliance requirements for this project. Return a JSON object.

PROJECT:
Jurisdiction: ${jurisdiction}
Type: ${projectType}
Number of assets: ${assetCount}

Return ONLY valid JSON in this exact shape:
{
  "complianceRisk": "High" | "Medium" | "Low",
  "environmentalRequirements": ["<req 1>", "<req 2>"],
  "safetyRequirements": ["<req 1>", "<req 2>"],
  "taxObligations": ["<obligation 1>", "<obligation 2>"]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<{
			complianceRisk: string;
			environmentalRequirements: string[];
			safetyRequirements: string[];
			taxObligations: string[];
		}>;
		const validRisks: string[] = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.complianceRisk ?? "")) throw new Error("Invalid complianceRisk");
		return {
			...base,
			complianceRisk: parsed.complianceRisk as "High" | "Medium" | "Low",
			environmentalRequirements: parsed.environmentalRequirements ?? base.environmentalRequirements,
			safetyRequirements: parsed.safetyRequirements ?? base.safetyRequirements,
			taxObligations: parsed.taxObligations ?? base.taxObligations,
		};
	} catch (_err) {
		return base;
	}
}
