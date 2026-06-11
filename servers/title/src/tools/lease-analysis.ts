/**
 * Lease term analysis — primary term parsing, expiry risk, and depth/acreage limitations.
 *
 * An oil and gas lease has a primary term (fixed years) and a secondary term that
 * continues as long as production is maintained. Expiry risk rises when the primary
 * term is short, the lease has been held without production, or a shut-in royalty
 * clause is absent. Depth severance and acreage limitation clauses constrain what
 * the lessee can actually develop.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface LeaseAnalysis {
    primaryTermMonths: number;
    royaltyRate: number; // lessor royalty fraction
    expiryRisk: "low" | "medium" | "high";
    hasDepthSeverance: boolean; // lease restricted to specific formations
    hasAcreageLimitation: boolean; // non-participating zone or Pugh clause
    hasShutInProvisions: boolean; // shut-in royalty preserves lease without production
    notes: string;
}

/** Parse common lease term strings to months. Defaults to 36 months if unparseable. */
export function parseLeaseTermMonths(primaryTerm: string): number {
    const yearMatch = primaryTerm.match(/(\d+)\s*year/i);
    if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
    const monthMatch = primaryTerm.match(/(\d+)\s*month/i);
    if (monthMatch) return parseInt(monthMatch[1], 10);
    return 36; // industry default primary term
}

/**
 * Rule-based lease analysis — deterministic fallback when the API is unavailable.
 * Expiry thresholds: >36 months = low risk, 24–36 = medium, <24 = high.
 */
export function deriveLeaseAnalysis(primaryTerm: string, county: string, examPeriod: string): LeaseAnalysis {
    const lc = county.toLowerCase();
    const termMonths = parseLeaseTermMonths(primaryTerm);

    const isActive = ["reeves", "midland", "lea", "weld", "ector"].some((c) => lc.includes(c));
    const royaltyRate = isActive ? 0.25 : 0.1875;

    const expiryRisk: LeaseAnalysis["expiryRisk"] = termMonths < 24 ? "high" : termMonths <= 36 ? "medium" : "low";

    // Depth severance typically noted in formation-specific leases or long exam periods
    const hasDepthSeverance = examPeriod.toLowerCase().includes("formation") || examPeriod.includes("50");

    return {
        primaryTermMonths: termMonths,
        royaltyRate,
        expiryRisk,
        hasDepthSeverance,
        hasAcreageLimitation: false,
        hasShutInProvisions: true, // shut-in clauses are standard in most basins
        notes: `${termMonths}-month primary term in ${county} — ${expiryRisk} expiry risk; royalty ${(royaltyRate * 100).toFixed(2)}%`,
    };
}

export async function synthesizeLeaseAnalysisWithLLM(params: {
    primaryTerm: string;
    county: string;
    state: string;
    examPeriod: string;
}): Promise<LeaseAnalysis> {
    const { primaryTerm, county, state, examPeriod } = params;

    const prompt = `You are Titulus Verificatus, a master oil & gas title analyst.

Analyze the lease terms for this property and return valid JSON only.

PROPERTY:
Primary term: ${primaryTerm}
County: ${county}, ${state}
Examination period: ${examPeriod}

Return ONLY valid JSON in this exact shape:
{
  "primaryTermMonths": <integer>,
  "royaltyRate": <fraction 0–1>,
  "expiryRisk": "low" | "medium" | "high",
  "hasDepthSeverance": true | false,
  "hasAcreageLimitation": true | false,
  "hasShutInProvisions": true | false,
  "notes": "<one sentence on key lease consideration>"
}

Use realistic lease terms for ${county} County, ${state}.`;

    try {
        const raw = await callLLM({ prompt, maxTokens: 300 });
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in response");
        const parsed = JSON.parse(match[0]) as Partial<LeaseAnalysis>;
        const validRisks = ["low", "medium", "high"];
        if (!validRisks.includes(parsed.expiryRisk ?? "")) throw new Error("Invalid expiryRisk");
        return {
            primaryTermMonths: typeof parsed.primaryTermMonths === "number" ? parsed.primaryTermMonths : 36,
            royaltyRate: typeof parsed.royaltyRate === "number" ? parsed.royaltyRate : 0.25,
            expiryRisk: parsed.expiryRisk as LeaseAnalysis["expiryRisk"],
            hasDepthSeverance: parsed.hasDepthSeverance ?? false,
            hasAcreageLimitation: parsed.hasAcreageLimitation ?? false,
            hasShutInProvisions: parsed.hasShutInProvisions ?? true,
            notes: parsed.notes ?? "",
        };
    } catch {
        return deriveLeaseAnalysis(primaryTerm, county, examPeriod);
    }
}
