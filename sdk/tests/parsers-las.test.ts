/**
 * LAS Parser Unit Tests
 * Tests LASParser error paths and parse output shape — no API key required.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LASParser } from "../src/parsers/las-parser.js";

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

console.log("\n=== LAS Parser ===\n");

await test("instantiates without error", async () => {
	const parser = new LASParser();
	assert(parser instanceof LASParser, "LASParser instantiates");
});

await test("rejects on missing file", async () => {
	const parser = new LASParser();
	let threw = false;
	try {
		await parser.parseLASFile("/nonexistent/path/file.las");
	} catch {
		threw = true;
	}
	assert(threw, "parseLASFile rejects on nonexistent file");
});

await test("parses minimal valid LAS 2.0 file", async () => {
	// Minimal LAS 2.0 file with one curve and one data row
	const lasContent = [
		"~VERSION ---",
		"VERS.                 2.0 : LAS version",
		"WRAP.                  NO : One line per depth",
		"~WELL ---",
		"WELL.             TEST_01 : Well name",
		"~CURVE ---",
		"DEPT .M                   : Depth",
		"GR   .GAPI                : Gamma Ray",
		"~A",
		"1000.0 45.0",
	].join("\n");

	const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.las`);
	await fs.writeFile(tmpFile, lasContent, "utf-8");

	try {
		const parser = new LASParser();
		const result = await parser.parseLASFile(tmpFile);

		assert(result !== null && typeof result === "object", "parse returns an object");
		assert("header" in result, "result has header field");
		assert("curves" in result, "result has curves field");
		assert("data" in result, "result has data field");
		assert("metadata" in result, "result has metadata field");
		assert(Array.isArray(result.curves), "curves is an array");
		assert(result.curves.length >= 1, "at least one curve parsed");
		assert(result.metadata.curveCount >= 1, "metadata.curveCount >= 1");
	} finally {
		await fs.unlink(tmpFile).catch(() => {});
	}
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
