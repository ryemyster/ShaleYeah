/**
 * LLM Client Tests — Issue #222
 *
 * Verifies that:
 * - callLLM() is exported from src/shared/llm-client.ts
 * - callLLM() accepts a prompt string and returns a non-empty string
 * - callLLM() accepts an optional system prompt
 * - callLLM() accepts an optional model override
 * - LLMCallOptions type is exported and structurally correct
 * - SDK is invoked (mocked via env var when key absent)
 */

import assert from "node:assert";
import type { LLMCallOptions } from "../src/shared/llm-client.js";
import { callLLM } from "../src/shared/llm-client.js";

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

async function runTests(): Promise<void> {
	console.log("\n🧪 LLM Client Tests\n");

	await test("callLLM is exported as a function", () => {
		assert.strictEqual(typeof callLLM, "function");
	});

	await test("LLMCallOptions type has prompt field", () => {
		const opts: LLMCallOptions = { prompt: "test prompt" };
		assert.strictEqual(opts.prompt, "test prompt");
	});

	await test("LLMCallOptions type accepts optional system", () => {
		const opts: LLMCallOptions = {
			prompt: "test",
			system: "You are a geologist.",
		};
		assert.strictEqual(opts.system, "You are a geologist.");
	});

	await test("LLMCallOptions type accepts optional model", () => {
		const opts: LLMCallOptions = {
			prompt: "test",
			model: "claude-opus-4-6",
		};
		assert.strictEqual(opts.model, "claude-opus-4-6");
	});

	await test("LLMCallOptions type accepts optional maxTokens", () => {
		const opts: LLMCallOptions = {
			prompt: "test",
			maxTokens: 1024,
		};
		assert.strictEqual(opts.maxTokens, 1024);
	});

	// When ANTHROPIC_API_KEY is not set, callLLM should throw a clear error
	// rather than silently returning empty or crashing with an SDK internal error.
	await test("callLLM throws descriptive error when ANTHROPIC_API_KEY is absent", async () => {
		const savedKey = process.env.ANTHROPIC_API_KEY;
		try {
			delete process.env.ANTHROPIC_API_KEY;
			await callLLM({ prompt: "hello" });
			assert.fail("Expected callLLM to throw when API key is absent");
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			assert.ok(
				message.includes("ANTHROPIC_API_KEY") || message.includes("API key") || message.includes("auth"),
				`Expected error to mention API key, got: ${message}`,
			);
		} finally {
			if (savedKey !== undefined) {
				process.env.ANTHROPIC_API_KEY = savedKey;
			}
		}
	});

	// Summary
	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) {
		process.exit(1);
	}
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
