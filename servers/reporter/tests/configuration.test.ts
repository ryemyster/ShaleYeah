import assert from "node:assert/strict";
import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadReporterBinding } from "../src/configuration.js";
import { fixture } from "./fixtures/review-fixture.js";

test("private operator-attested source bootstrap rechecks permissions and enrolled reviewer", async () => {
	const f = fixture();
	let binding: Awaited<ReturnType<typeof loadReporterBinding>> | undefined;
	try {
		const policy = await f.options.currentPolicy();
		const file = path.join(f.directory, "reporter.json");
		const config = {
			version: "0.1.0",
			sourceAuthority: "operator-attested-export",
			directory: path.join(f.directory, "service"),
			policy,
			requirements: await f.options.currentRequirements(),
			sources: [f.receipt],
			localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			sensitiveFiles: [],
		};
		writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
		binding = await loadReporterBinding(file);
		assert.equal((await binding.reviewer()).subjectId, f.reviewer.subjectId);
		assert.equal((await binding.sources.verified(f.receipt.work.artifact.id, f.requester)).current, true);
		config.sources[0].current = false;
		writeFileSync(file, JSON.stringify(config));
		await assert.rejects(() => binding!.sources.verified(f.receipt.work.artifact.id, f.requester), /access_denied/);
		config.localReviewer.uid += 1;
		writeFileSync(file, JSON.stringify(config));
		await assert.rejects(() => binding!.reviewer(), /authority_denied/);
		chmodSync(file, 0o644);
		await assert.rejects(() => loadReporterBinding(file));
	} finally {
		binding?.reviewWorkflow.close();
		f.close();
	}
});

test("invalid operator publication requirements are rejected before opening review storage", async () => {
	const f = fixture();
	try {
		const file = path.join(f.directory, "invalid.json");
		writeFileSync(
			file,
			JSON.stringify({
				version: "0.1.0",
				sourceAuthority: "operator-attested-export",
				directory: path.join(f.directory, "invalid-state"),
				policy: await f.options.currentPolicy(),
				requirements: null,
				sources: [f.receipt],
				localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
				sensitiveFiles: [],
			}),
			{ mode: 0o600 },
		);
		await assert.rejects(() => loadReporterBinding(file));
	} finally {
		f.close();
	}
});
