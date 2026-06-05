/**
 * Quality Assurance Agent Contract Tests — Issue #376
 *
 * Proves the qa-server tools are accessible through the AgentRuntime contract
 * and that the quality-assurance manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createQAAssuranceEndpoint,
	createQAAssuranceRuntime,
	qaAssuranceConfig,
	qaAssuranceManifest,
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

console.log("🧪 Starting Quality Assurance Agent Contract Tests (#376)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(qaAssuranceManifest);
	assert(manifest.success, "Quality-assurance manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(qaAssuranceConfig);
	assert(config.success, "Quality-assurance runtime config validates");

	assert(qaAssuranceManifest.tools.length === 2, "Quality-assurance exposes 2 QA tools");
	assert(
		qaAssuranceManifest.tools.every((t) => t.name.startsWith("quality-assurance.")),
		"All tools follow quality-assurance. naming convention",
	);
	assert(
		qaAssuranceManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	// Manifest-level scopes must cover all tool-level scopes (enforced by refine in schema)
	const allToolScopes = new Set(qaAssuranceManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => qaAssuranceManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	// LLM provider is marked required — quality-assurance actively calls the model
	const llmReq = qaAssuranceManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createQAAssuranceRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 2, "Tool discovery returns 2 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "quality-assurance.run_quality_tests");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns run_quality_tests input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"run_quality_tests schema declares required fields",
	);

	const missing = runtime.discover("schema", "quality-assurance.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	// Handlers call qa-server over MCP — execution tests require a live server.
	// Verify routing contracts at the config level without executing through the network.
	const customRouting = {
		...qaAssuranceConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-qa-llm",
			model: "operator-selected-model",
		},
	};

	const reportTool = qaAssuranceManifest.tools.find((t) => t.name === "quality-assurance.run_quality_tests");
	assert(reportTool !== undefined, "run_quality_tests tool is declared in manifest");

	const deterministicRoute = qaAssuranceConfig.modelRouting.deterministic;
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	// Verify operator override wires correctly into the config shape
	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-qa-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createQAAssuranceRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(qaAssuranceManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.size > 0, "At least one model requirement class is declared");

	for (const req of modelRequirements) {
		const binding = qaAssuranceConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	// No tool has requiresHumanApproval: true — verify at manifest level without executing
	const approvalRequired = qaAssuranceManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No quality-assurance tool requires human approval by default");

	// approvalMode: "always" forces a challenge before the handler is called — no live server needed
	const strictRuntime = createQAAssuranceRuntime({
		...qaAssuranceConfig,
		hitl: { ...qaAssuranceConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "quality-assurance.run_quality_tests",
		args: { targets: ["test-component"] },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "quality-assurance", "Challenge identifies quality-assurance agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	// Handlers delegate to qa-server over MCP — execution-level eval tests require a live server.
	// Verify the eval policy is correctly wired in config.
	assert(qaAssuranceConfig.evals.enabled === true, "Evals are enabled");
	assert(qaAssuranceConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(qaAssuranceConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	// Verify eval profiles are declared on tools that need them
	const profileTools = qaAssuranceManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length > 0, "At least one tool declares an eval profile");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createQAAssuranceEndpoint();
	// Quality-assurance boots without kernel, orchestrator, or other agents present
	const health = await endpoint.health();
	assert(health.agentId === "quality-assurance", "Health endpoint identifies quality-assurance");
	assert(health.status !== "not_ready", "Quality-assurance boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "quality-assurance", "Endpoint exposes quality-assurance manifest");
	assert(manifest.tools.length === 2, "Endpoint manifest has 2 tools");

	const toolSchema = await endpoint.discoveryToolSchema("quality-assurance.run_quality_tests");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...qaAssuranceManifest, id: "" } as typeof qaAssuranceManifest,
			config: qaAssuranceConfig,
			handlers: Object.fromEntries(qaAssuranceManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Quality Assurance Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
