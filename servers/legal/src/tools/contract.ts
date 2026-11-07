/**
 * Oil & gas contract review and analysis.
 * Classifies key terms and assesses negotiation risk by contract type.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface ContractReview {
	contractType: string;
	overallRisk: "High" | "Medium" | "Low";
	financialTerms: string[];
	operationalTerms: string[];
	legalTerms: string[];
	negotiabilityNotes: string;
	recommendations: string[];
}

// Contract types with higher default risk exposure
const HIGH_RISK_CONTRACT_TYPES = ["JOA", "farmout"];

export function deriveContractReview(
	contractType: "lease" | "JOA" | "purchase" | "service" | "farmout",
	keyTerms: string[],
	riskProfile: "conservative" | "moderate" | "aggressive",
): ContractReview {
	const overallRisk: "High" | "Medium" | "Low" =
		riskProfile === "conservative"
			? "Low"
			: riskProfile === "aggressive"
				? "High"
				: HIGH_RISK_CONTRACT_TYPES.includes(contractType)
					? "High"
					: "Medium";

	return {
		contractType,
		overallRisk,
		financialTerms: keyTerms.filter(
			(t) =>
				t.toLowerCase().includes("payment") || t.toLowerCase().includes("royalty") || t.toLowerCase().includes("bonus"),
		),
		operationalTerms: keyTerms.filter(
			(t) => t.toLowerCase().includes("drilling") || t.toLowerCase().includes("operation"),
		),
		legalTerms: keyTerms.filter((t) => t.toLowerCase().includes("liability") || t.toLowerCase().includes("indemnity")),
		negotiabilityNotes: "Standard terms with room for negotiation",
		recommendations: [
			"Review indemnification clauses carefully",
			"Negotiate favorable payment terms",
			"Ensure clear operational responsibilities",
		],
	};
}

export async function synthesizeContractReviewWithLLM(params: {
	contractType: "lease" | "JOA" | "purchase" | "service" | "farmout";
	keyTerms: string[];
	parties: string[];
	riskProfile: "conservative" | "moderate" | "aggressive";
}): Promise<ContractReview> {
	const { contractType, keyTerms, parties, riskProfile } = params;
	const base = deriveContractReview(contractType, keyTerms, riskProfile);

	const prompt = `You are Legatus Juridicus, a master oil & gas legal strategist.

Review this oil & gas contract and provide risk assessment. Return a JSON object.

CONTRACT:
Type: ${contractType}
Parties: ${parties.join(", ")}
Risk profile: ${riskProfile}
Key terms: ${keyTerms.join("; ")}

Return ONLY valid JSON in this exact shape:
{
  "overallRisk": "High" | "Medium" | "Low",
  "negotiabilityNotes": "<one sentence on negotiability>",
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<{
			overallRisk: string;
			negotiabilityNotes: string;
			recommendations: string[];
		}>;
		const validRisks: string[] = ["High", "Medium", "Low"];
		if (!validRisks.includes(parsed.overallRisk ?? "")) throw new Error("Invalid overallRisk");
		return {
			...base,
			overallRisk: parsed.overallRisk as "High" | "Medium" | "Low",
			negotiabilityNotes: parsed.negotiabilityNotes ?? base.negotiabilityNotes,
			recommendations: parsed.recommendations ?? base.recommendations,
		};
	} catch (_err) {
		return base;
	}
}
