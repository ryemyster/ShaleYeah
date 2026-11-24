import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { validateContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { qaProfileSchema } from "../src/tools/qa-rules.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("an unavailable correctness reference remains UNTESTED in an honest canonical report", async () => {
	const f = fixture();
	try {
		Object.assign(f.profile.rules[0], { type: "correctness", referenceSourceId: "source.missing", tolerance: 0 });
		f.grant.profileHash = createHash("sha256")
			.update(reviewJson(qaProfileSchema.parse(f.profile)))
			.digest("hex");
		const result = await f.service.run(f.request, f.principal);
		validateContract(result.work);
		assert.equal(result.payload.status, "UNTESTED");
		assert.equal(result.work.findings[0].basis, "unknown");
		assert.equal(result.work.findings[0].value, null);
		assert.deepEqual(result.work.findings[0].evidenceIds, []);
		assert.equal((await f.service.report(result.resultRef, f.principal)).summary.status, "UNTESTED");
	} finally {
		f.close();
	}
});

test("authorized malformed normalized data remains ERROR with source bytes retained but no measured claim", async () => {
	const f = fixture();
	try {
		f.source.snapshot.bytes = new TextEncoder().encode("{broken");
		f.source.snapshot.evidence.hash.value = createHash("sha256").update(f.source.snapshot.bytes).digest("hex");
		const result = await f.service.run(f.request, f.principal);
		validateContract(result.work);
		assert.equal(result.payload.status, "ERROR");
		assert.equal(result.work.status, "blocked");
		assert.equal(result.work.evidence[0].hash.value, f.source.snapshot.evidence.hash.value);
		assert.equal(result.work.findings[0].basis, "unknown");
		assert.deepEqual(result.work.findings[0].evidenceIds, []);
	} finally {
		f.close();
	}
});
