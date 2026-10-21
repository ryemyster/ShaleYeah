import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { QAInputs } from "../src/qa-inputs.js";

function fixture() {
	const scope = { customerId: "customer", assetId: "well", taskId: "task", employeeId: "employee.qa" };
	const principal = {
		subjectId: "qa-run",
		customerId: scope.customerId,
		employeeId: scope.employeeId,
		scopes: ["qa:read", "qa:run", "qa:report"],
	};
	const bytes = new TextEncoder().encode('{"schemaVersion":"0.1.0","kind":"normalized-qa-data","rows":[]}');
	const entry = {
		snapshot: {
			scope,
			bytes,
			evidence: {
				id: "source.one",
				revision: "r1",
				uri: "urn:fixture:source.one",
				hash: { algorithm: "sha256", value: createHash("sha256").update(bytes).digest("hex") },
				asOf: "2026-10-13T00:00:00Z",
				accessClassification: "restricted",
				usagePolicy: { id: "policy.data", version: "r1" },
			},
		},
		grant: {
			subjectId: principal.subjectId,
			scope,
			taskRevision: "r1",
			operations: ["read", "export"],
			current: true,
			expiresAt: "2026-10-13T01:00:00Z",
		},
	};
	const options = {
		scope,
		taskRevision: "r1",
		current: async () => entry,
		contentGuard: async () => true,
		clock: () => new Date("2026-10-13T00:00:00Z"),
	};
	return { scope, principal, entry, options, ref: { id: "source.one", revision: "r1" } };
}

test("source access returns exact hashed bytes only under current scoped task and recipient authority", async () => {
	const f = fixture(),
		inputs = new QAInputs(f.options);
	const result = await inputs.fetch(f.ref, f.principal, "read");
	assert.deepEqual(result.bytes, f.entry.snapshot.bytes);
	assert.notEqual(result, f.entry.snapshot);
	f.entry.grant.current = false;
	await assert.rejects(() => inputs.fetch(f.ref, f.principal, "read"), /access_denied/);
});

test("foreign caller, changed task/reference/hash, expired permission and unavailable source cannot become evaluated data", async () => {
	for (const fault of ["caller", "scope", "task", "reference", "hash", "expiry", "missing"]) {
		const f = fixture();
		if (fault === "caller") f.principal.subjectId = "another";
		if (fault === "scope") f.entry.snapshot.scope = { ...f.scope, customerId: "other" };
		if (fault === "task") f.entry.grant.taskRevision = "r2";
		if (fault === "reference") f.ref.revision = "r2";
		if (fault === "hash") f.entry.snapshot.evidence.hash.value = "0".repeat(64);
		if (fault === "expiry") f.entry.grant.expiresAt = "2026-10-12T00:00:00Z";
		const inputs = new QAInputs({ ...f.options, current: async () => (fault === "missing" ? undefined : f.entry) });
		await assert.rejects(() => inputs.fetch(f.ref, f.principal, "read"), undefined, fault);
	}
});

test("revocation during content scanning is rechecked, unsafe content and cancellation block", async () => {
	const f = fixture();
	const inputs = new QAInputs({
		...f.options,
		contentGuard: async () => {
			f.entry.grant.current = false;
			return true;
		},
	});
	await assert.rejects(() => inputs.fetch(f.ref, f.principal, "read"), /access_denied/);
	const fresh = fixture();
	await assert.rejects(
		() => new QAInputs({ ...fresh.options, contentGuard: async () => false }).fetch(fresh.ref, fresh.principal, "read"),
		/unsafe_content/,
	);
	const abort = new AbortController();
	abort.abort();
	await assert.rejects(
		() => new QAInputs(fresh.options).fetch(fresh.ref, fresh.principal, "read", abort.signal),
		/cancelled/,
	);
});
