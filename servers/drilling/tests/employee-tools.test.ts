import assert from "node:assert/strict";
import { test } from "node:test";
import { DrillingPacketService } from "../src/drilling-service.js";
import { drillingEmployeeTools } from "../src/employee-tools.js";
import { drillingFixture, ref, who } from "./fixtures/drilling.js";
import { reviewFixture } from "./fixtures/review.js";

test("configured Drilling tools read actual evidence, compute source facts and record only exact reviewed private work", async () => {
	const f = await reviewFixture();
	try {
		const tools = drillingEmployeeTools({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: who });
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing Drilling tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.equal(tools.length, 12);
		assert.equal(tools.filter((tool) => tool.type === "command").length, 2);
		assert.ok(!tools.some((tool) => /(?:^|_)(approve|decide|inspect|sign|file)(?:_|$)/.test(tool.name)));
		assert.equal((await run("read_drilling_inputs", { taskRef: ref })).analysis.sourceArtifacts.length, 3);
		const source = await run("read_drilling_source", { sourceRef: f.current.corpusSourceRef, maxChars: 80 });
		assert.equal(Array.from(source.analysis.text).length, 80);
		const metadata = await run("get_context_source_metadata", { sourceRef: f.current.corpusSourceRef });
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.ok(!Object.hasOwn(metadata.analysis, "text"));
		const selected = { evidenceRef: { id: "evidence.design", revision: "r1" }, sectionId: "basis" };
		assert.equal(
			(await run("read_drilling_evidence", { taskRef: ref, ...selected, maxChars: 20 })).analysis.nextOffset,
			20,
		);
		assert.equal(
			(await run("cite_drilling_evidence", { taskRef: ref, ...selected, quote: "Élodie 🛢" })).analysis.citation.quote,
			"Élodie 🛢",
		);
		for (const name of ["design_drilling_program", "estimate_well_costs", "assess_drilling_risks"])
			assert.equal((await run(name, { taskRef: ref })).analysis.drilling.operationalApproval, false);
		const draft = await run("draft_drilling_packet", { taskRef: ref, proposal: f.proposal, revision: "r2" });
		assert.equal(draft.analysis.work.artifact.revision, "r2");
		assert.equal(draft.analysis.drilling.costs[0].totalExact, "450000/1");
		const pending = (await run("prepare_drilling_review", { candidate: await f.candidate(), expectedHead: null }))
			.analysis;
		assert.equal(
			(await run("drilling_review_status", { reviewId: pending.reviewId })).analysis.state,
			"awaiting-review",
		);
		await assert.rejects(
			run("record_drilling_packet", {
				reviewId: pending.reviewId,
				packetDigest: pending.packetDigest,
				grantId: "forged",
			}),
			/approval_required/,
		);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Exact private source packet reviewed",
			f.reviewer,
		);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		assert.equal((await run("record_drilling_packet", request)).analysis.stored, true);
		assert.equal((await run("record_drilling_packet", request)).analysis.stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("Drilling tool identity comes from the host request and cannot be supplied as tool arguments", async () => {
	const f = drillingFixture(),
		tool = drillingEmployeeTools({ service: f.service }).find((row) => row.name === "read_drilling_inputs");
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /access_denied/);
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, principal: who }));
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, credential: "model-chosen" }));
	const context = { principal: who, policyId: "host", policyVersion: "r1", requestId: "request.drilling" };
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.handler({ taskRef: ref }, context, controller.signal), /cancelled/);
	f.revoke();
	await assert.rejects(tool.handler({ taskRef: ref }, context));
});

test("Drilling tool deadlines cancel stalled I/O without a fabricated success", async () => {
	const f = drillingFixture();
	let observed: AbortSignal | undefined;
	const service = new DrillingPacketService({
		...f.options,
		fetchSource: async (_ref, _who, _op, signal) => {
			observed = signal;
			return new Promise(() => {});
		},
	});
	const tool = drillingEmployeeTools({ service, localPrincipal: who, timeoutMs: 15 }).find(
		(row) => row.name === "read_drilling_inputs",
	);
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /timeout/);
	assert.equal(observed?.aborted, true);
});

test("unconfigured Drilling tooling advertises no work and invalid execution bounds fail closed", () => {
	assert.deepEqual(drillingEmployeeTools({}), []);
	assert.throws(() => drillingEmployeeTools({ timeoutMs: 0 }), /configuration/);
});

test("missing review runtime, invented approval and model-selected paths cannot prepare or execute work", async () => {
	const f = await reviewFixture();
	try {
		const tools = drillingEmployeeTools({ service: f.service, localPrincipal: who });
		const review = tools.find((row) => row.name === "prepare_drilling_review");
		assert.ok(review);
		await assert.rejects(review.handler({ candidate: await f.candidate(), expectedHead: null }), /review_unavailable/);
		await assert.rejects(review.handler({ candidate: {}, expectedHead: null, approve: true }), /invalid_arguments/);
		const draft = tools.find((row) => row.name === "draft_drilling_packet");
		assert.ok(draft);
		assert.throws(() =>
			draft.inputSchema.parse({ taskRef: ref, proposal: f.proposal, revision: "r1", outputPath: "/tmp/model-chosen" }),
		);
	} finally {
		f.close();
	}
});
