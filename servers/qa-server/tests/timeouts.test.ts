import assert from "node:assert/strict";
import { test } from "node:test";
import { QAInputs } from "../src/qa-inputs.js";
import { QAService } from "../src/qa-service.js";
import { createQATemplate } from "../src/server.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("MCP timeout cancels underlying work and late source completion cannot store a successful artifact", async () => {
	const f = fixture();
	try {
		let release: (value: unknown) => void = () => {};
		const waiting = new Promise((resolve) => {
			release = resolve;
		});
		const inputs = new QAInputs({
			scope: f.task.scope,
			taskRevision: "r1",
			current: async () => waiting,
			contentGuard: async () => true,
			clock: f.options.clock,
		});
		const service = new QAService({ ...f.options, inputs });
		const tool = createQATemplate({ service, localPrincipal: f.principal, timeoutMs: 10 }).tools.find(
			(item) => item.name === "run_quality_tests",
		)!;
		await assert.rejects(() => tool.handler(f.request), /timeout/);
		release(f.source);
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(f.audits.length, 0);
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(() => tool.handler(f.request, undefined, controller.signal), /cancelled/);
		assert.throws(() => createQATemplate({ timeoutMs: 0 }));
	} finally {
		f.close();
	}
});
