/**
 * Standalone Agent Runtime Contract Tests — Issue #358
 *
 * Agent Zero proves the contract shape before Geowiz migrates onto it.
 */

import { createAgentZeroEndpoint, createAgentZeroRuntime } from "../src/agents/agent-zero.js";
import { AgentManifestSchema, AgentRuntimeConfigSchema } from "../src/agents/contracts.js";
import { agentZeroConfig, agentZeroManifest } from "../src/agents/index.js";
import { LocalAgentRuntime, redactSensitive } from "../src/agents/runtime.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
	if (condition) {
		console.log(`  ✅ ${message}`);
		passed++;
	} else {
		console.error(`  ❌ ${message}`);
		failed++;
	}
}

console.log("🧪 Starting Standalone Agent Runtime Contract Tests (#358)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(agentZeroManifest);
	assert(manifest.success, "Agent Zero manifest validates");

	const config = AgentRuntimeConfigSchema.safeParse(agentZeroConfig);
	assert(config.success, "Agent Zero runtime config validates");

	assert(agentZeroManifest.tools.length === 2, "Agent Zero exposes two sample tools");
	assert(
		agentZeroManifest.tools.every((tool) => !tool.modelRequirement.includes("claude")),
		"Tool model requirements are capability labels, not provider names",
	);
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createAgentZeroRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool schemas");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools), "Tool discovery returns an array");
	assert(tools.length === 2, "Tool discovery lists two tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schema");

	const schema = runtime.discover("schema", "agent-zero.inspect");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns requested input schema");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const runtime = createAgentZeroRuntime({
		...agentZeroConfig,
		modelRouting: {
			...agentZeroConfig.modelRouting,
			"small-fast": {
				provider: "acme-local-small",
				model: "operator-selected-model",
			},
		},
	});
	await runtime.initialize();

	const result = await runtime.execute({
		toolName: "agent-zero.inspect",
		args: { subject: "Wolfcamp A" },
	});

	assert(result.status === "completed", "Read-only tool completes");
	if (result.status === "completed") {
		assert(result.metadata.modelRequirement === "small-fast", "Tool declares model capability requirement");
		assert(result.metadata.modelBinding.provider === "acme-local-small", "Runtime uses organization provider alias");
		assert(result.metadata.modelBinding.model === "operator-selected-model", "Runtime uses organization model alias");
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL challenge before memory promotion...");
{
	const runtime = createAgentZeroRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "agent-zero.promote_memory",
		args: { lesson: "Geology evals need source provenance." },
		runId: "run-123",
	});

	assert(blocked.status === "approval_required", "Memory promotion returns approval challenge first");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.requiredScopes.includes("write:memory"), "Challenge includes required scope");
	}

	const approved = await runtime.execute({
		toolName: "agent-zero.promote_memory",
		args: { lesson: "Geology evals need source provenance." },
		runId: "run-123",
		approval: { approved: true, reviewerId: "human-1" },
	});

	assert(approved.status === "completed", "Approved memory promotion completes");

	await runtime.shutdown();
}

console.log("\n🧪 Testing evals and secret redaction...");
{
	const runtime = createAgentZeroRuntime();
	await runtime.initialize();

	const result = await runtime.execute({
		toolName: "agent-zero.inspect",
		args: {
			subject: "Permian package",
			apiKey: "sk-test-secret",
			nested: { bearerToken: "bearer abc123" },
		},
	});

	assert(result.status === "completed", "Tool with sensitive input completes");
	if (result.status === "completed") {
		assert(
			result.evals.some((evalResult) => evalResult.check === "schema"),
			"Schema eval ran",
		);
		assert(
			result.evals.some((evalResult) => evalResult.check === "redactSecrets"),
			"Secret-redaction eval ran",
		);
		assert(
			result.evals.some((evalResult) => evalResult.check === "redactSecrets" && evalResult.status === "pass"),
			"Secret-redaction eval passes after redaction",
		);
		assert(JSON.stringify(result.data).includes("[REDACTED]"), "Sensitive input values are redacted before handler");
		assert(!JSON.stringify(result.data).includes("sk-test-secret"), "Secret value is not present in output");
	}

	await runtime.shutdown();
}

console.log("\n🏥 Testing transport-neutral endpoint facade...");
{
	const endpoint = createAgentZeroEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "agent-zero", "Endpoint exposes health");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "agent-zero", "Endpoint exposes manifest");

	const schema = await endpoint.discoveryToolSchema("agent-zero.inspect");
	assert(schema !== null, "Endpoint exposes requested tool schema");
}

console.log("\n🧯 Testing invalid runtime config fails early...");
{
	const invalidConfig = {
		...agentZeroConfig,
		modelRouting: {
			...agentZeroConfig.modelRouting,
			"small-fast": undefined,
		},
	};

	try {
		const runtime = new LocalAgentRuntime({
			manifest: agentZeroManifest,
			config: invalidConfig as typeof agentZeroConfig,
			handlers: {
				"agent-zero.inspect": async () => ({}),
				"agent-zero.promote_memory": async () => ({}),
			},
		});
		await runtime.initialize();
		assert(false, "Invalid runtime config should fail");
	} catch {
		assert(true, "Invalid runtime config fails early");
	}
}

console.log("\n🚫 Testing approvalMode: 'never' semantics...");
{
	const neverApprovalConfig = {
		...agentZeroConfig,
		hitl: { ...agentZeroConfig.hitl, approvalMode: "never" as const },
	};
	const runtime = createAgentZeroRuntime(neverApprovalConfig);
	await runtime.initialize();

	// approvalMode: "never" disables the config-level "always" gate, but tool-level
	// requiresHumanApproval: true still fires — tool intent wins over operator config.
	const blocked = await runtime.execute({
		toolName: "agent-zero.promote_memory",
		args: { lesson: "test" },
	});
	assert(
		blocked.status === "approval_required",
		"approvalMode: 'never' does not override tool-level requiresHumanApproval: true",
	);

	// A plain tool (no requiresHumanApproval, non-destructive) should not be blocked.
	const unblocked = await runtime.execute({
		toolName: "agent-zero.inspect",
		args: { subject: "test" },
	});
	assert(
		unblocked.status === "completed",
		"approvalMode: 'never' lets non-sensitive tools run without a challenge",
	);

	await runtime.shutdown();
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...agentZeroManifest, id: "" } as typeof agentZeroManifest,
			config: agentZeroConfig,
			handlers: {
				"agent-zero.inspect": async () => ({}),
				"agent-zero.promote_memory": async () => ({}),
			},
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n🔒 Testing direct redaction helper...");
{
	const redacted = redactSensitive({
		apiKey: "sk-secret",
		normal: "visible",
		nested: { token: "bearer secret" },
	}) as Record<string, unknown>;

	assert(redacted.apiKey === "[REDACTED]", "Top-level sensitive key redacted");
	assert(redacted.normal === "visible", "Non-sensitive key preserved");
	assert((redacted.nested as Record<string, unknown>).token === "[REDACTED]", "Nested sensitive key redacted");

	// Arrays of objects must have sensitive keys redacted at each element.
	const redactedArray = redactSensitive([
		{ apiKey: "sk-secret", label: "first" },
		{ token: "bearer abc", label: "second" },
	]) as Array<Record<string, unknown>>;
	assert(redactedArray[0].apiKey === "[REDACTED]", "Array element sensitive key redacted");
	assert(redactedArray[0].label === "first", "Array element non-sensitive key preserved");
	assert(redactedArray[1].token === "[REDACTED]", "Array element nested sensitive key redacted");
}

console.log("\n══════════════════════════════════════════════");
console.log(`Standalone Agent Runtime Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
