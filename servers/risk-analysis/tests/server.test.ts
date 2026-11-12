import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.js";
import { riskFixture, who } from "./fixtures/risk.js";

test("the public entry exposes only configured source-bound employee tools", () => {
	const f = riskFixture();
	const template = api.createRiskAnalysisTemplate({ service: f.service, localPrincipal: who });
	assert.equal(template.tools.length, 9);
	assert.equal(template.tools.filter((tool) => tool.type === "command").length, 2);
	assert.ok(
		!template.tools.some((tool) => /assess_investment_risk|monte_carlo_simulation|approve|decide/.test(tool.name)),
	);
	for (const name of [
		"assessTechnicalRisk",
		"assessRegulatoryRisk",
		"assessEnvironmentalRisk",
		"assessOperationalRisk",
	])
		assert.ok(!Object.hasOwn(api, name), "Unsupported category defaults must not remain callable");
});

test("unconfigured tools cannot manufacture analysis or accept arbitrary output paths", () => {
	assert.deepEqual(api.createRiskAnalysisTemplate().tools, []);
	const f = riskFixture();
	const tool = api
		.createRiskAnalysisTemplate({ service: f.service, localPrincipal: who })
		.tools.find((tool) => tool.name === "calculate_risk");
	assert.ok(tool);
	assert.throws(() =>
		tool.inputSchema.parse({
			taskRef: { id: "task.risk", revision: "r1" },
			modelRef: { id: "joint.fixture", revision: "r1" },
			outputPath: "/tmp/model-selected.json",
		}),
	);
});
