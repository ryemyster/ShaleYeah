/**
 * File Integration Layer
 * Unified interface for all file format parsers
 */

import { FileFormatDetector, type FileMetadata } from "./file-detector.js";
import { type ExcelData, ExcelParser } from "./parsers/excel-parser.js";
import { type GISData, GISParser } from "./parsers/gis-parser.js";
import { type LASData, LASParser } from "./parsers/las-parser.js";
import { type SEGYData, SEGYParser } from "./parsers/segy-parser.js";

export interface ParsedFileResult {
	metadata: FileMetadata;
	data: LASData | GISData | ExcelData | SEGYData | any;
	format: string;
	success: boolean;
	errors?: string[];
	warnings?: string[];
}

export interface FileFormatSupport {
	format: string;
	extensions: string[];
	parser: string;
	status: "supported" | "planned" | "proprietary";
	description: string;
}

export class FileIntegrationManager {
	private detector: FileFormatDetector;
	private lasParser: LASParser;
	private gisParser: GISParser;
	private excelParser: ExcelParser;
	private segyParser: SEGYParser;

	constructor() {
		this.detector = new FileFormatDetector();
		this.lasParser = new LASParser();
		this.gisParser = new GISParser();
		this.excelParser = new ExcelParser();
		this.segyParser = new SEGYParser();
	}

	/**
	 * Get list of all supported file formats
	 */
	getSupportedFormats(): FileFormatSupport[] {
		return [
			// Well Log Formats (Supported)
			{
				format: "las",
				extensions: [".las"],
				parser: "LASParser",
				status: "supported",
				description: "Log ASCII Standard well log files",
			},
			{
				format: "dlis",
				extensions: [".dlis"],
				parser: "Planned",
				status: "planned",
				description: "Digital Log Interchange Standard",
			},
			{
				format: "witsml",
				extensions: [".xml"],
				parser: "Planned",
				status: "planned",
				description: "WITSML XML well data",
			},

			// Seismic Formats (Supported)
			{
				format: "segy",
				extensions: [".segy", ".sgy"],
				parser: "SEGYParser",
				status: "supported",
				description: "SEG-Y seismic data format",
			},
			{
				format: "seg2",
				extensions: [".seg2", ".dat"],
				parser: "Planned",
				status: "planned",
				description: "SEG-2 seismic data format",
			},

			// GIS Formats (Supported)
			{
				format: "shapefile",
				extensions: [".shp"],
				parser: "GISParser",
				status: "supported",
				description: "ESRI Shapefile with .dbf/.shx support",
			},
			{
				format: "geojson",
				extensions: [".geojson", ".json"],
				parser: "GISParser",
				status: "supported",
				description: "GeoJSON geographic data",
			},
			{
				format: "kml",
				extensions: [".kml", ".kmz"],
				parser: "GISParser",
				status: "supported",
				description: "Keyhole Markup Language",
			},
			{
				format: "geopackage",
				extensions: [".gpkg"],
				parser: "Planned",
				status: "planned",
				description: "OGC GeoPackage",
			},

			// Spreadsheet Formats (Supported)
			{
				format: "excel",
				extensions: [".xlsx", ".xls"],
				parser: "ExcelParser",
				status: "supported",
				description: "Microsoft Excel spreadsheets",
			},
			{
				format: "csv",
				extensions: [".csv"],
				parser: "ExcelParser",
				status: "supported",
				description: "Comma-separated values",
			},

			// Image/Raster Formats (Planned)
			{
				format: "geotiff",
				extensions: [".tif", ".tiff", ".geotiff"],
				parser: "Planned",
				status: "planned",
				description: "GeoTIFF raster images",
			},
			{
				format: "ecw",
				extensions: [".ecw"],
				parser: "Proprietary",
				status: "proprietary",
				description: "Enhanced Compression Wavelet (ER Mapper)",
			},

			// Database Formats (Planned)
			{
				format: "access",
				extensions: [".mdb", ".accdb"],
				parser: "Planned",
				status: "planned",
				description: "Microsoft Access databases",
			},
			{
				format: "sqlite",
				extensions: [".sqlite", ".db"],
				parser: "Planned",
				status: "planned",
				description: "SQLite databases",
			},

			// Reservoir Formats (Planned)
			{
				format: "eclipse",
				extensions: [".grdecl", ".inc"],
				parser: "Planned",
				status: "planned",
				description: "Eclipse reservoir grid format",
			},
			{
				format: "petrel",
				extensions: [".dat"],
				parser: "Proprietary",
				status: "proprietary",
				description: "Petrel project files (Schlumberger)",
			},

			// Proprietary Formats
			{
				format: "kingdom",
				extensions: [".kdb"],
				parser: "Proprietary",
				status: "proprietary",
				description: "Kingdom seismic interpretation (IHS)",
			},
			{
				format: "geoframe",
				extensions: [".gf"],
				parser: "Proprietary",
				status: "proprietary",
				description: "GeoFrame project files (Schlumberger)",
			},
		];
	}

	/**
	 * Parse any supported file format
	 */
	async parseFile(filePath: string): Promise<ParsedFileResult> {
		try {
			// Detect file format
			const metadata = await this.detector.detectFormat(filePath);

			if (!metadata.isValid) {
				return {
					metadata,
					data: null,
					format: metadata.format,
					success: false,
					errors: metadata.errors || ["Unable to detect valid file format"],
				};
			}

			// Parse based on detected format
			switch (metadata.format) {
				case "las":
					return await this.parseLAS(filePath, metadata);

				case "shapefile":
					return await this.parseShapefile(filePath, metadata);

				case "geojson":
					return await this.parseGeoJSON(filePath, metadata);

				case "kml":
					return await this.parseKML(filePath, metadata);

				case "excel":
					return await this.parseExcel(filePath, metadata);

				case "csv":
					return await this.parseCSV(filePath, metadata);

				case "segy":
					return await this.parseSEGY(filePath, metadata);

				default:
					return {
						metadata,
						data: null,
						format: metadata.format,
						success: false,
						errors: [`Parser not implemented for format: ${metadata.format}`],
						warnings: ["This file format is planned for future support"],
					};
			}
		} catch (error) {
			return {
				metadata: {
					format: "unknown",
					size: 0,
					lastModified: new Date(),
					parsed: false,
					isValid: false,
					metadata: {},
				},
				data: null,
				format: "unknown",
				success: false,
				errors: [`Failed to parse file: ${error}`],
			};
		}
	}

	private async parseLAS(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.lasParser.parseLASFile(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "las",
				success: true,
				warnings: data.metadata.quality.completeness < 0.8 ? ["Data completeness below 80%"] : undefined,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "las",
				success: false,
				errors: [`LAS parsing failed: ${error}`],
			};
		}
	}

	private async parseShapefile(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.gisParser.parseShapefile(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "shapefile",
				success: true,
				warnings: !data.metadata.quality.coordinateSystemDefined ? ["No coordinate system defined"] : undefined,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "shapefile",
				success: false,
				errors: [`Shapefile parsing failed: ${error}`],
			};
		}
	}

	private async parseGeoJSON(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.gisParser.parseGeoJSON(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "geojson",
				success: true,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "geojson",
				success: false,
				errors: [`GeoJSON parsing failed: ${error}`],
			};
		}
	}

	private async parseKML(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.gisParser.parseKML(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "kml",
				success: true,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "kml",
				success: false,
				errors: [`KML parsing failed: ${error}`],
			};
		}
	}

	private async parseExcel(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.excelParser.parseExcelFile(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "excel",
				success: true,
				warnings: !data.metadata.quality.structuredData ? ["No structured data detected"] : undefined,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "excel",
				success: false,
				errors: [`Excel parsing failed: ${error}`],
			};
		}
	}

	private async parseCSV(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.excelParser.parseCSVFile(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "csv",
				success: true,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "csv",
				success: false,
				errors: [`CSV parsing failed: ${error}`],
			};
		}
	}

	private async parseSEGY(filePath: string, metadata: FileMetadata): Promise<ParsedFileResult> {
		try {
			const data = await this.segyParser.parseSEGYFile(filePath);

			return {
				metadata: { ...metadata, parsed: true },
				data,
				format: "segy",
				success: true,
				warnings: data.metadata.quality.dataIntegrity < 0.9 ? ["Data integrity below 90%"] : undefined,
			};
		} catch (error) {
			return {
				metadata,
				data: null,
				format: "segy",
				success: false,
				errors: [`SEGY parsing failed: ${error}`],
			};
		}
	}

	/**
	 * Get format-specific extraction capabilities
	 */
	getExtractionCapabilities(format: string): string[] {
		const capabilities: Record<string, string[]> = {
			las: ["well-logs", "curves", "depth-data", "formation-tops"],
			shapefile: ["spatial-features", "attribute-data", "geometry", "coordinate-systems"],
			geojson: ["geographic-features", "properties", "coordinate-data"],
			kml: ["placemarks", "geographic-data", "descriptions"],
			excel: ["tabular-data", "pricing-data", "cost-assumptions", "calculations"],
			csv: ["structured-data", "time-series", "tabular-data"],
			segy: ["seismic-traces", "survey-geometry", "acquisition-parameters", "trace-headers"],
		};

		return capabilities[format] || [];
	}

	/**
	 * Validate file format compatibility
	 */
	async validateFileCompatibility(
		filePath: string,
		expectedFormat: string,
	): Promise<{
		compatible: boolean;
		confidence: number;
		issues: string[];
	}> {
		const result = await this.detector.validateFormat(filePath, expectedFormat);

		return {
			compatible: result.isValid,
			confidence: result.confidence,
			issues: [...result.errors, ...result.warnings],
		};
	}
}
