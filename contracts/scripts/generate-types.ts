import { readFileSync, writeFileSync } from "node:fs";
import { compile } from "json-schema-to-typescript";

const schema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/employee-0.1.0.schema.json", import.meta.url), "utf8"),
);
const sourceSchema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/data-connectors-0.1.0.schema.json", import.meta.url), "utf8"),
);
// Resolve shared definitions mechanically for generation; the two published profiles retain their own roots/IDs.
const sourceDefs = JSON.parse(JSON.stringify(sourceSchema.$defs).split(`${schema.$id}#/$defs/`).join("#/$defs/"));
const jsonSourceSchema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/data-connectors-0.2.0.schema.json", import.meta.url), "utf8"),
);
const jsonSourceDefs = JSON.parse(
	JSON.stringify(jsonSourceSchema.$defs)
		.split(`${schema.$id}#/$defs/`)
		.join("#/$defs/")
		.split(`${sourceSchema.$id}#/$defs/`)
		.join("#/$defs/"),
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
		properties: { record: { $ref: "#/$defs/EmployeeContract" }, sourceRecord: { $ref: "#/$defs/SourceContract" } },
		required: ["record"],
		$defs: {
			...schema.$defs,
			...sourceDefs,
			...jsonSourceDefs,
			EmployeeContract: { oneOf },
			SourceContract: { oneOf: [...sourceSchema.oneOf, { $ref: "#/$defs/JsonSourceArtifact" }] },
		},
	},
	"ContractBindings",
	{
		bannerComment:
			"/* Generated from employee 0.1.0 and data-connectors 0.1.0/0.2.0 schemas. Run pnpm generate; do not edit. */",
		unreachableDefinitions: true,
		ignoreMinAndMaxItems: true,
		style: { useTabs: true, printWidth: 120 },
	},
);
if (process.argv.includes("--check")) {
	if (readFileSync(target, "utf8") !== output) throw new Error("Generated types are stale. Run pnpm generate.");
} else writeFileSync(target, output);

const eventSchema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/employee-events-0.1.0.schema.json", import.meta.url), "utf8"),
);
const eventTarget = new URL("../src/event-generated.ts", import.meta.url);
const eventOutput = await compile(eventSchema, "EmployeeEvent", {
	bannerComment: "/* Generated from employee-events 0.1.0. Run pnpm generate; do not edit. */",
	unreachableDefinitions: true,
	ignoreMinAndMaxItems: true,
	style: { useTabs: true, printWidth: 120 },
});
if (process.argv.includes("--check")) {
	if (readFileSync(eventTarget, "utf8") !== eventOutput)
		throw new Error("Generated event types are stale. Run pnpm generate.");
} else writeFileSync(eventTarget, eventOutput);
