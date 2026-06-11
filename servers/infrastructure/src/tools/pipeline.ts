import { callLLM } from "@shaleyeah/sdk";

export interface PipelinePlan {
    gatheringMiles: number;
    transmissionMiles: number;
    capacityBopd: number;
    pressureRequirementPsi: number;
    takeawayRisk: "High" | "Medium" | "Low";
    recommendation: string;
}

/**
 * Gathering miles scale linearly with well count; transmission is fixed at 12 miles
 * to the nearest existing midstream network (representative Permian/DJ assumption).
 * Capacity is sized 10% above expected production to handle flush production peaks.
 * Pressure: remote locations require higher compression due to longer haul distances.
 */
export function derivePipelinePlan(wellCount: number, expectedProduction: number, location: string): PipelinePlan {
    const isRemote = !["texas", "oklahoma", "kansas"].some((s) => location.toLowerCase().includes(s));
    const gatheringMiles = Math.ceil(wellCount * 1.2);
    const transmissionMiles = 12;
    const capacityBopd = Math.round(expectedProduction * 1.1);
    const pressureRequirementPsi = isRemote ? 1200 : 800;
    const takeawayRisk: "High" | "Medium" | "Low" =
        isRemote ? "High" : wellCount > 20 || expectedProduction > 10000 ? "Medium" : "Low";

    return {
        gatheringMiles,
        transmissionMiles,
        capacityBopd,
        pressureRequirementPsi,
        takeawayRisk,
        recommendation: isRemote
            ? "Secure midstream transport agreement before committing capital — no existing tie-in available."
            : `Connect to existing midstream network via ${transmissionMiles}-mile transmission line.`,
    };
}

export async function synthesizePipelinePlanWithLLM(params: {
    wellCount: number;
    expectedProduction: number;
    location: string;
}): Promise<PipelinePlan> {
    const { wellCount, expectedProduction, location } = params;

    const prompt = `You are Structura Ingenious, a master O&G infrastructure architect.

Plan the pipeline gathering and transmission infrastructure for this project.

PROJECT:
Well count: ${wellCount}
Expected production: ${expectedProduction} BOPD (barrels of oil per day)
Location: ${location}

Return ONLY valid JSON matching this exact shape:
{
  "gatheringMiles": <number — miles of gathering line to connect all wells>,
  "transmissionMiles": <number — miles to existing midstream network>,
  "capacityBopd": <number — design capacity in BOPD>,
  "pressureRequirementPsi": <number — design inlet pressure in PSI>,
  "takeawayRisk": "High" | "Medium" | "Low",
  "recommendation": "<one sentence pipeline strategy>"
}`;

    try {
        const raw = await callLLM({ prompt, maxTokens: 300 });
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in response");
        const parsed = JSON.parse(match[0]) as Partial<PipelinePlan>;
        const validRisks = ["High", "Medium", "Low"];
        if (!validRisks.includes(parsed.takeawayRisk ?? "")) throw new Error("Invalid takeawayRisk");
        return parsed as PipelinePlan;
    } catch {
        return derivePipelinePlan(wellCount, expectedProduction, location);
    }
}
