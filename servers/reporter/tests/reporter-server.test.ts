import assert from "node:assert/strict";
import { test } from "node:test";
import { createReporterTemplate, ReporterServer } from "../src/index.js";

test("unconfigured server has discovery but cannot draft, release or write caller paths", async () => {
	const server = new ReporterServer();
	assert.equal(server.config.name, "reporter");
	const tools = createReporterTemplate().tools;
	const names = tools.map((tool) => tool.name);
	assert.ok(names.includes("draft_report"));
	assert.ok(names.includes("release_report"));
	assert.equal(names.includes("generate_investment_decision"), false);
	for (const name of ["draft_report", "release_report", "prepare_review", "get_reviewed_source"]) {
		const tool = tools.find((tool) => tool.name === name)!;
		await assert.rejects(
			() => tool.handler({ sourceIds: ["product.source"], sourceId: "product.source" }),
			/configuration|authority/,
		);
		assert.equal(tool.inputSchema.safeParse({ outputPath: "/tmp/public" }).success, false);
	}
});
