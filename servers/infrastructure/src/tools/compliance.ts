import { callLLM } from "@shaleyeah/sdk";

export interface ComplianceAssessment {
    requiredPermits: string[];
    approvalTimelineMonths: number;
    environmentalRisks: string[];
    criticalPath: string;
    complianceRisk: "High" | "Medium" | "Low";
}

/**
 * Permit requirements for O&G infrastructure vary by state and project scale.
 * Baseline: Pipeline ROW + Facility Construction + Environmental are always required.
 * Remote/large projects trigger additional federal or state-level reviews.
 * Approval timeline: 6–8 months for standard projects; up to 12 months for remote/federal land.
 */
export function deriveComplianceAssessment(
    wellCount: number,
    location: string,
    environmentalConstraints: string[],
): ComplianceAssessment {
    const isRemote = !["texas", "oklahoma", "kansas"].some((s) => location.toLowerCase().includes(s));
    const isLarge = wellCount > 20;

    const requiredPermits = ["Pipeline Right-of-Way", "Facility Construction Permit", "Air Quality Permit (Title V)"];
    if (isRemote) requiredPermits.push("Federal Surface Use Agreement", "NEPA Environmental Assessment");
    if (isLarge) requiredPermits.push("Stormwater Pollution Prevention Plan (SWPPP)");

    const approvalTimelineMonths = isRemote ? 12 : isLarge ? 9 : 6;
    const complianceRisk: "High" | "Medium" | "Low" = isRemote ? "High" : isLarge ? "Medium" : "Low";

    const environmentalRisks = environmentalConstraints.length > 0 ? environmentalConstraints : ["Standard erosion/runoff controls required"];

    const criticalPath = isRemote
        ? "Federal EA (NEPA) is the critical path — begin immediately; 6–9 months minimum"
        : "Air quality permit is the critical path — submit 90 days before construction";

    return { requiredPermits, approvalTimelineMonths, environmentalRisks, criticalPath, complianceRisk };
}

export async function synthesizeComplianceAssessmentWithLLM(params: {
    wellCount: number;
    location: string;
    environmentalConstraints: string[];
}): Promise<ComplianceAssessment> {
    const { wellCount, location, environmentalConstraints } = params;

    const prompt = `You are Structura Ingenious, a master O&G infrastructure architect.

Assess the permitting and regulatory compliance requirements for this infrastructure project.

PROJECT:
Well count: ${wellCount}
Location: ${location}
Environmental constraints noted: ${environmentalConstraints.length > 0 ? environmentalConstraints.join(", ") : "none identified"}

Return ONLY valid JSON matching this exact shape:
{
  "requiredPermits": ["<permit 1>", "<permit 2>", "..."],
  "approvalTimelineMonths": <number — total calendar months for all permits>,
  "environmentalRisks": ["<risk 1>", "..."],
  "criticalPath": "<one sentence — what drives the schedule>",
  "complianceRisk": "High" | "Medium" | "Low"
}`;

    try {
        const raw = await callLLM({ prompt, maxTokens: 350 });
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in response");
        const parsed = JSON.parse(match[0]) as Partial<ComplianceAssessment>;
        const validRisks = ["High", "Medium", "Low"];
        if (!validRisks.includes(parsed.complianceRisk ?? "")) throw new Error("Invalid complianceRisk");
        return parsed as ComplianceAssessment;
    } catch {
        return deriveComplianceAssessment(wellCount, location, environmentalConstraints);
    }
}
