export type ConfidenceScale = "unit_interval" | "percentage";

export interface ConfidenceMetadata {
	confidence: number | null;
	confidenceScale: ConfidenceScale | null;
	confidenceStatus: "available" | "unavailable" | "invalid" | "unscaled";
}

export function validateConfidenceScale(scale: unknown): asserts scale is ConfidenceScale | undefined {
	if (scale !== undefined && scale !== "unit_interval" && scale !== "percentage") {
		throw new Error("confidenceScale must be unit_interval or percentage when declared");
	}
}

/** Preserve raw scores; interpreting an undeclared scale would invent information. */
export function confidenceMetadata(value: unknown, scale?: ConfidenceScale): ConfidenceMetadata {
	const confidenceScale = scale ?? null;
	if (value === undefined || value === null) {
		return { confidence: null, confidenceScale, confidenceStatus: "unavailable" };
	}
	const maximum = scale === "unit_interval" ? 1 : 100;
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
		return { confidence: null, confidenceScale, confidenceStatus: "invalid" };
	}
	return { confidence: value, confidenceScale, confidenceStatus: scale ? "available" : "unscaled" };
}
