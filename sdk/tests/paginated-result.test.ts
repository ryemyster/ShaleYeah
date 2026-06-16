/**
 * Tests for PaginatedResult — Arcade #31
 *
 * Covers cursor encoding/decoding and paginateArray behaviour: correct slicing,
 * hasMore flag, cursor propagation across pages, and edge cases.
 */

import assert from "node:assert";
import { test } from "node:test";
import { decodeCursor, encodeCursor, type PaginatedResult, paginateArray } from "../src/types.js";

test("encodeCursor/decodeCursor round-trip preserves offset", () => {
	for (const offset of [0, 1, 10, 25, 100, 9999]) {
		assert.strictEqual(decodeCursor(encodeCursor(offset)), offset, `round-trip failed for offset ${offset}`);
	}
});

test("decodeCursor on garbage input returns 0 (safe default)", () => {
	// Malformed cursors must not crash or produce negative offsets.
	assert.strictEqual(decodeCursor("not-valid"), 0);
	assert.strictEqual(decodeCursor(""), 0);
});

test("paginateArray — page 1 of large array returns hasMore: true with cursor", () => {
	const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
	const page1: PaginatedResult<{ id: number }> = paginateArray(items, { pageSize: 10 });
	assert.strictEqual(page1.data.length, 10);
	assert.strictEqual(page1.hasMore, true);
	assert.strictEqual(page1.totalCount, 30);
	assert.ok(page1.cursor, "cursor must be present when hasMore is true");
	assert.deepStrictEqual(page1.data[0], { id: 0 });
	assert.deepStrictEqual(page1.data[9], { id: 9 });
});

test("paginateArray — cursor from page 1 retrieves correct page 2", () => {
	const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
	const page1 = paginateArray(items, { pageSize: 10 });
	assert.ok(page1.cursor, "page 1 must have cursor");
	const page2 = paginateArray(items, { pageSize: 10, cursor: page1.cursor });
	assert.strictEqual(page2.data.length, 10);
	assert.deepStrictEqual(page2.data[0], { id: 10 });
	assert.deepStrictEqual(page2.data[9], { id: 19 });
	assert.strictEqual(page2.hasMore, true);
});

test("paginateArray — cursor from page 2 retrieves correct page 3 (last page)", () => {
	const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
	const page1 = paginateArray(items, { pageSize: 10 });
	const page2 = paginateArray(items, { pageSize: 10, cursor: page1.cursor });
	const page3 = paginateArray(items, { pageSize: 10, cursor: page2.cursor });
	assert.strictEqual(page3.data.length, 10);
	assert.deepStrictEqual(page3.data[0], { id: 20 });
	assert.strictEqual(page3.hasMore, false);
	assert.strictEqual(page3.cursor, undefined, "no cursor on final page");
});

test("paginateArray — partial last page returns remaining items", () => {
	const items = Array.from({ length: 25 }, (_, i) => i);
	const page1 = paginateArray(items, { pageSize: 10 });
	const page2 = paginateArray(items, { pageSize: 10, cursor: page1.cursor! });
	const page3 = paginateArray(items, { pageSize: 10, cursor: page2.cursor! });
	assert.strictEqual(page3.data.length, 5, "last page has 5 remaining items");
	assert.strictEqual(page3.hasMore, false);
});

test("paginateArray — small array fits in one page (hasMore: false, no cursor)", () => {
	const items = [{ a: 1 }, { a: 2 }, { a: 3 }];
	const result = paginateArray(items, { pageSize: 25 });
	assert.strictEqual(result.data.length, 3);
	assert.strictEqual(result.hasMore, false);
	assert.strictEqual(result.cursor, undefined);
	assert.strictEqual(result.totalCount, 3);
});

test("paginateArray — empty array returns empty result without cursor", () => {
	const result = paginateArray([], { pageSize: 10 });
	assert.strictEqual(result.data.length, 0);
	assert.strictEqual(result.hasMore, false);
	assert.strictEqual(result.totalCount, 0);
	assert.strictEqual(result.cursor, undefined);
});

test("paginateArray — no options uses default pageSize of 25", () => {
	const items = Array.from({ length: 30 }, (_, i) => i);
	const result = paginateArray(items, {});
	assert.strictEqual(result.data.length, 25, "default pageSize is 25");
	assert.strictEqual(result.hasMore, true);
});

test("paginateArray — pageSize clamped to max 100", () => {
	const items = Array.from({ length: 200 }, (_, i) => i);
	const result = paginateArray(items, { pageSize: 999 });
	assert.ok(result.data.length <= 100, "pageSize must not exceed 100");
});

test("paginateArray — pageSize clamped to min 1", () => {
	const items = [1, 2, 3];
	const result = paginateArray(items, { pageSize: 0 });
	assert.strictEqual(result.data.length, 1, "pageSize must be at least 1");
});
