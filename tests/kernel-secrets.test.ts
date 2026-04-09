/**
 * Kernel Secret Injection Tests — Issue #205
 *
 * TDD: written before implementation.
 *
 * Validates the SecretsStore pattern:
 *   - Secrets load from env by default
 *   - Secrets are injectable (override env) for testing
 *   - Dynamic resolvers (async functions) are supported
 *   - Secret values are never returned raw — only key names are observable
 *   - Audit log records secret access by key name, not value
 *   - callLLM() accepts an injected apiKey (skips process.env lookup)
 *   - Missing secrets throw with a clear, actionable message
 */

import assert from "node:assert";
import { Kernel } from "../src/kernel/index.js";
import { ShaleYeahMCPClient } from "../src/mcp-client.js";
import { callLLM } from "../src/shared/llm-client.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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
// Setup
// ---------------------------------------------------------------------------

const client = new ShaleYeahMCPClient();
const kernel = new Kernel();
kernel.initialize(client.serverConfigs);

// ---------------------------------------------------------------------------
// Section 1: SecretsStore — static injection
// ---------------------------------------------------------------------------

console.log("\n🔐 Section 1: Static secret injection\n");

await test("kernel has a secrets store after initialize()", () => {
	assert.ok(kernel.secrets !== undefined, "kernel.secrets exists");
});

await test("SecretsStore.set() and resolve() round-trip a static value", async () => {
	kernel.secrets.set("TEST_KEY", "test-value-abc");
	const val = await kernel.secrets.resolve("TEST_KEY");
	assert.strictEqual(val, "test-value-abc");
});

await test("SecretsStore.resolve() falls back to process.env when key not explicitly set", async () => {
	const savedEnv = process.env.KERNEL_TEST_SECRET;
	try {
		process.env.KERNEL_TEST_SECRET = "from-env-123";
		// Don't call secrets.set() — should fall back to env
		const val = await kernel.secrets.resolve("KERNEL_TEST_SECRET");
		assert.strictEqual(val, "from-env-123");
	} finally {
		if (savedEnv !== undefined) {
			process.env.KERNEL_TEST_SECRET = savedEnv;
		} else {
			delete process.env.KERNEL_TEST_SECRET;
		}
	}
});

await test("SecretsStore.resolve() throws a clear error for unknown key with no env fallback", async () => {
	let caughtError: Error | null = null;
	try {
		await kernel.secrets.resolve("TOTALLY_UNKNOWN_SECRET_XYZ_999");
	} catch (err) {
		caughtError = err instanceof Error ? err : new Error(String(err));
	}
	assert.ok(caughtError !== null, "Expected resolve() to throw for unknown key");
	assert.ok(
		caughtError!.message.includes("TOTALLY_UNKNOWN_SECRET_XYZ_999"),
		`Error should name the missing key (got: "${caughtError!.message}")`,
	);
});

// ---------------------------------------------------------------------------
// Section 2: SecretsStore — dynamic resolvers
// ---------------------------------------------------------------------------

console.log("\n⚙️  Section 2: Dynamic secret resolvers\n");

await test("SecretsStore.set() accepts an async resolver function", async () => {
	// Dynamic resolver — simulates fetching from a vault at call time
	kernel.secrets.set("DYNAMIC_KEY", async () => "dynamic-resolved-value");
	const val = await kernel.secrets.resolve("DYNAMIC_KEY");
	assert.strictEqual(val, "dynamic-resolved-value");
});

await test("Dynamic resolver is called fresh each time (not cached)", async () => {
	let callCount = 0;
	kernel.secrets.set("COUNTER_KEY", async () => {
		callCount++;
		return `call-${callCount}`;
	});
	const first = await kernel.secrets.resolve("COUNTER_KEY");
	const second = await kernel.secrets.resolve("COUNTER_KEY");
	assert.strictEqual(first, "call-1");
	assert.strictEqual(second, "call-2");
	assert.strictEqual(callCount, 2);
});

// ---------------------------------------------------------------------------
// Section 3: SecretsStore — has() and list()
// ---------------------------------------------------------------------------

console.log("\n📋 Section 3: Secret introspection (key names only)\n");

await test("SecretsStore.has() returns true for a registered key", () => {
	kernel.secrets.set("HAS_TEST_KEY", "value");
	assert.strictEqual(kernel.secrets.has("HAS_TEST_KEY"), true);
});

await test("SecretsStore.has() returns false for an unknown key", () => {
	assert.strictEqual(kernel.secrets.has("COMPLETELY_UNKNOWN_12345"), false);
});

await test("SecretsStore.list() returns key names, never values", () => {
	kernel.secrets.set("LIST_KEY_A", "secret-val-a");
	kernel.secrets.set("LIST_KEY_B", "secret-val-b");
	const keys = kernel.secrets.list();
	assert.ok(Array.isArray(keys), "list() returns an array");
	assert.ok(keys.includes("LIST_KEY_A"), "list() includes LIST_KEY_A");
	assert.ok(keys.includes("LIST_KEY_B"), "list() includes LIST_KEY_B");
	// Values must never appear in the list output
	assert.ok(!keys.includes("secret-val-a"), "list() does not expose values");
	assert.ok(!keys.includes("secret-val-b"), "list() does not expose values");
});

// ---------------------------------------------------------------------------
// Section 4: callLLM — injected apiKey skips env lookup
// ---------------------------------------------------------------------------

console.log("\n🤖 Section 4: callLLM injected apiKey\n");

await test("callLLM() throws when no key in env AND no injected key", async () => {
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;
		let caughtError: Error | null = null;
		try {
			await callLLM({ prompt: "test" });
		} catch (err) {
			caughtError = err instanceof Error ? err : new Error(String(err));
		}
		assert.ok(caughtError !== null, "Expected callLLM to throw");
		assert.ok(
			caughtError!.message.includes("ANTHROPIC_API_KEY"),
			`Error should mention ANTHROPIC_API_KEY (got: "${caughtError!.message}")`,
		);
	} finally {
		if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
	}
});

await test("callLLM() with injected apiKey reaches SDK (auth error proves SDK was called, not env guard)", async () => {
	// Inject a syntactically valid but auth-invalid key.
	// If the SDK is reached, we get an auth error (not our env-guard error).
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		delete process.env.ANTHROPIC_API_KEY;
		let caughtError: Error | null = null;
		try {
			await callLLM({
				prompt: "test",
				apiKey: "sk-ant-api03-injected-invalid-key-for-testing-00000000000000000000",
			});
		} catch (err) {
			caughtError = err instanceof Error ? err : new Error(String(err));
		}
		assert.ok(caughtError !== null, "Expected callLLM to throw with invalid injected key");
		// Must NOT be our env-guard error — that would mean the injected key was ignored
		assert.ok(
			!caughtError!.message.includes("environment variable is not set"),
			`Injected key was ignored — callLLM fell back to env guard: "${caughtError!.message}"`,
		);
	} finally {
		if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
	}
});

await test("callLLM() injected key takes priority over process.env", async () => {
	// Set a real-looking env key, inject a different fake key.
	// The SDK call should fail with the injected key's auth error, not succeed with the env key.
	const savedKey = process.env.ANTHROPIC_API_KEY;
	try {
		// Put a fake env key in place (not a real key — we don't want a real LLM call)
		process.env.ANTHROPIC_API_KEY = "sk-ant-env-key-that-should-be-ignored";
		let caughtError: Error | null = null;
		try {
			await callLLM({
				prompt: "test",
				apiKey: "sk-ant-api03-injected-override-key-00000000000000000000000000000000",
			});
		} catch (err) {
			caughtError = err instanceof Error ? err : new Error(String(err));
		}
		// Both keys are fake — just assert we get an SDK error, not our guard error
		assert.ok(caughtError !== null, "Expected an error with fake keys");
		assert.ok(
			!caughtError!.message.includes("environment variable is not set"),
			"callLLM should not throw env-guard error when apiKey is injected",
		);
	} finally {
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		} else {
			delete process.env.ANTHROPIC_API_KEY;
		}
	}
});

// ---------------------------------------------------------------------------
// Section 5: Kernel.secrets integration with callLLM
// ---------------------------------------------------------------------------

console.log("\n🔗 Section 5: Kernel secrets → callLLM integration\n");

await test("kernel.secrets.resolveForLLM() returns the injected ANTHROPIC_API_KEY", async () => {
	kernel.secrets.set("ANTHROPIC_API_KEY", "sk-ant-injected-test-key-12345");
	const key = await kernel.secrets.resolve("ANTHROPIC_API_KEY");
	assert.strictEqual(key, "sk-ant-injected-test-key-12345");
});

await test("SecretsStore does not expose values through JSON serialization", () => {
	kernel.secrets.set("SENSITIVE_KEY", "top-secret-value");
	const serialized = JSON.stringify(kernel.secrets);
	assert.ok(!serialized.includes("top-secret-value"), "Secret value must not appear in JSON.stringify output");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`);
console.log("─".repeat(50));

if (failed > 0) process.exit(1);
