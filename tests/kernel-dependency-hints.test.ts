/**
 * Tests for #198 — Dependency Hint pattern
 *
 * Tools declare which other tools must complete before they can run
 * (dependsOn) and which tools can consume their output (providesFor).
 * The registry builds and exposes the dependency graph; the executor
 * checks that required dependencies have completed before dispatching.
 *
 * Uses Node's built-in assert module — no jest/vitest.
 */

import assert from "node:assert";
import { Registry } from "../src/kernel/registry.js";
import type { ToolDescriptor } from "../src/kernel/types.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	try {
		await fn();
		passed++;
		console.log(`  ✅ ${name}`);
	} catch (err) {
		failed++;
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`  ❌ ${name}: ${msg}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(): Registry {
	const registry = new Registry();

	// Simulate the kernel registering 4 servers with realistic dep hints
	registry.registerServer({
		name: "geowiz",
		description: "Formation analysis",
		persona: "Marcus Geologicus",
		domain: "geology",
		capabilities: ["formation", "geology"],
	});

	registry.registerServer({
		name: "econobot",
		description: "Economic modeling",
		persona: "Economicus",
		domain: "finance",
		capabilities: ["economics", "npv", "irr"],
	});

	registry.registerServer({
		name: "risk-analysis",
		description: "Risk scoring",
		persona: "Riskus",
		domain: "risk",
		capabilities: ["risk", "probability"],
	});

	registry.registerServer({
		name: "decision",
		description: "Investment decision",
		persona: "Decidus",
		domain: "decision",
		capabilities: ["decision", "recommendation"],
	});

	return registry;
}

// ---------------------------------------------------------------------------
// ToolDescriptor shape
// ---------------------------------------------------------------------------

console.log("\n--- ToolDescriptor shape ---");

await test("ToolDescriptor has dependsOn field (array of strings)", () => {
	const registry = makeRegistry();
	const tool = registry.getTool("geowiz.analyze");
	assert.ok(tool !== undefined, "geowiz.analyze must exist");
	// After implementation: field must exist and default to []
	assert.ok(Array.isArray((tool as ToolDescriptor).dependsOn), "dependsOn must be an array");
});

await test("ToolDescriptor has providesFor field (array of strings)", () => {
	const registry = makeRegistry();
	const tool = registry.getTool("geowiz.analyze");
	assert.ok(tool !== undefined, "geowiz.analyze must exist");
	assert.ok(Array.isArray((tool as ToolDescriptor).providesFor), "providesFor must be an array");
});

await test("dependsOn defaults to empty array when not declared", () => {
	const registry = makeRegistry();
	const tool = registry.getTool("geowiz.analyze")!;
	assert.deepStrictEqual(tool.dependsOn, [], "geowiz has no prerequisites");
});

await test("providesFor defaults to empty array when not declared", () => {
	const registry = makeRegistry();
	const tool = registry.getTool("econobot.analyze")!;
	assert.deepStrictEqual(tool.providesFor, [], "default providesFor is empty");
});

// ---------------------------------------------------------------------------
// Registry: setToolDependencies
// ---------------------------------------------------------------------------

console.log("\n--- Registry.setToolDependencies ---");

await test("setToolDependencies sets dependsOn on a registered tool", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"],
	});
	const tool = registry.getTool("decision.analyze")!;
	assert.deepStrictEqual(tool.dependsOn, ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"]);
});

await test("setToolDependencies sets providesFor on a registered tool", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("geowiz.analyze", {
		providesFor: ["risk-analysis.analyze", "decision.analyze"],
	});
	const tool = registry.getTool("geowiz.analyze")!;
	assert.deepStrictEqual(tool.providesFor, ["risk-analysis.analyze", "decision.analyze"]);
});

await test("setToolDependencies can set both fields at once", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("risk-analysis.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze"],
		providesFor: ["decision.analyze"],
	});
	const tool = registry.getTool("risk-analysis.analyze")!;
	assert.deepStrictEqual(tool.dependsOn, ["geowiz.analyze", "econobot.analyze"]);
	assert.deepStrictEqual(tool.providesFor, ["decision.analyze"]);
});

await test("setToolDependencies is a no-op for unknown tool names", () => {
	const registry = makeRegistry();
	// Should not throw — unknown tool names are silently ignored
	registry.setToolDependencies("unknown.analyze", { dependsOn: ["geowiz.analyze"] });
	// No assertion needed — absence of throw is the pass condition
});

// ---------------------------------------------------------------------------
// Registry: getDependencies / getDependents
// ---------------------------------------------------------------------------

console.log("\n--- Registry.getDependencies / getDependents ---");

await test("getDependencies returns the dependsOn list for a tool", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze"],
	});
	const deps = registry.getDependencies("decision.analyze");
	assert.deepStrictEqual(deps, ["geowiz.analyze", "econobot.analyze"]);
});

await test("getDependencies returns [] when tool has no dependsOn", () => {
	const registry = makeRegistry();
	const deps = registry.getDependencies("geowiz.analyze");
	assert.deepStrictEqual(deps, []);
});

await test("getDependencies returns [] for unknown tool", () => {
	const registry = makeRegistry();
	const deps = registry.getDependencies("nonexistent.analyze");
	assert.deepStrictEqual(deps, []);
});

await test("getDependents returns all tools that list this tool in dependsOn", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("risk-analysis.analyze", {
		dependsOn: ["geowiz.analyze"],
	});
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze"],
	});

	const dependents = registry.getDependents("geowiz.analyze");
	// Both risk-analysis and decision depend on geowiz
	assert.ok(dependents.includes("risk-analysis.analyze"), "risk-analysis depends on geowiz");
	assert.ok(dependents.includes("decision.analyze"), "decision depends on geowiz");
});

await test("getDependents returns [] when no tool depends on the given tool", () => {
	const registry = makeRegistry();
	// Nothing has been wired up — all empty
	const dependents = registry.getDependents("decision.analyze");
	assert.deepStrictEqual(dependents, []);
});

// ---------------------------------------------------------------------------
// Registry: validateExecutionOrder
// ---------------------------------------------------------------------------

console.log("\n--- Registry.validateExecutionOrder ---");

await test("validateExecutionOrder returns valid=true when all deps are satisfied", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze"],
	});
	// Both deps completed
	const completed = new Set(["geowiz.analyze", "econobot.analyze"]);
	const result = registry.validateExecutionOrder("decision.analyze", completed);
	assert.strictEqual(result.valid, true);
	assert.deepStrictEqual(result.missing, []);
});

await test("validateExecutionOrder returns valid=false when deps are missing", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"],
	});
	// Only geowiz has completed
	const completed = new Set(["geowiz.analyze"]);
	const result = registry.validateExecutionOrder("decision.analyze", completed);
	assert.strictEqual(result.valid, false);
	assert.ok(result.missing.includes("econobot.analyze"), "econobot must be listed as missing");
	assert.ok(result.missing.includes("risk-analysis.analyze"), "risk-analysis must be listed as missing");
});

await test("validateExecutionOrder returns valid=true for tool with no deps", () => {
	const registry = makeRegistry();
	const result = registry.validateExecutionOrder("geowiz.analyze", new Set());
	assert.strictEqual(result.valid, true);
	assert.deepStrictEqual(result.missing, []);
});

await test("validateExecutionOrder returns valid=true for unknown tool (no deps assumed)", () => {
	const registry = makeRegistry();
	const result = registry.validateExecutionOrder("nonexistent.analyze", new Set());
	assert.strictEqual(result.valid, true);
	assert.deepStrictEqual(result.missing, []);
});

// ---------------------------------------------------------------------------
// Registry: getExecutionGraph
// ---------------------------------------------------------------------------

console.log("\n--- Registry.getExecutionGraph ---");

await test("getExecutionGraph returns the full adjacency map for all registered tools", () => {
	const registry = makeRegistry();
	registry.setToolDependencies("risk-analysis.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze"],
	});
	registry.setToolDependencies("decision.analyze", {
		dependsOn: ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"],
	});

	const graph = registry.getExecutionGraph();
	// Graph is a Map of toolName → dependsOn[]
	assert.ok(graph instanceof Map, "getExecutionGraph must return a Map");
	assert.deepStrictEqual(graph.get("risk-analysis.analyze"), ["geowiz.analyze", "econobot.analyze"]);
	assert.deepStrictEqual(graph.get("decision.analyze"), [
		"geowiz.analyze",
		"econobot.analyze",
		"risk-analysis.analyze",
	]);
	// Tools with no deps are still present in the graph (empty arrays)
	assert.deepStrictEqual(graph.get("geowiz.analyze"), []);
	assert.deepStrictEqual(graph.get("econobot.analyze"), []);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
