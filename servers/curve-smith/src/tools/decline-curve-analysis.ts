#!/usr/bin/env tsx
/**
 * Professional decline curve analysis tool for reservoir engineering
 * Implements Arps decline curve models (exponential, hyperbolic, harmonic)
 */

export interface ProductionData {
	date: string;
	days: number;
	oil: number; // bopd
	gas: number; // mcfd
	water: number; // bwpd
}

export interface DeclineParameters {
	initialRate: number;
	declineRate: number; // fraction per year
	bFactor: number; // hyperbolic exponent (0-1)
	r2: number; // correlation coefficient
	rmse: number; // root mean square error
}

export interface CurveFitResult {
	curveType: "exponential" | "hyperbolic" | "harmonic";
	parameters: DeclineParameters;
	eur: number; // estimated ultimate recovery
	qualityGrade: "Excellent" | "Good" | "Fair" | "Poor";
	confidence: number; // percentage
	forecast: ProductionData[];
}

/**
 * Parse CSV production data
 */
export function parseProductionData(csvData: string): ProductionData[] {
	const lines = csvData.trim().split("\n");
	const headers = lines[0].toLowerCase().split(",");

	const dateCol = headers.findIndex(
		(h) => h.includes("date") || h.includes("time"),
	);
	const daysCol = headers.findIndex(
		(h) => h.includes("days") || h.includes("day"),
	);
	const oilCol = headers.findIndex(
		(h) => h.includes("oil") || h.includes("bopd"),
	);
	const gasCol = headers.findIndex(
		(h) => h.includes("gas") || h.includes("mcfd"),
	);
	const waterCol = headers.findIndex(
		(h) => h.includes("water") || h.includes("bwpd"),
	);

	return lines
		.slice(1)
		.map((line, index) => {
			const values = line.split(",");
			return {
				date: dateCol >= 0 ? values[dateCol] : `2024-01-${index + 1}`,
				days: daysCol >= 0 ? parseFloat(values[daysCol]) : index * 30,
				oil: oilCol >= 0 ? parseFloat(values[oilCol]) || 0 : 0,
				gas: gasCol >= 0 ? parseFloat(values[gasCol]) || 0 : 0,
				water: waterCol >= 0 ? parseFloat(values[waterCol]) || 0 : 0,
			};
		})
		.filter((row) => !Number.isNaN(row.days));
}

/**
 * Fit exponential decline curve: q(t) = qi * exp(-D * t)
 */
export function fitExponentialDecline(
	data: ProductionData[],
	product: "oil" | "gas",
): CurveFitResult {
	const validData = data.filter((d) => d[product] > 0 && d.days >= 0);

	if (validData.length < 3) {
		throw new Error("Insufficient data for curve fitting");
	}

	// Linear regression on log-transformed data
	const x = validData.map((d) => d.days / 365); // years
	const y = validData.map((d) => Math.log(d[product]));

	const n = x.length;
	const sumX = x.reduce((sum, val) => sum + val, 0);
	const sumY = y.reduce((sum, val) => sum + val, 0);
	const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
	const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
	const _sumY2 = y.reduce((sum, val) => sum + val * val, 0);

	const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
	const intercept = (sumY - slope * sumX) / n;

	const qi = Math.exp(intercept);
	const Di = -slope; // nominal decline rate

	// Calculate R² and RMSE
	const yPred = x.map((xi) => intercept + slope * xi);
	const yMean = sumY / n;
	const ss_tot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
	const ss_res = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
	const r2 = 1 - ss_res / ss_tot;
	const rmse = Math.sqrt(ss_res / n);

	// Calculate EUR (30 years)
	const timeHorizon = 30; // years
	const eur = (qi / Di) * (1 - Math.exp(-Di * timeHorizon));

	// Generate forecast
	const forecast: ProductionData[] = [];
	for (let t = 0; t <= timeHorizon * 12; t++) {
		// monthly
		const years = t / 12;
		const rate = qi * Math.exp(-Di * years);
		forecast.push({
			date: `${2024 + Math.floor(years)}-${String(Math.floor((years % 1) * 12) + 1).padStart(2, "0")}-01`,
			days: years * 365,
			oil: product === "oil" ? rate : 0,
			gas: product === "gas" ? rate : 0,
			water: 0,
		});
	}

	return {
		curveType: "exponential",
		parameters: {
			initialRate: qi,
			declineRate: Di,
			bFactor: 0, // N/A for exponential
			r2,
			rmse,
		},
		eur,
		qualityGrade: getQualityGrade(r2, validData.length),
		confidence: Math.round(r2 * 100),
		forecast,
	};
}

/**
 * Fit hyperbolic decline curve: q(t) = qi / (1 + b * Di * t)^(1/b)
 */
export function fitHyperbolicDecline(
	data: ProductionData[],
	product: "oil" | "gas",
): CurveFitResult {
	const validData = data.filter((d) => d[product] > 0 && d.days >= 0);

	if (validData.length < 4) {
		throw new Error("Insufficient data for hyperbolic curve fitting");
	}

	// Simplified approach: assume b = 0.5 and solve for qi and Di
	const b = 0.5; // typical value for shale wells
	const t = validData.map((d) => d.days / 365); // years
	const q = validData.map((d) => d[product]);

	// Non-linear regression would be ideal, but using simplified approach
	const qi = q[0]; // first production rate

	// Estimate Di from early production data
	let bestDi = 0.1;
	let bestR2 = 0;

	for (let Di = 0.05; Di <= 2.0; Di += 0.05) {
		const predicted = t.map((ti) => qi / (1 + b * Di * ti) ** (1 / b));
		const r2 = calculateR2(q, predicted);

		if (r2 > bestR2) {
			bestR2 = r2;
			bestDi = Di;
		}
	}

	const predicted = t.map((ti) => qi / (1 + b * bestDi * ti) ** (1 / b));
	const rmse = Math.sqrt(
		q.reduce((sum, qi, i) => sum + (qi - predicted[i]) ** 2, 0) / q.length,
	);

	// Calculate EUR using Arps formula
	const timeHorizon = 30; // years
	const eur =
		(qi / ((1 - b) * bestDi)) *
		(1 - (1 + b * bestDi * timeHorizon) ** ((1 - b) / b));

	// Generate forecast
	const forecast: ProductionData[] = [];
	for (let t = 0; t <= timeHorizon * 12; t++) {
		// monthly
		const years = t / 12;
		const rate = qi / (1 + b * bestDi * years) ** (1 / b);
		forecast.push({
			date: `${2024 + Math.floor(years)}-${String(Math.floor((years % 1) * 12) + 1).padStart(2, "0")}-01`,
			days: years * 365,
			oil: product === "oil" ? rate : 0,
			gas: product === "gas" ? rate : 0,
			water: 0,
		});
	}

	return {
		curveType: "hyperbolic",
		parameters: {
			initialRate: qi,
			declineRate: bestDi,
			bFactor: b,
			r2: bestR2,
			rmse,
		},
		eur,
		qualityGrade: getQualityGrade(bestR2, validData.length),
		confidence: Math.round(bestR2 * 100),
		forecast,
	};
}

/**
 * Calculate coefficient of determination (R²)
 */
function calculateR2(observed: number[], predicted: number[]): number {
	const mean = observed.reduce((sum, val) => sum + val, 0) / observed.length;
	const ss_tot = observed.reduce((sum, val) => sum + (val - mean) ** 2, 0);
	const ss_res = observed.reduce(
		(sum, val, i) => sum + (val - predicted[i]) ** 2,
		0,
	);
	return 1 - ss_res / ss_tot;
}

/**
 * Determine quality grade based on R² and data points
 */
function getQualityGrade(
	r2: number,
	dataPoints: number,
): "Excellent" | "Good" | "Fair" | "Poor" {
	if (r2 > 0.9 && dataPoints >= 12) return "Excellent";
	if (r2 > 0.8 && dataPoints >= 6) return "Good";
	if (r2 > 0.6 && dataPoints >= 3) return "Fair";
	return "Poor";
}

/**
 * CLI interface
 */
async function main() {
	const filePath = process.argv[2];
	const product = (process.argv[3] || "oil") as "oil" | "gas";
	const curveType = (process.argv[4] || "hyperbolic") as
		| "exponential"
		| "hyperbolic";

	if (!filePath) {
		console.error(
			"Usage: decline-curve-analysis.ts <production-file.csv> [oil|gas] [exponential|hyperbolic]",
		);
		process.exit(1);
	}

	try {
		const fs = await import("node:fs/promises");
		const csvData = await fs.readFile(filePath, "utf8");
		const data = parseProductionData(csvData);

		let result: CurveFitResult;
		if (curveType === "exponential") {
			result = fitExponentialDecline(data, product);
		} else {
			result = fitHyperbolicDecline(data, product);
		}

		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(`Error: ${error}`);
		process.exit(1);
	}
}

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
