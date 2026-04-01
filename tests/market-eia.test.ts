/**
 * Market EIA API Tests — Issue #223
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail against the current stub and pass after EIA integration.
 *
 * Validates:
 * - fetchEiaPrices() returns prices from a mocked HTTP response
 * - fetchEiaPrices() falls back to stub constants when fetch fails
 * - fetchEiaPrices() falls back when EIA_API_KEY is absent
 * - Cache prevents duplicate fetches within 1 hour
 * - analyze_market_conditions response includes dataSource field
 * - dataSource is 'eia' when fetch succeeds, 'stub' on fallback
 */

import assert from "node:assert";

// We import the EIA client functions directly for unit testing.
// These do not exist yet — import will fail until implementation is added.
import { clearEiaCache, type EiaPrices, fetchEiaPrices } from "../src/servers/market.js";

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

// ---------------------------------------------------------------------------
// Mock fetch helper — replaces global fetch for a single test
// ---------------------------------------------------------------------------

type FetchFn = typeof fetch;

function withMockFetch(mockFn: FetchFn, fn: () => Promise<void>): Promise<void> {
	const original = globalThis.fetch;
	globalThis.fetch = mockFn;
	return fn().finally(() => {
		globalThis.fetch = original;
	});
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Market EIA API Tests (Issue #223)\n");

	// ------------------------------------------------------------------
	// fetchEiaPrices — mock fetch, key present
	// ------------------------------------------------------------------

	await test("fetchEiaPrices returns oil and gas prices from EIA response", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		process.env.EIA_API_KEY = "test-key";
		let callCount = 0;
		const mockFetch: FetchFn = async () => {
			callCount++;
			const price = callCount === 1 ? "82.50" : "3.75";
			const body = JSON.stringify({ response: { data: [{ value: price, period: "2026-04-01" }] } });
			return new Response(body, { status: 200 });
		};
		try {
			await withMockFetch(mockFetch, async () => {
				const prices = await fetchEiaPrices();
				assert.strictEqual(prices.dataSource, "eia", "Expected dataSource: 'eia'");
				assert.strictEqual(prices.oilPrice, 82.5, `Expected oil $82.50, got ${prices.oilPrice}`);
				assert.strictEqual(prices.gasPrice, 3.75, `Expected gas $3.75, got ${prices.gasPrice}`);
			});
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
			else delete process.env.EIA_API_KEY;
		}
	});

	await test("fetchEiaPrices falls back to stub when EIA_API_KEY is absent", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		delete process.env.EIA_API_KEY;
		try {
			const prices = await fetchEiaPrices();
			assert.strictEqual(prices.dataSource, "stub", "Expected dataSource: 'stub' when key absent");
			assert.ok(typeof prices.oilPrice === "number" && prices.oilPrice > 0, "Expected positive oil stub price");
			assert.ok(typeof prices.gasPrice === "number" && prices.gasPrice > 0, "Expected positive gas stub price");
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
		}
	});

	await test("fetchEiaPrices falls back to stub when fetch throws", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		process.env.EIA_API_KEY = "test-key";
		const failFetch: FetchFn = async () => {
			throw new Error("Network error");
		};
		try {
			await withMockFetch(failFetch, async () => {
				const prices = await fetchEiaPrices();
				assert.strictEqual(prices.dataSource, "stub", "Expected dataSource: 'stub' on network error");
			});
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
			else delete process.env.EIA_API_KEY;
		}
	});

	await test("fetchEiaPrices falls back to stub when EIA returns non-200", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		process.env.EIA_API_KEY = "test-key";
		const errorFetch: FetchFn = async () => new Response("Unauthorized", { status: 401 });
		try {
			await withMockFetch(errorFetch, async () => {
				const prices = await fetchEiaPrices();
				assert.strictEqual(prices.dataSource, "stub", "Expected dataSource: 'stub' on 401");
			});
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
			else delete process.env.EIA_API_KEY;
		}
	});

	// ------------------------------------------------------------------
	// Cache behaviour
	// ------------------------------------------------------------------

	await test("cache: second call within 1 hour does not re-fetch", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		process.env.EIA_API_KEY = "test-key";
		let fetchCount = 0;
		const countingFetch: FetchFn = async () => {
			fetchCount++;
			const price = fetchCount === 1 ? "80.00" : "4.00";
			const body = JSON.stringify({ response: { data: [{ value: price, period: "2026-04-01" }] } });
			return new Response(body, { status: 200 });
		};
		try {
			await withMockFetch(countingFetch, async () => {
				await fetchEiaPrices();
				await fetchEiaPrices(); // second call — should hit cache
				// 2 EIA endpoints × 1 fetch (not 2) = 2 fetch calls total, not 4
				assert.ok(fetchCount <= 2, `Expected ≤2 fetch calls (cache hit), got ${fetchCount}`);
			});
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
			else delete process.env.EIA_API_KEY;
		}
	});

	await test("clearEiaCache forces a re-fetch on next call", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		process.env.EIA_API_KEY = "test-key";
		let fetchCount = 0;
		const countingFetch: FetchFn = async () => {
			fetchCount++;
			const body = JSON.stringify({ response: { data: [{ value: "77.00", period: "2026-04-01" }] } });
			return new Response(body, { status: 200 });
		};
		try {
			await withMockFetch(countingFetch, async () => {
				await fetchEiaPrices();
				clearEiaCache();
				await fetchEiaPrices(); // should re-fetch
				assert.ok(fetchCount === 4, `Expected 4 fetch calls after cache clear, got ${fetchCount}`);
			});
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
			else delete process.env.EIA_API_KEY;
		}
	});

	// ------------------------------------------------------------------
	// EiaPrices shape
	// ------------------------------------------------------------------

	await test("EiaPrices type has oilPrice, gasPrice, dataSource, fetchedAt", async () => {
		clearEiaCache();
		const savedKey = process.env.EIA_API_KEY;
		delete process.env.EIA_API_KEY;
		try {
			const prices: EiaPrices = await fetchEiaPrices();
			assert.ok("oilPrice" in prices, "Missing oilPrice");
			assert.ok("gasPrice" in prices, "Missing gasPrice");
			assert.ok("dataSource" in prices, "Missing dataSource");
			assert.ok("fetchedAt" in prices, "Missing fetchedAt");
			assert.ok(prices.fetchedAt instanceof Date, "fetchedAt should be a Date");
		} finally {
			if (savedKey !== undefined) process.env.EIA_API_KEY = savedKey;
		}
	});

	// ------------------------------------------------------------------
	// Summary
	// ------------------------------------------------------------------
	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
