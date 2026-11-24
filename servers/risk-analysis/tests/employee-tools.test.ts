import assert from "node:assert/strict";
import { test } from "node:test";
import { riskEmployeeTools } from "../src/employee-tools.js";
import { RiskAssessmentService } from "../src/risk-service.js";
import { reviewFixture } from "./fixtures/review.js";
import { ref, riskFixture, who } from "./fixtures/risk.js";

test("risk tools discover exact inputs, compare declared states and record only enrolled human-approved work", async () => {
	const f = await reviewFixture();
	try {
		const tools = riskEmployeeTools({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: who });
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing risk tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.equal(tools.length, 9);
		assert.ok(!tools.some((tool) => /approve|decide|inspect/.test(tool.name)));
		assert.equal((await run("read_risk_inputs", { taskRef: ref })).analysis.sourceArtifacts.length, 3);
		const source = await run("read_risk_source", { sourceRef: f.current.scenariosSourceRef, maxChars: 80 });
		assert.equal(source.analysis.text.length, 80);
		const metadata = await run("get_context_source_metadata", { sourceRef: f.current.scenariosSourceRef });
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.ok(!Object.hasOwn(metadata.analysis, "text"));
		const modelRef = { id: "joint.fixture", revision: "r1" };
		assert.equal((await run("calculate_risk", { taskRef: ref, modelRef })).analysis.risk.summary.expectedLoss, 80);
		const compared = await run("compare_risk_scenarios", {
			taskRef: ref,
			modelRefs: [modelRef, { id: "joint.stress", revision: "r1" }],
		});
		assert.deepEqual(
			compared.analysis.analyses.map((item) => item.summary.expectedLoss),
			[80, 160],
		);
		const drafted = await run("draft_risk", { taskRef: ref, modelRef, revision: "r2" });
		assert.equal(drafted.analysis.work.artifact.revision, "r2");
		assert.equal(drafted.analysis.risk.riskAccepted, false);
		const prepared = (await run("prepare_risk_review", { candidate: await f.candidate(), expectedHead: null }))
			.analysis;
		assert.equal((await run("risk_review_status", { reviewId: prepared.reviewId })).analysis.state, "awaiting-review");
		await assert.rejects(
			run("record_risk_assessment", {
				reviewId: prepared.reviewId,
				packetDigest: prepared.packetDigest,
				grantId: "forged",
			}),
			/approval_required/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Owner reviewed exact assumptions",
			f.reviewer,
		);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		assert.equal((await run("record_risk_assessment", request)).analysis.stored, true);
		assert.equal((await run("record_risk_assessment", request)).analysis.stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("risk tool identity comes from the host and current request, never tool arguments", async () => {
	const f = riskFixture();
	const tool = riskEmployeeTools({ service: f.service }).find((item) => item.name === "read_risk_inputs");
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /access_denied/);
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, principal: who }));
	const context = { principal: who, policyId: "host", policyVersion: "r1", requestId: "request.risk" };
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.handler({ taskRef: ref }, context, controller.signal), /cancelled/);
	f.revoke();
	await assert.rejects(tool.handler({ taskRef: ref }, context));
});

test("a stalled source fetch observes the bounded tool deadline", async () => {
	const f = riskFixture();
	let observed: AbortSignal | undefined;
	const service = new RiskAssessmentService({
		...f.options,
		fetchSource: async (_r, _w, _op, signal) => {
			observed = signal;
			return new Promise(() => {});
		},
	});
	const tool = riskEmployeeTools({ service, localPrincipal: who, timeoutMs: 15 }).find(
		(item) => item.name === "read_risk_inputs",
	);
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /timeout/);
	assert.equal(observed?.aborted, true);
});
