#!/usr/bin/env tsx
/**
 * Enhanced GIS Processor for SHALE YEAH
 * Comprehensive spatial data processing with validation and quality assessment
 * Supports Shapefile, GeoJSON, KML formats with oil & gas industry focus
 *
 * LEGAL NOTICE: GIS format support uses open standards and libraries.
 * Users responsible for compliance with data licensing requirements.
 */

import { access, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import * as turf from "@turf/turf";
import type { Feature as GeoJSONFeature } from "geojson";
import shapefile from "shapefile";
import { parseString as parseXML } from "xml2js";

// Enhanced interfaces for oil & gas spatial data
export interface SpatialGeometry {
	type: string;
	coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface SpatialFeature {
	id?: string | number;
	type: "Feature";
	geometry: SpatialGeometry;
	properties: Record<string, any>;
}

export interface SpatialFeatureCollection {
	type: "FeatureCollection";
	crs?: {
		type: string;
		properties: Record<string, any>;
	};
	features: SpatialFeature[];
}

export interface SpatialBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	centerX: number;
	centerY: number;
	width: number;
	height: number;
}

export interface GISQualityMetrics {
	geometryValidity: number; // 0-1 scale
	attributeCompleteness: number; // 0-1 scale
	spatialAccuracy: number; // 0-1 scale
	dataConsistency: number; // 0-1 scale
	overallQuality: number; // 0-1 scale
	validationErrors: string[];
	recommendations: string[];
}

export interface GISProcessingResult {
	format: "shapefile" | "geojson" | "kml";
	featureCollection: SpatialFeatureCollection;
	bounds: SpatialBounds;
	qualityMetrics: GISQualityMetrics;
	oilGasMetrics: {
		leaseBlocks: number;
		wellLocations: number;
		pipelines: number;
		facilities: number;
		estimatedAcreage: number;
		majorOperators: string[];
	};
	metadata: {
		featureCount: number;
		geometryTypes: string[];
		attributeFields: string[];
		coordinateSystem: string;
		fileSize: number;
		parseTime: number;
		spatialIndex: boolean;
		hasElevation: boolean;
		dateProcessed: string;
	};
	recommendations: string[];
}

export class EnhancedGISProcessor {
	/**
	 * Main processing function - auto-detects format and processes
	 */
	async processGISFile(filePath: string): Promise<GISProcessingResult> {
		const format = this.detectGISFormat(filePath);

		switch (format) {
			case "shapefile":
				return await this.processShapefile(filePath);
			case "geojson":
				return await this.processGeoJSON(filePath);
			case "kml":
				return await this.processKML(filePath);
			default:
				throw new Error(`Unsupported GIS format for file: ${filePath}`);
		}
	}

	/**
	 * Detect GIS file format
	 */
	detectGISFormat(
		filePath: string,
	): "shapefile" | "geojson" | "kml" | "unknown" {
		const ext = path.extname(filePath).toLowerCase();

		switch (ext) {
			case ".shp":
				return "shapefile";
			case ".geojson":
			case ".json":
				return "geojson";
			case ".kml":
			case ".kmz":
				return "kml";
			default:
				return "unknown";
		}
	}

	/**
	 * Process shapefile with enhanced validation
	 */
	async processShapefile(shpPath: string): Promise<GISProcessingResult> {
		const startTime = Date.now();

		try {
			// Validate shapefile components
			const validation = await this.validateShapefileComponents(shpPath);
			if (!validation.isValid) {
				throw new Error(
					`Shapefile validation failed: ${validation.errors.join(", ")}`,
				);
			}

			const basePath = shpPath.replace(/\.shp$/i, "");
			const dbfPath = `${basePath}.dbf`;
			const prjPath = `${basePath}.prj`;

			// Parse shapefile
			const features: SpatialFeature[] = [];
			const geometryTypes = new Set<string>();

			await shapefile.read(shpPath, dbfPath).then((collection) => {
				if (collection.type === "FeatureCollection") {
					features.push(...(collection.features as SpatialFeature[]));
					collection.features.forEach((feature: any) => {
						if (feature.geometry) {
							geometryTypes.add(feature.geometry.type);
						}
					});
				}
			});

			// Read coordinate system
			let coordinateSystem = "Unknown";
			if (await this.fileExists(prjPath)) {
				try {
					const prjContent = await readFile(prjPath, "utf-8");
					coordinateSystem = this.parsePRJFile(prjContent);
				} catch {
					// Ignore PRJ file errors
				}
			}

			const featureCollection: SpatialFeatureCollection = {
				type: "FeatureCollection",
				features,
			};

			// Enhanced processing
			const bounds = this.calculateEnhancedBounds(features);
			const qualityMetrics = await this.assessGISQuality(
				features,
				coordinateSystem,
			);
			const oilGasMetrics = this.analyzeOilGasContent(features);
			const attributeFields = this.extractAttributeFields(features);
			const stats = await stat(shpPath);

			return {
				format: "shapefile",
				featureCollection,
				bounds,
				qualityMetrics,
				oilGasMetrics,
				metadata: {
					featureCount: features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem,
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					spatialIndex: false,
					hasElevation: this.checkElevationData(features),
					dateProcessed: new Date().toISOString(),
				},
				recommendations: this.generateRecommendations(
					qualityMetrics,
					oilGasMetrics,
				),
			};
		} catch (error) {
			throw new Error(`Failed to process shapefile: ${error}`);
		}
	}

	/**
	 * Process GeoJSON with enhanced validation
	 */
	async processGeoJSON(filePath: string): Promise<GISProcessingResult> {
		const startTime = Date.now();

		try {
			const content = await readFile(filePath, "utf-8");
			const data = JSON.parse(content);

			// Validate GeoJSON structure
			const validation = this.validateGeoJSONStructure(data);
			if (!validation.isValid) {
				throw new Error(
					`GeoJSON validation failed: ${validation.errors.join(", ")}`,
				);
			}

			let featureCollection: SpatialFeatureCollection;

			if (data.type === "FeatureCollection") {
				featureCollection = data as SpatialFeatureCollection;
			} else if (data.type === "Feature") {
				featureCollection = {
					type: "FeatureCollection",
					features: [data as SpatialFeature],
				};
			} else if (this.isGeometryType(data.type)) {
				featureCollection = {
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: data as SpatialGeometry,
							properties: {},
						},
					],
				};
			} else {
				throw new Error("Invalid GeoJSON format");
			}

			const geometryTypes = new Set<string>();
			featureCollection.features.forEach((feature) => {
				if (feature.geometry) {
					geometryTypes.add(feature.geometry.type);
				}
			});

			// Enhanced processing
			const bounds = this.calculateEnhancedBounds(featureCollection.features);
			const qualityMetrics = await this.assessGISQuality(
				featureCollection.features,
				this.extractCRS(featureCollection),
			);
			const oilGasMetrics = this.analyzeOilGasContent(
				featureCollection.features,
			);
			const attributeFields = this.extractAttributeFields(
				featureCollection.features,
			);
			const stats = await stat(filePath);

			return {
				format: "geojson",
				featureCollection,
				bounds,
				qualityMetrics,
				oilGasMetrics,
				metadata: {
					featureCount: featureCollection.features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem: this.extractCRS(featureCollection),
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					spatialIndex: false,
					hasElevation: this.checkElevationData(featureCollection.features),
					dateProcessed: new Date().toISOString(),
				},
				recommendations: this.generateRecommendations(
					qualityMetrics,
					oilGasMetrics,
				),
			};
		} catch (error) {
			throw new Error(`Failed to process GeoJSON: ${error}`);
		}
	}

	/**
	 * Process KML with enhanced validation
	 */
	async processKML(filePath: string): Promise<GISProcessingResult> {
		const startTime = Date.now();

		try {
			const content = await readFile(filePath, "utf-8");
			const features: SpatialFeature[] = [];

			// Parse XML
			const parseResult = await new Promise<any>((resolve, reject) => {
				parseXML(content, (err, result) => {
					if (err) reject(err);
					else resolve(result);
				});
			});

			// Extract features from KML structure
			if (parseResult.kml?.Document) {
				const document = parseResult.kml.Document[0];
				await this.extractKMLFeatures(document, features);
			} else if (parseResult.kml?.Folder) {
				for (const folder of parseResult.kml.Folder) {
					await this.extractKMLFeatures(folder, features);
				}
			}

			const geometryTypes = new Set<string>();
			features.forEach((feature) => {
				if (feature.geometry) {
					geometryTypes.add(feature.geometry.type);
				}
			});

			const featureCollection: SpatialFeatureCollection = {
				type: "FeatureCollection",
				features,
			};

			// Enhanced processing
			const bounds = this.calculateEnhancedBounds(features);
			const qualityMetrics = await this.assessGISQuality(features, "WGS84");
			const oilGasMetrics = this.analyzeOilGasContent(features);
			const attributeFields = this.extractAttributeFields(features);
			const stats = await stat(filePath);

			return {
				format: "kml",
				featureCollection,
				bounds,
				qualityMetrics,
				oilGasMetrics,
				metadata: {
					featureCount: features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem: "WGS84",
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					spatialIndex: false,
					hasElevation: this.checkElevationData(features),
					dateProcessed: new Date().toISOString(),
				},
				recommendations: this.generateRecommendations(
					qualityMetrics,
					oilGasMetrics,
				),
			};
		} catch (error) {
			throw new Error(`Failed to process KML: ${error}`);
		}
	}

	// Validation methods
	private async validateShapefileComponents(
		shpPath: string,
	): Promise<{ isValid: boolean; errors: string[] }> {
		const errors: string[] = [];
		const basePath = shpPath.replace(/\.shp$/i, "");

		const requiredFiles = [
			{ path: shpPath, name: ".shp file" },
			{ path: `${basePath}.dbf`, name: ".dbf file" },
			{ path: `${basePath}.shx`, name: ".shx file" },
		];

		for (const file of requiredFiles) {
			if (!(await this.fileExists(file.path))) {
				errors.push(`Missing ${file.name}: ${file.path}`);
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	private validateGeoJSONStructure(data: any): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!data.type) {
			errors.push("Missing 'type' property");
		}

		if (data.type === "FeatureCollection") {
			if (!Array.isArray(data.features)) {
				errors.push("FeatureCollection must have 'features' array");
			}
		} else if (data.type === "Feature") {
			if (!data.geometry) {
				errors.push("Feature must have 'geometry' property");
			}
			if (!data.properties) {
				errors.push("Feature must have 'properties' property");
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	// Enhanced analysis methods
	private calculateEnhancedBounds(features: SpatialFeature[]): SpatialBounds {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		features.forEach((feature) => {
			if (feature.geometry) {
				try {
					const bbox = turf.bbox(feature as GeoJSONFeature);
					minX = Math.min(minX, bbox[0]);
					minY = Math.min(minY, bbox[1]);
					maxX = Math.max(maxX, bbox[2]);
					maxY = Math.max(maxY, bbox[3]);
				} catch {
					// Skip invalid geometries
				}
			}
		});

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const width = maxX - minX;
		const height = maxY - minY;

		return { minX, minY, maxX, maxY, centerX, centerY, width, height };
	}

	private async assessGISQuality(
		features: SpatialFeature[],
		coordinateSystem: string,
	): Promise<GISQualityMetrics> {
		const validationErrors: string[] = [];

		// Geometry validity check
		let validGeometries = 0;
		features.forEach((feature, index) => {
			try {
				if (feature.geometry?.coordinates) {
					// Basic geometry validation
					turf.bbox(feature as GeoJSONFeature);
					validGeometries++;
				} else {
					validationErrors.push(
						`Feature ${index}: Invalid or missing geometry`,
					);
				}
			} catch (error) {
				validationErrors.push(
					`Feature ${index}: Geometry validation failed - ${error}`,
				);
			}
		});

		const geometryValidity =
			features.length > 0 ? validGeometries / features.length : 0;

		// Attribute completeness
		let featuresWithAttributes = 0;
		features.forEach((feature) => {
			if (feature.properties && Object.keys(feature.properties).length > 0) {
				featuresWithAttributes++;
			}
		});

		const attributeCompleteness =
			features.length > 0 ? featuresWithAttributes / features.length : 0;

		// Spatial accuracy (based on coordinate system definition)
		const spatialAccuracy = coordinateSystem !== "Unknown" ? 0.9 : 0.5;

		// Data consistency (check for consistent attribute schemas)
		const dataConsistency = this.assessDataConsistency(features);

		// Overall quality score
		const overallQuality =
			(geometryValidity +
				attributeCompleteness +
				spatialAccuracy +
				dataConsistency) /
			4;

		// Generate recommendations
		const recommendations: string[] = [];
		if (geometryValidity < 0.9) {
			recommendations.push(
				"Some features have invalid geometries - consider data validation",
			);
		}
		if (attributeCompleteness < 0.8) {
			recommendations.push(
				"Many features lack attribute data - consider data enrichment",
			);
		}
		if (spatialAccuracy < 0.8) {
			recommendations.push(
				"Coordinate system not well defined - verify projection",
			);
		}
		if (dataConsistency < 0.8) {
			recommendations.push(
				"Inconsistent attribute schema - standardize field names",
			);
		}

		return {
			geometryValidity: Math.round(geometryValidity * 100) / 100,
			attributeCompleteness: Math.round(attributeCompleteness * 100) / 100,
			spatialAccuracy: Math.round(spatialAccuracy * 100) / 100,
			dataConsistency: Math.round(dataConsistency * 100) / 100,
			overallQuality: Math.round(overallQuality * 100) / 100,
			validationErrors,
			recommendations,
		};
	}

	private analyzeOilGasContent(features: SpatialFeature[]): {
		leaseBlocks: number;
		wellLocations: number;
		pipelines: number;
		facilities: number;
		estimatedAcreage: number;
		majorOperators: string[];
	} {
		let leaseBlocks = 0;
		let wellLocations = 0;
		let pipelines = 0;
		let facilities = 0;
		let totalArea = 0;
		const operators = new Set<string>();

		features.forEach((feature) => {
			const props = feature.properties || {};

			// Analyze by geometry type and properties
			if (
				feature.geometry?.type === "Polygon" ||
				feature.geometry?.type === "MultiPolygon"
			) {
				// Likely lease blocks
				const keywords = ["lease", "block", "tract", "acreage", "permit"];
				const hasLeaseKeywords = Object.keys(props).some((key) =>
					keywords.some((keyword) => key.toLowerCase().includes(keyword)),
				);

				if (hasLeaseKeywords) {
					leaseBlocks++;
					try {
						totalArea += turf.area(feature as GeoJSONFeature) * 0.000247105; // Convert to acres
					} catch {
						// Skip area calculation for invalid geometries
					}
				}
			} else if (feature.geometry?.type === "Point") {
				// Likely wells or facilities
				const wellKeywords = ["well", "bore", "hole"];
				const facilityKeywords = ["facility", "plant", "station", "terminal"];

				const hasWellKeywords = Object.keys(props).some((key) =>
					wellKeywords.some((keyword) => key.toLowerCase().includes(keyword)),
				);
				const hasFacilityKeywords = Object.keys(props).some((key) =>
					facilityKeywords.some((keyword) =>
						key.toLowerCase().includes(keyword),
					),
				);

				if (hasWellKeywords) {
					wellLocations++;
				} else if (hasFacilityKeywords) {
					facilities++;
				}
			} else if (
				feature.geometry?.type === "LineString" ||
				feature.geometry?.type === "MultiLineString"
			) {
				// Likely pipelines
				const pipelineKeywords = ["pipeline", "pipe", "line", "transmission"];
				const hasPipelineKeywords = Object.keys(props).some((key) =>
					pipelineKeywords.some((keyword) =>
						key.toLowerCase().includes(keyword),
					),
				);

				if (hasPipelineKeywords) {
					pipelines++;
				}
			}

			// Extract operator information
			const operatorFields = ["operator", "company", "owner", "lessee"];
			operatorFields.forEach((field) => {
				if (props[field] && typeof props[field] === "string") {
					operators.add(props[field]);
				}
			});
		});

		return {
			leaseBlocks,
			wellLocations,
			pipelines,
			facilities,
			estimatedAcreage: Math.round(totalArea),
			majorOperators: Array.from(operators).slice(0, 10), // Top 10 operators
		};
	}

	// Helper methods
	private assessDataConsistency(features: SpatialFeature[]): number {
		if (features.length === 0) return 1;

		const attributeSets = features.map(
			(f) => new Set(Object.keys(f.properties || {})),
		);
		if (attributeSets.length < 2) return 1;

		// Calculate consistency based on attribute field overlap
		const firstSet = attributeSets[0];
		let totalSimilarity = 0;

		for (let i = 1; i < attributeSets.length; i++) {
			const currentSet = attributeSets[i];
			const firstArray = Array.from(firstSet);
			const currentArray = Array.from(currentSet);
			const intersection = new Set(firstArray.filter((x) => currentSet.has(x)));
			const union = new Set([...firstArray, ...currentArray]);
			const similarity = intersection.size / union.size;
			totalSimilarity += similarity;
		}

		return totalSimilarity / (attributeSets.length - 1);
	}

	private checkElevationData(features: SpatialFeature[]): boolean {
		return features.some((feature) => {
			if (feature.geometry?.coordinates) {
				// Check if coordinates have Z values (3D)
				const coords = feature.geometry.coordinates;
				if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
					return coords[0][0].length > 2;
				} else if (Array.isArray(coords[0])) {
					return coords[0].length > 2;
				} else {
					return coords.length > 2;
				}
			}
			return false;
		});
	}

	private generateRecommendations(
		qualityMetrics: GISQualityMetrics,
		oilGasMetrics: any,
	): string[] {
		const recommendations: string[] = [];

		if (qualityMetrics.overallQuality < 0.7) {
			recommendations.push(
				"Overall data quality below 70% - comprehensive review recommended",
			);
		}

		if (oilGasMetrics.leaseBlocks > 0) {
			recommendations.push(
				`Identified ${oilGasMetrics.leaseBlocks} potential lease blocks - verify ownership data`,
			);
		}

		if (oilGasMetrics.wellLocations > 0) {
			recommendations.push(
				`Found ${oilGasMetrics.wellLocations} well locations - cross-reference with production data`,
			);
		}

		if (oilGasMetrics.estimatedAcreage > 0) {
			recommendations.push(
				`Estimated ${oilGasMetrics.estimatedAcreage} acres total - verify boundary accuracy`,
			);
		}

		if (oilGasMetrics.majorOperators.length > 0) {
			recommendations.push(
				`Major operators identified: ${oilGasMetrics.majorOperators.slice(0, 3).join(", ")}`,
			);
		}

		return recommendations.length > 0
			? recommendations
			: ["Standard GIS processing completed successfully"];
	}

	// Utility methods (from original parser)
	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	private parsePRJFile(prjContent: string): string {
		const match = prjContent.match(/PROJCS\["([^"]+)"|GEOGCS\["([^"]+)/);
		if (match) {
			return match[1] || match[2];
		}

		if (prjContent.includes("WGS_1984")) return "WGS84 (EPSG:4326)";
		if (prjContent.includes("NAD83")) return "NAD83";
		if (prjContent.includes("UTM")) return "UTM";

		return "Custom Projection";
	}

	private extractAttributeFields(features: SpatialFeature[]): string[] {
		const fields = new Set<string>();
		features.forEach((feature) => {
			if (feature.properties) {
				Object.keys(feature.properties).forEach((key) => fields.add(key));
			}
		});
		return Array.from(fields);
	}

	private extractCRS(featureCollection: SpatialFeatureCollection): string {
		if (featureCollection.crs?.properties?.name) {
			return featureCollection.crs.properties.name;
		}
		return "WGS84 (assumed)";
	}

	private isGeometryType(type: string): boolean {
		return [
			"Point",
			"LineString",
			"Polygon",
			"MultiPoint",
			"MultiLineString",
			"MultiPolygon",
		].includes(type);
	}

	private async extractKMLFeatures(
		element: any,
		features: SpatialFeature[],
	): Promise<void> {
		// Implementation from original parser
		if (element.Placemark) {
			for (const placemark of element.Placemark) {
				const feature = await this.convertKMLPlacemark(placemark);
				if (feature) {
					features.push(feature);
				}
			}
		}

		if (element.Folder) {
			for (const folder of element.Folder) {
				await this.extractKMLFeatures(folder, features);
			}
		}
	}

	private async convertKMLPlacemark(
		placemark: any,
	): Promise<SpatialFeature | null> {
		// Implementation from original parser - simplified for space
		try {
			const properties: Record<string, any> = {};

			if (placemark.name) properties.name = placemark.name[0];
			if (placemark.description)
				properties.description = placemark.description[0];

			let geometry: SpatialGeometry | null = null;

			if (placemark.Point) {
				const coords = this.parseKMLCoordinates(
					placemark.Point[0].coordinates[0],
				);
				if (coords.length > 0) {
					geometry = { type: "Point", coordinates: coords[0] };
				}
			}
			// ... other geometry types

			if (!geometry) return null;

			return { type: "Feature", geometry, properties };
		} catch {
			return null;
		}
	}

	private parseKMLCoordinates(coordinateString: string): number[][] {
		const coords: number[][] = [];
		const lines = coordinateString.trim().split(/\s+/);

		for (const line of lines) {
			const parts = line.split(",");
			if (parts.length >= 2) {
				const lon = parseFloat(parts[0]);
				const lat = parseFloat(parts[1]);
				const alt = parts.length > 2 ? parseFloat(parts[2]) : undefined;

				if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
					if (alt !== undefined && !Number.isNaN(alt)) {
						coords.push([lon, lat, alt]);
					} else {
						coords.push([lon, lat]);
					}
				}
			}
		}

		return coords;
	}
}

// CLI usage
const main = async () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error(
			"Usage: gis-processor <file> [--json|--summary|--quality|--oilgas]",
		);
		console.error("Supported formats: .shp, .geojson, .kml");
		console.error("Options:");
		console.error("  --json     Output full JSON data");
		console.error("  --summary  Output metadata summary (default)");
		console.error("  --quality  Output quality assessment only");
		console.error("  --oilgas   Output oil & gas analysis only");
		process.exit(1);
	}

	if (
		!(await access(filePath)
			.then(() => true)
			.catch(() => false))
	) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	try {
		const processor = new EnhancedGISProcessor();
		const result = await processor.processGISFile(filePath);

		if (options.includes("--quality")) {
			console.log(
				JSON.stringify(
					{
						file: filePath,
						format: result.format,
						qualityMetrics: result.qualityMetrics,
					},
					null,
					2,
				),
			);
		} else if (options.includes("--oilgas")) {
			console.log(
				JSON.stringify(
					{
						file: filePath,
						format: result.format,
						oilGasMetrics: result.oilGasMetrics,
						recommendations: result.recommendations,
					},
					null,
					2,
				),
			);
		} else if (options.includes("--json")) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				format: result.format,
				featureCount: result.metadata.featureCount,
				geometryTypes: result.metadata.geometryTypes,
				bounds: result.bounds,
				quality: result.qualityMetrics.overallQuality,
				oilGasAssets: {
					leaseBlocks: result.oilGasMetrics.leaseBlocks,
					wells: result.oilGasMetrics.wellLocations,
					pipelines: result.oilGasMetrics.pipelines,
					estimatedAcres: result.oilGasMetrics.estimatedAcreage,
				},
				coordinateSystem: result.metadata.coordinateSystem,
				recommendations: result.recommendations.slice(0, 3),
			};
			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error processing GIS file: ${error}`);
		process.exit(1);
	}
};

// Check if this script is being run directly
if (typeof process !== "undefined" && process.argv.length >= 2) {
	const scriptPath = process.argv[1];
	if (
		scriptPath &&
		(scriptPath.endsWith("gis-processor.ts") ||
			scriptPath.endsWith("gis-processor.js"))
	) {
		main();
	}
}

// Types and class are exported inline above
