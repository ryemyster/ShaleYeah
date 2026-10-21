/**
 * SDK Performance Hints — Arcade Pattern #10
 *
 * Verifies that AgentToolManifestSchema accepts estimatedLatencyMs and complexity
 * fields, and rejects out-of-range values.
 */

import assert from "node:assert";
import { AgentToolManifestSchema } from "../src/contracts.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`  ✅ ${name}`);
		passed++;
	} catch (err) {
		console.error(`  ❌ ${name}`);
		console.error(`     ${err instanceof Error ? err.message : String(err)}`);
		failed++;
	}
}

const baseToolFields = {
	name: "test.tool",
	description: "A test tool",
	type: "query" as const,
	capabilities: ["test"],
	inputSchema: { type: "object" as const, properties: {}, required: [] },
	readOnly: true,
	destructive: false,
	requiresHumanApproval: false,
	requiredScopes: ["read:test"],
	modelRequirement: "deterministic" as const,
};

console.log("🧪 Arcade #10: Performance Hints — Schema Tests\n");

console.log("📋 estimatedLatencyMs field...");
{
	test("accepts tool without estimatedLatencyMs (optional)", () => {
		const result = AgentToolManifestSchema.safeParse(baseToolFields);
		assert.ok(result.success, `Expected success, got: ${!result.success ? JSON.stringify(result.error.format()) : ""}`);
	});

	test("accepts tool with valid estimatedLatencyMs", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			estimatedLatencyMs: { p50: 200, p95: 800 },
		});
		assert.ok(result.success, `Expected success, got: ${!result.success ? JSON.stringify(result.error.format()) : ""}`);
	});

	test("rejects estimatedLatencyMs with zero p50", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			estimatedLatencyMs: { p50: 0, p95: 800 },
		});
		assert.ok(!result.success, "Expected failure for zero p50");
	});

	test("rejects estimatedLatencyMs with negative p95", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			estimatedLatencyMs: { p50: 200, p95: -1 },
		});
		assert.ok(!result.success, "Expected failure for negative p95");
	});

	test("rejects estimatedLatencyMs with float p50", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			estimatedLatencyMs: { p50: 200.5, p95: 800 },
		});
		assert.ok(!result.success, "Expected failure for non-integer p50");
	});
}

console.log("\n📋 complexity field...");
{
	test("accepts tool without complexity (optional)", () => {
		const result = AgentToolManifestSchema.safeParse(baseToolFields);
		assert.ok(result.success, `Expected success`);
	});

	test('accepts complexity "fast"', () => {
		const result = AgentToolManifestSchema.safeParse({ ...baseToolFields, complexity: "fast" });
		assert.ok(result.success, `Expected success`);
	});

	test('accepts complexity "moderate"', () => {
		const result = AgentToolManifestSchema.safeParse({ ...baseToolFields, complexity: "moderate" });
		assert.ok(result.success, `Expected success`);
	});

	test('accepts complexity "slow"', () => {
		const result = AgentToolManifestSchema.safeParse({ ...baseToolFields, complexity: "slow" });
		assert.ok(result.success, `Expected success`);
	});

	test("rejects unknown complexity value", () => {
		const result = AgentToolManifestSchema.safeParse({ ...baseToolFields, complexity: "instant" });
		assert.ok(!result.success, "Expected failure for unknown complexity");
	});
}

console.log("\n📋 combined estimatedLatencyMs + complexity...");
{
	test("accepts both fields together", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			complexity: "moderate",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
		});
		assert.ok(result.success, `Expected success`);
		if (result.success) {
			assert.strictEqual(result.data.complexity, "moderate");
			assert.strictEqual(result.data.estimatedLatencyMs?.p50, 2000);
			assert.strictEqual(result.data.estimatedLatencyMs?.p95, 8000);
		}
	});

	test("fast tier constants parse correctly", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			complexity: "fast",
			estimatedLatencyMs: { p50: 200, p95: 800 },
		});
		assert.ok(result.success);
	});

	test("slow tier constants parse correctly", () => {
		const result = AgentToolManifestSchema.safeParse({
			...baseToolFields,
			complexity: "slow",
			estimatedLatencyMs: { p50: 8000, p95: 30000 },
		});
		assert.ok(result.success);
	});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
