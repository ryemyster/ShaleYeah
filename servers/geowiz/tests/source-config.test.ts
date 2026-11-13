import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SourceAccessError } from "@shaleyeah/connectors";
import { createFileSourceAudit, loadSourceBinding, readPrivateSourceConfig } from "../src/source-config.js";
import { sourceConfig } from "./fixtures/source-config.mjs";

test("private source bootstrap rejects missing, shared, linked, malformed and oversized configuration", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-source-config-"));
	const file = path.join(directory, "sources.json");
	try {
		await assert.rejects(readPrivateSourceConfig(file));
		await fs.writeFile(file, "{}", { mode: 0o644 });
		await assert.rejects(readPrivateSourceConfig(file), SourceAccessError);
		await fs.chmod(file, 0o600);
		await fs.symlink(file, path.join(directory, "linked"));
		await assert.rejects(readPrivateSourceConfig(path.join(directory, "linked")));
		await fs.link(file, path.join(directory, "hardlinked"));
		await assert.rejects(readPrivateSourceConfig(file));
		await fs.unlink(path.join(directory, "hardlinked"));
		await fs.writeFile(file, "invalid-json");
		await assert.rejects(readPrivateSourceConfig(file), SourceAccessError);
		await fs.writeFile(file, " ".repeat(65537));
		await assert.rejects(readPrivateSourceConfig(file), SourceAccessError);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test("private source binding reloads revocations and audit failures stop publication", async () => {
	const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-source-grant-")));
	const file = path.join(directory, "sources.json");
	const auditFile = path.join(directory, "audit.jsonl");
	const sample = new URL("sample-files/sample.las", import.meta.url).pathname;
	const config = await sourceConfig(sample, { subjectId: "operator", customerId: "fixture", employeeId: "geologist" });
	await fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
	try {
		assert.deepEqual(await readPrivateSourceConfig(file), config);
		const { runtime, principal } = await loadSourceBinding(file, createFileSourceAudit(auditFile));
		const request = runtime.request(config.sources[0].evidence.id);
		await runtime.fetch(request, principal);
		const events = (await fs.readFile(auditFile, "utf8"))
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		assert.equal(events.at(-1).stage, "retrieved");
		assert.equal(events.at(-1).contentHash, config.sources[0].evidence.hash.value);
		assert.equal((await fs.stat(auditFile)).mode & 0o777, 0o600);
		const asOf = config.sources[0].evidence.asOf;
		config.sources[0].evidence.asOf = new Date(Date.parse(asOf) - 1000).toISOString();
		await fs.writeFile(file, JSON.stringify(config));
		await assert.rejects(runtime.fetch(request, principal), { code: "revision_mismatch" });
		config.sources[0].evidence.asOf = asOf;
		await fs.writeFile(file, JSON.stringify(config));
		config.grant.revoked = true;
		await fs.writeFile(file, JSON.stringify(config));
		await assert.rejects(runtime.fetch(request, principal), SourceAccessError);
		config.grant.revoked = false;
		config.manifest.revision = "r2";
		await fs.writeFile(file, JSON.stringify(config));
		await assert.rejects(runtime.fetch(request, principal), SourceAccessError);
		config.manifest.revision = "r1";
		await fs.writeFile(file, JSON.stringify(config));
		await fs.chmod(auditFile, 0o644);
		await assert.rejects(runtime.fetch(request, principal), SourceAccessError);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});
