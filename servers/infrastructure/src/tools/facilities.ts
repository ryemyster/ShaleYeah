import { callLLM } from "@shaleyeah/sdk";

export interface FacilitySizing {
	batteries: number;
	separators: number;
	compressors: number;
	saltWaterDisposalWells: number;
	treatmentCapacityBwpd: number;
	notes: string[];
}

/**
 * Standard O&G surface facility sizing rules:
 *   - 1 battery per 8 wells (manifolds + storage tanks per pad cluster)
 *   - 1 separator per 4 wells (three-phase: oil/gas/water)
 *   - 1 compressor per 5,000 BOPD equivalent production
 *   - SWD wells: 1 per 10 wells minimum; saltwater volumes ≈ 3× oil production
 */
export function deriveFacilitySizing(wellCount: number, expectedProduction: number): FacilitySizing {
	const batteries = Math.ceil(wellCount / 8);
	const separators = Math.ceil(wellCount / 4);
	const compressors = Math.ceil(expectedProduction / 5000);
	const saltWaterDisposalWells = Math.max(1, Math.ceil(wellCount / 10));
	const treatmentCapacityBwpd = Math.round(expectedProduction * 3);

	const notes: string[] = [
		`${batteries} battery station${batteries > 1 ? "s" : ""} — oil storage + metering for ${wellCount} wells`,
		`${separators} three-phase separator${separators > 1 ? "s" : ""} — oil/gas/water separation`,
		`SWD capacity sized for ${treatmentCapacityBwpd.toLocaleString()} BWPD (barrels of water per day)`,
	];

	if (compressors > 2) {
		notes.push(`${compressors} compressors required — consider centralized compression facility`);
	}

	return { batteries, separators, compressors, saltWaterDisposalWells, treatmentCapacityBwpd, notes };
}

export async function synthesizeFacilitySizingWithLLM(params: {
	wellCount: number;
	expectedProduction: number;
	location: string;
}): Promise<FacilitySizing> {
	const { wellCount, expectedProduction, location } = params;

	const prompt = `You are Structura Ingenious, a master O&G infrastructure architect.

Size the surface facilities for this project.

PROJECT:
Well count: ${wellCount}
Expected production: ${expectedProduction} BOPD
Location: ${location}

Return ONLY valid JSON matching this exact shape:
{
  "batteries": <number — oil battery stations>,
  "separators": <number — three-phase separators>,
  "compressors": <number — compression units>,
  "saltWaterDisposalWells": <number — SWD wells>,
  "treatmentCapacityBwpd": <number — water treatment capacity in BWPD>,
  "notes": ["<note 1>", "<note 2>", "<note 3>"]
}`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 350 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		return JSON.parse(match[0]) as FacilitySizing;
	} catch {
		return deriveFacilitySizing(wellCount, expectedProduction);
	}
}
