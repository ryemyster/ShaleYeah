import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadQABinding } from "../src/configuration.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("operator-owned review configuration authenticates a separate reviewer and keeps grants current", async () => {
	const f = await fixture();
	let binding: Awaited<ReturnType<typeof loadQABinding>> | undefined;
	try {
		const file = path.join(f.directory, "qa-config.json");
		const config = {
			version: "0.1.0",
			sourceAuthority: "operator-attested-export",
			qualification: "fixture",
			correlation: { runId: "qa.test", traceId: "a".repeat(32) },
			directory: path.join(f.directory, "configured"),
			auditFile: path.join(f.directory, "configured", "events.jsonl"),
			task: f.task,
			profile: f.profile,
			grant: f.grant,
			sources: [
				{
					snapshot: {
						...f.source.snapshot,
						bytes: undefined,
						bytesBase64: Buffer.from(f.source.snapshot.bytes).toString("base64"),
					},
					grant: f.source.grant,
				},
			],
			localOperator: { uid: process.getuid!(), subjectId: f.principal.subjectId },
			sensitiveFiles: [],
			review: {
				policy: f.policy,
				dispositionPolicy: f.dispositionPolicy,
				localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			},
		};
		const write = () => writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
		write();
		binding = await loadQABinding(file, { clock: f.options.clock });
		assert.ok(binding.reviewWorkflow);
		assert.equal((await binding.reviewer!()).subjectId, f.reviewer.subjectId);
		assert.ok(binding.localPrincipal.scopes.includes("qa:disposition"));
		const run = await binding.service.run(f.request, binding.localPrincipal);
		assert.equal(run.payload.status, "FAIL");
		config.review.localReviewer.uid++;
		write();
		await assert.rejects(() => binding!.reviewer!(), /authority_denied/);
	} finally {
		binding?.close();
		f.close();
	}
});
