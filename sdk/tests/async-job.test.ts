import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultAsyncJobPoller } from "../src/async-job.js";

test("unsupported default job polling performs no anonymous or unbounded protocol request", async () => {
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return new Response(JSON.stringify({ result: { content: [{ text: '{"status":"pending"}' }] } }));
	};
	try {
		const result = await defaultAsyncJobPoller("fixture-job", "http://127.0.0.1:4321");
		assert.equal(calls, 0);
		assert.equal(result.status, "failed");
		assert.ok(result.status === "failed" && /configured.*poller|unsupported/i.test(result.error));
	} finally {
		globalThis.fetch = original;
	}
});
