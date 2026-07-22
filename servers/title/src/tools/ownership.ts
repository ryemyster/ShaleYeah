/**
 * Ownership analysis — Working Interest (WI) and Net Revenue Interest (NRI) calculations.
 *
 * WI is the cost-bearing share of production. NRI is the revenue share after deducting
 * lessor royalty and any overriding royalty interests (ORRI). The relationship is:
 *   NRI = WI × (1 − royaltyRate − orriRate)
 *
 * Industry norms vary by basin: Permian Basin royalties run 20–25%; DJ Basin 18.75%; mid-continent 12.5–16.67%.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface OwnershipBreakdown {
	workingInterest: number; // fraction, e.g. 0.75 = 75% WI
	netRevenueInterest: number; // fraction — revenue share after royalty and ORRI deductions
	royaltyRate: number; // lessor royalty fraction
	orriRate: number; // overriding royalty interest fraction
	operatorWI: number; // operator's portion of WI
	notes: string;
}

/** NRI = WI × (1 − royalty − ORRI). All inputs are fractions (0–1). */
export function calculateNRI(workingInterest: number, royaltyRate: number, orriRate: number): number {
	return workingInterest * (1 - royaltyRate - orriRate);
}

/**
 * Rule-based ownership estimate — deterministic fallback when the API is unavailable.
 * Basin defaults derived from public lease data and regional norms.
 */
export function deriveOwnershipBreakdown(propertyDescription: string, county: string): OwnershipBreakdown {
	const lc = county.toLowerCase();
	const isPermian = ["reeves", "midland", "ector", "andrews", "lea", "eddy", "loving"].some((c) => lc.includes(c));
	const isDJ = ["weld", "adams", "arapahoe", "boulder"].some((c) => lc.includes(c));

	const royaltyRate = isPermian ? 0.25 : isDJ ? 0.1875 : 0.1667;
	const hasOrri =
		propertyDescription.toLowerCase().includes("override") || propertyDescription.toLowerCase().includes("orri");
	const orriRate = hasOrri ? 0.02 : 0;

	// Multi-parcel descriptions often indicate fractional WI (e.g. jointly owned section)
	const workingInterest = propertyDescription.includes(",") ? 0.75 : 1.0;

	const basin = isPermian ? "Permian Basin" : isDJ ? "DJ Basin" : "regional";

	return {
		workingInterest,
		netRevenueInterest: calculateNRI(workingInterest, royaltyRate, orriRate),
		royaltyRate,
		orriRate,
		operatorWI: workingInterest,
		notes: `${basin} standard royalty ${(royaltyRate * 100).toFixed(2)}%${hasOrri ? `, plus ORRI ${(orriRate * 100).toFixed(2)}%` : ""}`,
	};
}

export async function synthesizeOwnershipWithLLM(params: {
	propertyDescription: string;
	county: string;
	state: string;
}): Promise<OwnershipBreakdown> {
	const { propertyDescription, county, state } = params;

	const prompt = `You are Titulus Verificatus, a master oil & gas title analyst.

Estimate the ownership structure for this property and return valid JSON only.

PROPERTY:
Description: ${propertyDescription}
County: ${county}, ${state}

Return ONLY valid JSON in this exact shape:
{
  "workingInterest": <fraction 0–1>,
  "netRevenueInterest": <fraction 0–1>,
  "royaltyRate": <fraction 0–1>,
  "orriRate": <fraction 0–1>,
  "operatorWI": <fraction 0–1>,
  "notes": "<one sentence on key ownership consideration>"
}

Use realistic values for ${county} County, ${state}. Working interest and royalty rates must be consistent (NRI = WI × (1 − royalty − ORRI)).`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<OwnershipBreakdown>;
		return {
			workingInterest: typeof parsed.workingInterest === "number" ? parsed.workingInterest : 1.0,
			netRevenueInterest: typeof parsed.netRevenueInterest === "number" ? parsed.netRevenueInterest : 0.75,
			royaltyRate: typeof parsed.royaltyRate === "number" ? parsed.royaltyRate : 0.25,
			orriRate: typeof parsed.orriRate === "number" ? parsed.orriRate : 0,
			operatorWI: typeof parsed.operatorWI === "number" ? parsed.operatorWI : 1.0,
			notes: parsed.notes ?? "",
		};
	} catch {
		return deriveOwnershipBreakdown(propertyDescription, county);
	}
}
