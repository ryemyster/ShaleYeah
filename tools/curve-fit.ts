#!/usr/bin/env tsx
/**
 * Fit a curve with a simple linear or polynomial baseline.
 * usage: curve-fit input.csv target=GR order=2 > out.csv
 */
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const input = args.input || args._ || process.argv[2];
const target = args.target || "GR";
const _order = Number(args.order ?? 2);
// For demo emit a fake curve column to prove plumbing
const csv = fs.readFileSync(input, "utf8").trim().split(/\r?\n/);
const header = csv[0].split(",");
const out = [header.concat([`${target}_fit`]).join(",")];
for (let i = 1; i < csv.length; i++) out.push(`${csv[i]},${10 + i}`);
console.log(out.join("\n"));
