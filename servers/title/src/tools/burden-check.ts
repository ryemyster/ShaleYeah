/**
 * Burden check — ORRI, production payments, and encumbrance identification.
 *
 * Burdens are interests carved out of the lessee's share that reduce net revenue.
 * Common burdens include:
 *   - ORRI (Overriding Royalty Interest): a royalty interest out of the lessee's WI
 *   - Production payments: a right to a share of production for a fixed period/volume
 *   - Liens and mortgages: security interests against the property
 *
 * Total burden = royaltyRate + ORRI + any other production payments.
 * A net revenue interest (NRI) below 70% of working interest warrants scrutiny.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface BurdenAssessment {
	totalBurdenFraction: number; // royalty + ORRI + other, as fraction of WI
	orriRate: number; // overriding royalty interest fraction
	productionPaymentDollars: number; // fixed-amount production payment obligations
	encumbranceCount: number; // total number of encumbrances found
	liens: string[]; // descriptions of any liens or mortgages
	riskLevel: "low" | "medium" | "high";
	notes: string;
}

/** Aggregate burden fraction = royalty + ORRI. All inputs are fractions (0–1). */
export function calculateTotalBurden(royaltyRate: number, orriRate: number): number {
	return royaltyRate + orriRate;
}

/**
 * Rule-based burden estimate — deterministic fallback when the API is unavailable.
 * ORRI is assumed 2% when the property description mentions "override" or "ORRI".
 */
export function deriveBurdenAssessment(propertyDescription: string, county: string): BurdenAssessment {
	const lc = county.toLowerCase();
	const descLc = propertyDescription.toLowerCase();

	const isPermian = ["reeves", "midland", "ector", "lea", "eddy"].some((c) => lc.includes(c));
	const royaltyRate = isPermian ? 0.25 : 0.1875;

	const hasOrri = descLc.includes("override") || descLc.includes("orri");
	const orriRate = hasOrri ? 0.02 : 0;

	const isComplex = propertyDescription.includes(",") || hasOrri;
	const encumbranceCount = isComplex ? 2 : 1;

	return {
		totalBurdenFraction: calculateTotalBurden(royaltyRate, orriRate),
		orriRate,
		productionPaymentDollars: 0,
		encumbranceCount,
		liens: [],
		riskLevel: isComplex ? "medium" : "low",
		notes: hasOrri
			? `ORRI of ${(orriRate * 100).toFixed(1)}% detected — verify instrument in county records`
			: `Standard ${isPermian ? "Permian" : "regional"} burden; ${encumbranceCount} encumbrance(s) expected`,
	};
}

export async function synthesizeBurdenCheckWithLLM(params: {
	propertyDescription: string;
	county: string;
	state: string;
}): Promise<BurdenAssessment> {
	const { propertyDescription, county, state } = params;

	const prompt = `You are Titulus Verificatus, a master oil & gas title analyst.

Assess the burden structure for this property and return valid JSON only.

PROPERTY:
Description: ${propertyDescription}
County: ${county}, ${state}

Return ONLY valid JSON in this exact shape:
{
  "totalBurdenFraction": <fraction 0–1>,
  "orriRate": <fraction 0–1>,
  "productionPaymentDollars": <number>,
  "encumbranceCount": <integer>,
  "liens": [<string>, ...],
  "riskLevel": "low" | "medium" | "high",
  "notes": "<one sentence on key burden consideration>"
}

Use realistic burden levels for ${county} County, ${state}. ORRI should only appear when explicitly relevant to the property.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<BurdenAssessment>;
		const validRisks = ["low", "medium", "high"];
		if (!validRisks.includes(parsed.riskLevel ?? "")) throw new Error("Invalid riskLevel");
		return {
			totalBurdenFraction: typeof parsed.totalBurdenFraction === "number" ? parsed.totalBurdenFraction : 0.25,
			orriRate: typeof parsed.orriRate === "number" ? parsed.orriRate : 0,
			productionPaymentDollars:
				typeof parsed.productionPaymentDollars === "number" ? parsed.productionPaymentDollars : 0,
			encumbranceCount: typeof parsed.encumbranceCount === "number" ? parsed.encumbranceCount : 1,
			liens: Array.isArray(parsed.liens) ? (parsed.liens as string[]) : [],
			riskLevel: parsed.riskLevel as BurdenAssessment["riskLevel"],
			notes: parsed.notes ?? "",
		};
	} catch {
		return deriveBurdenAssessment(propertyDescription, county);
	}
}
