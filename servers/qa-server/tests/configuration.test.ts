import assert from "node:assert/strict";
import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadQABinding } from "../src/configuration.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("private operator file checks actual source bytes, records results, survives restart and honors revocation", async () => {
	const f = fixture();
	let binding: Awaited<ReturnType<typeof loadQABinding>> | undefined;
	try {
		const file = path.join(f.directory, "qa.json");
		const config = {
			version: "0.1.0",
			correlation: { runId: "run.qa.fixture", traceId: "a".repeat(32) },
			sourceAuthority: "operator-attested-export",
			directory: path.join(f.directory, "qa-state"),
			auditFile: path.join(f.directory, "qa-state", "events.jsonl"),
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
		};
		const write = () => writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
		write();
		binding = await loadQABinding(file, { clock: f.options.clock });
		const result = await binding.service.run(f.request, binding.localPrincipal);
		assert.equal(result.payload.status, "PASS");
		binding.close();
		binding = await loadQABinding(file, { clock: f.options.clock });
		const report = await binding.service.report(result.resultRef, binding.localPrincipal);
		assert.equal(report.summary.passRate, 1);
		config.sources[0].grant.current = false;
		write();
		await assert.rejects(() => binding!.service.report(result.resultRef, binding!.localPrincipal), /access_denied/);
		config.sources[0].grant.current = true;
		config.localOperator.uid++;
		write();
		await assert.rejects(() => binding!.service.run(f.request, binding!.localPrincipal), /access_denied/);
		chmodSync(file, 0o644);
		await assert.rejects(() => loadQABinding(file));
	} finally {
		binding?.close();
		f.close();
	}
});
