/**
 * Development Planner Agent Contract Tests — Issue #373
 *
 * Proves the development tools are accessible through the AgentRuntime contract
 * and that the development-planner manifest satisfies all Arcade acceptance criteria.
 */

import {
	AgentManifestSchema,
	AgentRuntimeConfigSchema,
	ContextStore,
	type LLMCallOptions,
	LocalAgentRuntime,
} from "@shaleyeah/sdk";
import {
	createDevelopmentPlannerEndpoint,
	createDevelopmentPlannerRuntime,
	developmentPlannerConfig,
	developmentPlannerManifest,
	runDevelopmentPlannerTask,
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

console.log("🧪 Starting Development Planner Agent Contract Tests (#373)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(developmentPlannerManifest);
	assert(manifest.success, "Development planner manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(developmentPlannerConfig);
	assert(config.success, "Development planner runtime config validates");

	assert(developmentPlannerManifest.id === "development-planner", "Agent id is development-planner");
	assert(
		developmentPlannerManifest.persona.name === "Architectus Developmentus",
		"Persona is Architectus Developmentus",
	);
	assert(developmentPlannerManifest.tools.length === 3, "Development planner exposes 3 development tools");
	assert(
		developmentPlannerManifest.tools.every((t) => t.name.startsWith("development-planner.")),
		"All tools follow development-planner. naming convention",
	);
	assert(
		developmentPlannerManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		developmentPlannerManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		developmentPlannerManifest.tools.every((t) => t.mcpServer === "development"),
		'All tools declare mcpServer: "development"',
	);
	const allToolScopes = new Set(developmentPlannerManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => developmentPlannerManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = developmentPlannerManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createDevelopmentPlannerRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "development-planner.create_development_plan");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns create_development_plan input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"create_development_plan schema declares required fields",
	);

	const missing = runtime.discover("schema", "development-planner.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...developmentPlannerConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-development-llm",
			model: "operator-selected-model",
		},
	};

	const planTool = developmentPlannerManifest.tools.find(
		(t) => t.name === "development-planner.create_development_plan",
	);
	assert(planTool !== undefined, "create_development_plan tool is declared in manifest");

	const deterministicRoute = developmentPlannerConfig.modelRouting.deterministic;
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-development-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createDevelopmentPlannerRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(developmentPlannerManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deterministic"), "deterministic requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = developmentPlannerConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = developmentPlannerManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No development-planner tool requires human approval by default");

	const strictRuntime = createDevelopmentPlannerRuntime({
		...developmentPlannerConfig,
		hitl: { ...developmentPlannerConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "development-planner.create_development_plan",
		args: {
			project: { name: "Test", location: "TX", reserves: 1000, wellCount: 5 },
		},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "development-planner", "Challenge identifies development-planner agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(developmentPlannerConfig.evals.enabled === true, "Evals are enabled");
	assert(developmentPlannerConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(developmentPlannerConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = developmentPlannerManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 3, "All development-planner tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createDevelopmentPlannerEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "development-planner", "Health endpoint identifies development-planner");
	assert(health.status !== "not_ready", "Development planner boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "development-planner", "Endpoint exposes development-planner manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("development-planner.create_development_plan");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #425)...");
{
	const blockingConfig: typeof developmentPlannerConfig = {
		...developmentPlannerConfig,
		evals: {
			...developmentPlannerConfig.evals,
			checks: { ...developmentPlannerConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: developmentPlannerManifest,
		config: blockingConfig,
		handlers: Object.fromEntries(developmentPlannerManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "development-planner.create_development_plan",
				args: { wellName: "Test-1", reservoirData: {} },
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runDevelopmentPlannerTask("create a plan", {
		config: blockingConfig,
		callLLM: mockLLM,
		runtime: blockingRuntime,
	});

	assert(llmCallCount.length === 1, "executeLoop halts after permanent failure — LLM not called a second time");
	assert(typeof result === "string" && result.length > 0, "Permanent failure returns non-empty error string");

	await blockingRuntime.shutdown();
}

console.log("\n🗂️  Testing context injection — prior context in prompt...");
{
	const ns = developmentPlannerManifest.memory?.namespace ?? "development-planner";
	ContextStore.clear(ns);
	ContextStore.write(ns, "Prior finding: test context seeded for Development Planner.");

	let capturedSystem = "";
	const mockLLM = async (opts: LLMCallOptions): Promise<string> => {
		capturedSystem = opts.system ?? "";
		return JSON.stringify({ action: "done", answer: "Analysis complete." });
	};

	const rt = createDevelopmentPlannerRuntime();
	await rt.initialize();
	await runDevelopmentPlannerTask("Analyze test data.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	assert(
		capturedSystem.includes("Prior finding: test context seeded for Development Planner."),
		"Prior context from namespace is injected into system prompt",
	);
	ContextStore.clear(ns);
}

console.log("\n🗂️  Testing context injection — findings written after run...");
{
	const ns = developmentPlannerManifest.memory?.namespace ?? "development-planner";
	ContextStore.clear(ns);

	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		return JSON.stringify({ action: "done", answer: "Development Planner analysis: test finding written to store." });
	};

	const rt = createDevelopmentPlannerRuntime();
	await rt.initialize();
	await runDevelopmentPlannerTask("Summarize the analysis.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	const stored = ContextStore.read(ns);
	assert(
		stored.includes("Development Planner analysis: test finding written to store."),
		"Answer is written to context store after task completes",
	);
	ContextStore.clear(ns);
}
console.log("\n🛑 Testing invalid manifest fails early...");
try {
	new LocalAgentRuntime({
		manifest: {
			...developmentPlannerManifest,
			id: "",
		} as typeof developmentPlannerManifest,
		config: developmentPlannerConfig,
		handlers: Object.fromEntries(developmentPlannerManifest.tools.map((t) => [t.name, async () => ({})])),
	});
	assert(false, "Empty manifest id should fail validation");
} catch {
	assert(true, "Invalid manifest id fails at construction");
}

console.log("\n══════════════════════════════════════════════");
console.log(`Development Planner Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
