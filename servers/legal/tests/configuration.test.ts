import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { loadLegalBinding } from "../src/configuration.js";
import { ref } from "./fixtures/legal.js";
import { localBindingFixture } from "./fixtures/local-binding.js";

test("private Legal binding reads actual operator exports, audits retrieval and enforces current read/export rights", async () => {
	const f = await localBindingFixture();
	let binding: Awaited<ReturnType<typeof loadLegalBinding>> | undefined;
	try {
		binding = await loadLegalBinding(f.file, { clock: f.clock });
		assert.equal((await binding.service.inspect(ref, binding.localPrincipal)).sourceArtifacts.length, 3);
		assert.ok((await fs.readFile(f.config.auditFile, "utf8")).includes('"eventType":"source"'));
		assert.match(
			(await binding.service.readSource(f.current.corpusSourceRef, binding.localPrincipal)).text,
			/Café 🛢 LLC/,
		);
		assert.equal((await binding.reviewer!()).subjectId, "human-legal-reviewer");
		f.config.sourceOperations = ["read"];
		await f.write();
		await binding.service.inspect(ref, binding.localPrincipal);
		await assert.rejects(
			binding.service.sourceMetadata(f.current.corpusSourceRef, "export", binding.localPrincipal),
			/source_use_denied/,
		);
		await assert.rejects(binding.service.draft(ref, f.proposal, "r1", binding.localPrincipal), /source_use_denied/);
		f.config.sourceGrant.revoked = true;
		await f.write();
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /authority_denied|access_denied/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("source bytes are part of current authority even when the binding file and declared revisions stay unchanged", async () => {
	const f = await localBindingFixture();
	let binding: Awaited<ReturnType<typeof loadLegalBinding>> | undefined;
	try {
		binding = await loadLegalBinding(f.file, { clock: f.clock });
		await binding.service.inspect(ref, binding.localPrincipal);
		await fs.appendFile(path.join(f.inputs, "corpus.json"), "tampered\n");
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /revision_mismatch/);
		f.config.task.revision = "r2";
		await f.write();
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /configuration_changed/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("private configuration, source file permissions and symlinks cannot bypass owner-only input policy", async () => {
	const f = await localBindingFixture();
	try {
		await fs.chmod(f.file, 0o644);
		await assert.rejects(loadLegalBinding(f.file, { clock: f.clock }));
		await fs.chmod(f.file, 0o600);
		const input = path.join(f.inputs, "matter.json");
		await fs.chmod(input, 0o644);
		await assert.rejects(loadLegalBinding(f.file, { clock: f.clock }));
		await fs.chmod(input, 0o600);
		await fs.rename(input, `${input}.original`);
		await fs.symlink(`${input}.original`, input);
		await assert.rejects(loadLegalBinding(f.file, { clock: f.clock }));
	} finally {
		await f.close();
	}
});

test("a correctly hashed source containing a configured credential is blocked without leaking it to audit", async () => {
	const f = await localBindingFixture({ unsafeSource: true });
	let binding: Awaited<ReturnType<typeof loadLegalBinding>> | undefined;
	try {
		binding = await loadLegalBinding(f.file, { clock: f.clock });
		await assert.rejects(
			binding.service.inspect(ref, binding.localPrincipal),
			(error: unknown) =>
				error instanceof Error && /unsafe_content/.test(error.message) && !error.message.includes(f.secret),
		);
		assert.ok(!(await fs.readFile(f.config.auditFile, "utf8")).includes(f.secret));
	} finally {
		binding?.close();
		await f.close();
	}
});

test("current enrollment, source grants and immutable task binding cannot be claimed by a different local principal", async () => {
	const f = await localBindingFixture();
	let binding: Awaited<ReturnType<typeof loadLegalBinding>> | undefined;
	try {
		binding = await loadLegalBinding(f.file, { clock: f.clock });
		await assert.rejects(
			binding.service.inspect(ref, { ...binding.localPrincipal, subjectId: "other" }),
			/source_use_denied/,
		);
		f.config.review.localReviewer.subjectId = "not-enrolled";
		await f.write();
		await assert.rejects(binding.reviewer!(), /authority_denied/);
		f.config.localOperator.uid += 1;
		await f.write();
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /configuration_changed|access_denied/);
	} finally {
		binding?.close();
		await f.close();
	}
});
