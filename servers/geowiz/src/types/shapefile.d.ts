/**
 * Type definitions for shapefile library
 */

declare module "shapefile" {
	export interface ShapefileFeature {
		type: "Feature";
		geometry: {
			type: string;
			coordinates: number[] | number[][] | number[][][] | number[][][][];
		};
		properties: Record<string, any>;
	}

	export interface ShapefileCollection {
		type: "FeatureCollection";
		features: ShapefileFeature[];
	}

	export interface ShapefileReader {
		read(): Promise<{ done: boolean; value: ShapefileFeature }>;
		close(): void;
	}

	export function read(shpPath: string, dbfPath?: string): Promise<ShapefileCollection>;

	export function open(shpPath: string, dbfPath?: string): Promise<ShapefileReader>;

	export default {
		read,
		open,
	};
}
