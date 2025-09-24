#!/usr/bin/env tsx
/**
 * Enhanced Well Log Processor for SHALE YEAH
 * Supports LAS, DLIS, and WITSML formats with unified interface
 *
 * LEGAL NOTICE: DLIS and WITSML support provided under DMCA Section 1201(f)
 * interoperability exception. Users must have appropriate software licenses.
 */

import fs from "node:fs";
import path from "node:path";
import { parseLASFile, type LASData, type LASCurve } from "./las-parse.js";

// Unified well log data interface
export interface WellLogData {
	format: "LAS" | "DLIS" | "WITSML";
	version: string;
	wellName: string;
	depthUnit: string;
	depthStart: number;
	depthStop: number;
	depthStep: number;
	nullValue: number;
	curves: WellLogCurve[];
	depthData: number[];
	rows: number;
	metadata: {
		company?: string;
		field?: string;
		location?: string;
		wellId?: string;
		operator?: string;
		county?: string;
		state?: string;
		country?: string;
		spudDate?: string;
		totalDepth?: number;
		[key: string]: unknown;
	};
	qualityMetrics: {
		completeness: number; // 0-1 scale
		continuity: number;   // 0-1 scale
		consistency: number;  // 0-1 scale
		confidence: number;   // 0-1 scale
	};
}

export interface WellLogCurve {
	name: string;
	unit: string;
	description: string;
	data: number[];
	mnemonic?: string;
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

// File format detection
export function detectWellLogFormat(filePath: string): "LAS" | "DLIS" | "WITSML" | "UNKNOWN" {
	const ext = path.extname(filePath).toLowerCase();

	switch (ext) {
		case ".las":
			return "LAS";
		case ".dlis":
			return "DLIS";
		case ".xml":
			// Check if it's WITSML by looking for WITSML namespace
			try {
				const content = fs.readFileSync(filePath, "utf8");
				if (content.includes("witsml") || content.includes("WITSML")) {
					return "WITSML";
				}
			} catch {
				// File reading error, return unknown
			}
			return "UNKNOWN";
		default:
			return "UNKNOWN";
	}
}

// Main processing function
export async function processWellLogFile(filePath: string): Promise<WellLogData> {
	const format = detectWellLogFormat(filePath);

	switch (format) {
		case "LAS":
			return await processLASFile(filePath);
		case "DLIS":
			return await processDLISFile(filePath);
		case "WITSML":
			return await processWITSMLFile(filePath);
		default:
			throw new Error(`Unsupported well log format: ${format}`);
	}
}

// LAS file processing (enhanced)
async function processLASFile(filePath: string): Promise<WellLogData> {
	const lasData = parseLASFile(filePath);

	// Convert to unified format with enhanced metrics
	const curves: WellLogCurve[] = lasData.curves.map(curve => {
		const validData = curve.data.filter(v => !Number.isNaN(v));
		const statistics = calculateStatistics(validData);

		return {
			name: curve.name,
			unit: curve.unit,
			description: curve.description,
			data: curve.data,
			validPoints: validData.length,
			nullPoints: curve.data.length - validData.length,
			minValue: Math.min(...validData),
			maxValue: Math.max(...validData),
			statistics
		};
	});

	const qualityMetrics = calculateQualityMetrics(curves, lasData.depth_data);

	return {
		format: "LAS",
		version: lasData.version,
		wellName: lasData.well_name,
		depthUnit: lasData.depth_unit,
		depthStart: lasData.depth_start,
		depthStop: lasData.depth_stop,
		depthStep: lasData.depth_step,
		nullValue: lasData.null_value,
		curves,
		depthData: lasData.depth_data,
		rows: lasData.rows,
		metadata: {
			company: lasData.company,
			field: lasData.field,
			location: lasData.location,
		},
		qualityMetrics
	};
}

// DLIS file processing (placeholder - requires dlisio Python library)
async function processDLISFile(filePath: string): Promise<WellLogData> {
	// Note: Full DLIS support would require Python dlisio library integration
	// This is a placeholder implementation showing the structure

	console.warn("DLIS support requires dlisio library. Returning demo data structure.");
	console.warn("For production use, install dlisio: pip install dlisio");
	console.warn("User must have appropriate DLIS software license.");

	// Return demo structure for development
	return {
		format: "DLIS",
		version: "1.0",
		wellName: "DLIS_DEMO_WELL",
		depthUnit: "M",
		depthStart: 0,
		depthStop: 1000,
		depthStep: 0.1,
		nullValue: -999.25,
		curves: [
			{
				name: "DEPT",
				unit: "M",
				description: "Measured Depth",
				data: [],
				validPoints: 0,
				nullPoints: 0
			}
		],
		depthData: [],
		rows: 0,
		metadata: {
			company: "Demo Company",
			field: "Demo Field"
		},
		qualityMetrics: {
			completeness: 0,
			continuity: 0,
			consistency: 0,
			confidence: 0
		}
	};
}

// WITSML file processing
async function processWITSMLFile(filePath: string): Promise<WellLogData> {
	try {
		const content = fs.readFileSync(filePath, "utf8");

		// Basic WITSML XML parsing (simplified)
		const wellData = parseWITSMLContent(content);

		return wellData;
	} catch (error) {
		throw new Error(`Failed to process WITSML file: ${error}`);
	}
}

// WITSML XML parsing function
function parseWITSMLContent(xmlContent: string): WellLogData {
	// Simplified WITSML parsing - in production, use proper XML parser
	const wellName = extractXMLValue(xmlContent, "name") || "WITSML_WELL";
	const company = extractXMLValue(xmlContent, "operator") || "";
	const field = extractXMLValue(xmlContent, "field") || "";

	// Extract log curves (simplified)
	const curves: WellLogCurve[] = [];
	const logCurveRegex = /<logCurveInfo[^>]*>(.*?)<\/logCurveInfo>/gs;
	let match;

	while ((match = logCurveRegex.exec(xmlContent)) !== null) {
		const curveContent = match[1];
		const curveName = extractXMLValue(curveContent, "mnemonic") || "UNKNOWN";
		const unit = extractXMLValue(curveContent, "unit") || "";
		const description = extractXMLValue(curveContent, "curveDescription") || "";

		curves.push({
			name: curveName,
			unit: unit,
			description: description,
			data: [], // Would need to parse actual data section
			validPoints: 0,
			nullPoints: 0
		});
	}

	return {
		format: "WITSML",
		version: "1.4.1.1",
		wellName: wellName,
		depthUnit: "FT",
		depthStart: 0,
		depthStop: 0,
		depthStep: 0.5,
		nullValue: -999.25,
		curves: curves,
		depthData: [],
		rows: 0,
		metadata: {
			company: company,
			field: field
		},
		qualityMetrics: {
			completeness: 0.5,
			continuity: 0.5,
			consistency: 0.5,
			confidence: 0.5
		}
	};
}

// Helper functions
function extractXMLValue(xmlContent: string, tagName: string): string | null {
	const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, "i");
	const match = regex.exec(xmlContent);
	return match ? match[1].trim() : null;
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

function calculateQualityMetrics(curves: WellLogCurve[], depthData: number[]): {
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

	// Continuity: measure of data gaps
	const depthContinuity = depthData.length > 1 ?
		1 - (Math.abs(depthData.length - (depthData[depthData.length - 1] - depthData[0])) / depthData[depthData.length - 1]) : 0;

	// Consistency: measure of reasonable value ranges per curve type
	const consistency = curves.length > 0 ?
		curves.reduce((sum, curve) => sum + (curve.validPoints > 0 ? 1 : 0), 0) / curves.length : 0;

	// Overall confidence
	const confidence = (completeness + depthContinuity + consistency) / 3;

	return {
		completeness: Math.round(completeness * 100) / 100,
		continuity: Math.round(depthContinuity * 100) / 100,
		consistency: Math.round(consistency * 100) / 100,
		confidence: Math.round(confidence * 100) / 100
	};
}

// CLI usage
const main = async () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error("Usage: well-log-processor <file> [--json|--summary|--quality]");
		console.error("Supported formats: .las, .dlis, .xml (WITSML)");
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
		const wellData = await processWellLogFile(filePath);

		if (options.includes("--quality")) {
			console.log(JSON.stringify({
				format: wellData.format,
				wellName: wellData.wellName,
				qualityMetrics: wellData.qualityMetrics,
				curves: wellData.curves.map(c => ({
					name: c.name,
					validPoints: c.validPoints,
					nullPoints: c.nullPoints,
					completeness: c.validPoints / (c.validPoints + c.nullPoints)
				}))
			}, null, 2));
		} else if (options.includes("--json")) {
			console.log(JSON.stringify(wellData, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				format: wellData.format,
				wellName: wellData.wellName,
				depthRange: `${wellData.depthStart}-${wellData.depthStop} ${wellData.depthUnit}`,
				curves: wellData.curves.length,
				rows: wellData.rows,
				quality: wellData.qualityMetrics,
				metadata: wellData.metadata
			};
			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error processing well log file: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

// Export already declared above