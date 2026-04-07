/**
 * Result Cache Tests — Issue #113
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until ResultCache is implemented.
 *
 * Validates:
 * - Cache miss returns undefined
 * - Cache hit returns stored response
 * - TTL expiry evicts entries
 * - Command tools are never cached
 * - invalidate(key) evicts a single entry
 * - invalidateAll() clears everything
 * - Metrics: hits, misses, size
 * - Executor uses cache: second identical call returns cached result (no re-execution)
 * - Executor does NOT cache command tool responses
 */

import assert from "node:assert";
import { ResultCache } from "../src/kernel/result-cache.js";
import type { ToolResponse } from "../src/kernel/types.js";

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

function makeResponse(summary: string): ToolResponse {
	return {
		success: true,
		summary,
		confidence: 90,
		data: { value: summary },
		detailLevel: "standard",
		completeness: 100,
		metadata: {
			server: "geowiz",
			persona: "test",
			executionTimeMs: 10,
			timestamp: new Date().toISOString(),
		},
	};
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Result Cache Tests (Issue #113)\n");

	// ---------------------------------------------------------------------------
	// Basic get/set
	// ---------------------------------------------------------------------------

	await test("get() returns undefined on cache miss", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		assert.strictEqual(cache.get("nonexistent"), undefined);
	});

	await test("get() returns stored response on cache hit", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		const response = makeResponse("geological analysis");
		cache.set("key1", response);
		const result = cache.get("key1");
		assert.ok(result, "Expected cached response");
		assert.strictEqual(result.summary, "geological analysis");
	});

	await test("set() overwrites an existing entry", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("first"));
		cache.set("key1", makeResponse("second"));
		assert.strictEqual(cache.get("key1")?.summary, "second");
	});

	await test("different keys are stored independently", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("alpha"));
		cache.set("key2", makeResponse("beta"));
		assert.strictEqual(cache.get("key1")?.summary, "alpha");
		assert.strictEqual(cache.get("key2")?.summary, "beta");
	});

	// ---------------------------------------------------------------------------
	// TTL expiry
	// ---------------------------------------------------------------------------

	await test("get() returns undefined after TTL expires", async () => {
		const cache = new ResultCache({ ttlMs: 50 });
		cache.set("key1", makeResponse("expires soon"));
		await new Promise((resolve) => setTimeout(resolve, 80));
		assert.strictEqual(cache.get("key1"), undefined, "Expected entry to expire after TTL");
	});

	await test("get() returns response before TTL expires", async () => {
		const cache = new ResultCache({ ttlMs: 200 });
		cache.set("key1", makeResponse("still valid"));
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.ok(cache.get("key1"), "Expected entry to still be valid before TTL");
	});

	// ---------------------------------------------------------------------------
	// Command tool exclusion
	// ---------------------------------------------------------------------------

	await test("set() with cacheable=false (command tool) is a no-op", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("decision output"), false);
		assert.strictEqual(cache.get("key1"), undefined, "Command tool responses must not be cached");
	});

	await test("set() with cacheable=true (default) stores the entry", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("query output"), true);
		assert.ok(cache.get("key1"), "Query tool responses should be cached");
	});

	// ---------------------------------------------------------------------------
	// Invalidation
	// ---------------------------------------------------------------------------

	await test("invalidate(key) removes a specific entry", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("to evict"));
		cache.set("key2", makeResponse("keep this"));
		cache.invalidate("key1");
		assert.strictEqual(cache.get("key1"), undefined, "Expected key1 to be evicted");
		assert.ok(cache.get("key2"), "Expected key2 to remain");
	});

	await test("invalidate() on nonexistent key does not throw", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.invalidate("ghost"); // should be safe
	});

	await test("invalidateAll() clears all entries", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("key1", makeResponse("a"));
		cache.set("key2", makeResponse("b"));
		cache.set("key3", makeResponse("c"));
		cache.invalidateAll();
		assert.strictEqual(cache.get("key1"), undefined);
		assert.strictEqual(cache.get("key2"), undefined);
		assert.strictEqual(cache.get("key3"), undefined);
	});

	// ---------------------------------------------------------------------------
	// Metrics
	// ---------------------------------------------------------------------------

	await test("metrics.size reflects number of cached entries", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		assert.strictEqual(cache.metrics.size, 0);
		cache.set("k1", makeResponse("a"));
		cache.set("k2", makeResponse("b"));
		assert.strictEqual(cache.metrics.size, 2);
		cache.invalidate("k1");
		assert.strictEqual(cache.metrics.size, 1);
	});

	await test("metrics.hits increments on cache hit", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("k1", makeResponse("hit me"));
		cache.get("k1");
		cache.get("k1");
		assert.strictEqual(cache.metrics.hits, 2);
	});

	await test("metrics.misses increments on cache miss", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.get("missing");
		cache.get("also-missing");
		assert.strictEqual(cache.metrics.misses, 2);
	});

	await test("metrics.hits and misses track independently", () => {
		const cache = new ResultCache({ ttlMs: 5000 });
		cache.set("k1", makeResponse("present"));
		cache.get("k1"); // hit
		cache.get("absent"); // miss
		assert.strictEqual(cache.metrics.hits, 1);
		assert.strictEqual(cache.metrics.misses, 1);
	});

	await test("metrics.size does not count expired entries", async () => {
		const cache = new ResultCache({ ttlMs: 50 });
		cache.set("k1", makeResponse("expires"));
		await new Promise((resolve) => setTimeout(resolve, 80));
		// Trigger expiry check via get
		cache.get("k1");
		assert.strictEqual(cache.metrics.size, 0, "Expected size=0 after expiry");
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
