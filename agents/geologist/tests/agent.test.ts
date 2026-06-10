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

async function geowizReachable(): Promise<boolean> {
	try {
		const url = geologistConfig.mcpServers?.geowiz?.url ?? "http://localhost:3001";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
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

	assert(geologistManifest.tools.length === 9, "Geologist exposes 9 geology tools (8 read + 1 write)");
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
	assert(Array.isArray(tools) && tools.length === 9, "Tool discovery returns 9 tools");
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
	const live = await geowizReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] geowiz not reachable — execute() tests require live server");
		console.log("     Start with: cd servers/geowiz && PORT=3001 pnpm start");
	} else {
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
	const live = await geowizReachable();

	if (live) {
		const runtime = createGeologistRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "geologist.assess_quality",
			args: { filePath: "test.las", dataType: "las" },
		});
		assert(result.status === "completed", "Analysis tools complete without approval challenge");

		await runtime.shutdown();
	} else {
		console.log("  ⚠️  [skipped] execute() test requires live geowiz server");
	}

	// approvalMode: "always" blocks BEFORE calling the handler — no server needed
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
	const live = await geowizReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] eval test requires live geowiz server");
	} else {
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
	assert(manifest.tools.length === 9, "Endpoint manifest has 9 tools");

	const toolSchema = await endpoint.discoveryToolSchema("geologist.process_gis");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔒 Testing scope enforcement (issue #403)...");
{
	// When grantedScopes is provided, runtime must reject tool calls missing required scopes.
	const runtime = createGeologistRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
		grantedScopes: [],
	});
	assert(blocked.status === "failed", "Missing scope blocks tool execution");
	if (blocked.status === "failed") {
		assert(blocked.error.includes("Missing required scopes"), "Error message names missing scopes");
	}

	const allowed = await runtime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
		grantedScopes: ["read:geology"],
	});
	// Server may not be live — we only care that scope check passed (no scope error)
	assert(
		allowed.status !== "failed" || !allowed.error.includes("Missing required scopes"),
		"Correct scopes are accepted",
	);

	await runtime.shutdown();
}

console.log("\n🧱 Testing blocking eval halt (issue #404)...");
{
	// A handler that returns undefined triggers the schema blocking eval.
	// The runtime must return status: "failed" rather than status: "completed".
	const undefinedHandler = async () => undefined;
	const allHandlers = Object.fromEntries(geologistManifest.tools.map((t) => [t.name, undefinedHandler]));
	const _strictRuntime = createGeologistRuntime({
		...geologistConfig,
		evals: { ...geologistConfig.evals, checks: { ...geologistConfig.evals.checks, schema: "blocking" } },
	});
	// Swap handlers to ones that return undefined — overrides are not public, so build via constructor.
	const { LocalAgentRuntime } = await import("@shaleyeah/sdk");
	const testRuntime = new LocalAgentRuntime({
		manifest: geologistManifest,
		config: geologistConfig,
		handlers: allHandlers,
	});
	await testRuntime.initialize();
	const result = await testRuntime.execute({
		toolName: "geologist.assess_quality",
		args: { filePath: "test.las", dataType: "las" },
	});
	assert(result.status === "failed", "Blocking eval failure returns status: failed");
	if (result.status === "failed") {
		assert(result.error.includes("Blocking eval"), "Error message references blocking eval");
		assert(result.retryable === false, "Blocking eval failures are not retryable");
	}
	await testRuntime.shutdown();
}

console.log("\n🔀 Testing model routing resolution (issue #402)...");
{
	// After fixing geologistConfig.modelRouting, the standard-analysis binding must use a real
	// Anthropic model ID — not the old "configured-by-operator" placeholder.
	const standardAnalysis = geologistConfig.modelRouting["standard-analysis"];
	assert(standardAnalysis !== undefined, "standard-analysis binding is present");
	assert(
		standardAnalysis?.model !== "configured-by-operator",
		"standard-analysis model is a real model ID, not a placeholder",
	);
	assert(standardAnalysis?.provider === "anthropic", "standard-analysis provider is anthropic");

	// write:geology scope must be declared at the manifest level
	assert(
		geologistManifest.requiredScopes.includes("write:geology"),
		"Manifest declares write:geology scope (save_finding requires it)",
	);

	// save_finding must exist in the tool list
	const saveFinding = geologistManifest.tools.find((t) => t.name === "geologist.save_finding");
	assert(saveFinding !== undefined, "geologist.save_finding is in the manifest");
	assert(saveFinding?.type === "command", "save_finding is a command type (has side effects)");
	assert(saveFinding?.requiredScopes.includes("write:geology"), "save_finding requires write:geology");
	assert(saveFinding?.requiresHumanApproval === true, "save_finding requires human approval (memory promotion)");
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
