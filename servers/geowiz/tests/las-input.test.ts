import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseLASFile, readLASNumber } from "../src/tools/las-parse.js";

function fixture(overrides: { unit?: string; start?: number; stop?: number; step?: number; rows?: string[] } = {}) {
	const {
		unit = "FT",
		start = 1000,
		stop = 1001,
		step = 0.5,
		rows = ["1000 80 0.1 2.5", "1000.5 -999.25 0 2.65", "1001 120 -999.25 2.4"],
	} = overrides;
	return `~Version\nVERS. 2.0 : version\nWRAP. NO : layout\n~Well\nSTRT.${unit} ${start} : start\nSTOP.${unit} ${stop} : stop\nSTEP.${unit} ${step} : step\nNULL. -999.25 : null\nWELL. CONTROL-1 : well\n~Curve\nDEPT.${unit} : depth\nGR.GAPI : gamma ray\nNPHI.V/V : neutron response\nRHOB.G/C3 : density\n~A\n${rows.join("\n")}\n`;
}

function parse(text: string) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "geowiz-las-input-"));
	const file = path.join(directory, "private-input.las");
	try {
		fs.writeFileSync(file, text);
		return parseLASFile(file);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

test("known input preserves units, depth, exact nulls and real zero values", () => {
	const result = parse(fixture());
	assert.equal(result.version, "2.0");
	assert.equal(result.well_name, "CONTROL-1");
	assert.equal(result.depth_unit.toUpperCase(), "FT");
	assert.deepEqual(result.depth_data, [1000, 1000.5, 1001]);
	assert.equal(result.rows, 3);
	assert.equal(result.curves[2].data[1], 0);
	assert.ok(Number.isNaN(result.curves[1].data[1]));
});

test("a value near the null marker is still an observation", () => {
	const result = parse(fixture({ rows: ["1000 -999.249 0.1 2.5", "1000.5 0 0 2.65", "1001 120 -999.25 2.4"] }));
	assert.equal(result.curves[1].data[0], -999.249);
});

test("CWLS spaced mnemonic/unit headers parse without guessed depth metadata", () => {
	const result = parse(
		fixture().replace("STRT.FT", "STRT .FT").replace("STOP.FT", "STOP .FT").replace("STEP.FT", "STEP .FT"),
	);
	assert.equal(result.depth_start, 1000);
	assert.equal(result.depth_stop, 1001);
	assert.equal(result.depth_step, 0.5);
});

test("descending metre index preserves its signed step and unit", () => {
	const result = parse(
		fixture({
			unit: "M",
			start: 1001,
			stop: 1000,
			step: -0.5,
			rows: ["1001 80 0.1 2.5", "1000.5 -999.25 0 2.65", "1000 120 -999.25 2.4"],
		}),
	);
	assert.equal(result.depth_unit.toUpperCase(), "M");
	assert.deepEqual(result.depth_data, [1001, 1000.5, 1000]);
	assert.equal(result.depth_step, -0.5);
});

for (const [name, alter, code] of [
	["missing version", (text: string) => text.replace("VERS. 2.0 : version\n", ""), "invalid_header"],
	["unsupported version", (text: string) => text.replace("VERS. 2.0", "VERS. 3.0"), "unsupported_version"],
	["wrapped input", (text: string) => text.replace("WRAP. NO", "WRAP. YES"), "unsupported_layout"],
	["missing declared null", (text: string) => text.replace("NULL. -999.25 : null\n", ""), "invalid_header"],
	["missing index unit", (text: string) => text.replace("DEPT.FT", "DEPT."), "invalid_units"],
	["conflicting units", (text: string) => text.replace("STRT.FT", "STRT.M"), "invalid_units"],
	["truncated row", (text: string) => text.replace("1000.5 -999.25 0 2.65", "1000.5 -999.25"), "invalid_data"],
	["non-numeric observation", (text: string) => text.replace("1000.5 -999.25", "1000.5 bad-number"), "invalid_data"],
	["numeric prefix with text", (text: string) => text.replace("1000.5 -999.25", "1000.5 12oops"), "invalid_data"],
	["infinite observation", (text: string) => text.replace("1000.5 -999.25", "1000.5 Infinity"), "invalid_data"],
	["null depth", (text: string) => text.replace("1000.5 -999.25", "-999.25 -999.25"), "invalid_depth"],
	["nonmonotonic depth", (text: string) => text.replace("1000.5 -999.25", "999.5 -999.25"), "invalid_depth"],
	["contradictory declared stop", (text: string) => text.replace("STOP.FT 1001", "STOP.FT 2000"), "invalid_depth"],
	["duplicate curve", (text: string) => text.replace("NPHI.V/V", "GR.GAPI"), "duplicate_curve"],
] as const) {
	test(`${name} fails with a typed value-free diagnostic`, () => {
		assert.throws(() => parse(alter(fixture())), { code });
	});
}

test("empty input is not zero-depth measured data", () => {
	assert.throws(() => parse(""), { code: "invalid_header" });
});

test("irregular sampling requires the explicitly declared zero step", () => {
	const rows = ["1000 80 0.1 2.5", "1000.25 90 0 2.65", "1001 120 -999.25 2.4"];
	assert.deepEqual(parse(fixture({ step: 0, rows })).depth_data, [1000, 1000.25, 1001]);
	assert.throws(() => parse(fixture({ rows })), { code: "invalid_depth" });
});

test("matrix and fluid header parameters retain their declared values and units", () => {
	const result = parse(
		fixture().replace("~A", "~Parameter\nMDEN.G/C3 2.68 : supplied matrix\nFDEN.G/C3 1.1 : supplied fluid\n~A"),
	);
	assert.deepEqual(result.parameters.MDEN, { unit: "G/C3", value: "2.68", description: "supplied matrix" });
	assert.equal(result.parameters.FDEN.value, "1.1");
});

test("diagnostics expose locations and categories without private input values or paths", () => {
	assert.throws(
		() => parse(fixture().replace("1000.5 -999.25", "1000.5 PRIVATE-NONNUMERIC")),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			assert.match(error.message, /invalid_data.*line/i);
			assert.ok(!error.message.includes("PRIVATE-NONNUMERIC"));
			assert.ok(!error.message.includes("private-input"));
			return true;
		},
	);
});

test("invalid UTF-8 cannot become replacement characters in source observations", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "geowiz-invalid-encoding-"));
	try {
		const file = path.join(directory, "input.las");
		fs.writeFileSync(file, Buffer.concat([Buffer.from(`${fixture()}~Other\n`), Buffer.from([0xff])]));
		assert.throws(() => parseLASFile(file), { code: "invalid_data" });
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

test("decimal scalar parsing preserves zero and rejects JavaScript-only numeric syntax", () => {
	assert.equal(readLASNumber("0"), 0);
	assert.ok(Object.is(readLASNumber("-0.0"), -0));
	assert.equal(readLASNumber("1.2e3"), 1200);
	for (const value of ["", "0x10", "NaN", "Infinity", "1e999", "12oops"]) assert.equal(readLASNumber(value), null);
});
