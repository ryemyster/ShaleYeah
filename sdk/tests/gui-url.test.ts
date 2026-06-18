/**
 * TDD — Issue #458: GUI URL (Arcade #33)
 *
 * Tests for ToolResponseEnvelope<T> and wrapWithGuiUrl().
 * Written before implementation — all cases start red.
 */

import assert from "node:assert";
import { wrapWithGuiUrl } from "../src/types.js";

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
// Envelope passthrough — no DASHBOARD_BASE_URL
// ---------------------------------------------------------------------------

const savedUrl = process.env.DASHBOARD_BASE_URL;

await test("no env var → returns data directly (no envelope)", () => {
	delete process.env.DASHBOARD_BASE_URL;
	const data = { npv: 1_000_000 };
	const result = wrapWithGuiUrl(data, "economics");
	assert.strictEqual(result, data, "should return the same object reference");
	assert.ok(!("viewUrl" in result), "should not add viewUrl when env var is absent");
});

await test("no env var → returns data with no viewLabel", () => {
	delete process.env.DASHBOARD_BASE_URL;
	const data = { risk: "low" };
	const result = wrapWithGuiUrl(data, "risk") as Record<string, unknown>;
	assert.ok(!("viewLabel" in result), "should not add viewLabel when env var is absent");
});

// ---------------------------------------------------------------------------
// Envelope wrapping — DASHBOARD_BASE_URL set
// ---------------------------------------------------------------------------

await test("env var set → wraps in ToolResponseEnvelope", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const data = { formationQuality: "good" };
	const result = wrapWithGuiUrl(data, "formations") as { data: typeof data; viewUrl: string; viewLabel: string };
	assert.ok("data" in result, "envelope must have data field");
	assert.strictEqual(result.data, data, "data must be the original object");
});

await test("env var set → viewUrl is base + path", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const result = wrapWithGuiUrl({ x: 1 }, "formations") as { viewUrl: string };
	assert.strictEqual(result.viewUrl, "https://dash.example.com/formations");
});

await test("env var with trailing slash → viewUrl has no double slash", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com/";
	const result = wrapWithGuiUrl({ x: 1 }, "risk") as { viewUrl: string };
	assert.strictEqual(result.viewUrl, "https://dash.example.com/risk");
});

await test("path with leading slash → viewUrl has no double slash", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const result = wrapWithGuiUrl({ x: 1 }, "/economics") as { viewUrl: string };
	assert.strictEqual(result.viewUrl, "https://dash.example.com/economics");
});

await test("default label is 'View in Dashboard'", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const result = wrapWithGuiUrl({ x: 1 }, "formations") as { viewLabel: string };
	assert.strictEqual(result.viewLabel, "View in Dashboard");
});

await test("custom label overrides default", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const result = wrapWithGuiUrl({ x: 1 }, "risk", "Open Risk Report") as { viewLabel: string };
	assert.strictEqual(result.viewLabel, "Open Risk Report");
});

await test("works with array data", () => {
	process.env.DASHBOARD_BASE_URL = "https://dash.example.com";
	const data = [1, 2, 3];
	const result = wrapWithGuiUrl(data, "economics") as { data: number[] };
	assert.deepStrictEqual(result.data, [1, 2, 3]);
});

// Restore env
process.env.DASHBOARD_BASE_URL = savedUrl ?? "";
if (!savedUrl) delete process.env.DASHBOARD_BASE_URL;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
