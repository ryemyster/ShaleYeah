/**
 * Tests for identifier normalization and fuzzy matching — Arcade #42
 *
 * All tests fail until sdk/src/identifier.ts is implemented and exported
 * from @shaleyeah/sdk. Covers: normalizeIdentifier, editDistance, fuzzyMatch.
 */

import assert from "node:assert";
import { test } from "node:test";
import { fuzzyMatch, normalizeIdentifier } from "../src/identifier.js";

// --- normalizeIdentifier ---

test("normalizeIdentifier — lowercases input", () => {
	assert.strictEqual(normalizeIdentifier("Permian Basin"), "permian-basin");
});

test("normalizeIdentifier — replaces punctuation and spaces with hyphens", () => {
	assert.strictEqual(normalizeIdentifier("Permian Basin #1A"), "permian-basin-1a");
});

test("normalizeIdentifier — collapses multiple separators to one hyphen", () => {
	assert.strictEqual(normalizeIdentifier("Permian--Basin  1A"), "permian-basin-1a");
});

test("normalizeIdentifier — strips leading/trailing hyphens", () => {
	assert.strictEqual(normalizeIdentifier("#1A#"), "1a");
});

test("normalizeIdentifier — handles already-normalized input unchanged", () => {
	assert.strictEqual(normalizeIdentifier("permian-basin-1a"), "permian-basin-1a");
});

test("normalizeIdentifier — case and punctuation variants normalize identically", () => {
	// normalizeIdentifier handles case and punctuation; "No." is a semantic abbreviation
	// that requires fuzzy matching, not simple normalization.
	const a = normalizeIdentifier("permian basin #1A");
	const b = normalizeIdentifier("Permian-Basin-1a");
	assert.strictEqual(a, b, "case/punctuation variants must normalize to the same string");
});

test("normalizeIdentifier — 'No.' abbreviation becomes 'no' slug segment (fuzzy matching bridges the gap)", () => {
	// "Permian Basin No. 1-A" → "permian-basin-no-1-a" is correct slug behavior.
	// Callers use fuzzyMatch to bridge "no-1-a" vs "1a" — not the normalizer's job.
	assert.strictEqual(normalizeIdentifier("Permian Basin No. 1-A"), "permian-basin-no-1-a");
});

// --- fuzzyMatch ---

test("fuzzyMatch — exact match returns score 1.0", () => {
	const results = fuzzyMatch("permian-basin", ["permian-basin", "wolfcamp", "delaware-basin"]);
	assert.ok(results.length > 0, "must return at least one result");
	const top = results[0];
	assert.strictEqual(top.value, "permian-basin");
	assert.strictEqual(top.score, 1.0);
});

test("fuzzyMatch — close match is returned above default threshold", () => {
	// "permian-basn" vs "permian-basin" — one character off, should still match
	const results = fuzzyMatch("permian-basn", ["permian-basin", "wolfcamp"], 0.7);
	assert.ok(results.length > 0, "close match must be returned above 0.7 threshold");
	assert.strictEqual(results[0].value, "permian-basin");
});

test("fuzzyMatch — below-threshold candidate is excluded", () => {
	// "wolfcamp" vs "permian-basin" — completely different, must not appear at 0.8 threshold
	const results = fuzzyMatch("wolfcamp", ["permian-basin"], 0.8);
	assert.strictEqual(results.length, 0, "no match should be returned below threshold");
});

test("fuzzyMatch — returns candidates sorted by score descending", () => {
	const results = fuzzyMatch("permian-basin", ["permian-basin", "permian-bason", "wolfcamp"], 0.5);
	for (let i = 1; i < results.length; i++) {
		assert.ok(
			results[i - 1].score >= results[i].score,
			`results must be sorted descending: index ${i - 1} score ${results[i - 1].score} < index ${i} score ${results[i].score}`,
		);
	}
});

test("fuzzyMatch — empty candidates returns empty array", () => {
	const results = fuzzyMatch("anything", []);
	assert.deepStrictEqual(results, []);
});

test("fuzzyMatch — default threshold is 0.8 (excludes low-similarity candidates)", () => {
	// "abc" vs "xyz" — similarity well below 0.8
	const results = fuzzyMatch("abc", ["xyz"]);
	assert.strictEqual(results.length, 0, "low-similarity match must be excluded at default threshold 0.8");
});

test("fuzzyMatch — threshold 0 returns all candidates", () => {
	const candidates = ["permian-basin", "wolfcamp", "delaware-basin"];
	const results = fuzzyMatch("anything", candidates, 0);
	assert.strictEqual(results.length, candidates.length, "threshold 0 must return all candidates");
});
