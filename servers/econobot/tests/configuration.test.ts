import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { loadEconomicBinding } from "../src/configuration.js";
import { localBindingFixture } from "./fixtures/local-binding.js";
import { ref } from "./fixtures/scenario.js";

test("independent private binding reads actual operator exports and enforces current read/export rights", async () => {
	const f = await localBindingFixture();
	let binding: Awaited<ReturnType<typeof loadEconomicBinding>> | undefined;
	try {
		binding = await loadEconomicBinding(f.file, { clock: f.clock });
		const result = await binding.service.inspect(ref, binding.localPrincipal);
		assert.equal(result.sourceArtifacts.length, 7);
		assert.ok((await fs.readFile(f.config.auditFile, "utf8")).includes('"eventType":"source"'));
		const source = await binding.service.readSource(f.basis.priceDeckRef, binding.localPrincipal);
		assert.match(source.text, /50,USD,bbl/);
		assert.equal((await binding.reviewer!()).subjectId, "human-owner");
		f.config.sourceOperations = ["read"];
		await f.write();
		await binding.service.inspect(ref, binding.localPrincipal);
		await assert.rejects(
			binding.service.sourceMetadata(f.basis.forecastRef, "export", binding.localPrincipal),
			/source_use_denied/,
		);
		await assert.rejects(binding.service.draft(ref, ["base"], "r1", binding.localPrincipal), /source_use_denied/);
		f.config.connectorConfiguration.grant.revoked = true;
		await f.write();
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /authority_denied|access_denied/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("tampered operator file and changed task/source bindings cannot keep an earlier source identity", async () => {
	const f = await localBindingFixture();
	let binding: Awaited<ReturnType<typeof loadEconomicBinding>> | undefined;
	try {
		binding = await loadEconomicBinding(f.file, { clock: f.clock });
		await fs.appendFile(path.join(f.inputs, "prices.csv"), "base,2,99999,USD,bbl\n");
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /revision_mismatch/);
		f.config.task.revision = "r2";
		await f.write();
		await assert.rejects(binding.service.inspect(ref, binding.localPrincipal), /configuration_changed/);
	} finally {
		binding?.close();
		await f.close();
	}
});

test("private binding rejects public config permissions and changed byte identities", async () => {
	const f = await localBindingFixture();
	try {
		await fs.chmod(f.file, 0o644);
		await assert.rejects(loadEconomicBinding(f.file, { clock: f.clock }));
		await fs.chmod(f.file, 0o600);
		const binding = await loadEconomicBinding(f.file, { clock: f.clock });
		try {
			const text = await fs.readFile(path.join(f.inputs, "assumptions.csv"), "utf8");
			await fs.writeFile(path.join(f.inputs, "assumptions.csv"), `${text}private,${f.secret}\n`);
			// A changed byte identity is rejected even before the content scanner.
			await assert.rejects(
				binding.service.inspect(ref, binding.localPrincipal),
				(error: unknown) => error instanceof Error && !error.message.includes(f.secret),
			);
		} finally {
			binding.close();
		}
	} finally {
		await f.close();
	}
});

test("the content scanner blocks a correctly hashed source containing a configured credential", async () => {
	const f = await localBindingFixture({ unsafeSource: true });
	let binding: Awaited<ReturnType<typeof loadEconomicBinding>> | undefined;
	try {
		binding = await loadEconomicBinding(f.file, { clock: f.clock });
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
