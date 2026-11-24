#!/usr/bin/env tsx
import { createHash } from "node:crypto";
/**
 * Enhanced LAS file parser for SHALE YEAH geological analysis
 * Extracts curve data, metadata, and validates depth intervals
 */
import fs from "node:fs";

interface LASCurve {
	name: string;
	unit: string;
	description: string;
	data: number[];
}

interface LASData {
	version: string;
	well_name: string;
	depth_unit: string;
	depth_start: number;
	depth_stop: number;
	depth_step: number;
	null_value: number;
	curves: LASCurve[];
	depth_data: number[];
	rows: number;
	company?: string;
	field?: string;
	location?: string;
	parameters: Record<string, LASHeaderItem>;
	content_hash: string;
}

interface LASHeaderItem {
	unit: string;
	value: string;
	description: string;
}

type LASInputCode =
	| "invalid_header"
	| "unsupported_version"
	| "unsupported_layout"
	| "invalid_units"
	| "duplicate_curve"
	| "invalid_data"
	| "invalid_depth"
	| "invalid_assumptions";

/** Safe to return over MCP: neither the path nor header/data contents enter diagnostics. */
export class LASInputError extends Error {
	constructor(
		readonly code: LASInputCode,
		readonly line?: number,
	) {
		super(`LAS input: ${code}${line === undefined ? "" : ` at line ${line}`}`);
		this.name = "LASInputError";
	}
}

export function readLASNumber(value: string): number | null {
	if (!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value)) return null;
	const result = Number(value);
	return Number.isFinite(result) ? result : null;
}

function numeric(value: string, code: LASInputCode, line?: number): number {
	const result = readLASNumber(value);
	if (result === null) throw new LASInputError(code, line);
	return result;
}

function header(line: string, number: number): { name: string } & LASHeaderItem {
	const colon = line.indexOf(":");
	const before = colon < 0 ? line : line.slice(0, colon);
	const dot = before.indexOf(".");
	if (dot < 1) throw new LASInputError("invalid_header", number);
	const name = before.slice(0, dot).trim().toUpperCase();
	if (!name || /\s/.test(name)) throw new LASInputError("invalid_header", number);
	const after = before.slice(dot + 1);
	const space = after.search(/\s/);
	const unit = space < 0 ? after : after.slice(0, space);
	const value = space < 0 ? "" : after.slice(space).trim();
	return { name, unit, value, description: colon < 0 ? "" : line.slice(colon + 1).trim() };
}

function close(a: number, b: number): boolean {
	return Math.abs(a - b) <= 32 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Deliberately bounded LAS 2.0 subset: unwrapped, unique curves, numeric depth index. */
function parseLASFile(filePath: string): LASData {
	const sections = new Set<string>();
	const headers: Record<string, Record<string, LASHeaderItem>> = { V: {}, W: {}, P: {} };
	const curves: LASCurve[] = [];
	const rows: Array<{ values: string[]; line: number }> = [];
	let section = "";
	const bytes = fs.readFileSync(filePath);
	let content: string;
	try {
		content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new LASInputError("invalid_data");
	}
	if (content.includes("\0")) throw new LASInputError("invalid_data");
	const lines = content.split(/\r?\n/);
	for (const [index, raw] of lines.entries()) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		if (line.startsWith("~")) {
			section = line.slice(1, 2).toUpperCase();
			if (sections.has(section)) throw new LASInputError("invalid_header", index + 1);
			sections.add(section);
			continue;
		}
		if (section === "A") rows.push({ values: line.split(/\s+/), line: index + 1 });
		else if (section === "C") {
			const item = header(line, index + 1);
			if (curves.some((curve) => curve.name === item.name)) throw new LASInputError("duplicate_curve", index + 1);
			curves.push({ name: item.name, unit: item.unit, description: item.description, data: [] });
		} else if (headers[section]) {
			const { name, ...item } = header(line, index + 1);
			if (Object.hasOwn(headers[section], name)) throw new LASInputError("invalid_header", index + 1);
			headers[section][name] = item;
		} else if (section !== "O") throw new LASInputError("invalid_header", index + 1);
	}
	const required = (section: string, name: string): LASHeaderItem => {
		const item = headers[section][name];
		if (!item?.value) throw new LASInputError("invalid_header");
		return item;
	};
	if (!["V", "W", "C", "A"].every((s) => sections.has(s)) || !curves.length) throw new LASInputError("invalid_header");
	const version = required("V", "VERS").value;
	if (numeric(version, "invalid_header") !== 2) throw new LASInputError("unsupported_version");
	if (required("V", "WRAP").value.toUpperCase() !== "NO") throw new LASInputError("unsupported_layout");
	const start = required("W", "STRT"),
		stop = required("W", "STOP"),
		step = required("W", "STEP");
	const unit = curves[0].unit.toUpperCase();
	if (!["M", "F", "FT"].includes(unit) || [start, stop, step].some((item) => item.unit.toUpperCase() !== unit))
		throw new LASInputError("invalid_units");
	const depthStart = numeric(start.value, "invalid_header");
	const depthStop = numeric(stop.value, "invalid_header");
	const depthStep = numeric(step.value, "invalid_header");
	const nullValue = numeric(required("W", "NULL").value, "invalid_header");
	const depthData: number[] = [];
	if (!rows.length) throw new LASInputError("invalid_data");
	for (const row of rows) {
		if (row.values.length !== curves.length) throw new LASInputError("invalid_data", row.line);
		const values = row.values.map((v) => numeric(v, "invalid_data", row.line));
		const depth = values[0];
		const previous = depthData.at(-1);
		if (depth === nullValue) throw new LASInputError("invalid_depth", row.line);
		if (previous !== undefined) {
			const difference = depth - previous;
			if (
				difference === 0 ||
				Math.sign(difference) !== Math.sign(depthStop - depthStart) ||
				(depthStep !== 0 && !close(difference, depthStep))
			)
				throw new LASInputError("invalid_depth", row.line);
		}
		depthData.push(depth);
		values.forEach((v, index) => curves[index].data.push(v === nullValue ? NaN : v));
	}
	if (!close(depthData[0], depthStart) || !close(depthData[depthData.length - 1], depthStop))
		throw new LASInputError("invalid_depth");
	return {
		version,
		well_name: headers.W.WELL?.value ?? "",
		depth_unit: curves[0].unit,
		depth_start: depthStart,
		depth_stop: depthStop,
		depth_step: depthStep,
		null_value: nullValue,
		curves,
		depth_data: depthData,
		rows: rows.length,
		parameters: headers.P,
		content_hash: createHash("sha256").update(bytes).digest("hex"),
		company: headers.W.COMP?.value,
		field: headers.W.FLD?.value,
		location: headers.W.LOC?.value,
	};
}

// CLI usage
const main = () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error("Usage: las-parse <file.las> [--json|--summary]");
		console.error("Options:");
		console.error("  --json     Output full JSON data including curve arrays");
		console.error("  --summary  Output metadata summary only (default)");
		process.exit(1);
	}

	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	try {
		const lasData = parseLASFile(filePath);

		if (options.includes("--json")) {
			// Full JSON output with curve data
			console.log(JSON.stringify(lasData, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				version: lasData.version,
				well_name: lasData.well_name,
				depth_unit: lasData.depth_unit,
				depth_range: `${lasData.depth_start}-${lasData.depth_stop}${lasData.depth_unit}`,
				depth_step: lasData.depth_step,
				rows: lasData.rows,
				curves: lasData.curves.map((c) => ({
					name: c.name,
					unit: c.unit,
					description: c.description,
					valid_points: c.data.filter((v) => !Number.isNaN(v)).length,
					null_points: c.data.filter((v) => Number.isNaN(v)).length,
				})),
				company: lasData.company,
				field: lasData.field,
				location: lasData.location,
			};

			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error parsing LAS file: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { type LASCurve, type LASData, parseLASFile };
