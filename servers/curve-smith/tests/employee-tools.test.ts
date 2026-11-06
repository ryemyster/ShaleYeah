import assert from "node:assert/strict";
import { test } from "node:test";
import { createCurveSmithTemplate } from "../src/index.js";
import { ref, who } from "./fixtures/forecast.js";
import { reviewFixture } from "./fixtures/review.js";

test("configured employee tools expose current sources, calculations and exact protected review", async () => {
	const f = await reviewFixture();
	try {
		const tools = createCurveSmithTemplate({
			service: f.service,
			reviewWorkflow: f.workflow,
			localPrincipal: who,
		}).tools;
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing employee tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.ok(!tools.some((tool) => /decide|approve|inspect/.test(tool.name)), "Human authority is a separate API");
		const inputs = await run("read_forecast_inputs", { taskRef: ref });
		assert.equal(inputs.analysis.sourceArtifacts.length, 3);
		const result = await run("calculate_forecast", { taskRef: ref, forecastRef: { id: "base", revision: "r1" } });
		assert.ok(
			Math.abs(result.analysis.calculation.modeled.cumulativeProduction.value! / (365000 * Math.log(1.5)) - 1) < 1e-8,
		);
		const source = await run("read_forecast_source", { sourceRef: f.current.historySourceRef });
		assert.match(source.analysis.text, /observations/);
		const metadata = await run("get_context_source_metadata", {
			sourceRef: f.current.historySourceRef,
			operation: "export",
		});
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.equal(metadata.analysis.operation, "export");
		assert.ok(!("text" in metadata.analysis));
		const compared = await run("compare_forecasts", { taskRef: ref, forecastIds: ["base", "alternative"] });
		assert.equal(compared.analysis.forecasts.length, 2);
		const draft = await run("draft_forecast", { taskRef: ref, forecastIds: ["base"], revision: "r2" });
		assert.equal(draft.analysis.work.artifact.revision, "r2");
		assert.equal(draft.analysis.forecast.authorizesReserves, false);
		const prepared = await run("prepare_review", { candidate: await f.candidate(), expectedHead: null });
		assert.equal(prepared.analysis.state, "awaiting-review");
		assert.equal(
			(await run("get_review_status", { reviewId: prepared.analysis.reviewId })).analysis.state,
			"awaiting-review",
		);
		await assert.rejects(
			run("record_forecast", {
				reviewId: prepared.analysis.reviewId,
				packetDigest: prepared.analysis.packetDigest,
				grantId: "forged",
			}),
			/approval_required/,
		);
		const approved = await f.workflow.decide(
			prepared.analysis.reviewId,
			prepared.analysis.packetDigest,
			"approve",
			"Reviewed exact basis",
			f.reviewer,
		);
		assert.equal(
			(
				await run("record_forecast", {
					reviewId: approved.reviewId,
					packetDigest: approved.packetDigest,
					grantId: approved.grantId,
				})
			).analysis.stored,
			true,
		);
	} finally {
		f.close();
	}
});

test("employee tools require host identity and preserve cancellation and source denials", async () => {
	const f = await reviewFixture();
	try {
		const tool = createCurveSmithTemplate({ service: f.service }).tools.find(
			(item) => item.name === "read_forecast_inputs",
		);
		assert.ok(tool);
		await assert.rejects(tool.handler({ taskRef: ref }), /access_denied/);
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(tool.handler({ taskRef: ref }, { principal: who } as never, controller.signal), /cancelled/);
		f.revoke("evidence.history");
		await assert.rejects(
			tool.handler({ taskRef: ref }, { principal: who } as never),
			/verification_unavailable|source_unavailable/,
		);
	} finally {
		f.close();
	}
});
