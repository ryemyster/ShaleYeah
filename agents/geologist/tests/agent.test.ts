/**
 * Geologist Agent Contract Tests — Issue #363
 *
 * Proves the geowiz tools are accessible through the AgentRuntime contract
 * and that the geologist manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema } from "@shaleyeah/sdk";
import {
	createGeologistEndpoint,
	createGeologistRuntime,
	geologistConfig,
	geologistManifest,
} from "../src/agent/index.js";
import { LocalAgentRuntime } from "@shaleyeah/sdk";

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

console.log("🧪 Starting Geologist Agent Contract Tests (#363)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(geologistManifest);
	assert(manifest.success, "Geologist manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(geologistConfig);
	assert(config.success, "Geologist runtime config validates");

	assert(geologistManifest.tools.length === 8, "Geologist exposes 8 geology tools");
	assert(
		geologistManifest.tools.every((t) => t.name.startsWith("geologist.")),
		"All tools follow geologist. naming convention",
	);
	assert(
		geologistManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	// Manifest-level scopes must cover all tool-level scopes (enforced by refine in schema)
	const allToolScopes = new Set(geologistManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => geologistManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	// LLM provider is marked required — geologist actively calls the model
	const llmReq = geologistManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createGeologistRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 8, "Tool discovery returns 8 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "geologist.analyze_formation");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns analyze_formation input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"analyze_formation schema declares required fields",
	);

	const missing = runtime.discover("schema", "geologist.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const runtime = createGeologistRuntime({
		...geologistConfig,
		modelRouting: {
			...geologistConfig.modelRouting,
			"standard-analysis": {
				provider: "acme-geology-llm",
				model: "operator-selected-model",
			},
		},
	});
	await runtime.initialize();

	// assess_quality is deterministic — no real file needed, the function doesn't read disk
	const result = await runtime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
	});

	assert(result.status === "completed", "Deterministic quality-assessment tool completes");
	if (result.status === "completed") {
		assert(result.metadata.modelRequirement === "deterministic", "assess_quality routes to deterministic");
		assert(result.metadata.modelBinding.provider === "rule-based", "Deterministic tools use rule-based provider");
	}

	await runtime.shutdown();
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createGeologistRuntime();
	await runtime.initialize();

	// Verify all 5 model requirements are covered by the config
	const modelRequirements = new Set(geologistManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deterministic"), "deterministic requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = geologistConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const runtime = createGeologistRuntime();
	await runtime.initialize();

	// No tool has requiresHumanApproval: true — verify inspect-style tools run freely
	const result = await runtime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
	});
	assert(result.status === "completed", "Analysis tools complete without approval challenge");

	// approvalMode: "always" forces a challenge even for non-marked tools
	const strictRuntime = createGeologistRuntime({
		...geologistConfig,
		hitl: { ...geologistConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "geologist", "Challenge identifies geologist agent");
	}

	await runtime.shutdown();
	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals run on tool output...");
{
	const runtime = createGeologistRuntime();
	await runtime.initialize();

	const result = await runtime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
	});

	assert(result.status === "completed", "assess_quality completes for eval test");
	if (result.status === "completed") {
		assert(
			result.evals.some((e) => e.check === "schema"),
			"Schema eval ran",
		);
		assert(
			result.evals.some((e) => e.check === "redactSecrets"),
			"Secret-redaction eval ran",
		);
		assert(
			result.evals.every((e) => e.status === "pass"),
			"All evals pass on clean geology output",
		);
	}

	await runtime.shutdown();
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createGeologistEndpoint();
	// Geologist boots without kernel, orchestrator, or other agents present
	const health = await endpoint.health();
	assert(health.agentId === "geologist", "Health endpoint identifies geologist");
	assert(health.status !== "not_ready", "Geologist boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "geologist", "Endpoint exposes geologist manifest");
	assert(manifest.tools.length === 8, "Endpoint manifest has 8 tools");

	const toolSchema = await endpoint.discoveryToolSchema("geologist.process_gis");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...geologistManifest, id: "" } as typeof geologistManifest,
			config: geologistConfig,
			handlers: Object.fromEntries(geologistManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Geologist Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
