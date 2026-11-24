import assert from "node:assert/strict";
import { test } from "node:test";
import { createQATemplate } from "../src/server.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("MCP handlers invoke the observed evaluator and report its actual stored results", async () => {
	const f = fixture();
	try {
		const template = createQATemplate({ service: f.service, localPrincipal: f.principal });
		const run = template.tools.find((tool) => tool.name === "run_quality_tests")!;
		const report = template.tools.find((tool) => tool.name === "generate_quality_report")!;
		const result = await run.handler(run.inputSchema.parse(f.request));
		assert.equal(result.analysis.payload.status, "PASS");
		const actual = await report.handler(report.inputSchema.parse({ resultRef: result.analysis.resultRef }));
		assert.equal(actual.analysis.summary.counts.passed, 1);
		assert.deepEqual(actual.analysis.resultRef, result.analysis.resultRef);
		assert.throws(() => run.inputSchema.parse({ ...f.request, outputPath: "/tmp/write", approved: true }));
		assert.throws(() => report.inputSchema.parse({ resultRef: result.analysis.resultRef, waive: true }));
		await assert.rejects(
			() =>
				createQATemplate()
					.tools.find((t) => t.name === "run_quality_tests")!
					.handler(f.request),
			/access_denied/,
		);
		await assert.rejects(
			() =>
				createQATemplate({ localPrincipal: f.principal })
					.tools.find((t) => t.name === "run_quality_tests")!
					.handler(f.request),
			/configuration/,
		);
		await assert.rejects(
			() => run.handler(f.request, { principal: { ...f.principal, customerId: "foreign" } } as never),
			/access_denied/,
		);
		const status = await template.tools.find((t) => t.name === "get_qa_status")!.handler({});
		assert.equal(status.analysis.professionalCertification, false);
		assert.equal(status.analysis.configured, true);
	} finally {
		f.close();
	}
});
