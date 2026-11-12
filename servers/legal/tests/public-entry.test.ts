import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.js";
import { legalFixture, who } from "./fixtures/legal.js";

test("the public Legal entry exposes the ten configured source-backed tools and no source-less defaults", () => {
	const f = legalFixture();
	const template = api.createLegalTemplate({ service: f.service, localPrincipal: who });
	assert.equal(template.tools.length, 10);
	assert.equal(template.tools.filter((tool) => tool.type === "command").length, 2);
	assert.ok(
		!template.tools.some((tool) =>
			/analyze_legal_framework|review_contract|assess_compliance|approve|decide/.test(tool.name),
		),
	);
	for (const name of [
		"deriveDefaultRegulatoryRisk",
		"deriveRegulatoryAssessment",
		"deriveContractReview",
		"deriveComplianceRequirements",
		"synthesizeLegalAnalysisWithLLM",
	])
		assert.ok(!Object.hasOwn(api, name), "Source-less default algorithms must not remain callable");
});

test("unconfigured Legal tools cannot manufacture analysis or accept model-selected output paths", () => {
	assert.deepEqual(api.createLegalTemplate().tools, []);
	const f = legalFixture();
	const tool = api
		.createLegalTemplate({ service: f.service, localPrincipal: who })
		.tools.find((tool) => tool.name === "draft_legal_memo");
	assert.ok(tool);
	assert.throws(() =>
		tool.inputSchema.parse({
			taskRef: { id: "task.legal", revision: "r1" },
			proposal: f.proposal,
			revision: "r1",
			outputPath: "/tmp/model-selected.json",
		}),
	);
});
