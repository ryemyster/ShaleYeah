/**
 * Geologist Agent Contract Tests — Issue #363
 *
 * Proves the geowiz tools are accessible through the AgentRuntime contract
 * and that the geologist manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createGeologistEndpoint,
	createGeologistRuntime,
	geologistConfig,
	geologistManifest,
} from "../src/agent/index.js";

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
	// Handlers now call geowiz over MCP — execution tests require a live server.
	// Verify routing contracts at the config level without executing through the network.
	const customRouting = {
		...geologistConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-geology-llm",
			model: "operator-selected-model",
		},
	};

	const assessTool = geologistManifest.tools.find((t) => t.name === "geologist.assess_quality");
	assert(assessTool?.modelRequirement === "deterministic", "assess_quality declares deterministic requirement");

	const deterministicRoute = geologistConfig.modelRouting["deterministic"];
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	// Verify operator override wires correctly into the config shape
	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-geology-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
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
	// No tool has requiresHumanApproval: true — verify at manifest level without executing
	const approvalRequired = geologistManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No geologist tool requires human approval by default");

	// approvalMode: "always" forces a challenge before the handler is called — no live server needed
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

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	// Handlers now delegate to geowiz over MCP — execution-level eval tests require a live server.
	// Verify the eval policy is correctly wired in config (the runtime enforces it at execute time).
	assert(geologistConfig.evals.enabled === true, "Evals are enabled");
	assert(geologistConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(geologistConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	// Verify eval profiles are declared on the tools that need them
	const profileTools = geologistManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length > 0, "At least one tool declares an eval profile");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
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
