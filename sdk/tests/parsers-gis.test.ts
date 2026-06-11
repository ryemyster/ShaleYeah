/**
 * GIS Parser Unit Tests
 * Tests GISParser error paths and parse output shape — no API key required.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GISParser } from "../src/parsers/gis-parser.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
	if (condition) {
		console.log(`  ✅ ${message}`);
		passed++;
	} else {
		console.error(`  ❌ ${message}`);
		failed++;
	}
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
	} catch (err) {
		console.error(`  ❌ ${name} — unexpected throw: ${err}`);
		failed++;
	}
}

console.log("\n=== GIS Parser ===\n");

await test("instantiates without error", async () => {
	const parser = new GISParser();
	assert(parser instanceof GISParser, "GISParser instantiates");
});

await test("rejects on missing GeoJSON file", async () => {
	const parser = new GISParser();
	let threw = false;
	try {
		await parser.parseGeoJSON("/nonexistent/path/file.geojson");
	} catch {
		threw = true;
	}
	assert(threw, "parseGeoJSON rejects on nonexistent file");
});

await test("rejects on missing shapefile", async () => {
	const parser = new GISParser();
	let threw = false;
	try {
		await parser.parseShapefile("/nonexistent/path/file.shp");
	} catch {
		threw = true;
	}
	assert(threw, "parseShapefile rejects on nonexistent file");
});

await test("parses minimal valid GeoJSON file", async () => {
	const geojson = {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [-101.5, 31.2],
				},
				properties: { name: "Test Well", api: "42-XXX-00001" },
			},
		],
	};

	const tmpFile = path.join(os.tmpdir(), `shaleyeah-test-${crypto.randomUUID()}.geojson`);
	await fs.writeFile(tmpFile, JSON.stringify(geojson), "utf-8");

	try {
		const parser = new GISParser();
		const result = await parser.parseGeoJSON(tmpFile);

		assert(result !== null && typeof result === "object", "parse returns an object");
		assert("featureCollection" in result, "result has featureCollection");
		assert("bounds" in result, "result has bounds");
		assert("metadata" in result, "result has metadata");
		assert(Array.isArray(result.featureCollection.features), "featureCollection.features is array");
		assert(result.featureCollection.features.length === 1, "one feature parsed");
		assert(result.metadata.featureCount === 1, "metadata.featureCount matches");
		assert(typeof result.bounds.minX === "number", "bounds.minX is a number");
		assert(typeof result.bounds.maxY === "number", "bounds.maxY is a number");
	} finally {
		await fs.unlink(tmpFile).catch(() => {});
	}
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
