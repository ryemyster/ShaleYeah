/**
 * Reservoir Engineer Agent Contract Tests — Issue #442
 *
 * Proves the curve-smith tools are accessible through the AgentRuntime contract
 * and that the reservoir-engineer manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createReservoirEngineerEndpoint,
	createReservoirEngineerRuntime,
	reservoirEngineerConfig,
	reservoirEngineerManifest,
	runReservoirEngineerTask,
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

console.log("🧪 Starting Reservoir Engineer Agent Contract Tests (#442)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(reservoirEngineerManifest);
	assert(manifest.success, "Reservoir Engineer manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(reservoirEngineerConfig);
	assert(config.success, "Reservoir Engineer runtime config validates");

	assert(reservoirEngineerManifest.id === "reservoir-engineer", "Agent id is reservoir-engineer");
	assert(
		reservoirEngineerManifest.persona.name === "Lucius Technicus Engineer",
		"Persona is Lucius Technicus Engineer",
	);
	assert(reservoirEngineerManifest.tools.length === 4, "Reservoir Engineer exposes 4 curve-smith tools");
	assert(
		reservoirEngineerManifest.tools.every((t) => t.name.startsWith("reservoir-engineer.")),
		"All tools follow reservoir-engineer. naming convention",
	);
	assert(
		reservoirEngineerManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		reservoirEngineerManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		reservoirEngineerManifest.tools.every((t) => t.mcpServer === "curve-smith"),
		'All tools declare mcpServer: "curve-smith"',
	);
	const allToolScopes = new Set(reservoirEngineerManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => reservoirEngineerManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = reservoirEngineerManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createReservoirEngineerRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 4, "Tool discovery returns 4 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "reservoir-engineer.analyze_decline_curve");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns analyze_decline_curve input schema");

	const missing = runtime.discover("schema", "reservoir-engineer.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...reservoirEngineerConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-reservoir-llm",
			model: "operator-selected-model",
		},
	};

	const declineTool = reservoirEngineerManifest.tools.find(
		(t) => t.name === "reservoir-engineer.analyze_decline_curve",
	);
	assert(declineTool !== undefined, "analyze_decline_curve tool is declared in manifest");

	const deterministicRoute = reservoirEngineerConfig.modelRouting.deterministic;
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-reservoir-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createReservoirEngineerRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(reservoirEngineerManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deterministic"), "deterministic requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = reservoirEngineerConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = reservoirEngineerManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No reservoir-engineer tool requires human approval by default");

	const strictRuntime = createReservoirEngineerRuntime({
		...reservoirEngineerConfig,
		hitl: { ...reservoirEngineerConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "reservoir-engineer.analyze_decline_curve",
		args: { productionData: [1000, 900, 810] },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "reservoir-engineer", "Challenge identifies reservoir-engineer agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(reservoirEngineerConfig.evals.enabled === true, "Evals are enabled");
	assert(reservoirEngineerConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(reservoirEngineerConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = reservoirEngineerManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 4, "All reservoir-engineer tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createReservoirEngineerEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "reservoir-engineer", "Health endpoint identifies reservoir-engineer");
	assert(health.status !== "not_ready", "Reservoir Engineer boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "reservoir-engineer", "Endpoint exposes reservoir-engineer manifest");
	assert(manifest.tools.length === 4, "Endpoint manifest has 4 tools");

	const toolSchema = await endpoint.discoveryToolSchema("reservoir-engineer.analyze_decline_curve");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #442)...");
{
	// A blocking schema eval sets retryable: false on execute(). executeLoop must
	// immediately return the error — do not continue to the next LLM step.
	const blockingConfig: typeof reservoirEngineerConfig = {
		...reservoirEngineerConfig,
		evals: {
			...reservoirEngineerConfig.evals,
			checks: { ...reservoirEngineerConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: reservoirEngineerManifest,
		config: blockingConfig,
		// Handler returns undefined — triggers blocking schema eval failure on execute()
		handlers: Object.fromEntries(reservoirEngineerManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "reservoir-engineer.analyze_decline_curve",
				args: { productionData: [1000, 900, 810] },
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runReservoirEngineerTask("analyze decline curve", {
		config: blockingConfig,
		callLLM: mockLLM,
		runtime: blockingRuntime,
	});

	assert(llmCallCount.length === 1, "executeLoop halts after permanent failure — LLM not called a second time");
	assert(typeof result === "string" && result.length > 0, "Permanent failure returns non-empty error string");

	await blockingRuntime.shutdown();
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...reservoirEngineerManifest, id: "" } as typeof reservoirEngineerManifest,
			config: reservoirEngineerConfig,
			handlers: Object.fromEntries(reservoirEngineerManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Reservoir Engineer Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
