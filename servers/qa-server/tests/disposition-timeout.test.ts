import assert from "node:assert/strict";
import { test } from "node:test";
import { QAInputs } from "../src/qa-inputs.js";
import { QADispositionWorkflow } from "../src/review-workflow.js";
import { createQATemplate } from "../src/server.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("timed-out preparation cannot create a late successful review checkpoint", async () => {
	const f = await fixture();
	f.workflow.close();
	let release: (value: unknown) => void = () => {};
	const waiting = new Promise((resolve) => {
		release = resolve;
	});
	const inputs = new QAInputs({
		scope: f.task.scope,
		taskRevision: f.task.revision,
		current: async () => waiting,
		contentGuard: async () => true,
		clock: f.options.clock,
	});
	const workflow = new QADispositionWorkflow(f.directory, { ...f.options, inputs });
	try {
		const tool = createQATemplate({
			service: f.service,
			reviewWorkflow: workflow,
			localPrincipal: f.requester,
			timeoutMs: 10,
		}).tools.find((tool) => tool.name === "prepare_review")!;
		await assert.rejects(() => tool.handler({ candidate: f.candidate(), expectedHead: null }), /timeout/);
		release(f.source);
		await new Promise((resolve) => setTimeout(resolve, 30));
		await assert.rejects(() => workflow.status(undefined, f.requester), /review_unavailable/);
	} finally {
		workflow.close();
		f.close();
	}
});
