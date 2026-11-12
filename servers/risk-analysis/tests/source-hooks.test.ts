import assert from "node:assert/strict";
import { test } from "node:test";
import { createRiskSnapshotHook } from "../src/source-hooks.js";
import { now, riskFixture, scope, who } from "./fixtures/risk.js";

function fixture() {
	const f = riskFixture(),
		source = structuredClone(f.fetched("evidence.register"));
	source.artifact.sourceKind = "internal-api";
	source.artifact.adapterRef = { id: "normalized-risk-snapshot", version: "0.1.0" };
	const grant = {
		subjectId: who.subjectId,
		scope,
		taskRevision: "r1",
		sourceIds: [source.artifact.artifact.id],
		operations: ["read", "export"],
		expiresAt: "2026-01-02T13:00:00Z",
		revoked: false,
	};
	const calls: string[] = [];
	const settings = {
		scope,
		taskRevision: "r1",
		currentGrant: async () => grant,
		credentialRef: "secret:operator-snapshot",
		resolveCredential: async () => {
			calls.push("credential");
			return "synthetic-secret-value";
		},
		readSnapshot: async () => {
			calls.push("read");
			return source;
		},
		contentGuard: async () => true,
		audit: async (event: { stage: string }) => {
			calls.push(event.stage);
		},
		maxBytes: 100000,
		maxAgeSeconds: 86400,
		clock: () => now,
	};
	return { ...f, source, grant, calls, settings, hook: createRiskSnapshotHook(settings) };
}

test("installed normalized public/internal snapshots retain exact bytes and source identities under current rights", async () => {
	const f = fixture(),
		reference = f.current.registerSourceRef;
	const result = await f.hook(reference, who, "export");
	assert.deepEqual(result.artifact, f.source.artifact);
	assert.deepEqual(result.bytes, f.source.bytes);
	assert.notEqual(result.bytes, f.source.bytes);
	assert.deepEqual(f.calls, ["started", "credential", "read", "succeeded"]);
	f.source.artifact.sourceKind = "public-download";
	assert.equal((await f.hook(reference, who, "read")).artifact.sourceKind, "public-download");
});

test("denied rights never resolve credentials or read snapshots", async () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.grant.revoked = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.grant.sourceIds = [];
		},
		(f: ReturnType<typeof fixture>) => {
			f.grant.operations = ["read"];
		},
		(f: ReturnType<typeof fixture>) => {
			f.grant.expiresAt = "2026-01-02T11:00:00Z";
		},
	]) {
		const f = fixture();
		change(f);
		await assert.rejects(() => f.hook(f.current.registerSourceRef, who, "export"));
		assert.ok(!f.calls.includes("credential") && !f.calls.includes("read"));
	}
});

test("stale, forged, cross-scope, wrong adapter and credential-bearing snapshots fail closed", async () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.source.bytes = Buffer.from("forged");
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.scope.customerId = "other";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.evidence.asOf = "2025-01-01T00:00:00Z";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.adapterRef.id = "unqualified-vendor-mapping";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.accessNotes = "synthetic-secret-value";
		},
	]) {
		const f = fixture();
		change(f);
		await assert.rejects(
			() => f.hook(f.current.registerSourceRef, who, "read"),
			(error: unknown) => error instanceof Error && !error.message.includes("synthetic-secret-value"),
		);
		assert.ok(!f.calls.includes("succeeded"));
	}
});

test("revocation during retrieval, aborted work and unavailable audit cannot deliver a snapshot", async () => {
	const f = fixture();
	const hook = createRiskSnapshotHook({
		...f.settings,
		readSnapshot: async () => {
			f.grant.revoked = true;
			return f.source;
		},
	});
	await assert.rejects(() => hook(f.current.registerSourceRef, who, "read"));
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(() => f.hook(f.current.registerSourceRef, who, "read", controller.signal));
	const audit = createRiskSnapshotHook({
		...f.settings,
		audit: async () => {
			throw new Error("private-failure");
		},
	});
	await assert.rejects(
		() => audit(f.current.registerSourceRef, who, "read"),
		(error: unknown) => error instanceof Error && !error.message.includes("private-failure"),
	);
});
