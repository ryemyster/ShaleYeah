import { readFileSync, writeFileSync } from "node:fs";
import { compile } from "json-schema-to-typescript";

const schema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/employee-0.1.0.schema.json", import.meta.url), "utf8"),
);
const target = new URL("../src/generated.ts", import.meta.url);
// A mechanical object root makes the generator emit even unreferenced $defs.
const { oneOf, ...base } = schema;
const output = await compile(
	{
		...base,
		title: "ContractBindings",
		type: "object",
		additionalProperties: false,
		properties: { record: { $ref: "#/$defs/EmployeeContract" } },
		required: ["record"],
		$defs: { ...schema.$defs, EmployeeContract: { oneOf } },
	},
	"ContractBindings",
	{
		bannerComment: "/* Generated from employee-0.1.0.schema.json. Run pnpm generate; do not edit. */",
		unreachableDefinitions: true,
		ignoreMinAndMaxItems: true,
		style: { useTabs: true, printWidth: 120 },
	},
);
if (process.argv.includes("--check")) {
	if (readFileSync(target, "utf8") !== output) throw new Error("Generated types are stale. Run pnpm generate.");
} else writeFileSync(target, output);
