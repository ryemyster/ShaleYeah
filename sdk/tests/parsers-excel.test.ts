/**
 * Excel Parser Unit Tests
 * Tests ExcelParser error paths and CSV parse output shape — no API key required.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ExcelParser } from "../src/parsers/excel-parser.js";

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

console.log("\n=== Excel Parser ===\n");

await test("instantiates without error", async () => {
	const parser = new ExcelParser();
	assert(parser instanceof ExcelParser, "ExcelParser instantiates");
});

await test("rejects on missing xlsx file", async () => {
	const parser = new ExcelParser();
	let threw = false;
	try {
		await parser.parseExcelFile("/nonexistent/path/file.xlsx");
	} catch {
		threw = true;
	}
	assert(threw, "parseExcelFile rejects on nonexistent file");
});

await test("parses minimal CSV file", async () => {
	const csvContent = [
		"Date,Oil Price,Gas Price,Units",
		"2024-01,75.50,2.80,bbl/mmbtu",
		"2024-02,78.10,3.10,bbl/mmbtu",
		"2024-03,72.30,2.65,bbl/mmbtu",
	].join("\n");

	const tmpFile = path.join(os.tmpdir(), `shaleyeah-test-${crypto.randomUUID()}.csv`);
	await fs.writeFile(tmpFile, csvContent, "utf-8");

	try {
		const parser = new ExcelParser();
		const result = await parser.parseCSVFile(tmpFile);

		assert(result !== null && typeof result === "object", "parse returns an object");
		assert("data" in result, "result has data field");
		assert("rowCount" in result, "result has rowCount field");
		assert(result.rowCount > 0, "rowCount > 0");
		assert(Array.isArray(result.data), "data is an array");
	} finally {
		await fs.unlink(tmpFile).catch(() => {});
	}
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
