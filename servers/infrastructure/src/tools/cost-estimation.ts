import { callLLM } from "@shaleyeah/sdk";

export interface InfrastructureCostEstimate {
    pipelineCost: number;
    facilitiesCost: number;
    compressorCost: number;
    swdCost: number;
    totalCost: number;
    costPerWell: number;
    contingencyPct: number;
}

/**
 * Cost benchmarks derived from Permian/DJ Basin midstream projects (2024–2025 USD):
 *   - Gathering pipeline: $250,000/well (2-4" line, pad tie-ins, right-of-way)
 *   - Facilities: $180,000/well (battery, separator, metering, controls)
 *   - Compression: $400,000/unit (electric or gas-driven reciprocating compressor)
 *   - SWD well: $1,200,000 each (drill, complete, surface equipment)
 *   - Contingency: 15% for remote locations, 10% for established areas
 */
export function deriveInfrastructureCostEstimate(
    wellCount: number,
    compressors: number,
    swdWells: number,
    location: string,
): InfrastructureCostEstimate {
    const isRemote = !["texas", "oklahoma", "kansas"].some((s) => location.toLowerCase().includes(s));
    const pipelineCost = wellCount * 250_000;
    const facilitiesCost = wellCount * 180_000;
    const compressorCost = compressors * 400_000;
    const swdCost = swdWells * 1_200_000;
    const subtotal = pipelineCost + facilitiesCost + compressorCost + swdCost;
    const contingencyPct = isRemote ? 15 : 10;
    const totalCost = Math.round(subtotal * (1 + contingencyPct / 100));
    const costPerWell = Math.round(totalCost / wellCount);

    return { pipelineCost, facilitiesCost, compressorCost, swdCost, totalCost, costPerWell, contingencyPct };
}

export async function synthesizeCostEstimateWithLLM(params: {
    wellCount: number;
    compressors: number;
    swdWells: number;
    location: string;
}): Promise<InfrastructureCostEstimate> {
    const { wellCount, compressors, swdWells, location } = params;
    const fallback = deriveInfrastructureCostEstimate(wellCount, compressors, swdWells, location);

    const prompt = `You are Structura Ingenious, a master O&G infrastructure architect.

Estimate infrastructure capital costs (CAPEX) for this project.

PROJECT:
Well count: ${wellCount}
Compressor units required: ${compressors}
SWD (salt water disposal) wells required: ${swdWells}
Location: ${location}
Rough baseline: $${(fallback.totalCost / 1_000_000).toFixed(1)}M total

Return ONLY valid JSON matching this exact shape:
{
  "pipelineCost": <number — USD for gathering pipelines>,
  "facilitiesCost": <number — USD for surface facilities>,
  "compressorCost": <number — USD for compression>,
  "swdCost": <number — USD for salt water disposal>,
  "totalCost": <number — total USD including contingency>,
  "costPerWell": <number — USD per well>,
  "contingencyPct": <number — contingency percentage applied>
}`;

    try {
        const raw = await callLLM({ prompt, maxTokens: 300 });
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in response");
        return JSON.parse(match[0]) as InfrastructureCostEstimate;
    } catch {
        return fallback;
    }
}
