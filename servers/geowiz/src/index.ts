#!/usr/bin/env node

/**
 * Geowiz MCP Server - DRY Refactored
 * Marcus Aurelius Geologicus - Master Geological Analyst
 */

import { type ConnectorRuntime, SourceAccessError, type SourcePrincipal } from "@shaleyeah/connectors";
import {
	buildMutualExclusivityError,
	checkMutualExclusivity,
	createFileModelCredentialResolver,
	createModelRuntime,
	type MCPExecutionContext,
	type MCPServer,
	ModelProviderError,
	type ModelRuntime,
	normalizeIdentifier,
	paginateArray,
	readPrivateReferenceModelConfig,
	runMCPServer,
	ServerFactory,
	type ServerRuntimeOptions,
	type ServerTemplate,
	wrapWithGuiUrl,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { annotateLAS } from "./formation-synthesis.js";
import { ReviewError, type ReviewWorkflow, reviewCandidateSchema, reviewExecutionSchema } from "./review-workflow.js";
import { createFileSourceAudit, loadSourceBinding } from "./source-config.js";
import { createSourceAnalysisTool, withSourceErrors } from "./source-tools.js";
import { parseLASFile } from "./tools/las-parse.js";
import {
	densityAssumptionsSchema,
	type LASReviewOptions,
	reviewConfidenceSchema,
	reviewLAS,
} from "./tools/las-review.js";

interface GeowizOptions extends ServerRuntimeOptions {
	reviewWorkflow?: ReviewWorkflow;
	modelRuntime?: ModelRuntime;
	sourceRuntime?: ConnectorRuntime;
	/** Trusted local operator identity for stdio; HTTP always uses its authenticated context. */
	localSourcePrincipal?: SourcePrincipal;
}

function createGeowizTemplate(runtime?: ModelRuntime, options: GeowizOptions = {}): ServerTemplate {
	const sourceTool = createSourceAnalysisTool(options, (name, context) => {
		if (name === "analyze_formation" && runtime) verifyModelOwner(runtime, context);
	});
	return {
		name: "geowiz",
		description: "Geological Analysis MCP Server",
		persona: {
			name: "Marcus Aurelius Geologicus",
			role: "Master Geological Analyst",
			expertise: [
				"Formation analysis and characterization",
				"Well log interpretation",
				"GIS data processing and spatial analysis",
				"Geological quality assessment",
				"Petroleum geology and reservoir characterization",
			],
		},
		directories: ["analyses", "gis", "logs", "formations", "reports"],
		tools: [
			sourceTool(
				"analyze_formation",
				"Review approved unwrapped LAS 2 observations and supplied density assumptions; unknown geology stays unmeasured",
				z.object({
					filePath: z.string().describe("Configured source ID, relative locator or canonical approved LAS path"),
					formations: z.array(z.string()).optional().describe("Target formations"),
					analysisType: z.enum(["basic", "standard", "comprehensive"]).default("standard"),
					densityAssumptions: densityAssumptionsSchema
						.optional()
						.describe("Explicit scenario densities; no rock or fluid defaults"),
					reviewConfidence: reviewConfidenceSchema
						.optional()
						.describe("Declared reviewer assessment with basis; not calibrated model confidence"),
					outputPath: z.string().optional(),
					// Arcade #9: Mutual Exclusivity — identify a single formation by name OR id, not both.
					formationName: z.string().optional().describe("Target formation by name (XOR with formationId)"),
					formationId: z.string().optional().describe("Target formation by database id (XOR with formationName)"),
					// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
					matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
				}),
				async (args, context, signal) => {
					const xorViolation = checkMutualExclusivity(args, [["formationName", "formationId"]]);
					if (xorViolation) {
						return buildMutualExclusivityError(
							["formationName", "formationId"],
							["formationName", "formationId"].filter((k) => args[k] != null),
						);
					}

					const rawFormationName = args.formationName;
					const normalizedFormationName = rawFormationName ? normalizeIdentifier(rawFormationName) : rawFormationName;
					const matchInfo =
						rawFormationName && normalizedFormationName !== rawFormationName
							? { matchedAs: normalizedFormationName, matchScore: 1.0 }
							: {};

					if (runtime) verifyModelOwner(runtime, context);
					const analysis = await performFormationAnalysis(
						{ ...args, formationName: normalizedFormationName },
						runtime?.fork?.() ?? runtime,
						signal,
					);

					return wrapWithGuiUrl({ ...analysis, ...matchInfo }, "formations");
				},
			),
			sourceTool(
				"process_gis",
				"Process GIS files with enhanced oil & gas spatial analysis (.shp, .geojson, .kml)",
				z.object({
					filePath: z.string().describe("Path to GIS file (.shp, .geojson, .kml)"),
					analysisType: z
						.enum(["basic", "standard", "comprehensive", "oilgas"])
						.default("standard")
						.describe("Level of analysis detail"),
					qualityAssessment: z.boolean().default(true),
					oilGasAnalysis: z.boolean().default(true),
					outputPath: z.string().optional(),
				}),
				async (args) => {
					const analysis = await processEnhancedGIS(args);

					return analysis;
				},
			),
			sourceTool(
				"process_well_logs",
				"Process approved LAS well logs; other source formats require reviewed adapters",
				z.object({
					filePath: z.string().describe("Configured source ID, relative locator or canonical approved LAS path"),
					format: z
						.enum(["auto", "las", "dlis", "witsml"])
						.default("auto")
						.describe("Force specific format or auto-detect"),
					qualityAssessment: z.boolean().default(true),
					outputPath: z.string().optional(),
					// Arcade #9: Mutual Exclusivity — identify the well by name OR id, not both.
					wellName: z.string().optional().describe("Filter by well name (XOR with wellId)"),
					wellId: z.string().optional().describe("Filter by well identifier (XOR with wellName)"),
					// Arcade #31: Paginated Result — cursor and pageSize for large curve datasets.
					cursor: z.string().optional().describe("Opaque cursor from a previous response to fetch the next page"),
					pageSize: z.number().int().min(1).max(100).optional().describe("Curves per page (1–100, default 25)"),
					// Arcade #42: Fuzzy Match Threshold — similarity cutoff for identifier normalization (0–1, default 0.8).
					matchThreshold: z.number().min(0).max(1).default(0.8).optional(),
				}),
				async (args) => {
					const xorViolation = checkMutualExclusivity(args, [["wellName", "wellId"]]);
					if (xorViolation) {
						return buildMutualExclusivityError(
							["wellName", "wellId"],
							["wellName", "wellId"].filter((k) => args[k] != null),
						);
					}

					const rawWellName = args.wellName;
					const normalizedWellName = rawWellName ? normalizeIdentifier(rawWellName) : rawWellName;
					const matchInfo =
						rawWellName && normalizedWellName !== rawWellName ? { matchedAs: normalizedWellName, matchScore: 1.0 } : {};

					const result = await processMultiFormatWellLog({ ...args, wellName: normalizedWellName });

					// Arcade #31: return curves as a PaginatedResult so large well logs don't
					// flood the LLM context. The rest of the analysis (wellData, qualityMetrics,
					// etc.) is always returned in full — only the potentially huge curves list is paged.
					const { curves, ...analysisRest } = result as Record<string, unknown> & {
						curves: unknown[];
					};
					return {
						...analysisRest,
						...matchInfo,
						curves: paginateArray(curves ?? [], { cursor: args.cursor, pageSize: args.pageSize }),
					};
				},
			),
			sourceTool(
				"assess_quality",
				"Assess geological data quality",
				z.object({
					filePath: z.string(),
					dataType: z.enum(["las", "gis", "seismic"]),
					thresholds: z
						.object({
							completeness: z.number().min(0).max(1).default(0.8),
							accuracy: z.number().min(0).max(1).default(0.85),
						})
						.optional(),
				}),
				async (args) => {
					return assessDataQuality(args);
				},
			),
			sourceTool(
				"process_access_database",
				"Process Microsoft Access database files (.accdb, .mdb) for production data",
				z.object({
					filePath: z.string().describe("Path to Access database file (.accdb or .mdb)"),
					extractTables: z.array(z.string()).optional().describe("Specific tables to extract (default: all)"),
					outputFormat: z.enum(["json", "csv", "summary"]).default("summary"),
					outputPath: z.string().optional(),
					// Arcade #31: Paginated Result — cursor and pageSize for large table sets.
					cursor: z.string().optional().describe("Opaque cursor from a previous response to fetch the next page"),
					pageSize: z.number().int().min(1).max(100).optional().describe("Tables per page (1–100, default 25)"),
				}),
				async (args) => {
					const result = await processAccessDatabaseData(args);

					// Arcade #31: paginate the tables list so databases with many tables
					// don't overwhelm the LLM context window in a single response.
					const { tables, ...dbRest } = result as Record<string, unknown> & {
						tables: unknown[];
					};
					return {
						...dbRest,
						tables: paginateArray(tables ?? [], { cursor: args.cursor, pageSize: args.pageSize }),
					};
				},
			),
			sourceTool(
				"process_document",
				"Process PDF, DOCX, and PPTX documents for oil & gas data extraction",
				z.object({
					filePath: z.string().describe("Path to document file (.pdf, .docx, .pptx)"),
					extractionType: z.enum(["summary", "technical", "financial", "all"]).default("all"),
					outputPath: z.string().optional(),
				}),
				async (args) => {
					const result = await processDocumentData(args);

					return result;
				},
			),
			sourceTool(
				"process_seismic_data",
				"Process seismic data files (SEGY, SGY, seismic3d) for structural interpretation",
				z.object({
					filePath: z.string().describe("Path to seismic file (.segy, .sgy, .seismic3d)"),
					analysisType: z.enum(["structural", "amplitude", "reservoir", "all"]).default("all"),
					outputPath: z.string().optional(),
				}),
				async (args) => {
					const result = await processSeismicAnalysis(args);

					return result;
				},
			),
			sourceTool(
				"process_aries_database",
				"Process ARIES petroleum economics and reserves database (.adb)",
				z.object({
					filePath: z.string().describe("Path to ARIES database file (.adb)"),
					analysisType: z.enum(["reserves", "economics", "forecasting", "all"]).default("all"),
					outputPath: z.string().optional(),
				}),
				async (args) => {
					const result = await processAriesAnalysis(args);

					return result;
				},
			),
			ServerFactory.createAnalysisTool(
				"save_finding",
				"Execute one exact human-reviewed private finding save. Requires a current server-issued grant; an ADK confirmation boolean cannot authorize this command. Exact retry returns its recorded outcome.",
				reviewExecutionSchema,
				async (args, context, signal) =>
					withReviewErrors(() =>
						reviewBoundary(options, context).execute(args, reviewPrincipal(options, context), signal),
					),
			),
			ServerFactory.createAnalysisTool(
				"prepare_review",
				"Prepare an immutable private review packet with actual source snapshots and reported eval evidence. Returns reference-only checkpoint; cannot approve or save. expectedHead is null for the first packet or the exact previous packetDigest.",
				z
					.object({
						candidate: reviewCandidateSchema,
						expectedHead: z
							.string()
							.regex(/^[a-f0-9]{64}$/)
							.nullable(),
					})
					.strict(),
				async (args, context) =>
					withReviewErrors(() =>
						reviewBoundary(options, context).prepare(
							args.candidate,
							reviewPrincipal(options, context),
							args.expectedHead,
						),
					),
			),
			ServerFactory.createAnalysisTool(
				"get_review_status",
				"Read a scoped durable review checkpoint. Approved grants are returned only to the bound authenticated requester; human decision and content inspection use the separate operator interface.",
				z.object({ reviewId: z.string().min(1).max(128).optional() }).strict(),
				async (args, context) =>
					withReviewErrors(() =>
						reviewBoundary(options, context).status(args.reviewId, reviewPrincipal(options, context)),
					),
			),
		],
	};
}

// Domain-specific geological analysis functions
export async function performFormationAnalysis(
	args: { filePath: string; formations?: string[]; analysisType?: string } & LASReviewOptions,
	runtime?: ModelRuntime,
	signal?: AbortSignal,
) {
	if (signal?.aborted) throw new ModelProviderError("cancelled");
	const inputReview = reviewLAS(parseLASFile(args.filePath), args);
	const synthesis = await annotateLAS(inputReview, runtime, signal);
	return {
		analysisVersion: "0.2.0",
		status: ["unavailable", "invalid_output"].includes(synthesis.status) ? "partial" : "needs_review",
		inputReview,
		synthesis,
		requestedFormations: args.formations ?? [],
		formations: [],
		netPay: null,
		porosity: null,
		permeability: null,
		toc: null,
		maturity: null,
		targets: null,
		confidence: null,
		recommendation:
			"Review source measurements, supplied assumptions and missing evidence before interpreting geology.",
		...(synthesis.modelMetadata ? { modelMetadata: synthesis.modelMetadata } : {}),
	};
}

// Enhanced GIS processing function
export async function processEnhancedGIS(args: {
	filePath: string;
	analysisType?: string;
	qualityAssessment?: boolean;
	oilGasAnalysis?: boolean;
}): Promise<Record<string, unknown>> {
	try {
		// Import the enhanced GIS processor
		const { EnhancedGISProcessor } = await import("./tools/gis-processor.js");

		const processor = new EnhancedGISProcessor();
		const gisResult = await processor.processGISFile(args.filePath);

		// Create analysis report based on requested analysis type
		const analysis = {
			fileInfo: {
				path: args.filePath,
				format: gisResult.format,
				size: gisResult.metadata.fileSize,
				processed: gisResult.metadata.dateProcessed,
			},
			spatialData: {
				featureCount: gisResult.metadata.featureCount,
				geometryTypes: gisResult.metadata.geometryTypes,
				bounds: gisResult.bounds,
				coordinateSystem: gisResult.metadata.coordinateSystem,
				hasElevation: gisResult.metadata.hasElevation,
			},
			qualityAssessment: args.qualityAssessment ? gisResult.qualityMetrics : undefined,
			oilGasAnalysis: args.oilGasAnalysis
				? {
						assets: gisResult.oilGasMetrics,
						geologicalContext: generateGeologicalContext(gisResult),
						investmentPerspective: generateInvestmentPerspective(gisResult),
					}
				: undefined,
			recommendations: gisResult.recommendations,
			processingMetrics: {
				parseTime: gisResult.metadata.parseTime,
				validationErrors: gisResult.qualityMetrics.validationErrors.length,
				overallQuality: gisResult.qualityMetrics.overallQuality,
			},
		};

		return analysis;
	} catch (error) {
		throw new Error(`Failed to process GIS file: ${error}`);
	}
}

// Generate geological context from GIS data
function generateGeologicalContext(gisResult: any): Record<string, unknown> {
	const context = {
		spatialExtent: `${gisResult.bounds.width.toFixed(4)}° x ${gisResult.bounds.height.toFixed(4)}°`,
		centralLocation: {
			latitude: gisResult.bounds.centerY.toFixed(6),
			longitude: gisResult.bounds.centerX.toFixed(6),
		},
		geologicalRegion: identifyGeologicalRegion(gisResult.bounds),
		basinContext: identifyBasinContext(gisResult.bounds),
		structuralSetting: "To be determined from detailed geological analysis",
	};

	return context;
}

// Generate investment perspective from GIS analysis
function generateInvestmentPerspective(gisResult: any): Record<string, unknown> {
	const metrics = gisResult.oilGasMetrics;

	return {
		assetSummary: {
			totalLeaseBlocks: metrics.leaseBlocks,
			totalWells: metrics.wellLocations,
			totalAcreage: metrics.estimatedAcreage,
			pipelineAccess: metrics.pipelines > 0 ? "Available" : "Limited",
		},
		competitiveAnalysis: {
			majorOperators: metrics.majorOperators.slice(0, 5),
			operatorCount: metrics.majorOperators.length,
			competitionLevel: metrics.majorOperators.length > 5 ? "High" : "Moderate",
		},
		developmentPotential: assessDevelopmentPotential(metrics),
		riskFactors: identifyGISRiskFactors(gisResult),
		recommendations: generateGISInvestmentRecommendations(metrics),
	};
}

// Helper functions for geological analysis
function identifyGeologicalRegion(bounds: any): string {
	const centerLat = bounds.centerY;
	const centerLon = bounds.centerX;

	// Basic geological region identification based on coordinates
	if (centerLat >= 31 && centerLat <= 33 && centerLon >= -105 && centerLon <= -100) {
		return "Permian Basin";
	} else if (centerLat >= 26 && centerLat <= 30 && centerLon >= -100 && centerLon <= -94) {
		return "Eagle Ford Shale";
	} else if (centerLat >= 28 && centerLat <= 32 && centerLon >= -99 && centerLon <= -96) {
		return "Barnett Shale";
	} else if (centerLat >= 35 && centerLat <= 40 && centerLon >= -104 && centerLon <= -95) {
		return "Anadarko Basin";
	} else {
		return "Regional Basin Analysis Required";
	}
}

function identifyBasinContext(bounds: any): string {
	const region = identifyGeologicalRegion(bounds);

	const basinMap: Record<string, string> = {
		"Permian Basin": "Major unconventional oil & gas basin",
		"Eagle Ford Shale": "Prolific shale oil play",
		"Barnett Shale": "Historic shale gas development",
		"Anadarko Basin": "Mixed conventional and unconventional play",
	};

	return basinMap[region] || "Basin characterization required";
}

function assessDevelopmentPotential(metrics: any): string {
	const score = metrics.leaseBlocks * 0.3 + metrics.wellLocations * 0.4 + (metrics.estimatedAcreage / 1000) * 0.3;

	if (score > 50) return "High - Significant infrastructure and acreage";
	if (score > 20) return "Moderate - Established activity with growth potential";
	if (score > 5) return "Limited - Early stage development opportunity";
	return "Minimal - Requires detailed evaluation";
}

function identifyGISRiskFactors(gisResult: any): string[] {
	const risks: string[] = [];

	if (gisResult.qualityMetrics.overallQuality < 0.7) {
		risks.push("Data quality concerns - verification required");
	}

	if (gisResult.oilGasMetrics.majorOperators.length > 10) {
		risks.push("High operator density - increased competition");
	}

	if (gisResult.oilGasMetrics.pipelines === 0) {
		risks.push("Limited pipeline infrastructure");
	}

	if (gisResult.bounds.width > 2 || gisResult.bounds.height > 2) {
		risks.push("Large spatial extent - management complexity");
	}

	return risks.length > 0 ? risks : ["Standard development risks apply"];
}

function generateGISInvestmentRecommendations(metrics: any): string[] {
	const recommendations: string[] = [];

	if (metrics.estimatedAcreage > 5000) {
		recommendations.push("Large acreage position - consider phased development");
	}

	if (metrics.wellLocations > 20) {
		recommendations.push("Significant well density - evaluate infill potential");
	}

	if (metrics.majorOperators.length > 0) {
		recommendations.push("Active operator presence - benchmark performance");
	}

	recommendations.push("Integrate with geological and economic analysis");

	return recommendations;
}

export function assessDataQuality(args: {
	filePath: string;
	dataType: string;
	thresholds?: { completeness: number; accuracy?: number; consistency?: number };
}) {
	if (args.dataType !== "las") throw new SourceAccessError("unsupported_capability");
	const inputReview = reviewLAS(parseLASFile(args.filePath));
	const { completeness } = inputReview.qc;
	const insufficientCoverage =
		args.thresholds !== undefined && (completeness === null || completeness < args.thresholds.completeness);
	const accuracyUnmeasured = args.thresholds?.accuracy !== undefined;
	return {
		analysisVersion: "0.2.0",
		dataType: "las",
		inputReview,
		overallScore: null,
		confidence: null,
		metrics: { completeness, accuracy: null, consistency: null },
		issues: [
			...(insufficientCoverage ? ["Completeness below the configured threshold"] : []),
			...(accuracyUnmeasured ? ["Accuracy threshold cannot be evaluated without reference measurements"] : []),
		],
		passesThresholds: args.thresholds ? !insufficientCoverage && !accuracyUnmeasured : null,
		recommendations: [
			"Coverage is an observed sample fraction; validate calibration and context before interpretation.",
		],
	};
}

// Multi-format well log processing function
export async function processMultiFormatWellLog(args: {
	filePath: string;
	format?: string;
	qualityAssessment?: boolean;
}): Promise<Record<string, unknown>> {
	const { processWellLogFile } = await import("./tools/well-log-processor.js");
	const wellLogData = await processWellLogFile(args.filePath);
	if (wellLogData.format !== "LAS" || !wellLogData.inputReview) throw new SourceAccessError("unsupported_capability");
	const inputReview = wellLogData.inputReview;
	return {
		analysisVersion: "0.2.0",
		inputReview,
		wellData: {
			name: wellLogData.wellName || null,
			depthRange: `${wellLogData.depthStart}-${wellLogData.depthStop} ${wellLogData.depthUnit}`,
			totalCurves: wellLogData.curves.length,
			totalRows: wellLogData.rows,
		},
		curves: inputReview.observations.map((curve) => ({
			name: curve.curve,
			unit: curve.unit,
			dataQuality: { validPoints: curve.validPoints, nullPoints: curve.nullPoints, completeness: curve.coverage },
			statistics: curve.statistics,
		})),
		qualityMetrics: inputReview.qc,
		geologicalInsights: { formations: [], lithology: null, hydrocarbon_indicators: [], reservoir_quality: null },
		recommendations: ["Review measured curves, declared units and calibration before geological interpretation."],
		metadata: wellLogData.metadata,
	};
}

// Process Access Database Data
export async function processAccessDatabaseData(args: {
	filePath: string;
	extractTables?: string[];
	outputFormat?: string;
}): Promise<Record<string, unknown>> {
	try {
		// Import the Access processor
		const { processAccessDatabase } = await import("./tools/access-processor.js");

		// Process the database file
		const accessData = await processAccessDatabase(args.filePath);

		// Filter tables if specific ones requested
		let filteredTables = accessData.tables;
		if (args.extractTables && args.extractTables.length > 0) {
			filteredTables = accessData.tables.filter((table) => args.extractTables?.includes(table.name));
		}

		// Generate oil & gas specific insights
		const oilGasInsights = await generateProductionInsights(filteredTables);

		const analysis = {
			fileInfo: {
				path: args.filePath,
				format: accessData.format,
				version: accessData.version,
				databaseName: accessData.databaseName,
			},
			summary: {
				totalTables: accessData.tables.length,
				extractedTables: filteredTables.length,
				totalRecords: accessData.totalRecords,
				fileSize: accessData.metadata.fileSize,
			},
			tables: filteredTables.map((table) => ({
				name: table.name,
				type: table.type,
				recordCount: table.recordCount,
				fields: table.fields.map((field) => ({
					name: field.name,
					type: field.type,
					required: field.required,
					completeness: field.validValues / (field.validValues + field.nullValues) || 0,
				})),
				statistics: table.statistics,
			})),
			qualityMetrics: accessData.qualityMetrics,
			oilGasInsights: oilGasInsights,
			recommendations: generateDatabaseRecommendations(accessData, filteredTables),
			metadata: accessData.metadata,
		};

		return analysis;
	} catch (error) {
		throw new Error(`Failed to process Access database: ${error}`);
	}
}

// Generate production insights from database tables
async function generateProductionInsights(tables: any[]): Promise<Record<string, unknown>> {
	const insights = {
		wellCount: 0,
		productionTables: [] as string[],
		dataTimespan: "Unknown",
		primaryDataTypes: [] as string[],
		completeness: 0,
	};

	// Look for common oil & gas tables
	const wellTable = tables.find((t) => t.name.toLowerCase().includes("well"));
	const prodTable = tables.find(
		(t) => t.name.toLowerCase().includes("production") || t.name.toLowerCase().includes("prod"),
	);
	const testTable = tables.find((t) => t.name.toLowerCase().includes("test"));

	if (wellTable) {
		insights.wellCount = wellTable.recordCount;
		insights.primaryDataTypes.push("Well Information");
	}

	if (prodTable) {
		insights.productionTables.push(prodTable.name);
		insights.primaryDataTypes.push("Production History");
	}

	if (testTable) {
		insights.productionTables.push(testTable.name);
		insights.primaryDataTypes.push("Well Test Data");
	}

	// Calculate overall data completeness
	const totalRecords = tables.reduce((sum, table) => sum + table.recordCount, 0);
	if (totalRecords > 0) {
		insights.completeness = Math.round((totalRecords / (tables.length * 1000)) * 100) / 100; // Rough completeness estimate
	}

	return insights;
}

// Generate recommendations for database analysis
function generateDatabaseRecommendations(accessData: any, tables: any[]): string[] {
	const recommendations = [];

	if (accessData.qualityMetrics.completeness < 0.7) {
		recommendations.push("Database completeness below 70% - validate data integrity");
	}

	if (accessData.qualityMetrics.accessibility < 1.0) {
		recommendations.push("Database may have access restrictions - check permissions");
	}

	if (tables.length === 0) {
		recommendations.push("No tables extracted - verify file format and permissions");
	}

	// Look for common production database patterns
	const hasWellData = tables.some((t) => t.name.toLowerCase().includes("well"));
	const hasProductionData = tables.some((t) => t.name.toLowerCase().includes("production"));

	if (hasWellData && hasProductionData) {
		recommendations.push("Complete production database detected - suitable for analysis");
	} else if (hasWellData) {
		recommendations.push("Well information available - missing production history");
	} else if (hasProductionData) {
		recommendations.push("Production data available - missing well metadata");
	}

	// Version-specific recommendations
	if (accessData.version === "2007+") {
		recommendations.push("Modern Access format - full feature support available");
	} else {
		recommendations.push("Legacy Access format - consider upgrading for enhanced features");
	}

	return recommendations.length > 0 ? recommendations : ["Standard database analysis protocols applied"];
}

// Process Document Data
export async function processDocumentData(args: {
	filePath: string;
	extractionType?: string;
}): Promise<Record<string, unknown>> {
	try {
		// Import the document processor
		const { processDocument } = await import("./tools/document-processor.js");

		// Process the document file
		const documentData = await processDocument(args.filePath);

		// Generate geological insights from document content
		const geologicalInsights = await generateDocumentInsights(documentData);

		// Filter content based on extraction type
		let filteredContent = documentData.content;
		if (args.extractionType && args.extractionType !== "all") {
			filteredContent = filterContentByType(documentData.content, args.extractionType);
		}

		const analysis = {
			fileInfo: {
				path: args.filePath,
				format: documentData.format,
				fileName: documentData.fileName,
				pages: documentData.pages,
			},
			summary: {
				sections: documentData.content.sections.length,
				tables: documentData.content.tables.length,
				images: documentData.content.images.length,
				textLength: documentData.content.text.length,
			},
			extractedData: {
				wellNames: documentData.oilGasData.wellNames,
				formations: documentData.oilGasData.formations,
				economicData: documentData.oilGasData.economicData,
				technicalSpecs: documentData.oilGasData.technicalSpecs,
				legalTerms: documentData.oilGasData.legalTerms,
			},
			content: {
				sections: filteredContent.sections.map((section) => ({
					title: section.title,
					type: section.type,
					pageNumber: section.pageNumber,
					content: section.content.substring(0, 500), // Truncate for summary
				})),
				tables: filteredContent.tables,
				images: filteredContent.images.map((img) => ({
					pageNumber: img.pageNumber,
					type: img.type,
					caption: img.caption,
				})),
			},
			qualityMetrics: documentData.qualityMetrics,
			geologicalInsights: geologicalInsights,
			recommendations: generateDocumentRecommendations(documentData),
			metadata: documentData.metadata,
		};

		return analysis;
	} catch (error) {
		throw new Error(`Failed to process document: ${error}`);
	}
}

// Generate geological insights from document content
async function generateDocumentInsights(documentData: any): Promise<Record<string, unknown>> {
	const insights = {
		documentType: "Unknown",
		primaryFocus: [] as string[],
		keyFindings: [] as string[],
		dataReliability: "Unknown",
		actionableItems: [] as string[],
	};

	// Determine document type based on content
	const hasEconomicData = documentData.oilGasData.economicData.length > 0;
	const hasTechnicalSpecs = documentData.oilGasData.technicalSpecs.length > 0;
	const _hasWellData = documentData.oilGasData.wellNames.length > 0;
	const hasLegalTerms = documentData.oilGasData.legalTerms.length > 0;

	if (hasEconomicData && hasTechnicalSpecs) {
		insights.documentType = "Technical Report";
		insights.primaryFocus.push("Economic Analysis", "Technical Specifications");
	} else if (hasEconomicData) {
		insights.documentType = "Financial Report";
		insights.primaryFocus.push("Economic Analysis");
	} else if (hasTechnicalSpecs) {
		insights.documentType = "Technical Document";
		insights.primaryFocus.push("Technical Specifications");
	}

	// Key findings based on extracted data
	if (documentData.oilGasData.formations.length > 0) {
		insights.keyFindings.push(`Formations identified: ${documentData.oilGasData.formations.join(", ")}`);
	}

	if (documentData.oilGasData.wellNames.length > 0) {
		insights.keyFindings.push(`${documentData.oilGasData.wellNames.length} wells referenced`);
	}

	if (hasLegalTerms) {
		insights.keyFindings.push("Legal terms and agreements present");
	}

	// Data reliability assessment
	if (documentData.qualityMetrics.confidence > 0.8) {
		insights.dataReliability = "High";
	} else if (documentData.qualityMetrics.confidence > 0.6) {
		insights.dataReliability = "Moderate";
	} else {
		insights.dataReliability = "Low";
	}

	// Actionable items based on content
	if (documentData.qualityMetrics.dataExtraction > 0.7) {
		insights.actionableItems.push("Sufficient data for analysis - proceed with detailed review");
	} else {
		insights.actionableItems.push("Limited extractable data - consider manual review");
	}

	if (hasEconomicData) {
		insights.actionableItems.push("Economic data available for investment analysis");
	}

	if (hasTechnicalSpecs) {
		insights.actionableItems.push("Technical specifications available for engineering review");
	}

	return insights;
}

// Filter content based on extraction type
function filterContentByType(content: any, extractionType: string): any {
	const filtered = { ...content };

	switch (extractionType) {
		case "technical":
			filtered.sections = content.sections.filter((s: any) => s.type === "technical");
			filtered.tables = content.tables.filter((t: any) => t.type === "technical");
			break;
		case "financial":
			filtered.sections = content.sections.filter((s: any) => s.type === "financial");
			filtered.tables = content.tables.filter((t: any) => t.type === "financial");
			break;
		case "summary":
			filtered.sections = content.sections.filter((s: any) => s.type === "executive_summary");
			break;
	}

	return filtered;
}

// Generate recommendations for document analysis
function generateDocumentRecommendations(documentData: any): string[] {
	const recommendations = [];

	if (documentData.qualityMetrics.completeness < 0.7) {
		recommendations.push("Document completeness below 70% - may be missing key sections");
	}

	if (documentData.qualityMetrics.dataExtraction < 0.6) {
		recommendations.push("Low data extraction rate - consider manual review for critical information");
	}

	if (documentData.oilGasData.wellNames.length === 0) {
		recommendations.push("No well names detected - verify document contains well-specific data");
	}

	if (documentData.oilGasData.economicData.length === 0) {
		recommendations.push("No economic data extracted - check for financial tables or metrics");
	}

	// Format-specific recommendations
	if (documentData.format === "PDF") {
		recommendations.push("PDF format - text extraction may vary based on document quality");
	} else if (documentData.format === "DOCX") {
		recommendations.push("Word document - structured data extraction available");
	} else if (documentData.format === "PPTX") {
		recommendations.push("PowerPoint format - focus on charts and summary data");
	}

	if (documentData.metadata.isPasswordProtected) {
		recommendations.push("Password protected document - ensure proper access permissions");
	}

	return recommendations.length > 0 ? recommendations : ["Standard document analysis protocols applied"];
}

// Process Seismic Data Analysis
export async function processSeismicAnalysis(args: {
	filePath: string;
	analysisType?: string;
}): Promise<Record<string, unknown>> {
	try {
		// Import the seismic processor
		const { processSeismicFile } = await import("./tools/seismic-processor.js");

		// Process the seismic file
		const seismicData = await processSeismicFile(args.filePath);

		// Generate geological insights from seismic data
		const geologicalInsights = await generateSeismicInsights(seismicData);

		// Filter analysis based on type
		let filteredAnalysis = seismicData.oilGasAnalysis;
		if (args.analysisType && args.analysisType !== "all") {
			filteredAnalysis = filterSeismicAnalysis(seismicData.oilGasAnalysis, args.analysisType);
		}

		const analysis = {
			fileInfo: {
				path: args.filePath,
				format: seismicData.format,
				fileName: seismicData.fileName,
				traces: seismicData.traces,
				samples: seismicData.samples,
			},
			headers: {
				sampleInterval: `${seismicData.headers.binaryHeader.sampleInterval} microseconds`,
				dataFormat: seismicData.metadata.dataFormat,
				revision: seismicData.metadata.revision,
				measurementSystem: seismicData.headers.binaryHeader.measurementSystem === 1 ? "meters" : "feet",
			},
			seismicAnalysis: {
				structuralFeatures: filteredAnalysis.structuralFeatures,
				amplitudeAnalysis: filteredAnalysis.amplitudeAnalysis,
				reservoirIndicators: filteredAnalysis.reservoirIndicators,
				interpretationNotes: filteredAnalysis.interpretationNotes,
			},
			qualityMetrics: seismicData.qualityMetrics,
			geologicalInsights: geologicalInsights,
			recommendations: generateSeismicRecommendations(seismicData),
			metadata: seismicData.metadata,
		};

		return analysis;
	} catch (error) {
		throw new Error(`Failed to process seismic data: ${error}`);
	}
}

// Generate geological insights from seismic data
async function generateSeismicInsights(seismicData: any): Promise<Record<string, unknown>> {
	const insights = {
		structuralInterpretation: "Preliminary analysis",
		hydrocarbonProspects: [] as string[],
		reservoirCharacteristics: "Under analysis",
		drillingRecommendations: [] as string[],
		riskAssessment: "Moderate",
	};

	// Analyze structural features
	if (seismicData.oilGasAnalysis.structuralFeatures.length > 0) {
		const features = seismicData.oilGasAnalysis.structuralFeatures;
		const horizons = features.filter((f: any) => f.type === "horizon").length;
		const faults = features.filter((f: any) => f.type === "fault").length;

		if (horizons > 0) {
			insights.structuralInterpretation = `${horizons} horizon(s) identified`;
			insights.reservoirCharacteristics = "Continuous reflectors suggest potential reservoir presence";
		}

		if (faults > 0) {
			insights.structuralInterpretation += `, ${faults} fault(s) detected`;
			insights.riskAssessment = "Elevated due to structural complexity";
		}
	}

	// Analyze reservoir indicators
	if (seismicData.oilGasAnalysis.reservoirIndicators.length > 0) {
		const indicators = seismicData.oilGasAnalysis.reservoirIndicators;
		const hcIndicators = indicators.filter((i: any) => i.hydrocarbon_indicator);

		if (hcIndicators.length > 0) {
			insights.hydrocarbonProspects.push(`${hcIndicators.length} hydrocarbon indicator(s) identified`);
			insights.drillingRecommendations.push("Consider targeted drilling on bright spots");
		}

		const brightSpots = indicators.filter((i: any) => i.type === "bright_spot").length;
		if (brightSpots > 0) {
			insights.hydrocarbonProspects.push(`${brightSpots} bright spot(s) for detailed analysis`);
		}
	}

	// Quality-based recommendations
	if (seismicData.qualityMetrics.confidence > 0.8) {
		insights.drillingRecommendations.push("High quality seismic - suitable for detailed prospect evaluation");
	} else if (seismicData.qualityMetrics.confidence > 0.6) {
		insights.drillingRecommendations.push("Moderate quality - additional processing may improve resolution");
	} else {
		insights.drillingRecommendations.push("Limited quality - consider reprocessing or additional acquisition");
		insights.riskAssessment = "High due to data quality limitations";
	}

	return insights;
}

// Filter seismic analysis by type
function filterSeismicAnalysis(analysis: any, analysisType: string): any {
	const filtered = { ...analysis };

	switch (analysisType) {
		case "structural":
			return {
				structuralFeatures: analysis.structuralFeatures,
				interpretationNotes: analysis.interpretationNotes.filter(
					(note: string) =>
						note.toLowerCase().includes("structural") ||
						note.toLowerCase().includes("fault") ||
						note.toLowerCase().includes("horizon"),
				),
			};
		case "amplitude":
			return {
				amplitudeAnalysis: analysis.amplitudeAnalysis,
				interpretationNotes: analysis.interpretationNotes.filter(
					(note: string) => note.toLowerCase().includes("amplitude") || note.toLowerCase().includes("bright"),
				),
			};
		case "reservoir":
			return {
				reservoirIndicators: analysis.reservoirIndicators,
				interpretationNotes: analysis.interpretationNotes.filter(
					(note: string) => note.toLowerCase().includes("reservoir") || note.toLowerCase().includes("hydrocarbon"),
				),
			};
		default:
			return filtered;
	}
}

// Generate seismic recommendations
function generateSeismicRecommendations(seismicData: any): string[] {
	const recommendations = [];

	if (seismicData.qualityMetrics.traceCompleteness < 0.9) {
		recommendations.push("Trace completeness below 90% - verify data integrity");
	}

	if (seismicData.qualityMetrics.amplitudeConsistency < 0.7) {
		recommendations.push("Low amplitude consistency - consider amplitude balancing");
	}

	if (seismicData.qualityMetrics.spatialCoverage < 0.8) {
		recommendations.push("Limited spatial coverage - coordinate information may be incomplete");
	}

	if (seismicData.oilGasAnalysis.reservoirIndicators.length === 0) {
		recommendations.push("No reservoir indicators detected - expand analysis parameters");
	}

	// Format-specific recommendations
	if (seismicData.format === "SEGY") {
		recommendations.push("SEGY format - industry standard with full header support");
	} else if (seismicData.format === "SGY") {
		recommendations.push("SGY format - verify byte order and data format settings");
	}

	if (seismicData.metadata.revision && parseFloat(seismicData.metadata.revision) >= 2.0) {
		recommendations.push("Modern SEGY revision - extended header features available");
	}

	return recommendations.length > 0 ? recommendations : ["Standard seismic interpretation protocols applied"];
}

// Process ARIES Database Analysis
export async function processAriesAnalysis(args: {
	filePath: string;
	analysisType?: string;
}): Promise<Record<string, unknown>> {
	try {
		// Import the ARIES processor
		const { processAriesDatabase } = await import("./tools/aries-processor.js");

		// Process the ARIES database
		const ariesData = await processAriesDatabase(args.filePath);

		// Generate geological insights from ARIES data
		const geologicalInsights = await generateAriesInsights(ariesData);

		// Filter analysis based on type
		let filteredAnalysis = ariesData.oilGasAnalysis;
		if (args.analysisType && args.analysisType !== "all") {
			filteredAnalysis = filterAriesAnalysis(ariesData.oilGasAnalysis, args.analysisType);
		}

		const analysis = {
			fileInfo: {
				path: args.filePath,
				format: ariesData.format,
				version: ariesData.version,
				databaseName: ariesData.databaseName,
			},
			summary: {
				totalProjects: ariesData.projects.length,
				totalWells: ariesData.wells.length,
				totalForecasts: ariesData.forecasts.length,
				totalEconomics: ariesData.economics.length,
				totalRecords: ariesData.totalRecords,
			},
			ariesAnalysis: filteredAnalysis,
			qualityMetrics: ariesData.qualityMetrics,
			geologicalInsights: geologicalInsights,
			recommendations: generateAriesRecommendations(ariesData),
			metadata: ariesData.metadata,
		};

		return analysis;
	} catch (error) {
		throw new Error(`Failed to process ARIES database: ${error}`);
	}
}

// Generate geological insights from ARIES data
async function generateAriesInsights(ariesData: any): Promise<Record<string, unknown>> {
	const insights = {
		portfolioOverview: "Analysis in progress",
		topPerformers: [] as string[],
		investmentGuidance: [] as string[],
		riskFactors: [] as string[],
		opportunityAreas: [] as string[],
	};

	const portfolio = ariesData.oilGasAnalysis.portfolioSummary;
	const economics = ariesData.oilGasAnalysis.economicEvaluation;

	// Portfolio overview
	insights.portfolioOverview = `${portfolio.totalWells} wells across ${portfolio.totalProjects} projects`;

	// Top performers
	if (portfolio.topPerformingWells.length > 0) {
		insights.topPerformers = portfolio.topPerformingWells.map(
			(well: any) => `${well.wellName}: NPV $${(well.npv / 1000000).toFixed(1)}M, IRR ${well.irr.toFixed(1)}%`,
		);
	}

	// Investment guidance based on economics
	if (economics.irr > 20) {
		insights.investmentGuidance.push("Strong IRR performance - consider portfolio expansion");
	} else if (economics.irr > 15) {
		insights.investmentGuidance.push("Moderate returns - selective development recommended");
	} else {
		insights.investmentGuidance.push("Below target returns - reevaluate economic assumptions");
	}

	if (economics.payout < 24) {
		insights.investmentGuidance.push("Fast payout period - favorable for cash flow");
	}

	// Risk assessment
	if (portfolio.portfolioRisk === "high") {
		insights.riskFactors.push("High portfolio risk - diversification recommended");
	}

	if (economics.operatingMargin < 30) {
		insights.riskFactors.push("Operating margins below 30% - cost optimization needed");
	}

	// Opportunity identification
	if (ariesData.oilGasAnalysis.reservesAssessment.reservesByCategory.probable > 0) {
		insights.opportunityAreas.push("Probable reserves available for development");
	}

	if (ariesData.wells.filter((w: any) => w.status === "shut_in").length > 0) {
		insights.opportunityAreas.push("Shut-in wells present - recompletion opportunities");
	}

	return insights;
}

// Filter ARIES analysis by type
function filterAriesAnalysis(analysis: any, analysisType: string): any {
	switch (analysisType) {
		case "reserves":
			return {
				reservesAssessment: analysis.reservesAssessment,
				productionForecasting: analysis.productionForecasting,
			};
		case "economics":
			return {
				economicEvaluation: analysis.economicEvaluation,
				riskAnalysis: analysis.riskAnalysis,
			};
		case "forecasting":
			return {
				productionForecasting: analysis.productionForecasting,
				reservesAssessment: analysis.reservesAssessment,
			};
		default:
			return analysis;
	}
}

// Generate ARIES recommendations
function generateAriesRecommendations(ariesData: any): string[] {
	const recommendations = [];

	if (ariesData.qualityMetrics.dataCompleteness < 0.8) {
		recommendations.push("Data completeness below 80% - verify forecast and economic data");
	}

	if (ariesData.qualityMetrics.forecastReliability < 0.7) {
		recommendations.push("Forecast reliability below 70% - review decline curve fits");
	}

	if (ariesData.qualityMetrics.economicConsistency < 0.6) {
		recommendations.push("Economic inconsistency detected - standardize assumptions");
	}

	// Portfolio-specific recommendations
	const economics = ariesData.oilGasAnalysis.economicEvaluation;
	if (economics.irr < 15) {
		recommendations.push("IRR below 15% threshold - reevaluate project economics");
	}

	if (economics.payout > 36) {
		recommendations.push("Payout exceeds 36 months - consider capital efficiency improvements");
	}

	const portfolio = ariesData.oilGasAnalysis.portfolioSummary;
	if (portfolio.portfolioRisk === "high") {
		recommendations.push("High portfolio risk - implement risk mitigation strategies");
	}

	// Version-specific recommendations
	if (ariesData.version === "5000+") {
		recommendations.push("Modern ARIES version - full feature set available");
	} else {
		recommendations.push("Older ARIES version - consider upgrade for enhanced capabilities");
	}

	if (ariesData.metadata.licenseRequired) {
		recommendations.push("Commercial ARIES license required - ensure compliance");
	}

	return recommendations.length > 0 ? recommendations : ["Standard ARIES analysis protocols applied"];
}

function reviewPrincipal(options: GeowizOptions, context?: MCPExecutionContext): SourcePrincipal {
	const principal = context?.principal ?? options.localSourcePrincipal;
	if (!principal) throw new ReviewError("authority_denied");
	return principal;
}
function reviewBoundary(options: GeowizOptions, context?: MCPExecutionContext): ReviewWorkflow {
	reviewPrincipal(options, context);
	if (!options.reviewWorkflow) throw new ReviewError("configuration");
	return options.reviewWorkflow;
}
async function withReviewErrors<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (error) {
		if (!(error instanceof ReviewError)) throw error;
		return {
			success: false,
			reviewError: { code: error.code },
			error: error.message,
			error_type: error.code === "audit_unavailable" ? "retryable" : "user_action",
		};
	}
}

// Create the server using factory
function verifyModelOwner(runtime: ModelRuntime | undefined, context?: MCPExecutionContext): void {
	if (!runtime) throw new ModelProviderError("configuration");
	const owner = runtime.publicProfile().owner;
	if (
		context &&
		(owner.customerId !== context.principal.customerId || owner.employeeId !== context.principal.employeeId)
	)
		throw new ModelProviderError("owner");
}

export const GeowizServer = function (options: GeowizOptions = {}) {
	if (!new.target) throw new Error("Use the GeowizServer constructor");
	// The factory registers capabilities during construction; capture this instance's binding in the template first.
	const template = createGeowizTemplate(options.modelRuntime, options);
	template.tools.push(
		ServerFactory.createAnalysisTool(
			"fetch_source",
			"Retrieve provenance for an approved source ID under the server-owned employee task grant; source text is untrusted data",
			z.object({ sourceId: z.string().min(1) }).strict(),
			async (args, context, signal) =>
				withSourceErrors(async () => {
					const sources = options.sourceRuntime;
					const principal = context?.principal ?? options.localSourcePrincipal;
					if (!sources || !principal) throw new SourceAccessError("access_denied");
					return (await sources.fetch(sources.request(args.sourceId), principal, signal)).artifact;
				}),
		),
		ServerFactory.createAnalysisTool(
			"get_source_status",
			"Check actual readability, revision, freshness and authority for one configured source; never reports cached readiness",
			z.object({ sourceId: z.string().min(1) }).strict(),
			async (args, context, signal) =>
				withSourceErrors(async () => {
					const sources = options.sourceRuntime;
					const principal = context?.principal ?? options.localSourcePrincipal;
					if (!sources || !principal) throw new SourceAccessError("access_denied");
					return sources.health({ ...sources.request(args.sourceId), operation: "health" }, principal, signal);
				}),
		),
		ServerFactory.createAnalysisTool(
			"get_model_profile",
			"Discover the effective synthesis profile; credentials and secret references are excluded",
			z.object({}).strict(),
			async (_args, context) => {
				verifyModelOwner(options.modelRuntime, context);
				return options.modelRuntime?.publicProfile();
			},
		),
	);
	return new (ServerFactory.createServer(template))({
		http: options.http,
		dataPath: options.dataPath,
		events: options.events,
	});
} as unknown as { new (options?: GeowizOptions): MCPServer };
export default GeowizServer;

// Run server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		const file = process.env.GEOWIZ_MODEL_CONFIG_FILE;
		const config = file ? await readPrivateReferenceModelConfig(file) : undefined;
		const modelRuntime = config
			? createModelRuntime(config.synthesis, {
					resolveCredential: createFileModelCredentialResolver(config.synthesis.owner),
				})
			: undefined;
		const sourceFile = process.env.GEOWIZ_SOURCE_CONFIG_FILE;
		const sourceAudit = process.env.GEOWIZ_SOURCE_AUDIT_FILE;
		if (sourceFile && !sourceAudit) throw new SourceAccessError("access_denied");
		const sourceBinding =
			sourceFile && sourceAudit ? await loadSourceBinding(sourceFile, createFileSourceAudit(sourceAudit)) : undefined;
		runMCPServer(
			new GeowizServer({
				modelRuntime,
				sourceRuntime: sourceBinding?.runtime,
				localSourcePrincipal: sourceBinding?.principal,
			}),
		);
	} catch {
		console.error("Geowiz setup failed. Check the private model/source configuration and source audit path.");
		process.exitCode = 1;
	}
}
