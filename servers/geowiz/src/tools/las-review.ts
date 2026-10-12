import { createHash } from "node:crypto";
import { z } from "zod";
import { type LASData, LASInputError, readLASNumber } from "./las-parse.js";

export const densityAssumptionsSchema = z
	.object({
		matrixDensity: z.number().positive().finite(),
		fluidDensity: z.number().positive().finite(),
		unit: z.enum(["g/cm3", "kg/m3"]),
		basis: z.string().trim().min(1).max(256),
	})
	.strict();

export const reviewConfidenceSchema = z
	.object({
		value: z.number().min(0).max(1).finite(),
		basis: z.string().trim().min(1).max(256),
	})
	.strict();

export interface LASReviewOptions {
	densityAssumptions?: z.infer<typeof densityAssumptionsSchema>;
	reviewConfidence?: z.infer<typeof reviewConfidenceSchema>;
}

/** Statistics of observed samples, not a depth-weighted reservoir average. */
export function sampleStatistics(values: number[]) {
	let count = 0,
		mean = 0,
		min = Infinity,
		max = -Infinity;
	for (const value of values) {
		if (!Number.isFinite(value)) continue;
		count++;
		mean = mean * ((count - 1) / count) + value / count;
		min = Math.min(min, value);
		max = Math.max(max, value);
	}
	return count ? { min, max, mean } : null;
}

function densityScale(unit: string): number | undefined {
	switch (unit.toUpperCase()) {
		case "G/C3":
		case "G/CC":
		case "G/CM3":
			return 1;
		case "K/M3":
		case "KG/M3":
			return 0.001;
		default:
			return undefined;
	}
}

const requiredEvidence: Record<string, string[]> = {
	formations: ["formation tops or correlated stratigraphy with well/location evidence"],
	netPay: ["fluid/saturation model, calibrated pay cutoffs and valid depth intervals"],
	porosity: ["lithology/fluid calibration and environmental corrections or core validation"],
	permeability: ["calibrated core, NMR or a validated formation-specific model"],
	toc: ["laboratory TOC or a calibrated multi-log TOC model"],
	maturity: ["thermal history and measured maturity indicators"],
	targets: ["integrated geology, engineering and reviewed target criteria"],
	confidence: ["a qualified assessment with an explicit basis; completeness is not confidence"],
};

export function reviewLAS(las: LASData, options: LASReviewOptions = {}) {
	const observations = las.curves.map((curve) => {
		const validPoints = curve.data.reduce((count, value) => count + (Number.isFinite(value) ? 1 : 0), 0);
		return {
			evidenceId: `curve:${curve.name}`,
			curve: curve.name,
			unit: curve.unit,
			points: curve.data.length,
			validPoints,
			nullPoints: curve.data.length - validPoints,
			coverage: validPoints / curve.data.length,
			statistics: sampleStatistics(curve.data),
		};
	});
	const measurementCurves = observations.slice(1);
	const total = measurementCurves.reduce((count, curve) => count + curve.points, 0);
	const valid = measurementCurves.reduce((count, curve) => count + curve.validPoints, 0);
	const warnings: Array<{ code: string; curve?: string }> = [];
	for (const curve of measurementCurves) {
		if (!curve.validPoints) warnings.push({ code: "all_null", curve: curve.curve });
		else if (curve.nullPoints) warnings.push({ code: "missing_samples", curve: curve.curve });
		if (!curve.unit) warnings.push({ code: "undeclared_curve_unit", curve: curve.curve });
	}
	const assumptions: Array<{ parameter: string; value: number; unit: string; basis: string }> = [];
	let matrix: number | undefined, fluid: number | undefined;
	if (options.densityAssumptions !== undefined) {
		const parsed = densityAssumptionsSchema.safeParse(options.densityAssumptions);
		if (!parsed.success) throw new LASInputError("invalid_assumptions");
		const supplied = parsed.data;
		const scale = supplied.unit === "kg/m3" ? 0.001 : 1;
		matrix = supplied.matrixDensity * scale;
		fluid = supplied.fluidDensity * scale;
		assumptions.push(
			{ parameter: "matrixDensity", value: supplied.matrixDensity, unit: supplied.unit, basis: supplied.basis },
			{ parameter: "fluidDensity", value: supplied.fluidDensity, unit: supplied.unit, basis: supplied.basis },
		);
	} else {
		const m = las.parameters.MDEN,
			f = las.parameters.FDEN ?? las.parameters.FD;
		const ms = m ? densityScale(m.unit) : undefined,
			fs = f ? densityScale(f.unit) : undefined;
		const mv = m ? (readLASNumber(m.value) ?? NaN) : NaN,
			fv = f ? (readLASNumber(f.value) ?? NaN) : NaN;
		const alternative = las.parameters.FD;
		const alternativeScale = alternative ? densityScale(alternative.unit) : undefined;
		const alternativeValue = alternative ? (readLASNumber(alternative.value) ?? NaN) : NaN;
		const conflict =
			las.parameters.FDEN &&
			alternative &&
			(alternativeScale === undefined ||
				!Number.isFinite(alternativeValue) ||
				fs === undefined ||
				Math.abs(alternativeValue * alternativeScale - fv * fs) > 32 * Number.EPSILON * Math.max(1, Math.abs(fv * fs)));
		if (conflict) warnings.push({ code: "conflicting_density_assumptions" });
		else if (ms !== undefined && fs !== undefined && Number.isFinite(mv) && Number.isFinite(fv)) {
			matrix = mv * ms;
			fluid = fv * fs;
			assumptions.push(
				{ parameter: "matrixDensity", value: mv, unit: m.unit, basis: "LAS ~P MDEN; not independently calibrated" },
				{
					parameter: "fluidDensity",
					value: fv,
					unit: f.unit,
					basis: "LAS ~P fluid density; not independently calibrated",
				},
			);
		}
	}
	const rhob = las.curves.find((curve) => curve.name === "RHOB");
	const scale = rhob ? densityScale(rhob.unit) : undefined;
	let densityPorosity: {
		method: string;
		reference: string;
		unit: "fraction";
		basis: string;
		curve: string;
		validPoints: number;
		nullPoints: number;
		invalidCalculationPoints: number;
		rangeViolations: number;
		statistics: ReturnType<typeof sampleStatistics>;
	} | null = null;
	if (matrix !== undefined && fluid !== undefined) {
		if (matrix <= fluid || fluid <= 0) warnings.push({ code: "invalid_density_assumptions" });
		else if (rhob && scale !== undefined) {
			const derived = rhob.data.map((value) =>
				Number.isFinite(value) ? (matrix - value * scale) / (matrix - fluid) : NaN,
			);
			const validPoints = derived.filter(Number.isFinite).length;
			const nullPoints = rhob.data.filter(Number.isNaN).length;
			const invalidCalculationPoints = las.rows - nullPoints - validPoints;
			if (invalidCalculationPoints) warnings.push({ code: "nonfinite_density_calculation", curve: "RHOB" });
			const rangeViolations = derived.filter((value) => Number.isFinite(value) && (value < 0 || value > 1)).length;
			if (rangeViolations) warnings.push({ code: "apparent_porosity_outside_fraction_range", curve: "RHOB" });
			densityPorosity = {
				method: "(matrixDensity - bulkDensity) / (matrixDensity - fluidDensity)",
				reference: "https://www.slb.com/resource-library/oilfield-review/defining-series/defining-log-interpretation",
				unit: "fraction",
				curve: "RHOB",
				basis: "apparent density porosity using supplied assumptions; uncalibrated",
				validPoints,
				nullPoints,
				invalidCalculationPoints,
				rangeViolations,
				statistics: sampleStatistics(derived),
			};
		}
	}
	if (!rhob) warnings.push({ code: "missing_density_curve" });
	else if (scale === undefined) warnings.push({ code: "unsupported_density_unit", curve: "RHOB" });
	if (matrix === undefined || fluid === undefined) warnings.push({ code: "missing_density_assumptions" });
	const confidence =
		options.reviewConfidence === undefined ? null : reviewConfidenceSchema.safeParse(options.reviewConfidence);
	if (confidence && !confidence.success) throw new LASInputError("invalid_assumptions");
	const declaredConfidence = confidence?.data ?? null;
	const packet = {
		version: "0.1.0",
		input: {
			format: "LAS",
			version: las.version,
			wellName: las.well_name || null,
			contentHash: { algorithm: "sha256", value: las.content_hash },
			rows: las.rows,
			nullValue: las.null_value,
			densityParameters: ["MDEN", "FDEN", "FD"].flatMap((parameter) => {
				const item = las.parameters[parameter];
				if (!item) return [];
				return [{ parameter, value: readLASNumber(item.value), unit: item.unit }];
			}),
			index: {
				curve: las.curves[0].name,
				unit: las.depth_unit,
				start: las.depth_start,
				stop: las.depth_stop,
				step: las.depth_step,
				sampling: las.depth_step === 0 ? "irregular" : "regular",
				basis: "declared LAS index; no inferred true vertical depth",
			},
		},
		observations,
		assumptions,
		derived: { densityPorosity },
		qc: { completeness: total ? valid / total : null, accuracy: null, confidence: null, warnings },
		unknowns: Object.entries(requiredEvidence).map(([field, requiredEvidence]) => ({
			field,
			reason: "not established by the supplied LAS measurements",
			requiredEvidence,
		})),
		review: { required: true, status: "unreviewed", declaredConfidence },
	};
	return { ...packet, revision: `sha256:${createHash("sha256").update(JSON.stringify(packet)).digest("hex")}` };
}

export type LASReview = ReturnType<typeof reviewLAS>;
