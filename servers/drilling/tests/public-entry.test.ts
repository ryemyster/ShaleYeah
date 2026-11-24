import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.js";
import { drillingFixture, who } from "./fixtures/drilling.js";

test("the public Drilling entry cannot expose unsupported program/cost/risk heuristics or global LLM helpers", () => {
	for (const name of [
		"deriveDefaultDrillingInterpretation",
		"synthesizeDrillingAnalysisWithLLM",
		"deriveWellCostBreakdown",
		"synthesizeWellCostsWithLLM",
		"deriveDrillingProgram",
		"synthesizeDrillingProgramWithLLM",
		"deriveDrillingRiskProfile",
		"synthesizeDrillingRisksWithLLM",
	]) {
		assert.equal(Object.hasOwn(api, name), false, `${name} must not remain a source-less public path`);
	}
});

test("an unconfigured Drilling entry advertises no work tools", () => {
	const create = Reflect.get(api, "createDrillingTemplate");
	assert.equal(typeof create, "function", "A source-bound Drilling template must be explicitly configured");
	assert.deepEqual(create().tools, []);
});

test("the configured public Drilling entry exposes 12 source-backed tools and rejects model-selected file paths", () => {
	const f = drillingFixture(),
		create = Reflect.get(api, "createDrillingTemplate");
	assert.equal(typeof create, "function");
	const template = create({ service: f.service, localPrincipal: who });
	assert.equal(template.tools.length, 12);
	assert.equal(template.tools.filter((tool: { type: string }) => tool.type === "command").length, 2);
	const draft = template.tools.find((tool: { name: string }) => tool.name === "draft_drilling_packet");
	assert.ok(draft);
	assert.throws(() =>
		draft.inputSchema.parse({
			taskRef: { id: "task.drilling", revision: "r1" },
			proposal: f.proposal,
			revision: "r1",
			outputPath: "/tmp/model-chosen",
		}),
	);
});
