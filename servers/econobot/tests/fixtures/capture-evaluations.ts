/** Capture actual backend results. Frozen numerical answers are never supplied to the solver. */
import fs from "node:fs/promises";
import { fixture, ref, who } from "./scenario.js";

const [inputsPath, outputPath] = process.argv.slice(2);
if (!inputsPath || !outputPath) throw new Error("Expected explicit input and output files");
const labels = JSON.parse(await fs.readFile(inputsPath, "utf8")).references as Record<
	string,
	{
		id: string;
		revision: string;
		cashFlows: number[];
		currency: string;
		periodUnit: "year" | "month";
		discountRate: number;
	}
>;
const results: Record<string, unknown> = {};
for (const [key, input] of Object.entries(labels)) {
	const f = fixture();
	f.current.scenarios = [
		{
			...structuredClone(f.current.scenarios[0]),
			id: input.id,
			revision: input.revision,
			currency: input.currency,
			periodUnit: input.periodUnit,
			discountRate: input.discountRate,
		},
	];
	f.texts.set(
		"cash-flows",
		[
			"scenarioId,scenarioRevision,period,netCashFlow",
			...input.cashFlows.map((value, period) => `${input.id},${input.revision},${period},${value}`),
			"",
		].join("\n"),
	);
	f.texts.set("ownership", `scenarioId,workingInterest,revenueInterest\n${input.id},0.5,0.4\n`);
	f.bind();
	results[key] = {
		...(await f.service.draft(ref, [input.id], "r1", who)),
		task: f.current.task,
	};
}
await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
