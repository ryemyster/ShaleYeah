#!/usr/bin/env tsx
/**
 * SHALE YEAH Curve Quality Control (TypeScript)
 *
 * Computes RMSE and NRMSE for curve analysis and validation
 * Replaces curve-qc.py with modern TypeScript implementation
 */

import fs from "node:fs";
import { LASInputError, parseLASFile } from "./las-parse.js";
import { sampleStatistics } from "./las-review.js";

interface QCMetrics {
	rmse: number;
	nrmse: number;
}

interface CurveAnalysis {
	curve: string;
	totalPoints: number;
	validPoints: number;
	minValue: number | null;
	maxValue: number | null;
	meanValue: number | null;
	depthStart: number | null;
	depthStop: number | null;
	depthStep: number | null;
	rmse?: number;
	nrmse?: number;
	error?: string;
	availableCurves?: string[];
}

/**
 * Compute Root Mean Square Error (RMSE) and Normalized RMSE (NRMSE)
 */
function computeRMSE_NRMSE(values: number[], fittedValues: number[]): QCMetrics {
	if (values.length !== fittedValues.length || values.length === 0) {
		return { rmse: NaN, nrmse: NaN };
	}

	// Remove NaN values
	const validPairs: [number, number][] = [];
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		const f = fittedValues[i];
		if (!Number.isNaN(v) && !Number.isNaN(f)) {
			validPairs.push([v, f]);
		}
	}

	if (validPairs.length === 0) {
		return { rmse: NaN, nrmse: NaN };
	}

	// Calculate RMSE
	let sumSquaredErrors = 0;
	const validValues: number[] = [];

	for (const [v, f] of validPairs) {
		sumSquaredErrors += (v - f) ** 2;
		validValues.push(v);
	}

	const mse = sumSquaredErrors / validPairs.length;
	const rmse = Math.sqrt(mse);

	// Calculate NRMSE (normalized by range)
	const minValue = Math.min(...validValues);
	const maxValue = Math.max(...validValues);
	const valueRange = maxValue - minValue;
	const nrmse = valueRange > 0 ? rmse / valueRange : NaN;

	return { rmse, nrmse };
}

/** Observational CLI summary; accuracy needs an independently supplied reference. */
function analyzeLASCurve(filePath: string, curveName: string): CurveAnalysis {
	try {
		const las = parseLASFile(filePath);
		const curve = las.curves.find((c) => c.name === curveName.toUpperCase());
		const statistics = curve ? sampleStatistics(curve.data) : null;
		return {
			curve: curveName,
			totalPoints: curve?.data.length ?? 0,
			validPoints: curve?.data.filter(Number.isFinite).length ?? 0,
			minValue: statistics?.min ?? null,
			maxValue: statistics?.max ?? null,
			meanValue: statistics?.mean ?? null,
			depthStart: las.depth_start,
			depthStop: las.depth_stop,
			depthStep: las.depth_step,
			...(!curve ? { error: "curve_unavailable", availableCurves: las.curves.map((c) => c.name) } : {}),
			...(curve && !statistics ? { error: "all_null" } : {}),
		};
	} catch (error) {
		return {
			curve: curveName,
			error: error instanceof LASInputError ? error.message : "source_unavailable",
			totalPoints: 0,
			validPoints: 0,
			minValue: null,
			maxValue: null,
			meanValue: null,
			depthStart: null,
			depthStop: null,
			depthStep: null,
		};
	}
}

/**
 * CLI usage
 */
const main = () => {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error("Usage: curve-qc <file.las> CURVE=<curve_name>");
		console.error("Example: curve-qc demo.las CURVE=GR");
		process.exit(1);
	}

	const filePath = args[0];
	const curveArg = args[1];

	if (!fs.existsSync(filePath)) {
		console.error(`Error: File '${filePath}' not found`);
		process.exit(1);
	}

	if (!curveArg.startsWith("CURVE=")) {
		console.error("Error: Second argument must be CURVE=<curve_name>");
		process.exit(1);
	}

	const curveName = curveArg.split("=")[1];

	if (!curveName) {
		console.error("Error: Curve name cannot be empty");
		process.exit(1);
	}

	try {
		const result = analyzeLASCurve(filePath, curveName);
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(`Error analyzing curve: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { analyzeLASCurve, type CurveAnalysis, computeRMSE_NRMSE, type QCMetrics };
