import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assessRecord, readMarketSnapshot, readMarketSourceFile } from "../src/evidence.js";
import { bundle, NOW } from "./fixtures/evidence.js";

test("host records retain exact observations and separate reviewed assumptions", async () => {
	const snapshot = await readMarketSnapshot(async () => structuredClone(bundle));
	assert.equal(snapshot.status, "available");
	assert.equal(snapshot.records.length, 3);
	const actual = assessRecord(snapshot.records[0], new Date(NOW), 604800);
	assert.equal(actual.status, "observed");
	assert.equal(actual.value, 0);
	assert.equal(actual.observedAt, "2026-11-12");
	const assumed = assessRecord(snapshot.records[2], new Date(NOW), 604800);
	assert.equal(assumed.status, "assumed");
	assert.equal(assumed.observedAt, null);
	assert.equal(assumed.review?.reviewerId, "fixture.operator");
});

test("denied/missing/unsafe/malformed source bundles are unavailable without leaking the input", async () => {
	assert.equal((await readMarketSnapshot(async () => undefined)).status, "source_missing");
	assert.equal((await readMarketSnapshot(async () => ({ ...bundle, rights: "denied" }))).status, "source_use_denied");
	for (const change of [
		(value: typeof bundle) => {
			value.records[0].unit = "wrong";
		},
		(value: typeof bundle) => {
			value.records.push(value.records[0]);
		},
		(value: typeof bundle) => {
			value.records[2].review = null;
		},
		(value: typeof bundle) => {
			value.records[0].source = { id: "source", uri: "https://example.com/?api_key=secret" };
		},
	]) {
		const value = structuredClone(bundle);
		change(value);
		const result = await readMarketSnapshot(async () => value);
		assert.equal(result.status, "source_invalid");
		assert.equal(result.records.length, 0);
	}
	const unavailable = await readMarketSnapshot(async () => {
		throw new Error("private-path-and-credential");
	});
	assert.equal(unavailable.status, "source_unavailable");
	assert.ok(!JSON.stringify(unavailable).includes("private-path"));
});

test("old/future observations and future assumption reviews cannot look current", async () => {
	const source = structuredClone(bundle).records[0];
	source.observedAt = "2000-01-01";
	assert.equal(assessRecord(source, new Date(NOW), 604800).status, "stale");
	source.observedAt = "2099-01-01";
	assert.equal(assessRecord(source, new Date(NOW), 604800).status, "unavailable");
	const assumption = structuredClone(bundle).records[2];
	assumption.review!.reviewedAt = "2099-01-01T00:00:00.000Z";
	assert.equal(assessRecord(assumption, new Date(NOW), 604800).status, "unavailable");
});

test("the real host file path requires an owned private source file", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-evidence-"));
	try {
		const file = path.join(root, "sources.json");
		await fs.writeFile(file, JSON.stringify(bundle), { mode: 0o600 });
		assert.equal((await readMarketSnapshot(() => readMarketSourceFile(file))).records.length, 3);
		await fs.chmod(file, 0o644);
		assert.equal((await readMarketSnapshot(() => readMarketSourceFile(file))).status, "source_unavailable");
		assert.equal(await readMarketSourceFile(undefined), undefined);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
