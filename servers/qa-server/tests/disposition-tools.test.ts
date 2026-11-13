import assert from "node:assert/strict";
import { test } from "node:test";
import { createQATemplate } from "../src/server.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("QA discovery exposes configured review tools without a human decision tool", async () => {
	const f = await fixture();
	try {
		const template = createQATemplate({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: f.requester });
		const names = template.tools.map((tool) => tool.name);
		assert.ok(names.includes("prepare_review") && names.includes("record_disposition"));
		assert.ok(!names.includes("decide_review"));
		const tool = (name: string) => template.tools.find((tool) => tool.name === name)!;
		const prepared = await tool("prepare_review").handler({ candidate: f.candidate(), expectedHead: null });
		assert.equal(prepared.analysis.state, "awaiting-review");
		await assert.rejects(
			() =>
				tool("record_disposition").handler({
					reviewId: prepared.analysis.reviewId,
					packetDigest: prepared.analysis.packetDigest,
					grantId: "forged",
				}),
			/approval_required/,
		);
		const status = await tool("get_review_status").handler({ reviewId: prepared.analysis.reviewId });
		assert.equal(status.analysis.state, "awaiting-review");
		assert.throws(() => tool("record_disposition").inputSchema.parse({ approved: true }));
		assert.ok(!createQATemplate().tools.some((tool) => tool.name === "prepare_review"));
	} finally {
		f.close();
	}
});
