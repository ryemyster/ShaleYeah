import type { ConfiguredSource, SourceUnit } from "@shaleyeah/contracts";
import { parse } from "csv-parse/sync";

/** Transport validation only; geological interpretation remains in the specialist package. */
export function inspectContent(
	bytes: Uint8Array,
	source: ConfiguredSource,
): { units: SourceUnit[]; parserRef: { id: string; version: string } } {
	const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	if (text.includes("\0")) throw new Error("Invalid source text");
	if (source.format === "csv") {
		const rows: string[][] = parse(text, { bom: true, skip_empty_lines: true, max_record_size: 1048576 });
		if (
			rows.length < 2 ||
			!rows[0].length ||
			rows[0].some((field) => !field) ||
			new Set(rows[0]).size !== rows[0].length
		)
			throw new Error("Invalid CSV header");
		if (source.units.some((unit) => unit.origin !== "operator-declared" || !rows[0].includes(unit.field)))
			throw new Error("Invalid CSV units");
		return { units: source.units, parserRef: { id: "csv-parse", version: "7.0.3" } };
	}
	let section = "";
	let version = false;
	let unwrapped = false;
	let well = false;
	let rows = 0;
	const units: SourceUnit[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		if (line.startsWith("~")) {
			section = line.slice(1, 2).toUpperCase();
			if (section === "W") well = true;
			continue;
		}
		if (section === "V") {
			if (/^VERS\s*\.\s*2(?:\.0)?(?:\s|:|$)/i.test(line)) version = true;
			if (/^WRAP\s*\.\s*NO(?:\s|:|$)/i.test(line)) unwrapped = true;
		}
		if (section === "C") {
			const dot = line.indexOf(".");
			if (dot <= 0) throw new Error("Invalid LAS curve");
			const field = line.slice(0, dot).trim();
			const unit = line.slice(dot + 1).split(/[\s:]/, 1)[0];
			if (!field || !unit || units.some((item) => item.field === field)) throw new Error("Invalid LAS units");
			units.push({ field, unit, origin: "header" });
		}
		if (section === "A") {
			const fields = line.split(/\s+/);
			if (fields.length === units.length && fields.every((field, index) => field === units[index].field)) continue;
			if (
				fields.length !== units.length ||
				!fields.every(
					(field) => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(field) && Number.isFinite(Number(field)),
				)
			)
				throw new Error("Invalid LAS row");
			rows++;
		}
	}
	if (!version || !unwrapped || !well || !units.length || !rows) throw new Error("Unsupported LAS shape");
	if (
		source.units.some(
			(expected) =>
				!units.some(
					(actual) => actual.field === expected.field && actual.unit === expected.unit && expected.origin === "header",
				),
		)
	)
		throw new Error("LAS units disagree with declaration");
	return { units, parserRef: { id: "las-shape", version: "0.1.0" } };
}
