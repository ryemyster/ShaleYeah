import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { ServerFactory } from "../src/server-factory.js";

const input = z.object({});

async function metadata(analysis: Record<string, unknown>, scale?: "unit_interval" | "percentage") {
	const tool = ServerFactory.createAnalysisTool("fixture", "Synthetic metadata control", input, async () => analysis, {
		confidenceScale: scale,
	});
	return (await tool.handler({})).metadata;
}

test("declared positive and explicit zero confidence survive unchanged on both supported scales", async () => {
	for (const [value, scale] of [
		[0, "unit_interval"],
		[0.4, "unit_interval"],
		[1, "unit_interval"],
		[0, "percentage"],
		[40, "percentage"],
		[100, "percentage"],
	] as const) {
		const result = await metadata({ confidence: value }, scale);
		assert.equal(result.confidence, value);
		assert.equal(result.confidenceScale, scale);
		assert.equal(result.confidenceStatus, "available");
	}
});

test("missing or null confidence is unavailable rather than fabricated certainty", async () => {
	for (const analysis of [{}, { confidence: undefined }, { confidence: null }]) {
		const result = await metadata(analysis, "unit_interval");
		assert.equal(result.confidence, null);
		assert.equal(result.confidenceStatus, "unavailable");
		assert.equal(result.confidenceScale, "unit_interval");
	}
});

test("non-numeric, non-finite and declared out-of-range confidence is explicitly invalid", async () => {
	for (const [value, scale] of [
		[Number.NaN, "unit_interval"],
		[Infinity, "unit_interval"],
		[-Infinity, "percentage"],
		[-1, "unit_interval"],
		[1.1, "unit_interval"],
		[101, "percentage"],
		["0.8", "unit_interval"],
		[false, "unit_interval"],
		[{ value: 0.8 }, "unit_interval"],
	] as const) {
		const result = await metadata({ confidence: value }, scale);
		assert.equal(result.confidence, null);
		assert.equal(result.confidenceStatus, "invalid");
		assert.equal(result.confidenceScale, scale);
	}
});

test("a percentage cannot be silently converted into unit-interval confidence", async () => {
	const invalid = await metadata({ confidence: 80 }, "unit_interval");
	assert.equal(invalid.confidence, null);
	assert.equal(invalid.confidenceStatus, "invalid");
	const declared = await metadata({ confidence: 80 }, "percentage");
	assert.equal(declared.confidence, 80);
	assert.equal(declared.confidenceStatus, "available");
});

test("legacy four-argument callers preserve raw zero/numbers with an explicit undeclared scale", async () => {
	for (const value of [0, 0.85, 85]) {
		const tool = ServerFactory.createAnalysisTool("legacy", "Legacy control", input, async () => ({
			confidence: value,
		}));
		const result = (await tool.handler({})).metadata;
		assert.equal(result.confidence, value);
		assert.equal(result.confidenceScale, null);
		assert.equal(result.confidenceStatus, "unscaled");
	}
});

test("model-returned scale prose cannot override the trusted factory declaration", async () => {
	const result = await metadata({ confidence: 80, confidenceScale: "percentage", approved: true }, "unit_interval");
	assert.equal(result.confidence, null);
	assert.equal(result.confidenceStatus, "invalid");
	assert.equal(result.confidenceScale, "unit_interval");
});

test("metadata absence/invalidity does not rewrite useful domain calculations or approve work", async () => {
	const analysis = { npv: -42, confidence: "unknown", reviewStatus: "draft" };
	const tool = ServerFactory.createAnalysisTool("calculation", "Synthetic calculation", input, async () => analysis, {
		confidenceScale: "percentage",
	});
	const result = await tool.handler({});
	assert.strictEqual(result.analysis, analysis);
	assert.equal(result.analysis.npv, -42);
	assert.equal(result.metadata.confidence, null);
	assert.equal(result.metadata.confidenceStatus, "invalid");
	assert.equal(result.analysis.reviewStatus, "draft");
	assert.equal(result.metadata.approved, undefined);
});

test("native failure records remain unchanged without invented confidence metadata", async () => {
	const failure = { success: false, error: "missing input", error_type: "user_action" };
	const tool = ServerFactory.createAnalysisTool("failure", "Failure control", input, async () => failure, {
		confidenceScale: "unit_interval",
	});
	assert.strictEqual(await tool.handler({}), failure);
});

test("unsupported confidence configuration fails before a tool can execute", () => {
	let called = false;
	assert.throws(
		() =>
			ServerFactory.createAnalysisTool(
				"bad_config",
				"Bad config",
				input,
				async () => {
					called = true;
					return { confidence: 0.4 };
				},
				{ confidenceScale: "infer-from-number" as "unit_interval" },
			),
		/confidenceScale/,
	);
	assert.equal(called, false);
});
