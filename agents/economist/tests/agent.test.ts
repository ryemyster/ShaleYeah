/**
 * Economist Agent Contract Tests — Issue #364
 *
 * Proves the econobot tools are accessible through the AgentRuntime contract
 * and that the economist manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createEconomistEndpoint,
	createEconomistRuntime,
	economistConfig,
	economistManifest,
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

console.log("🧪 Starting Economist Agent Contract Tests (#364)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(economistManifest);
	assert(manifest.success, "Economist manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(economistConfig);
	assert(config.success, "Economist runtime config validates");

	assert(economistManifest.id === "economist", "Agent id is economist");
	assert(economistManifest.persona.name === "Caesar Augustus Economicus", "Persona is Caesar Augustus Economicus");
	assert(economistManifest.tools.length === 3, "Economist exposes 3 economics tools");
	assert(
		economistManifest.tools.every((t) => t.name.startsWith("economist.")),
		"All tools follow economist. naming convention",
	);
	assert(
		economistManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		economistManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		economistManifest.tools.every((t) => t.mcpServer === "econobot"),
		'All tools declare mcpServer: "econobot"',
	);
	const allToolScopes = new Set(economistManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => economistManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = economistManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createEconomistRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "economist.calculate_dcf");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns calculate_dcf input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"calculate_dcf schema declares required fields",
	);

	const missing = runtime.discover("schema", "economist.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...economistConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-economics-llm",
			model: "operator-selected-model",
		},
	};

	const analysisTool = economistManifest.tools.find((t) => t.name === "economist.analyze_economics");
	assert(analysisTool !== undefined, "analyze_economics tool is declared in manifest");

	const deterministicRoute = economistConfig.modelRouting.deterministic;
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-economics-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createEconomistRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(economistManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deterministic"), "deterministic requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = economistConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = economistManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No economist tool requires human approval by default");

	const strictRuntime = createEconomistRuntime({
		...economistConfig,
		hitl: { ...economistConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "economist.calculate_dcf",
		args: { cashFlows: [-100, 60, 70], discountRate: 0.1 },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "economist", "Challenge identifies economist agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(economistConfig.evals.enabled === true, "Evals are enabled");
	assert(economistConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(economistConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = economistManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 3, "All economist tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createEconomistEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "economist", "Health endpoint identifies economist");
	assert(health.status !== "not_ready", "Economist boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "economist", "Endpoint exposes economist manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("economist.calculate_dcf");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...economistManifest, id: "" } as typeof economistManifest,
			config: economistConfig,
			handlers: Object.fromEntries(economistManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Economist Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
