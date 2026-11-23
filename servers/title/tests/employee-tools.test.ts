import assert from "node:assert/strict";
import { test } from "node:test";
import { titleEmployeeTools } from "../src/employee-tools.js";
import { TitlePacketService } from "../src/title-service.js";
import { reviewFixture } from "./fixtures/review.js";
import { ref, titleFixture, who } from "./fixtures/title.js";

test("configured Title tools read actual instruments, compute source facts and record only exact reviewed private work", async () => {
	const f = await reviewFixture();
	try {
		const tools = titleEmployeeTools({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: who });
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing Title tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.equal(tools.length, 13);
		assert.equal(tools.filter((tool) => tool.type === "command").length, 2);
		assert.ok(!tools.some((tool) => /approve|decide|inspect|sign|file/.test(tool.name)));
		assert.equal((await run("read_title_inputs", { taskRef: ref })).analysis.sourceArtifacts.length, 3);
		const source = await run("read_title_source", { sourceRef: f.current.corpusSourceRef, maxChars: 80 });
		assert.equal(Array.from(source.analysis.text).length, 80);
		const metadata = await run("get_context_source_metadata", { sourceRef: f.current.corpusSourceRef });
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.ok(!Object.hasOwn(metadata.analysis, "text"));
		const selected = { instrumentRef: { id: "instrument.opening", revision: "r1" }, sectionId: "opening" };
		assert.equal(
			(await run("read_title_instrument", { taskRef: ref, ...selected, maxChars: 20 })).analysis.nextOffset,
			20,
		);
		assert.equal(
			(await run("cite_title_instrument", { taskRef: ref, ...selected, quote: "Élodie 🛢 LLC" })).analysis.citation
				.quote,
			"Élodie 🛢 LLC",
		);
		for (const name of ["examine_ownership", "trace_chain_of_title", "check_burdens", "analyze_lease"])
			assert.equal((await run(name, { taskRef: ref })).analysis.title.titleClearance, false);
		const draft = await run("draft_title_packet", { taskRef: ref, proposal: f.proposal, revision: "r2" });
		assert.equal(draft.analysis.work.artifact.revision, "r2");
		assert.equal(draft.analysis.title.netRevenue[0].netRevenueInterest, "5/16");
		const pending = (await run("prepare_title_review", { candidate: await f.candidate(), expectedHead: null }))
			.analysis;
		assert.equal((await run("title_review_status", { reviewId: pending.reviewId })).analysis.state, "awaiting-review");
		await assert.rejects(
			run("record_title_packet", { reviewId: pending.reviewId, packetDigest: pending.packetDigest, grantId: "forged" }),
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
		assert.equal((await run("record_title_packet", request)).analysis.stored, true);
		assert.equal((await run("record_title_packet", request)).analysis.stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("Title tool identity comes from the host request and cannot be supplied as tool arguments", async () => {
	const f = titleFixture(),
		tool = titleEmployeeTools({ service: f.service }).find((row) => row.name === "read_title_inputs");
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /access_denied/);
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, principal: who }));
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, credential: "model-chosen" }));
	const context = { principal: who, policyId: "host", policyVersion: "r1", requestId: "request.title" };
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.handler({ taskRef: ref }, context, controller.signal), /cancelled/);
	f.revoke();
	await assert.rejects(tool.handler({ taskRef: ref }, context));
});

test("Title tool deadlines cancel stalled I/O without a fabricated success", async () => {
	const f = titleFixture();
	let observed: AbortSignal | undefined;
	const service = new TitlePacketService({
		...f.options,
		fetchSource: async (_ref, _who, _op, signal) => {
			observed = signal;
			return new Promise(() => {});
		},
	});
	const tool = titleEmployeeTools({ service, localPrincipal: who, timeoutMs: 15 }).find(
		(row) => row.name === "read_title_inputs",
	);
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /timeout/);
	assert.equal(observed?.aborted, true);
});

test("unconfigured Title tooling advertises no work and invalid execution bounds fail closed", () => {
	assert.deepEqual(titleEmployeeTools({}), []);
	assert.throws(() => titleEmployeeTools({ timeoutMs: 0 }), /configuration/);
});

test("missing review runtime, invented approval and model-selected paths cannot prepare or execute work", async () => {
	const f = await reviewFixture();
	try {
		const tools = titleEmployeeTools({ service: f.service, localPrincipal: who });
		const review = tools.find((row) => row.name === "prepare_title_review");
		assert.ok(review);
		await assert.rejects(review.handler({ candidate: await f.candidate(), expectedHead: null }), /review_unavailable/);
		await assert.rejects(review.handler({ candidate: {}, expectedHead: null, approve: true }), /invalid_arguments/);
		const draft = tools.find((row) => row.name === "draft_title_packet");
		assert.ok(draft);
		assert.throws(() =>
			draft.inputSchema.parse({ taskRef: ref, proposal: f.proposal, revision: "r1", outputPath: "/tmp/model-chosen" }),
		);
	} finally {
		f.close();
	}
});
