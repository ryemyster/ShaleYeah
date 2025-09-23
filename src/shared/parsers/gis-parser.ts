/**
 * GIS Format Parser
 * Handles Shapefile, GeoJSON, and KML spatial data formats
 */

import fs from "node:fs/promises";
import * as turf from "@turf/turf";
import type { Feature as GeoJSONFeature } from "geojson";
import shapefile from "shapefile";
import { parseString as parseXML } from "xml2js";

export interface Geometry {
	type: string;
	coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface Feature {
	id?: string | number;
	type: "Feature";
	geometry: Geometry;
	properties: Record<string, any>;
}

export interface FeatureCollection {
	type: "FeatureCollection";
	crs?: {
		type: string;
		properties: Record<string, any>;
	};
	features: Feature[];
}

export interface SpatialBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface GISData {
	type: "shapefile" | "geojson" | "kml";
	featureCollection: FeatureCollection;
	bounds: SpatialBounds;
	metadata: {
		featureCount: number;
		geometryTypes: string[];
		attributeFields: string[];
		coordinateSystem: string;
		fileSize: number;
		parseTime: number;
		quality: {
			hasValidGeometry: boolean;
			hasAttributes: boolean;
			spatialIndex: boolean;
			coordinateSystemDefined: boolean;
		};
	};
}

export class GISParser {
	/**
	 * Parse shapefile (.shp + supporting files)
	 */
	async parseShapefile(shpPath: string): Promise<GISData> {
		const startTime = Date.now();

		try {
			// Check for required supporting files
			const basePath = shpPath.replace(/\.shp$/i, "");
			const dbfPath = `${basePath}.dbf`;
			const _shxPath = `${basePath}.shx`;
			const prjPath = `${basePath}.prj`;

			// Verify required files exist
			const [shpExists, dbfExists] = await Promise.all([
				this.fileExists(shpPath),
				this.fileExists(dbfPath),
			]);

			if (!shpExists || !dbfExists) {
				throw new Error(
					"Missing required shapefile components (.shp and .dbf)",
				);
			}

			// Parse shapefile
			const features: Feature[] = [];
			const geometryTypes = new Set<string>();

			await shapefile.read(shpPath, dbfPath).then((collection) => {
				if (collection.type === "FeatureCollection") {
					features.push(...collection.features);
					collection.features.forEach((feature) => {
						if (feature.geometry) {
							geometryTypes.add(feature.geometry.type);
						}
					});
				}
			});

			// Read coordinate system if available
			let coordinateSystem = "Unknown";
			if (await this.fileExists(prjPath)) {
				try {
					coordinateSystem = await fs.readFile(prjPath, "utf-8");
					coordinateSystem = this.parsePRJFile(coordinateSystem);
				} catch (_error) {
					// Ignore PRJ file errors
				}
			}

			const featureCollection: FeatureCollection = {
				type: "FeatureCollection",
				features,
			};

			const bounds = this.calculateBounds(features);
			const attributeFields = this.extractAttributeFields(features);
			const stats = await fs.stat(shpPath);

			return {
				type: "shapefile",
				featureCollection,
				bounds,
				metadata: {
					featureCount: features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem,
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					quality: this.assessGISQuality(features, coordinateSystem),
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse shapefile: ${error}`);
		}
	}

	/**
	 * Parse GeoJSON file
	 */
	async parseGeoJSON(filePath: string): Promise<GISData> {
		const startTime = Date.now();

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const data = JSON.parse(content);

			let featureCollection: FeatureCollection;

			if (data.type === "FeatureCollection") {
				featureCollection = data as FeatureCollection;
			} else if (data.type === "Feature") {
				featureCollection = {
					type: "FeatureCollection",
					features: [data as Feature],
				};
			} else if (
				data.type &&
				[
					"Point",
					"LineString",
					"Polygon",
					"MultiPoint",
					"MultiLineString",
					"MultiPolygon",
				].includes(data.type)
			) {
				// Single geometry
				featureCollection = {
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							geometry: data as Geometry,
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

			const bounds = this.calculateBounds(featureCollection.features);
			const attributeFields = this.extractAttributeFields(
				featureCollection.features,
			);
			const coordinateSystem = this.extractCRS(featureCollection);
			const stats = await fs.stat(filePath);

			return {
				type: "geojson",
				featureCollection,
				bounds,
				metadata: {
					featureCount: featureCollection.features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem,
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					quality: this.assessGISQuality(
						featureCollection.features,
						coordinateSystem,
					),
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse GeoJSON: ${error}`);
		}
	}

	/**
	 * Parse KML file
	 */
	async parseKML(filePath: string): Promise<GISData> {
		const startTime = Date.now();

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const features: Feature[] = [];

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

			const featureCollection: FeatureCollection = {
				type: "FeatureCollection",
				features,
			};

			const bounds = this.calculateBounds(features);
			const attributeFields = this.extractAttributeFields(features);
			const stats = await fs.stat(filePath);

			return {
				type: "kml",
				featureCollection,
				bounds,
				metadata: {
					featureCount: features.length,
					geometryTypes: Array.from(geometryTypes),
					attributeFields,
					coordinateSystem: "WGS84", // KML uses WGS84 by default
					fileSize: stats.size,
					parseTime: Date.now() - startTime,
					quality: this.assessGISQuality(features, "WGS84"),
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse KML: ${error}`);
		}
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	private parsePRJFile(prjContent: string): string {
		// Extract coordinate system name from PRJ file
		const match = prjContent.match(/PROJCS\["([^"]+)"|GEOGCS\["([^"]+)/);
		if (match) {
			return match[1] || match[2];
		}

		// Check for common EPSG codes
		if (prjContent.includes("WGS_1984")) return "WGS84 (EPSG:4326)";
		if (prjContent.includes("NAD83")) return "NAD83";
		if (prjContent.includes("UTM")) return "UTM";

		return "Custom Projection";
	}

	private calculateBounds(features: Feature[]): SpatialBounds {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		features.forEach((feature) => {
			if (feature.geometry) {
				const bbox = turf.bbox(feature as GeoJSONFeature);
				minX = Math.min(minX, bbox[0]);
				minY = Math.min(minY, bbox[1]);
				maxX = Math.max(maxX, bbox[2]);
				maxY = Math.max(maxY, bbox[3]);
			}
		});

		return { minX, minY, maxX, maxY };
	}

	private extractAttributeFields(features: Feature[]): string[] {
		const fields = new Set<string>();

		features.forEach((feature) => {
			if (feature.properties) {
				Object.keys(feature.properties).forEach((key) => fields.add(key));
			}
		});

		return Array.from(fields);
	}

	private extractCRS(featureCollection: FeatureCollection): string {
		if (featureCollection.crs) {
			if (featureCollection.crs.properties.name) {
				return featureCollection.crs.properties.name;
			}
		}
		return "WGS84 (assumed)";
	}

	private async extractKMLFeatures(
		element: any,
		features: Feature[],
	): Promise<void> {
		// Extract placemarks
		if (element.Placemark) {
			for (const placemark of element.Placemark) {
				const feature = await this.convertKMLPlacemark(placemark);
				if (feature) {
					features.push(feature);
				}
			}
		}

		// Recursively process folders
		if (element.Folder) {
			for (const folder of element.Folder) {
				await this.extractKMLFeatures(folder, features);
			}
		}
	}

	private async convertKMLPlacemark(placemark: any): Promise<Feature | null> {
		try {
			const properties: Record<string, any> = {};

			// Extract name and description
			if (placemark.name) {
				properties.name = placemark.name[0];
			}
			if (placemark.description) {
				properties.description = placemark.description[0];
			}

			// Extract extended data
			if (placemark.ExtendedData) {
				// Process extended data if present
			}

			// Extract geometry
			let geometry: Geometry | null = null;

			if (placemark.Point) {
				const coords = this.parseKMLCoordinates(
					placemark.Point[0].coordinates[0],
				);
				if (coords.length > 0) {
					geometry = {
						type: "Point",
						coordinates: coords[0],
					};
				}
			} else if (placemark.LineString) {
				const coords = this.parseKMLCoordinates(
					placemark.LineString[0].coordinates[0],
				);
				if (coords.length > 1) {
					geometry = {
						type: "LineString",
						coordinates: coords,
					};
				}
			} else if (placemark.Polygon) {
				const outerCoords = this.parseKMLCoordinates(
					placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0],
				);
				if (outerCoords.length > 3) {
					geometry = {
						type: "Polygon",
						coordinates: [outerCoords],
					};
				}
			}

			if (!geometry) return null;

			return {
				type: "Feature",
				geometry,
				properties,
			};
		} catch (_error) {
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

	private assessGISQuality(
		features: Feature[],
		coordinateSystem: string,
	): {
		hasValidGeometry: boolean;
		hasAttributes: boolean;
		spatialIndex: boolean;
		coordinateSystemDefined: boolean;
	} {
		const hasValidGeometry = features.every(
			(feature) => feature.geometry?.type && feature.geometry.coordinates,
		);

		const hasAttributes = features.some(
			(feature) =>
				feature.properties && Object.keys(feature.properties).length > 0,
		);

		const coordinateSystemDefined = coordinateSystem !== "Unknown";

		return {
			hasValidGeometry,
			hasAttributes,
			spatialIndex: false, // Would require spatial indexing implementation
			coordinateSystemDefined,
		};
	}

	/**
	 * Convert between coordinate systems (basic implementation)
	 */
	transformCoordinates(
		feature: Feature,
		_fromCRS: string,
		_toCRS: string,
	): Feature {
		// This would require proj4 integration for full coordinate transformation
		// For now, return the feature unchanged
		return feature;
	}

	/**
	 * Calculate area of polygonal features
	 */
	calculateArea(feature: Feature): number {
		if (
			feature.geometry.type === "Polygon" ||
			feature.geometry.type === "MultiPolygon"
		) {
			return turf.area(feature as GeoJSONFeature);
		}
		return 0;
	}

	/**
	 * Calculate length of linear features
	 */
	calculateLength(feature: Feature): number {
		if (
			feature.geometry.type === "LineString" ||
			feature.geometry.type === "MultiLineString"
		) {
			return turf.length(feature as GeoJSONFeature, { units: "meters" });
		}
		return 0;
	}
}
