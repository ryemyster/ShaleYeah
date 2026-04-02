/**
 * Session Persistence Tests — Issue #114
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until SessionStorageBackend is implemented.
 *
 * Validates:
 * - SessionStorageBackend interface: save, load, loadAll, delete
 * - FileSessionStorage: persists sessions to JSON files
 * - FileSessionStorage: loads existing sessions from disk
 * - FileSessionStorage: loadAll recovers all sessions on startup
 * - FileSessionStorage: delete removes the file
 * - SessionManager with backend: auto-saves on createSession
 * - SessionManager with backend: auto-saves on storeResult (via touch)
 * - SessionManager with backend: auto-deletes on destroySession
 * - SessionManager with backend: recoverSessions() restores sessions from storage
 * - SessionManager without backend: behaves identically to current in-memory behavior
 */

import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStorage, SessionManager } from "../src/kernel/context.js";
import type { UserIdentity } from "../src/kernel/types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			console.log(`  ✓ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

const TEST_IDENTITY: UserIdentity = {
	userId: "test-user",
	role: "analyst",
	permissions: ["read:analysis"],
	organization: "Test Org",
	displayName: "Test User",
};

function makeTempDir(): string {
	const dir = join(tmpdir(), `shale-sessions-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Session Persistence Tests (Issue #114)\n");

	// ---------------------------------------------------------------------------
	// FileSessionStorage — basic save/load/delete
	// ---------------------------------------------------------------------------

	await test("FileSessionStorage: save() persists session to disk", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager();
		const session = mgr.createSession(TEST_IDENTITY);
		await storage.save(session);
		const loaded = await storage.load(session.id);
		assert.ok(loaded, "Expected session to be loaded from disk");
		assert.strictEqual(loaded.id, session.id);
		assert.strictEqual(loaded.identity.userId, "test-user");
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: load() returns undefined for unknown id", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const result = await storage.load("nonexistent-id");
		assert.strictEqual(result, undefined);
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: delete() removes session file", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager();
		const session = mgr.createSession(TEST_IDENTITY);
		await storage.save(session);
		await storage.delete(session.id);
		const loaded = await storage.load(session.id);
		assert.strictEqual(loaded, undefined, "Expected file to be deleted");
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: loadAll() returns all saved sessions", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager();
		const s1 = mgr.createSession(TEST_IDENTITY);
		const s2 = mgr.createSession({ ...TEST_IDENTITY, userId: "user-2" });
		await storage.save(s1);
		await storage.save(s2);
		const all = await storage.loadAll();
		assert.strictEqual(all.length, 2);
		const ids = all.map((s) => s.id);
		assert.ok(ids.includes(s1.id));
		assert.ok(ids.includes(s2.id));
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: loadAll() returns empty array if directory is empty", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const all = await storage.loadAll();
		assert.deepStrictEqual(all, []);
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: save() preserves stored results", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager();
		const session = mgr.createSession(TEST_IDENTITY);
		session.storeResult("geo-analysis", {
			success: true,
			summary: "Formation looks good",
			confidence: 88,
			data: { formation: "Wolfcamp" },
			detailLevel: "standard",
			completeness: 100,
			metadata: {
				server: "geowiz",
				persona: "test",
				executionTimeMs: 10,
				timestamp: new Date().toISOString(),
			},
		});
		await storage.save(session);
		const loaded = await storage.load(session.id);
		assert.ok(loaded, "Expected session to load");
		assert.ok(loaded.availableResults.includes("geo-analysis"), "Expected stored result key to survive round-trip");
		rmSync(dir, { recursive: true });
	});

	await test("FileSessionStorage: creates storage directory if it does not exist", async () => {
		const dir = join(tmpdir(), `shale-sessions-new-${randomUUID()}`, "nested");
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager();
		const session = mgr.createSession(TEST_IDENTITY);
		await storage.save(session);
		const loaded = await storage.load(session.id);
		assert.ok(loaded, "Expected session to be saved even when dir didn't exist");
		rmSync(join(tmpdir(), dir.split("/").at(-2)!), { recursive: true });
	});

	// ---------------------------------------------------------------------------
	// SessionManager with storage backend
	// ---------------------------------------------------------------------------

	await test("SessionManager: createSession() auto-saves to backend", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager(storage);
		const session = mgr.createSession(TEST_IDENTITY);
		// Fire-and-forget save — flush the microtask queue
		await new Promise((r) => setTimeout(r, 20));
		const loaded = await storage.load(session.id);
		assert.ok(loaded, "Expected session to be auto-saved after createSession");
		rmSync(dir, { recursive: true });
	});

	await test("SessionManager: destroySession() auto-deletes from backend", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr = new SessionManager(storage);
		const session = mgr.createSession(TEST_IDENTITY);
		await new Promise((r) => setTimeout(r, 20));
		mgr.destroySession(session.id);
		await new Promise((r) => setTimeout(r, 20));
		const loaded = await storage.load(session.id);
		assert.strictEqual(loaded, undefined, "Expected session to be deleted from storage");
		rmSync(dir, { recursive: true });
	});

	await test("SessionManager: recoverSessions() restores sessions from backend", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);

		// First manager: create and save sessions (fire-and-forget, flush with timeout)
		const mgr1 = new SessionManager(storage);
		const s1 = mgr1.createSession(TEST_IDENTITY);
		const s2 = mgr1.createSession({ ...TEST_IDENTITY, userId: "user-b" });
		await new Promise((r) => setTimeout(r, 20));

		// Second manager: recover from same storage
		const mgr2 = new SessionManager(storage);
		await mgr2.recoverSessions();

		assert.ok(mgr2.getSession(s1.id), "Expected session 1 to be recovered");
		assert.ok(mgr2.getSession(s2.id), "Expected session 2 to be recovered");
		assert.strictEqual(mgr2.sessionCount, 2);
		rmSync(dir, { recursive: true });
	});

	await test("SessionManager: recoverSessions() preserves session identity", async () => {
		const dir = makeTempDir();
		const storage = new FileSessionStorage(dir);
		const mgr1 = new SessionManager(storage);
		const original = mgr1.createSession(TEST_IDENTITY);
		await new Promise((r) => setTimeout(r, 20));

		const mgr2 = new SessionManager(storage);
		await mgr2.recoverSessions();
		const recovered = mgr2.getSession(original.id);
		assert.ok(recovered, "Expected session to be recovered");
		assert.strictEqual(recovered.identity.userId, "test-user");
		assert.strictEqual(recovered.identity.role, "analyst");
		rmSync(dir, { recursive: true });
	});

	await test("SessionManager: recoverSessions() is a no-op with no backend", async () => {
		const mgr = new SessionManager();
		await mgr.recoverSessions(); // should not throw
		assert.strictEqual(mgr.sessionCount, 0);
	});

	// ---------------------------------------------------------------------------
	// Backward compatibility — no backend behaves identically to before
	// ---------------------------------------------------------------------------

	await test("SessionManager without backend: createSession returns synchronously-compatible value", () => {
		const mgr = new SessionManager();
		const session = mgr.createSession(TEST_IDENTITY);
		assert.ok(session.id, "Expected session to have an id");
		assert.strictEqual(session.identity.userId, "test-user");
	});

	await test("SessionManager without backend: all in-memory operations still work", () => {
		const mgr = new SessionManager();
		const s = mgr.createSession(TEST_IDENTITY);
		assert.strictEqual(mgr.sessionCount, 1);
		assert.ok(mgr.getSession(s.id));
		mgr.destroySession(s.id);
		assert.strictEqual(mgr.sessionCount, 0);
	});

	// ---------------------------------------------------------------------------
	// Summary
	// ---------------------------------------------------------------------------

	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
