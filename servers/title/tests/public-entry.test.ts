import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.js";
import { titleFixture, who } from "./fixtures/title.js";

test("the public Title entry cannot expose source-less clear-title or county/default ownership helpers", () => {
	for (const name of [
		"deriveDefaultTitleFindings",
		"deriveOwnershipBreakdown",
		"deriveChainOfTitle",
		"deriveBurdenAssessment",
		"deriveLeaseAnalysis",
		"synthesizeOwnershipWithLLM",
	]) {
		assert.equal(Object.hasOwn(api, name), false, `${name} must not remain a source-less public path`);
	}
});

test("an unconfigured Title entry advertises no work tools", () => {
	const create = Reflect.get(api, "createTitleTemplate");
	assert.equal(typeof create, "function", "A source-bound Title template must be explicitly configured");
	assert.deepEqual(create().tools, []);
});

test("the configured public Title entry exposes 13 source-backed tools and rejects model-selected file paths", () => {
	const f = titleFixture(),
		create = Reflect.get(api, "createTitleTemplate");
	assert.equal(typeof create, "function");
	const template = create({ service: f.service, localPrincipal: who });
	assert.equal(template.tools.length, 13);
	assert.equal(template.tools.filter((tool: { type: string }) => tool.type === "command").length, 2);
	const draft = template.tools.find((tool: { name: string }) => tool.name === "draft_title_packet");
	assert.ok(draft);
	assert.throws(() =>
		draft.inputSchema.parse({
			taskRef: { id: "task.title", revision: "r1" },
			proposal: f.proposal,
			revision: "r1",
			outputPath: "/tmp/model-chosen",
		}),
	);
});
