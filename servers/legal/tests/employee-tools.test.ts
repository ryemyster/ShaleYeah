import assert from "node:assert/strict";
import { test } from "node:test";
import { legalEmployeeTools } from "../src/employee-tools.js";
import { LegalMemoService } from "../src/legal-service.js";
import { legalFixture, ref, who } from "./fixtures/legal.js";
import { reviewFixture } from "./fixtures/review.js";

test("Legal tools read actual provisions, compute citations and record only an exact human-approved private memo", async () => {
	const f = await reviewFixture();
	try {
		const tools = legalEmployeeTools({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: who });
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing Legal tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.equal(tools.length, 10);
		assert.ok(!tools.some((tool) => /approve|decide|inspect|sign|file/.test(tool.name)));
		assert.equal((await run("read_legal_inputs", { taskRef: ref })).analysis.sourceArtifacts.length, 3);
		const source = await run("read_legal_source", { sourceRef: f.current.corpusSourceRef, maxChars: 80 });
		assert.equal(Array.from(source.analysis.text).length, 80);
		const metadata = await run("get_context_source_metadata", { sourceRef: f.current.corpusSourceRef });
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.ok(!Object.hasOwn(metadata.analysis, "text"));
		const selected = { documentRef: f.quotes.party.documentRef, sectionId: f.quotes.party.sectionId };
		assert.equal(
			(await run("read_legal_provision", { taskRef: ref, ...selected, maxChars: 6 })).analysis.text,
			"Café 🛢",
		);
		assert.deepEqual(
			(await run("cite_legal_source", { taskRef: ref, ...selected, quote: "Café 🛢 LLC" })).analysis.citation,
			f.quotes.party,
		);
		const compared = await run("compare_legal_sources", {
			taskRef: ref,
			provisions: [selected, { documentRef: f.quotes["state-grant"].documentRef, sectionId: "state-grant" }],
		});
		assert.deepEqual(
			compared.analysis.provisions.map((p) => p.sourceKind),
			["contract", "primary-law"],
		);
		const drafted = await run("draft_legal_memo", { taskRef: ref, proposal: f.proposal, revision: "r2" });
		assert.equal(drafted.analysis.work.artifact.revision, "r2");
		assert.equal(drafted.analysis.legal.legalClearance, false);
		const pending = (await run("prepare_legal_review", { candidate: await f.candidate(), expectedHead: null }))
			.analysis;
		assert.equal((await run("legal_review_status", { reviewId: pending.reviewId })).analysis.state, "awaiting-review");
		await assert.rejects(
			run("record_legal_memo", { reviewId: pending.reviewId, packetDigest: pending.packetDigest, grantId: "forged" }),
			/approval_required/,
		);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Exact private legal memo reviewed",
			f.reviewer,
		);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		assert.equal((await run("record_legal_memo", request)).analysis.stored, true);
		assert.equal((await run("record_legal_memo", request)).analysis.stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("Legal tool identity comes from the host request and cannot be replaced by arguments", async () => {
	const f = legalFixture();
	const tool = legalEmployeeTools({ service: f.service }).find((item) => item.name === "read_legal_inputs");
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /access_denied/);
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, principal: who }));
	assert.throws(() => tool.inputSchema.parse({ taskRef: ref, credential: "model-chosen" }));
	const context = { principal: who, policyId: "host", policyVersion: "r1", requestId: "request.legal" };
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.handler({ taskRef: ref }, context, controller.signal), /cancelled/);
	f.revoke();
	await assert.rejects(tool.handler({ taskRef: ref }, context));
});

test("Legal source tool deadlines cancel stalled I/O without reporting success", async () => {
	const f = legalFixture();
	let observed: AbortSignal | undefined;
	const service = new LegalMemoService({
		...f.options,
		fetchSource: async (_ref, _who, _op, signal) => {
			observed = signal;
			return new Promise(() => {});
		},
	});
	const tool = legalEmployeeTools({ service, localPrincipal: who, timeoutMs: 15 }).find(
		(item) => item.name === "read_legal_inputs",
	);
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: ref }), /timeout/);
	assert.equal(observed?.aborted, true);
});

test("an unconfigured service advertises no work tools and invalid deadlines fail closed", () => {
	assert.deepEqual(legalEmployeeTools({}), []);
	assert.throws(() => legalEmployeeTools({ timeoutMs: 0 }), /configuration/);
});

test("preparing review without a review runtime or with invented tool arguments cannot succeed", async () => {
	const f = await reviewFixture();
	try {
		const tools = legalEmployeeTools({ service: f.service, localPrincipal: who });
		const tool = tools.find((item) => item.name === "prepare_legal_review");
		assert.ok(tool);
		await assert.rejects(tool.handler({ candidate: await f.candidate(), expectedHead: null }), /review_unavailable/);
		await assert.rejects(tool.handler({ candidate: {}, expectedHead: null, approve: true }), /invalid_arguments/);
	} finally {
		f.close();
	}
});
