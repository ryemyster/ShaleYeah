import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { createMarketSnapshotHook } from "../src/index.js";
import { MarketScenarioService } from "../src/market-service.js";
import { employeeFixture, now, scope, who } from "./fixtures/employee.js";

function fixture() {
	const build = createMarketSnapshotHook,
		f = employeeFixture(),
		source = structuredClone(f.fetched("evidence.series"));
	source.artifact.sourceKind = "internal-api";
	source.artifact.adapterRef = { id: "normalized-market-snapshot", version: "0.1.0" };
	const grant = {
		subjectId: who.subjectId,
		scope,
		taskRevision: "r1",
		sourceIds: [source.artifact.artifact.id],
		operations: ["read", "export"],
		expiresAt: "2026-11-13T13:00:00Z",
		revoked: false,
	};
	const calls: string[] = [];
	const settings = {
		scope,
		taskRevision: "r1",
		currentGrant: async () => grant,
		credentialRef: "secret:market-snapshot",
		resolveCredential: async () => {
			calls.push("credential");
			return "synthetic-snapshot-secret";
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
	return { ...f, source, grant, calls, settings, hook: build(settings) };
}

test("normalized public and permitted internal/licensed snapshots preserve bytes and support actual Market calculation", async () => {
	const f = fixture(),
		reference = f.current.seriesSourceRef;
	const result = await f.hook(reference, who, "export");
	assert.deepEqual(result.artifact, f.source.artifact);
	assert.deepEqual(result.bytes, f.source.bytes);
	assert.notEqual(result.bytes, f.source.bytes);
	assert.deepEqual(f.calls, ["started", "credential", "read", "succeeded"]);
	f.source.artifact.sourceKind = "public-download";
	assert.equal((await f.hook(reference, who, "read")).artifact.sourceKind, "public-download");
	f.source.artifact.sourceKind = "internal-api";
	f.source.artifact.licenseNotes =
		"Synthetic licensed-export fixture; operator attests these read/export rights, no vendor API verified";
	const service = new MarketScenarioService({
		...f.options,
		current: async () => ({
			...(await f.options.current()),
			authorityRevision: createHash("sha256").update(JSON.stringify(f.grant)).digest("hex"),
		}),
		fetchSource: (ref, principal, operation, signal) =>
			ref.id === reference.id
				? f.hook(ref, principal, operation, signal)
				: f.options.fetchSource(ref, principal, operation, signal),
	});
	const calculated = await service.calculate(f.ref(), who);
	assert.ok(Math.abs(calculated.market.comparison.meanDifferential! + 0.2) < 1e-12);
	f.grant.revoked = true;
	await assert.rejects(service.calculate(f.ref(), who), /source_use_denied/);
});

test("denied snapshot rights never resolve credentials or call the API fixture", async () => {
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
			f.grant.expiresAt = "2026-11-13T11:00:00Z";
		},
	]) {
		const f = fixture();
		change(f);
		await assert.rejects(f.hook(f.current.seriesSourceRef, who, "export"));
		assert.ok(!f.calls.includes("credential") && !f.calls.includes("read"));
	}
});

test("stale, forged, foreign-scope, unqualified-mapping or credential-bearing snapshots fail closed", async () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.source.bytes = Buffer.from("forged");
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.scope.assetId = "other";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.evidence.asOf = "2025-01-01T00:00:00Z";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.adapterRef.id = "vendor-native-unqualified";
		},
		(f: ReturnType<typeof fixture>) => {
			f.source.artifact.accessNotes = "synthetic-snapshot-secret";
		},
	]) {
		const f = fixture();
		change(f);
		await assert.rejects(
			f.hook(f.current.seriesSourceRef, who, "read"),
			(error: unknown) => error instanceof Error && !error.message.includes("synthetic-snapshot-secret"),
		);
		assert.ok(!f.calls.includes("succeeded"));
	}
});

test("revocation during snapshot retrieval, cancellation or unavailable audit prevents delivery", async () => {
	const f = fixture(),
		build = createMarketSnapshotHook;
	const changed = build({
		...f.settings,
		readSnapshot: async () => {
			f.grant.revoked = true;
			return f.source;
		},
	});
	await assert.rejects(changed(f.current.seriesSourceRef, who, "read"));
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(f.hook(f.current.seriesSourceRef, who, "read", controller.signal));
	const audit = build({
		...f.settings,
		audit: async () => {
			throw new Error("private-audit-detail");
		},
	});
	await assert.rejects(
		audit(f.current.seriesSourceRef, who, "read"),
		(error: unknown) => error instanceof Error && !error.message.includes("private-audit-detail"),
	);
});

test("snapshot credential and content guards are host settings and malformed configuration is rejected", async () => {
	const f = fixture(),
		build = createMarketSnapshotHook;
	assert.throws(() => build({ ...f.settings, maxBytes: 0 }), /configuration/);
	assert.throws(() => build({ ...f.settings, resolveCredential: undefined }), /configuration/);
	await assert.rejects(
		build({ ...f.settings, contentGuard: async () => false })(f.current.seriesSourceRef, who, "read"),
		/unsafe_content/,
	);
	await assert.rejects(
		f.hook(f.current.seriesSourceRef, { ...who, subjectId: "other" } as SourcePrincipal, "read"),
		/source_use_denied/,
	);
});
