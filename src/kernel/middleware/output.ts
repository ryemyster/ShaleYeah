/**
 * SHALE YEAH Agent OS - Output Shaping Middleware
 *
 * Transforms raw tool responses into AgentOSResponse format with
 * progressive detail levels. Implements Arcade patterns:
 * - Token-Efficient Response (minimize payload for agents)
 * - Progressive Detail (summary → standard → full)
 * - Response Shaper (per-domain formatting rules)
 */

import type { AgentOSResponse, DetailLevel, ResponseMetadata } from "../types.js";

/**
 * Per-domain summary field definitions.
 * Summary level extracts only these keys from each domain's data object.
 */
const SUMMARY_FIELDS: Record<string, string[]> = {
	geological: [
		"formationQuality.reservoirQuality",
		"formationQuality.hydrocarbonPotential",
		"investmentPerspective.recommendedAction",
		"investmentPerspective.geologicalConfidence",
		"professionalSummary",
	],
	economic: ["npv", "irr", "paybackMonths", "confidence"],
	curve: ["eur", "initialRate", "qualityGrade", "confidence"],
	risk: ["overallRiskScore", "overallRisk", "confidence"],
	market: ["confidence"],
};

/**
 * Fields to strip from standard level (large arrays, raw data).
 * Standard keeps everything except these verbose fields.
 */
const STANDARD_STRIP_FIELDS: string[] = [
	"sensitivityAnalysis",
	"monteCarloResults",
	"rawData",
	"depthData",
	"curveData",
];

/**
 * Output shaping middleware — transforms raw responses into AgentOSResponse.
 */
export class OutputShaper {
	/**
	 * Shape a raw tool response into an AgentOSResponse with the requested detail level.
	 */
	shape<T = unknown>(
		rawData: T,
		options: {
			detailLevel?: DetailLevel;
			server: string;
			persona: string;
			executionTimeMs: number;
			confidence?: number;
		},
	): AgentOSResponse<T> {
		const level = options.detailLevel ?? "standard";
		const confidence = options.confidence ?? this.extractConfidence(rawData) ?? 0;

		const domain = this.detectDomain(rawData);
		const shaped = this.applyDetailLevel(rawData, level, domain);
		const summary = this.summarize(rawData, domain, confidence);

		const metadata: ResponseMetadata = {
			server: options.server,
			persona: options.persona,
			executionTimeMs: options.executionTimeMs,
			timestamp: new Date().toISOString(),
		};

		return {
			success: true,
			summary,
			confidence,
			data: shaped as T,
			detailLevel: level,
			completeness: 100,
			metadata,
		};
	}

	/**
	 * Generate a 1-2 sentence natural language summary for the agent.
	 */
	summarize(data: unknown, domain: string | null, confidence: number): string {
		const pct = Math.round(confidence);
		const obj = data as Record<string, unknown>;

		if (domain === "geological") {
			const geo = obj.geological as Record<string, unknown> | undefined;
			const quality = (geo?.formationQuality as Record<string, unknown>)?.reservoirQuality ?? "unknown";
			const action = (geo?.investmentPerspective as Record<string, unknown>)?.recommendedAction ?? "unknown";
			return `${capitalize(String(quality))} reservoir quality. Recommended action: ${action}. Confidence: ${pct}%.`;
		}

		if (domain === "economic") {
			const econ = obj.economic as Record<string, unknown> | undefined;
			const npv = econ?.npv as number | undefined;
			const irr = econ?.irr as number | undefined;
			const npvStr = npv ? `$${(npv / 1_000_000).toFixed(1)}M` : "N/A";
			const irrStr = irr ? `${irr}%` : "N/A";
			return `NPV: ${npvStr}, IRR: ${irrStr}. Confidence: ${pct}%.`;
		}

		if (domain === "curve") {
			const curve = obj.curve as Record<string, unknown> | undefined;
			const grade = curve?.qualityGrade ?? "unknown";
			const eur = curve?.eur as Record<string, number> | undefined;
			const eurStr = eur?.oil ? `${(eur.oil / 1000).toFixed(0)}K BOE` : "N/A";
			return `EUR: ${eurStr}, grade: ${grade}. Confidence: ${pct}%.`;
		}

		if (domain === "risk") {
			const risk = obj.risk as Record<string, unknown> | undefined;
			const score = risk?.overallRiskScore ?? risk?.overallRisk ?? "N/A";
			return `Overall risk score: ${score}/100. Confidence: ${pct}%.`;
		}

		return `Analysis complete. Confidence: ${pct}%.`;
	}

	/**
	 * Apply detail level to data, stripping fields as appropriate.
	 */
	applyDetailLevel(data: unknown, level: DetailLevel, domain: string | null): unknown {
		if (level === "full" || !data || typeof data !== "object") {
			return data;
		}

		if (level === "summary") {
			return this.extractSummary(data as Record<string, unknown>, domain);
		}

		// Standard: strip verbose fields
		return this.stripFields(data as Record<string, unknown>, STANDARD_STRIP_FIELDS);
	}

	/**
	 * Extract only summary-level fields from data.
	 */
	private extractSummary(data: Record<string, unknown>, domain: string | null): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		// Always include confidence at top level
		if ("confidence" in data) {
			result.confidence = data.confidence;
		}

		if (domain && domain in data) {
			const domainData = data[domain] as Record<string, unknown>;
			const fields = SUMMARY_FIELDS[domain];

			if (fields) {
				const domainSummary: Record<string, unknown> = {};
				for (const fieldPath of fields) {
					const value = getNestedValue(domainData, fieldPath);
					if (value !== undefined) {
						// Flatten: use the last segment as key
						const key = fieldPath.split(".").pop()!;
						domainSummary[key] = value;
					}
				}
				result[domain] = domainSummary;
			} else {
				// No summary rules — take first 3 keys
				const keys = Object.keys(domainData).slice(0, 3);
				const partial: Record<string, unknown> = {};
				for (const k of keys) {
					partial[k] = domainData[k];
				}
				result[domain] = partial;
			}
		} else {
			// No recognized domain — take first 3 top-level keys
			const keys = Object.keys(data)
				.filter((k) => k !== "confidence")
				.slice(0, 3);
			for (const k of keys) {
				result[k] = data[k];
			}
		}

		return result;
	}

	/**
	 * Strip specified keys from an object (shallow, recursive into domain sub-objects).
	 */
	private stripFields(data: Record<string, unknown>, fields: string[]): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
			if (fields.includes(key)) continue;

			if (value && typeof value === "object" && !Array.isArray(value)) {
				result[key] = this.stripFields(value as Record<string, unknown>, fields);
			} else {
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * Detect which domain key is present in the data.
	 */
	private detectDomain(data: unknown): string | null {
		if (!data || typeof data !== "object") return null;
		const obj = data as Record<string, unknown>;

		const domains = ["geological", "economic", "curve", "risk", "market", "gis"];
		for (const d of domains) {
			if (d in obj) return d;
		}
		return null;
	}

	/**
	 * Extract confidence from nested data structures.
	 */
	private extractConfidence(data: unknown): number | null {
		if (!data || typeof data !== "object") return null;
		const obj = data as Record<string, unknown>;

		if (typeof obj.confidence === "number") return obj.confidence;

		// Check one level deep
		for (const val of Object.values(obj)) {
			if (val && typeof val === "object" && typeof (val as Record<string, unknown>).confidence === "number") {
				return (val as Record<string, unknown>).confidence as number;
			}
		}
		return null;
	}
}

// ==========================================
// Helpers
// ==========================================

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;

	for (const part of parts) {
		if (!current || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}
