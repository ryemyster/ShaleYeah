import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { QAResultStore } from "../src/qa-store.js";

const scope = { customerId: "customer", assetId: "asset", taskId: "task", employeeId: "employee.qa" };
test("result snapshots are immutable, scoped and durable across restart with replay and original expiry", () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-store-"));
	let store: QAResultStore | undefined;
	try {
		store = new QAResultStore(path.join(directory, "state"), { clock: () => new Date("2026-10-13T00:00:00Z") });
		const payload = { scope, sourceRevision: "r1", results: [{ status: "FAIL", observed: 0 }] };
		const ref = store.put(scope, payload, "2026-10-13T01:00:00Z");
		assert.deepEqual(store.put(scope, payload, "2026-10-13T01:00:00Z"), ref);
		store.close();
		store = new QAResultStore(path.join(directory, "state"), { clock: () => new Date("2026-10-13T00:00:00Z") });
		assert.deepEqual(store.get(scope, ref), payload);
		assert.throws(() => store!.get({ ...scope, customerId: "other" }, ref), /access_denied/);
		const revised = store.put(scope, { ...payload, sourceRevision: "r2" }, "2026-10-13T01:00:00Z");
		assert.notEqual(revised.id, ref.id);
		assert.deepEqual(store.get(scope, ref), payload);
		store.close();
		store = new QAResultStore(path.join(directory, "state"), { clock: () => new Date("2026-10-13T02:00:00Z") });
		assert.throws(() => store!.get(scope, ref), /expired/);
	} finally {
		store?.close();
		rmSync(directory, { recursive: true });
	}
});

test("store rejects public roots, symlinked stores, limits and invalid expiry without creating successful artifacts", () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-store-"));
	let store: QAResultStore | undefined;
	try {
		chmodSync(directory, 0o755);
		assert.throws(() => new QAResultStore(directory), /storage_policy/);
		chmodSync(directory, 0o700);
		symlinkSync(directory, path.join(directory, "link"));
		assert.throws(() => new QAResultStore(path.join(directory, "link")), /storage_policy/);
		store = new QAResultStore(path.join(directory, "state"), {
			maxRecords: 1,
			clock: () => new Date("2026-10-13T00:00:00Z"),
		});
		assert.throws(() => store!.put(scope, {}, "yesterday"), /invalid_expiry/);
		store.put(scope, { value: 0 }, "2026-10-13T01:00:00Z");
		assert.throws(() => store!.put(scope, { value: 1 }, "2026-10-13T01:00:00Z"), /store_limit/);
	} finally {
		store?.close();
		rmSync(directory, { recursive: true });
	}
});

test("expired results are purged on store access and do not permanently consume the bounded quota", () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-store-"));
	let instant = "2026-10-13T00:00:00Z";
	const store = new QAResultStore(directory, { maxRecords: 1, clock: () => new Date(instant) });
	try {
		const old = store.put(scope, { revision: "r1" }, "2026-10-13T00:01:00Z");
		instant = "2026-10-13T00:02:00Z";
		const next = store.put(scope, { revision: "r2" }, "2026-10-13T00:03:00Z");
		assert.deepEqual(store.get(scope, next), { revision: "r2" });
		assert.throws(() => store.get(scope, old), /access_denied|expired/);
	} finally {
		store.close();
		rmSync(directory, { recursive: true });
	}
});
