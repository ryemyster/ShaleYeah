/**
 * Identity Anchor tests — Issue #449 (Arcade #35)
 *
 * Verifies that SessionIdentity propagates from execute() through to audit log
 * entries, and that the runtime remains backward-compatible when no identity
 * is supplied (anonymous calls must still audit cleanly).
 *
 * Run: cd sdk && npx tsx tests/runtime-identity.test.ts
 */

import assert from "node:assert";
import {
	type AgentExecutionRequest,
	type AgentManifest,
	type AgentRuntimeConfig,
	type AuditLogEntry,
	LocalAgentRuntime,
	type SessionIdentity,
} from "../src/index.js";

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

// Minimal manifest + config that satisfies LocalAgentRuntime without network calls.
const testManifest: AgentManifest = {
	id: "test-agent",
	role: "test",
	version: "0.1.0",
	description: "Identity Anchor test agent",
	persona: { name: "Test Agent", role: "Tester", expertise: ["testing"] },
	capabilities: ["test"],
	tools: [
		{
			name: "test-agent.echo",
			description: "Echo the input back.",
			type: "query",
			capabilities: ["test"],
			inputSchema: {
				type: "object",
				properties: { value: { type: "string" } },
				required: ["value"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			modelRequirement: "deterministic",
			requiredScopes: [],
		},
	],
	requiredScopes: [],
	providerRequirements: [],
	compatibility: { agentRuntime: "0.1", remoteEndpoint: "0.1", mcp: "2025-06" },
	health: { readinessChecks: [] },
	memory: { namespace: "test", reviewRequired: false, sharedMemoryOptIn: false },
	evals: { defaultProfile: "none", requiredChecks: [] },
	autonomy: { defaultLevel: "reviewed", allowedLevels: ["reviewed"] },
};

const testConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"deep-reasoning": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"local-private": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		deterministic: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
	},
	hitl: { approvalMode: "never", requireForDestructive: false, requireForMemoryPromotion: false },
	memory: {
		enabled: false,
		namespace: "test",
		retentionDays: 1,
		promotion: { requireHumanReview: false, allowSharedMemory: false },
	},
	evals: {
		enabled: false,
		profile: "none",
		checks: {
			schema: "off",
			domainCompleteness: "off",
			confidenceMinimum: 0,
			requireSources: false,
			redactSecrets: "off",
			memoryPromotion: "disabled",
		},
	},
	mcpServers: {},
};

function buildRuntime(auditSink: (entry: AuditLogEntry) => void): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: testManifest,
		config: testConfig,
		handlers: {
			"test-agent.echo": async ({ args }) => ({ echo: (args as { value: string }).value }),
		},
		auditLogger: auditSink,
	});
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Identity Anchor Tests (#449 — Arcade #35)\n");

	await test("userId appears in audit log when identity provided", async () => {
		const entries: AuditLogEntry[] = [];
		const runtime = buildRuntime((e) => entries.push(e));
		await runtime.initialize();

		const identity: SessionIdentity = { userId: "user-abc", sessionId: "sess-001" };
		const request: AgentExecutionRequest = {
			toolName: "test-agent.echo",
			args: { value: "hello" },
			identity,
		};

		const result = await runtime.execute(request);
		assert.strictEqual(result.status, "completed", "tool must complete");
		assert.strictEqual(entries.length, 1, "exactly one audit entry");
		assert.strictEqual(entries[0].userId, "user-abc", "userId must appear in audit entry");
	});

	await test("audit log has no userId when no identity provided (backward compat)", async () => {
		const entries: AuditLogEntry[] = [];
		const runtime = buildRuntime((e) => entries.push(e));
		await runtime.initialize();

		const request: AgentExecutionRequest = {
			toolName: "test-agent.echo",
			args: { value: "anonymous" },
		};

		const result = await runtime.execute(request);
		assert.strictEqual(result.status, "completed", "tool must complete");
		assert.strictEqual(entries.length, 1, "exactly one audit entry");
		assert.ok(!("userId" in entries[0]), "userId must be absent when no identity supplied");
	});

	await test("orgId and roles carried in SessionIdentity (structural)", () => {
		const identity: SessionIdentity = {
			userId: "user-xyz",
			sessionId: "sess-002",
			orgId: "acme-oil",
			roles: ["admin", "geologist"],
		};
		assert.strictEqual(identity.orgId, "acme-oil", "orgId field present");
		assert.deepStrictEqual(identity.roles, ["admin", "geologist"], "roles field present");
	});

	await test("identity is optional — AgentExecutionRequest without identity compiles", () => {
		const req: AgentExecutionRequest = { toolName: "test-agent.echo", args: {} };
		assert.ok(!("identity" in req) || req.identity === undefined, "identity is optional");
	});

	console.log(`\nIdentity Anchor Tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

await runTests();
