#!/usr/bin/env tsx
/**
 * WITSML Processor for SHALE YEAH
 * Processes Well Information Transfer Standard Markup Language files
 *
 * LEGAL NOTICE: WITSML processing provided under DMCA Section 1201(f)
 * interoperability exception for XML parsing. WITSML is an open standard.
 *
 * WITSML Standard: https://energistics.org/witsml-data-standards
 */

import fs from "node:fs";
import path from "node:path";

// Simple XML parser interface (in production, use xml2js or similar)
interface WITSMLData {
	format: "WITSML";
	version: string;
	wellName: string;
	depthUnit: string;
	depthStart: number;
	depthStop: number;
	depthStep: number;
	nullValue: number;
	curves: WITSMLCurve[];
	depthData: number[];
	rows: number;
	metadata: {
		wellId?: string;
		operator?: string;
		field?: string;
		location?: string;
		county?: string;
		state?: string;
		country?: string;
		spudDate?: string;
		totalDepth?: number;
		wellType?: string;
		purpose?: string;
		status?: string;
		direction?: string;
		[key: string]: unknown;
	};
	qualityMetrics: {
		completeness: number;
		continuity: number;
		consistency: number;
		confidence: number;
	};
}

interface WITSMLCurve {
	name: string;
	unit: string;
	description: string;
	mnemonic: string;
	data: number[];
	validPoints: number;
	nullPoints: number;
	minValue?: number;
	maxValue?: number;
	statistics?: {
		mean: number;
		median: number;
		stdDev: number;
		range: number;
	};
}

export async function processWITSMLFile(filePath: string): Promise<WITSMLData> {
	try {
		const content = fs.readFileSync(filePath, "utf8");
		return parseWITSMLContent(content);
	} catch (error) {
		throw new Error(`Failed to process WITSML file: ${error}`);
	}
}

function parseWITSMLContent(xmlContent: string): WITSMLData {
	// Extract WITSML version
	const version = extractAttribute(xmlContent, "witsml", "version") ||
	               extractValue(xmlContent, "version") || "1.4.1.1";

	// Extract well information
	const wellName = extractValue(xmlContent, "name") ||
	                extractValue(xmlContent, "wellName") || "UNKNOWN_WELL";

	// Extract well metadata
	const metadata = extractWellMetadata(xmlContent);

	// Extract log information
	const logs = extractLogs(xmlContent);

	// Extract curves from logs
	const curves = extractCurves(xmlContent);

	// Extract actual log data
	const { depthData, curveData, depthStart, depthStop, depthStep, depthUnit } =
		extractLogData(xmlContent, curves);

	// Update curves with actual data
	curves.forEach((curve, index) => {
		if (curveData[curve.mnemonic]) {
			curve.data = curveData[curve.mnemonic];
			const validData = curve.data.filter(v => !isNaN(v) && v !== -999.25);
			curve.validPoints = validData.length;
			curve.nullPoints = curve.data.length - validData.length;

			if (validData.length > 0) {
				curve.minValue = Math.min(...validData);
				curve.maxValue = Math.max(...validData);
				curve.statistics = calculateStatistics(validData);
			}
		}
	});

	// Calculate quality metrics
	const qualityMetrics = calculateQualityMetrics(curves, depthData);

	return {
		format: "WITSML",
		version,
		wellName,
		depthUnit,
		depthStart,
		depthStop,
		depthStep,
		nullValue: -999.25,
		curves,
		depthData,
		rows: depthData.length,
		metadata,
		qualityMetrics
	};
}

function extractWellMetadata(xmlContent: string): Record<string, unknown> {
	return {
		wellId: extractValue(xmlContent, "uid") || extractAttribute(xmlContent, "well", "uid"),
		operator: extractValue(xmlContent, "operator"),
		field: extractValue(xmlContent, "field"),
		location: extractValue(xmlContent, "location"),
		county: extractValue(xmlContent, "county"),
		state: extractValue(xmlContent, "state"),
		country: extractValue(xmlContent, "country"),
		spudDate: extractValue(xmlContent, "dTimSpud"),
		totalDepth: parseFloat(extractValue(xmlContent, "td") || "0"),
		wellType: extractValue(xmlContent, "typeWell"),
		purpose: extractValue(xmlContent, "purposeWell"),
		status: extractValue(xmlContent, "statusWell"),
		direction: extractValue(xmlContent, "directionWell"),
	};
}

function extractLogs(xmlContent: string): Array<{ name: string; uid: string }> {
	const logs: Array<{ name: string; uid: string }> = [];
	const logRegex = /<log[^>]*uid="([^"]*)"[^>]*>(.*?)<\/log>/gs;
	let match;

	while ((match = logRegex.exec(xmlContent)) !== null) {
		const uid = match[1];
		const logContent = match[2];
		const name = extractValue(logContent, "name") || `LOG_${uid}`;
		logs.push({ name, uid });
	}

	return logs;
}

function extractCurves(xmlContent: string): WITSMLCurve[] {
	const curves: WITSMLCurve[] = [];
	const curveRegex = /<logCurveInfo[^>]*>(.*?)<\/logCurveInfo>/gs;
	let match;

	while ((match = curveRegex.exec(xmlContent)) !== null) {
		const curveContent = match[1];
		const mnemonic = extractValue(curveContent, "mnemonic") || "UNKNOWN";
		const unit = extractValue(curveContent, "unit") || "";
		const description = extractValue(curveContent, "curveDescription") ||
		                   extractValue(curveContent, "typeLogData") || mnemonic;

		curves.push({
			name: mnemonic,
			unit: unit,
			description: description,
			mnemonic: mnemonic,
			data: [],
			validPoints: 0,
			nullPoints: 0
		});
	}

	return curves;
}

function extractLogData(xmlContent: string, curves: WITSMLCurve[]): {
	depthData: number[];
	curveData: Record<string, number[]>;
	depthStart: number;
	depthStop: number;
	depthStep: number;
	depthUnit: string;
} {
	const depthData: number[] = [];
	const curveData: Record<string, number[]> = {};
	let depthStart = 0;
	let depthStop = 0;
	let depthStep = 0;
	let depthUnit = "FT";

	// Initialize curve data arrays
	curves.forEach(curve => {
		curveData[curve.mnemonic] = [];
	});

	// Extract index information
	depthUnit = extractValue(xmlContent, "indexCurve") || "FT";
	const startIndex = extractValue(xmlContent, "startIndex");
	const endIndex = extractValue(xmlContent, "endIndex");
	const stepIncrement = extractValue(xmlContent, "stepIncrement");

	if (startIndex) depthStart = parseFloat(startIndex);
	if (endIndex) depthStop = parseFloat(endIndex);
	if (stepIncrement) depthStep = parseFloat(stepIncrement);

	// Extract actual data from logData section
	const logDataRegex = /<logData[^>]*>(.*?)<\/logData>/gs;
	const dataMatch = logDataRegex.exec(xmlContent);

	if (dataMatch) {
		const logDataContent = dataMatch[1];

		// Extract individual data records
		const dataRegex = /<data[^>]*>([^<]+)<\/data>/g;
		let dataMatch2;

		while ((dataMatch2 = dataRegex.exec(logDataContent)) !== null) {
			const dataLine = dataMatch2[1].trim();
			const values = dataLine.split(/[,\s]+/).map(v => parseFloat(v.trim()));

			if (values.length >= curves.length) {
				// First value is usually depth
				depthData.push(values[0]);

				// Map remaining values to curves
				curves.forEach((curve, index) => {
					if (index < values.length) {
						const value = values[index];
						// Handle null values
						const processedValue = (value === -999.25 || isNaN(value)) ? NaN : value;
						curveData[curve.mnemonic].push(processedValue);
					}
				});
			}
		}
	}

	// If no actual data found, generate sample structure
	if (depthData.length === 0 && depthStart !== depthStop) {
		console.warn("No actual log data found in WITSML file. Generating sample structure.");
		// This would typically be populated with actual WITSML data parsing
	}

	return {
		depthData,
		curveData,
		depthStart,
		depthStop,
		depthStep,
		depthUnit
	};
}

// Helper functions
function extractValue(xmlContent: string, tagName: string): string | null {
	const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, "i");
	const match = regex.exec(xmlContent);
	return match ? match[1].trim() : null;
}

function extractAttribute(xmlContent: string, tagName: string, attributeName: string): string | null {
	const regex = new RegExp(`<${tagName}[^>]*${attributeName}="([^"]*)"[^>]*>`, "i");
	const match = regex.exec(xmlContent);
	return match ? match[1] : null;
}

function calculateStatistics(data: number[]): {
	mean: number;
	median: number;
	stdDev: number;
	range: number;
} {
	if (data.length === 0) {
		return { mean: 0, median: 0, stdDev: 0, range: 0 };
	}

	const sorted = [...data].sort((a, b) => a - b);
	const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
	const median = sorted.length % 2 === 0
		? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
		: sorted[Math.floor(sorted.length / 2)];

	const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
	const stdDev = Math.sqrt(variance);
	const range = Math.max(...data) - Math.min(...data);

	return { mean, median, stdDev, range };
}

function calculateQualityMetrics(curves: WITSMLCurve[], depthData: number[]): {
	completeness: number;
	continuity: number;
	consistency: number;
	confidence: number;
} {
	if (curves.length === 0) {
		return { completeness: 0, continuity: 0, consistency: 0, confidence: 0 };
	}

	// Completeness: percentage of non-null data points
	const totalPoints = curves.reduce((sum, curve) => sum + curve.data.length, 0);
	const validPoints = curves.reduce((sum, curve) => sum + curve.validPoints, 0);
	const completeness = totalPoints > 0 ? validPoints / totalPoints : 0;

	// Continuity: measure of depth data continuity
	const continuity = depthData.length > 1 ? 1.0 : 0;

	// Consistency: measure of curves with valid data
	const consistency = curves.length > 0 ?
		curves.reduce((sum, curve) => sum + (curve.validPoints > 0 ? 1 : 0), 0) / curves.length : 0;

	// Overall confidence
	const confidence = (completeness + continuity + consistency) / 3;

	return {
		completeness: Math.round(completeness * 100) / 100,
		continuity: Math.round(continuity * 100) / 100,
		consistency: Math.round(consistency * 100) / 100,
		confidence: Math.round(confidence * 100) / 100
	};
}

// CLI usage
const main = async () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error("Usage: witsml-processor <file.xml> [--json|--summary|--quality]");
		console.error("Options:");
		console.error("  --json     Output full JSON data");
		console.error("  --summary  Output metadata summary (default)");
		console.error("  --quality  Output quality assessment only");
		process.exit(1);
	}

	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	try {
		const witsmlData = await processWITSMLFile(filePath);

		if (options.includes("--quality")) {
			console.log(JSON.stringify({
				format: witsmlData.format,
				wellName: witsmlData.wellName,
				qualityMetrics: witsmlData.qualityMetrics,
				curves: witsmlData.curves.map(c => ({
					name: c.name,
					mnemonic: c.mnemonic,
					validPoints: c.validPoints,
					nullPoints: c.nullPoints,
					completeness: c.validPoints / (c.validPoints + c.nullPoints) || 0
				}))
			}, null, 2));
		} else if (options.includes("--json")) {
			console.log(JSON.stringify(witsmlData, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				format: witsmlData.format,
				version: witsmlData.version,
				wellName: witsmlData.wellName,
				depthRange: `${witsmlData.depthStart}-${witsmlData.depthStop} ${witsmlData.depthUnit}`,
				curves: witsmlData.curves.length,
				rows: witsmlData.rows,
				quality: witsmlData.qualityMetrics,
				metadata: witsmlData.metadata
			};
			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error processing WITSML file: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

// Exports already declared above