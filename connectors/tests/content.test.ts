import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfiguredSource } from "@shaleyeah/contracts";
import { inspectContent } from "../src/content.js";

const source = { format: "las", units: [{ field: "DEPT", unit: "FT", origin: "header" }] } as ConfiguredSource;
const las =
	"# controlled transport fixture\n~Version\nVERS. 2.0 : version\nWRAP. NO : wrap\n~Well\nWELL. demo\n~Curve\nDEPT.FT : depth\nGR.GAPI : gamma\n~ASCII\nDEPT GR\n0 12\n1 13\n";
test("LAS validation reports header units, preserves zero and does not reinterpret domain values", () => {
	assert.deepEqual(inspectContent(Buffer.from(las), source), {
		units: [
			{ field: "DEPT", unit: "FT", origin: "header" },
			{ field: "GR", unit: "GAPI", origin: "header" },
		],
		parserRef: { id: "las-shape", version: "0.1.0" },
	});
});
test("unsupported, malformed and unit-conflicting LAS fails before domain processing", () => {
	for (const text of [
		las.replace("2.0", "3.0"),
		las.replace("NO", "YES"),
		las.replace("~Well", "~Other"),
		las.replace("GR.GAPI", "GR"),
		las.replace("GR.GAPI", "DEPT.GAPI"),
		las.replace("GR.GAPI", "GR."),
		las.replace("0 12", "0 bad"),
		las.replace("0 12", "0"),
		las.replace("~ASCII", "~Other"),
		las.replace("DEPT.FT", "DEPT.M"),
		`${las}\0`,
	])
		assert.throws(() => inspectContent(Buffer.from(text), source));
	assert.throws(() => inspectContent(Uint8Array.from([255]), source));
});
test("CSV requires declared field units and valid bounded quoted records without numeric coercion", () => {
	const csv = {
		...source,
		format: "csv",
		units: [{ field: "DEPTH", unit: "FT", origin: "operator-declared" }],
	} as ConfiguredSource;
	assert.equal(inspectContent(Buffer.from('DEPTH,NOTE\n0,"quoted, value"\n'), csv).units[0].unit, "FT");
	for (const text of [
		"DEPTH,NOTE\n",
		"DEPTH,DEPTH\n0,1\n",
		",NOTE\n0,ok\n",
		'DEPTH,NOTE\n0,"unfinished\n',
		"DEPTH,NOTE\n0,ok,extra\n",
		"OTHER,NOTE\n0,ok\n",
	])
		assert.throws(() => inspectContent(Buffer.from(text), csv));
	assert.throws(() => inspectContent(Buffer.from("DEPTH,NOTE\n0,ok\n"), { ...csv, units: source.units }));
});
