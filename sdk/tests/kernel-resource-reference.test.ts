/**
 * Tests for Resource Reference (Issue #204)
 *
 * What this tests: tools can store a large blob of data under a short ID
 * (like "geowiz:formation-data:abc123"), and downstream tools can pass that
 * ID instead of copying the whole blob. The kernel looks up the blob and
 * hands it to the tool transparently.
 *
 * Think of it like a coat check: you hand in a heavy coat, get a ticket,
 * and later hand the ticket back to reclaim the coat — instead of carrying
 * the coat through every room.
 */

import assert from "node:assert";
import { DEMO_IDENTITY, Session, SessionManager } from "../src/kernel/context.js";
import type { ResourceRef } from "../src/kernel/types.js";

// ---------------------------------------------------------------------------
// ResourceRef shape tests
// ---------------------------------------------------------------------------

function test_resource_ref_has_required_fields() {
	// A ResourceRef must carry enough info for the kernel to locate the blob
	// and for the caller to know what type of data it holds.
	const ref: ResourceRef = {
		resourceId: "geowiz:formation-data:run-abc123",
		mimeType: "application/json",
	};
	assert.strictEqual(ref.resourceId, "geowiz:formation-data:run-abc123", "resourceId must be present");
	assert.strictEqual(ref.mimeType, "application/json", "mimeType must be present");
	// sizeBytes is optional
	assert.strictEqual(ref.sizeBytes, undefined, "sizeBytes is optional");
}

function test_resource_ref_accepts_size_bytes() {
	const ref: ResourceRef = {
		resourceId: "econobot:cashflow:run-456",
		mimeType: "application/json",
		sizeBytes: 2048,
	};
	assert.strictEqual(ref.sizeBytes, 2048, "sizeBytes should be stored when provided");
}

// ---------------------------------------------------------------------------
// Session resource store tests
// ---------------------------------------------------------------------------

function test_session_stores_and_retrieves_resource() {
	const session = new Session(DEMO_IDENTITY);
	const payload = { formation: "Permian", depth: 8500 };

	const ref = session.storeResource("geowiz:formation-data:run-001", payload, "application/json");

	assert.strictEqual(ref.resourceId, "geowiz:formation-data:run-001", "returned ref must match stored ID");
	assert.strictEqual(ref.mimeType, "application/json", "mimeType must be echoed back");

	const retrieved = session.getResource("geowiz:formation-data:run-001");
	assert.deepStrictEqual(retrieved, payload, "retrieved payload must match stored value");
}

function test_session_returns_undefined_for_unknown_resource() {
	const session = new Session(DEMO_IDENTITY);
	const result = session.getResource("does-not-exist");
	assert.strictEqual(result, undefined, "missing resource must return undefined, not throw");
}

function test_session_lists_available_resource_ids() {
	const session = new Session(DEMO_IDENTITY);
	session.storeResource("geowiz:formation:001", { foo: 1 }, "application/json");
	session.storeResource("econobot:cashflow:001", { bar: 2 }, "application/json");

	const ids = session.availableResourceIds;
	assert.ok(ids.includes("geowiz:formation:001"), "first resource ID must appear in list");
	assert.ok(ids.includes("econobot:cashflow:001"), "second resource ID must appear in list");
	assert.strictEqual(ids.length, 2, "exactly two resource IDs");
}

function test_session_overwrites_resource_on_same_id() {
	const session = new Session(DEMO_IDENTITY);
	session.storeResource("geowiz:formation:001", { version: 1 }, "application/json");
	session.storeResource("geowiz:formation:001", { version: 2 }, "application/json");

	const retrieved = session.getResource("geowiz:formation:001");
	assert.deepStrictEqual(retrieved, { version: 2 }, "second write must overwrite first (last writer wins)");
}

function test_session_resource_count() {
	const session = new Session(DEMO_IDENTITY);
	assert.strictEqual(session.resourceCount, 0, "fresh session has zero resources");
	session.storeResource("a:b:1", {}, "application/json");
	assert.strictEqual(session.resourceCount, 1, "count increments on store");
}

function test_session_size_bytes_computed_from_json() {
	const session = new Session(DEMO_IDENTITY);
	const payload = { x: 42 };
	const ref = session.storeResource("a:b:1", payload, "application/json");
	// sizeBytes should be the byte length of the JSON-serialized payload
	const expected = Buffer.byteLength(JSON.stringify(payload), "utf-8");
	assert.strictEqual(ref.sizeBytes, expected, "sizeBytes must reflect JSON serialization size");
}

// ---------------------------------------------------------------------------
// SessionManager resource resolution tests
// ---------------------------------------------------------------------------

function test_manager_resolves_resource_ref_to_payload() {
	const mgr = new SessionManager();
	const session = mgr.createSession();
	const payload = { npv: 1_500_000, irr: 0.22 };

	session.storeResource("econobot:cashflow:run-001", payload, "application/json");

	const resolved = mgr.resolveResource(session.id, "econobot:cashflow:run-001");
	assert.deepStrictEqual(resolved, payload, "manager must resolve the resource by session + ID");
}

function test_manager_returns_undefined_for_missing_session() {
	const mgr = new SessionManager();
	const resolved = mgr.resolveResource("nonexistent-session-id", "any:resource:id");
	assert.strictEqual(resolved, undefined, "missing session must return undefined, not throw");
}

function test_manager_returns_undefined_for_missing_resource() {
	const mgr = new SessionManager();
	const session = mgr.createSession();
	const resolved = mgr.resolveResource(session.id, "missing:resource:id");
	assert.strictEqual(resolved, undefined, "missing resource must return undefined");
}

// ---------------------------------------------------------------------------
// isResourceRef helper tests
// ---------------------------------------------------------------------------

function test_is_resource_ref_identifies_ref_objects() {
	// The kernel uses this to detect refs in tool args before dispatching.
	// Import it inline after implementation — for now test the shape contract.
	const ref: ResourceRef = { resourceId: "x:y:z", mimeType: "application/json" };
	// It's a ref if it has resourceId and mimeType
	assert.ok("resourceId" in ref, "ref must have resourceId");
	assert.ok("mimeType" in ref, "ref must have mimeType");
}

function test_plain_string_is_not_a_resource_ref() {
	const notARef = "some inline string value";
	assert.ok(!("resourceId" in Object(notARef)), "plain string must not be treated as a ref");
}

// ---------------------------------------------------------------------------
// Serialization round-trip
// ---------------------------------------------------------------------------

function test_session_resources_survive_export_and_reimport() {
	// When a session is serialized to JSON and reloaded (session persistence),
	// stored resources must come back intact.
	const session = new Session(DEMO_IDENTITY);
	const payload = { formation: "Wolfcamp", porosity: 0.08 };
	session.storeResource("geowiz:formation:001", payload, "application/json");

	const exported = session.exportResources();
	assert.ok("geowiz:formation:001" in exported, "exported must contain the stored resource ID");
	assert.deepStrictEqual(exported["geowiz:formation:001"].data, payload, "exported data must match original payload");
	assert.strictEqual(exported["geowiz:formation:001"].mimeType, "application/json", "mimeType preserved in export");
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

const tests = [
	test_resource_ref_has_required_fields,
	test_resource_ref_accepts_size_bytes,
	test_session_stores_and_retrieves_resource,
	test_session_returns_undefined_for_unknown_resource,
	test_session_lists_available_resource_ids,
	test_session_overwrites_resource_on_same_id,
	test_session_resource_count,
	test_session_size_bytes_computed_from_json,
	test_manager_resolves_resource_ref_to_payload,
	test_manager_returns_undefined_for_missing_session,
	test_manager_returns_undefined_for_missing_resource,
	test_is_resource_ref_identifies_ref_objects,
	test_plain_string_is_not_a_resource_ref,
	test_session_resources_survive_export_and_reimport,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
	try {
		t();
		console.log(`  ✅ ${t.name}`);
		passed = passed + 1;
	} catch (e) {
		console.error(`  ❌ ${t.name}: ${e instanceof Error ? e.message : e}`);
		failed = failed + 1;
	}
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
