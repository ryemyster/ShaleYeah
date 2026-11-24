import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./fixtures/qa-fixture.js";

test("QA context metadata verifies current employee/source rights without returning source bytes", async () => {
	const f = fixture();
	try {
		const metadata = await f.service.contextMetadata(f.ref.id, f.principal, "export");
		assert.deepEqual(metadata.evidence, f.source.snapshot.evidence);
		assert.equal(metadata.subjectId, f.principal.subjectId);
		assert.deepEqual(metadata.scope, f.task.scope);
		assert.equal(metadata.allowed, true);
		assert.ok(!JSON.stringify(metadata).includes("netPay"));
		f.source.grant.current = false;
		await assert.rejects(() => f.service.contextMetadata(f.ref.id, f.principal, "read"), /access_denied/);
	} finally {
		f.close();
	}
});
