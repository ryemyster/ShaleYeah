import assert from "node:assert/strict";
import { test } from "node:test";
import * as market from "../src/index.js";
import { marketEmployeeTools as employeeTools } from "../src/index.js";
import { MarketScenarioService } from "../src/market-service.js";
import { employeeFixture, who } from "./fixtures/employee.js";
import { reviewFixture } from "./fixtures/review.js";

test("Market tools expose actual comparisons and require exact enrolled human approval before private recording", async () => {
	const f = await reviewFixture();
	try {
		const tools = employeeTools({ service: f.service, reviewWorkflow: f.workflow, localPrincipal: who });
		const run = (name: string, args: unknown) => {
			const tool = tools.find((item) => item.name === name);
			assert.ok(tool, `Missing Market tool: ${name}`);
			return tool.handler(tool.inputSchema.parse(args));
		};
		assert.equal(tools.length, 8);
		assert.ok(!tools.some((tool) => /approve|decide|inspect|trade|bid|sign/.test(tool.name)));
		assert.equal((await run("read_market_inputs", { taskRef: f.ref() })).analysis.sourceArtifacts.length, 3);
		const source = await run("read_market_source", { sourceRef: f.current.seriesSourceRef, maxChars: 80 });
		assert.equal(Array.from(source.analysis.text).length, 80);
		const metadata = await run("get_context_source_metadata", { sourceRef: f.current.seriesSourceRef });
		assert.deepEqual(metadata.analysis.sourceArtifact, source.analysis.sourceArtifact);
		assert.ok(!Object.hasOwn(metadata.analysis, "text"));
		const calculated = (await run("calculate_market_scenarios", { taskRef: f.ref() })).analysis;
		assert.ok(Math.abs(calculated.market.comparison.meanDifferential + 0.2) < 1e-12);
		assert.ok(!Object.hasOwn(calculated, "work"));
		const draft = (await run("draft_market_scenario", { taskRef: f.ref(), proposal: f.proposal, revision: "r2" }))
			.analysis;
		assert.equal(draft.work.artifact.revision, "r2");
		assert.equal(draft.market.commercialAuthority, false);
		const pending = (await run("prepare_market_review", { candidate: await f.candidate(), expectedHead: null }))
			.analysis;
		assert.equal((await run("market_review_status", { reviewId: pending.reviewId })).analysis.state, "awaiting-review");
		await assert.rejects(
			run("record_market_scenarios", {
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
			"Exact private commercial scenarios reviewed",
			f.reviewer,
		);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		assert.equal((await run("record_market_scenarios", request)).analysis.stored, true);
		assert.equal((await run("record_market_scenarios", request)).analysis.stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("Market tool identity comes from the host and cannot be supplied through model arguments", async () => {
	const f = employeeFixture(),
		tool = employeeTools({ service: f.service }).find((item) => item.name === "read_market_inputs");
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: f.ref() }), /access_denied/);
	assert.throws(() => tool.inputSchema.parse({ taskRef: f.ref(), principal: who }));
	assert.throws(() => tool.inputSchema.parse({ taskRef: f.ref(), credential: "model-selected" }));
	const context = { principal: who, policyId: "host", policyVersion: "r1", requestId: "request.market" },
		controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.handler({ taskRef: f.ref() }, context, controller.signal), /cancelled/);
	f.revoke();
	await assert.rejects(tool.handler({ taskRef: f.ref() }, context));
});

test("Market tool deadlines cancel stalled source I/O without returning success", async () => {
	const f = employeeFixture();
	let observed: AbortSignal | undefined;
	const service = new MarketScenarioService({
		...f.options,
		fetchSource: async (_ref, _who, _op, signal) => {
			observed = signal;
			return new Promise(() => {});
		},
	});
	const tool = employeeTools({ service, localPrincipal: who, timeoutMs: 15 }).find(
		(item) => item.name === "read_market_inputs",
	);
	assert.ok(tool);
	await assert.rejects(tool.handler({ taskRef: f.ref() }), /timeout/);
	assert.equal(observed?.aborted, true);
});

test("unconfigured employee tools are absent and invalid deadlines fail closed", () => {
	assert.deepEqual(employeeTools({}), []);
	assert.throws(() => employeeTools({ timeoutMs: 0 }), /configuration/);
});

test("missing review runtime and invented approval arguments cannot prepare a Market review", async () => {
	const f = await reviewFixture();
	try {
		const tool = employeeTools({ service: f.service, localPrincipal: who }).find(
			(item) => item.name === "prepare_market_review",
		);
		assert.ok(tool);
		await assert.rejects(tool.handler({ candidate: await f.candidate(), expectedHead: null }), /review_unavailable/);
		await assert.rejects(tool.handler({ candidate: {}, expectedHead: null, approve: true }), /invalid_arguments/);
	} finally {
		f.close();
	}
});

test("the configured public Market template advertises the same source-bound employee tools", () => {
	const f = employeeFixture();
	const expected = employeeTools({ service: f.service, localPrincipal: who });
	const template = market.createMarketTemplate({ service: f.service, localPrincipal: who } as Parameters<
		typeof market.createMarketTemplate
	>[0]);
	for (const tool of expected)
		assert.ok(
			template.tools.some((item) => item.name === tool.name),
			`Missing public tool ${tool.name}`,
		);
	assert.equal(template.tools.length, expected.length + 2);
});
