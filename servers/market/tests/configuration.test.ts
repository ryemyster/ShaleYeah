import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { loadMarketBinding } from "../src/index.js";
import { localBindingFixture } from "./fixtures/local-binding.js";

type Binding = Awaited<ReturnType<typeof loadMarketBinding>>;

test("private Market binding reads three actual exports, audits source retrieval and rechecks read/export rights", async () => {
	const f = await localBindingFixture();
	let binding: Binding | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		assert.equal((await binding.service.inspect(f.ref(), binding.localPrincipal)).sourceArtifacts.length, 3);
		assert.ok((await fs.readFile(f.config.auditFile, "utf8")).includes('"eventType":"source"'));
		assert.match(
			(await binding.service.readSource(f.current.seriesSourceRef, binding.localPrincipal)).text,
			/heatContent/,
		);
		assert.equal((await binding.reviewer!()).subjectId, "human-commercial-owner");
		f.config.sourceOperations = ["read"];
		await f.write();
		await binding.service.inspect(f.ref(), binding.localPrincipal);
		await assert.rejects(
			binding.service.sourceMetadata(f.current.seriesSourceRef, "export", binding.localPrincipal),
			/source_use_denied/,
		);
		await assert.rejects(binding.service.draft(f.ref(), f.proposal, "r1", binding.localPrincipal), /source_use_denied/);
		f.config.sourceGrant.revoked = true;
		await f.write();
		await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /authority_denied|access_denied/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("current source authority includes file bytes even when declared input revisions stay unchanged", async () => {
	const f = await localBindingFixture();
	let binding: Binding | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		await binding.service.inspect(f.ref(), binding.localPrincipal);
		await fs.appendFile(path.join(f.inputs, "series.json"), "tampered\n");
		await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /revision_mismatch/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("private binding and source ownership cannot be bypassed by broad permissions or symlinks", async () => {
	const f = await localBindingFixture();
	try {
		await fs.chmod(f.file, 0o644);
		await assert.rejects(loadMarketBinding(f.file, { clock: f.clock }));
		await fs.chmod(f.file, 0o600);
		const input = path.join(f.inputs, "mandate.json");
		await fs.chmod(input, 0o644);
		await assert.rejects(loadMarketBinding(f.file, { clock: f.clock }));
		await fs.chmod(input, 0o600);
		await fs.rename(input, `${input}.original`);
		await fs.symlink(`${input}.original`, input);
		await assert.rejects(loadMarketBinding(f.file, { clock: f.clock }));
	} finally {
		await f.close();
	}
});

test("configured credentials in a correctly hashed source cannot reach model context or source audit", async () => {
	const f = await localBindingFixture({ unsafeSource: true });
	let binding: Binding | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		await assert.rejects(
			binding.service.inspect(f.ref(), binding.localPrincipal),
			(error: unknown) =>
				error instanceof Error && /unsafe_content/.test(error.message) && !error.message.includes(f.secret),
		);
		assert.ok(!(await fs.readFile(f.config.auditFile, "utf8")).includes(f.secret));
	} finally {
		binding?.close();
		await f.close();
	}
});

test("local principal and separate commercial reviewer enrollment come from current host configuration", async () => {
	const f = await localBindingFixture();
	let binding: Binding | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		await assert.rejects(
			binding.service.inspect(f.ref(), { ...binding.localPrincipal, subjectId: "other" }),
			/source_use_denied/,
		);
		f.config.review.localReviewer.subjectId = "not-enrolled";
		await f.write();
		await assert.rejects(binding.reviewer!(), /authority_denied/);
		f.config.localOperator.uid += 1;
		await f.write();
		await assert.rejects(
			binding.service.inspect(f.ref(), binding.localPrincipal),
			/configuration_changed|access_denied/,
		);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("task, input selection and local storage are sealed for the running Market service", async () => {
	for (const change of ["task", "selection", "directory"] as const) {
		const f = await localBindingFixture();
		let binding: Binding | undefined;
		try {
			binding = await loadMarketBinding(f.file, { clock: f.clock });
			if (change === "task") f.config.task.revision = "r2";
			if (change === "selection") f.config.seriesSourceRef = { id: "foreign", revision: "r1" };
			if (change === "directory") f.config.directory = path.join(f.root, "other-state");
			await f.write();
			await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /configuration_changed/);
		} finally {
			binding?.close();
			await f.close();
		}
	}
});

test("expired or narrowed source grants cannot continue using a previously loaded binding", async () => {
	const f = await localBindingFixture();
	let binding: Binding | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		f.config.sourceGrant.sourceIds = [f.current.mandateSourceRef.id];
		await f.write();
		await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /access_denied/);
		f.config.sourceGrant.expiresAt = "2026-11-13T11:59:00Z";
		await f.write();
		await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /authority_denied/);
	} finally {
		binding?.close();
		await f.close();
	}
});
