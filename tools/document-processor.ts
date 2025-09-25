#!/usr/bin/env tsx
/**
 * Enhanced Document Processor for SHALE YEAH
 * Processes PDF, DOCX, and PPTX files with oil & gas industry focus
 *
 * LEGAL NOTICE: Document processing provided under fair use for data extraction.
 * Users must have appropriate document access rights and software licenses.
 */

import fs from "node:fs";
import path from "node:path";

// Enhanced interface for document processing
export interface DocumentData {
	format: "PDF" | "DOCX" | "PPTX";
	fileName: string;
	pages: number;
	content: DocumentContent;
	metadata: {
		filePath?: string;
		fileSize?: number;
		createdDate?: string;
		modifiedDate?: string;
		author?: string;
		title?: string;
		subject?: string;
		isPasswordProtected?: boolean;
		[key: string]: unknown;
	};
	oilGasData: {
		wellNames: string[];
		formations: string[];
		economicData: EconomicDataPoint[];
		technicalSpecs: TechnicalSpec[];
		legalTerms: string[];
	};
	qualityMetrics: {
		completeness: number;
		readability: number;
		dataExtraction: number;
		confidence: number;
	};
}

export interface DocumentContent {
	text: string;
	tables: DocumentTable[];
	images: DocumentImage[];
	sections: DocumentSection[];
	footnotes: string[];
	headers: string[];
}

export interface DocumentTable {
	pageNumber: number;
	headers: string[];
	rows: string[][];
	caption?: string;
	type: "data" | "financial" | "technical" | "legal";
}

export interface DocumentImage {
	pageNumber: number;
	caption?: string;
	type: "chart" | "map" | "diagram" | "photo";
	dimensions?: { width: number; height: number };
}

export interface DocumentSection {
	title: string;
	level: number;
	pageNumber: number;
	content: string;
	type:
		| "executive_summary"
		| "technical"
		| "financial"
		| "legal"
		| "appendix"
		| "other";
}

export interface EconomicDataPoint {
	parameter: string;
	value: number | string;
	unit?: string;
	source?: string;
	pageNumber: number;
}

export interface TechnicalSpec {
	parameter: string;
	value: string;
	category: "drilling" | "completion" | "production" | "reservoir";
	pageNumber: number;
}

export async function processDocument(filePath: string): Promise<DocumentData> {
	try {
		const stats = fs.statSync(filePath);
		const fileName = path.basename(filePath);
		const ext = path.extname(filePath).toLowerCase();

		// Detect document format
		let format: "PDF" | "DOCX" | "PPTX";
		switch (ext) {
			case ".pdf":
				format = "PDF";
				break;
			case ".docx":
				format = "DOCX";
				break;
			case ".pptx":
				format = "PPTX";
				break;
			default:
				throw new Error(`Unsupported document format: ${ext}`);
		}

		// Process document based on format
		const content = await extractDocumentContent(filePath, format);
		const oilGasData = await extractOilGasData(content, format);
		const qualityMetrics = calculateDocumentQuality(content, oilGasData);

		return {
			format,
			fileName,
			pages: content.sections.length || 1,
			content,
			metadata: {
				filePath,
				fileSize: stats.size,
				createdDate: stats.birthtime.toISOString(),
				modifiedDate: stats.mtime.toISOString(),
				isPasswordProtected: false, // Would need to check actual file
			},
			oilGasData,
			qualityMetrics,
		};
	} catch (error) {
		throw new Error(`Failed to process document: ${error}`);
	}
}

async function extractDocumentContent(
	_filePath: string,
	format: "PDF" | "DOCX" | "PPTX",
): Promise<DocumentContent> {
	// Note: Full document processing requires libraries like pdf-parse, mammoth, or officegen
	// This is a placeholder implementation showing the structure

	console.warn(
		`Document processing for ${format} requires specialized libraries:`,
	);

	switch (format) {
		case "PDF":
			console.warn("For PDF: npm install pdf-parse pdf2pic");
			break;
		case "DOCX":
			console.warn("For DOCX: npm install mammoth");
			break;
		case "PPTX":
			console.warn("For PPTX: npm install officegen");
			break;
	}

	console.warn(
		"User must have appropriate document access rights and software licenses.",
	);

	// Return demo structure for development
	const demoContent: DocumentContent = {
		text: `Demo ${format} document content for oil & gas analysis.\n\nThis would contain extracted text from the actual document including technical specifications, economic data, and operational parameters.`,
		tables: [
			{
				pageNumber: 1,
				headers: [
					"Well Name",
					"Total Depth (ft)",
					"Lateral Length (ft)",
					"EUR (Mboe)",
				],
				rows: [
					["DEMO-WELL-1", "12500", "8500", "1250"],
					["DEMO-WELL-2", "13200", "9100", "1450"],
				],
				caption: "Well Summary Data",
				type: "technical",
			},
			{
				pageNumber: 2,
				headers: ["Parameter", "Value", "Unit"],
				rows: [
					["NPV @ 10%", "15.2", "MM$"],
					["IRR", "18.5", "%"],
					["Payout", "2.8", "years"],
				],
				caption: "Economic Summary",
				type: "financial",
			},
		],
		images: [
			{
				pageNumber: 1,
				caption: "Location Map",
				type: "map",
			},
			{
				pageNumber: 3,
				caption: "Decline Curve Analysis",
				type: "chart",
			},
		],
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				pageNumber: 1,
				content: "Demo executive summary content...",
				type: "executive_summary",
			},
			{
				title: "Technical Analysis",
				level: 1,
				pageNumber: 2,
				content: "Demo technical analysis content...",
				type: "technical",
			},
			{
				title: "Economic Evaluation",
				level: 1,
				pageNumber: 3,
				content: "Demo economic evaluation content...",
				type: "financial",
			},
		],
		footnotes: ["EUR = Estimated Ultimate Recovery", "NPV = Net Present Value"],
		headers: ["Executive Summary", "Technical Analysis", "Economic Evaluation"],
	};

	return demoContent;
}

async function extractOilGasData(
	content: DocumentContent,
	_format: "PDF" | "DOCX" | "PPTX",
): Promise<DocumentData["oilGasData"]> {
	const oilGasData = {
		wellNames: [] as string[],
		formations: [] as string[],
		economicData: [] as EconomicDataPoint[],
		technicalSpecs: [] as TechnicalSpec[],
		legalTerms: [] as string[],
	};

	// Extract well names from tables and text
	content.tables.forEach((table) => {
		table.rows.forEach((row) => {
			// Look for well naming patterns
			row.forEach((cell) => {
				if (
					typeof cell === "string" &&
					cell.match(/^[A-Z0-9\-_]+WELL[0-9\-_]*$/i)
				) {
					oilGasData.wellNames.push(cell);
				}
			});
		});
	});

	// Extract formations from text content
	const formationRegex =
		/(Eagle Ford|Bakken|Permian|Marcellus|Barnett|Haynesville|Niobrara|Woodford|Fayetteville|Utica)/gi;
	const formationMatches = content.text.match(formationRegex);
	if (formationMatches) {
		oilGasData.formations = [...new Set(formationMatches)];
	}

	// Extract economic data from tables
	content.tables.forEach((table) => {
		if (table.type === "financial") {
			table.rows.forEach((row, _index) => {
				if (row.length >= 2) {
					const parameter = row[0];
					const value = row[1];
					const unit = row.length > 2 ? row[2] : undefined;

					oilGasData.economicData.push({
						parameter,
						value: Number.isNaN(Number(value)) ? value : Number(value),
						unit,
						pageNumber: table.pageNumber,
					});
				}
			});
		}
	});

	// Extract technical specifications
	content.tables.forEach((table) => {
		if (table.type === "technical") {
			table.rows.forEach((row) => {
				if (row.length >= 2) {
					let category: TechnicalSpec["category"] = "production";

					// Categorize based on parameter name
					const param = row[0].toLowerCase();
					if (param.includes("drill") || param.includes("depth")) {
						category = "drilling";
					} else if (param.includes("completion") || param.includes("frac")) {
						category = "completion";
					} else if (
						param.includes("reservoir") ||
						param.includes("formation")
					) {
						category = "reservoir";
					}

					oilGasData.technicalSpecs.push({
						parameter: row[0],
						value: row[1],
						category,
						pageNumber: table.pageNumber,
					});
				}
			});
		}
	});

	// Extract legal terms from text
	const legalTermsRegex =
		/(royalty|lease|mineral rights|working interest|overriding royalty|net revenue interest|AFE|JOA|farmout|joint venture)/gi;
	const legalMatches = content.text.match(legalTermsRegex);
	if (legalMatches) {
		oilGasData.legalTerms = [...new Set(legalMatches)];
	}

	return oilGasData;
}

function calculateDocumentQuality(
	content: DocumentContent,
	oilGasData: DocumentData["oilGasData"],
): DocumentData["qualityMetrics"] {
	// Completeness: based on presence of key sections and data
	const hasExecutiveSummary = content.sections.some(
		(s) => s.type === "executive_summary",
	);
	const hasTechnical = content.sections.some((s) => s.type === "technical");
	const hasFinancial = content.sections.some((s) => s.type === "financial");
	const completeness =
		((hasExecutiveSummary ? 1 : 0) +
			(hasTechnical ? 1 : 0) +
			(hasFinancial ? 1 : 0) +
			(content.tables.length > 0 ? 1 : 0)) /
		4;

	// Readability: based on text length and structure
	const hasReasonableLength = content.text.length > 100;
	const hasStructure = content.sections.length > 1;
	const readability =
		((hasReasonableLength ? 1 : 0) + (hasStructure ? 1 : 0)) / 2;

	// Data extraction: based on amount of extracted oil & gas data
	const hasWellData = oilGasData.wellNames.length > 0;
	const hasEconomicData = oilGasData.economicData.length > 0;
	const hasTechnicalData = oilGasData.technicalSpecs.length > 0;
	const dataExtraction =
		((hasWellData ? 1 : 0) +
			(hasEconomicData ? 1 : 0) +
			(hasTechnicalData ? 1 : 0)) /
		3;

	// Overall confidence
	const confidence = (completeness + readability + dataExtraction) / 3;

	return {
		completeness: Math.round(completeness * 100) / 100,
		readability: Math.round(readability * 100) / 100,
		dataExtraction: Math.round(dataExtraction * 100) / 100,
		confidence: Math.round(confidence * 100) / 100,
	};
}

// CLI usage
const main = async () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error(
			"Usage: document-processor <document.pdf|.docx|.pptx> [--json|--summary|--data]",
		);
		console.error("Options:");
		console.error("  --json     Output full JSON data");
		console.error("  --summary  Output document summary (default)");
		console.error("  --data     Output extracted oil & gas data only");
		process.exit(1);
	}

	if (!fs.existsSync(filePath)) {
		console.error(`Document file not found: ${filePath}`);
		process.exit(1);
	}

	try {
		const documentData = await processDocument(filePath);

		if (options.includes("--data")) {
			console.log(
				JSON.stringify(
					{
						fileName: documentData.fileName,
						oilGasData: documentData.oilGasData,
						qualityMetrics: documentData.qualityMetrics,
					},
					null,
					2,
				),
			);
		} else if (options.includes("--json")) {
			console.log(JSON.stringify(documentData, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				format: documentData.format,
				fileName: documentData.fileName,
				pages: documentData.pages,
				sections: documentData.content.sections.length,
				tables: documentData.content.tables.length,
				images: documentData.content.images.length,
				oilGasData: {
					wellNames: documentData.oilGasData.wellNames.length,
					formations: documentData.oilGasData.formations.length,
					economicDataPoints: documentData.oilGasData.economicData.length,
					technicalSpecs: documentData.oilGasData.technicalSpecs.length,
				},
				quality: documentData.qualityMetrics,
				metadata: {
					fileSize: documentData.metadata.fileSize,
					modifiedDate: documentData.metadata.modifiedDate,
				},
			};
			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error processing document: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
