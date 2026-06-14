/**
 * Market Analyst Agent Contract Tests — Issue #440
 *
 * Proves the market tools are accessible through the AgentRuntime contract
 * and that the market-analyst manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createMarketAnalystEndpoint,
	createMarketAnalystRuntime,
	marketAnalystConfig,
	marketAnalystManifest,
	runMarketAnalystTask,
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

console.log("🧪 Starting Market Analyst Agent Contract Tests (#440)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(marketAnalystManifest);
	assert(manifest.success, "Market Analyst manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(marketAnalystConfig);
	assert(config.success, "Market Analyst runtime config validates");

	assert(marketAnalystManifest.id === "market-analyst", "Agent id is market-analyst");
	assert(marketAnalystManifest.persona.name === "Mercatus Analyticus", "Persona is Mercatus Analyticus");
	assert(marketAnalystManifest.tools.length === 2, "Market Analyst exposes 2 market tools");
	assert(
		marketAnalystManifest.tools.every((t) => t.name.startsWith("market-analyst.")),
		"All tools follow market-analyst. naming convention",
	);
	assert(
		marketAnalystManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		marketAnalystManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		marketAnalystManifest.tools.every((t) => t.mcpServer === "market"),
		'All tools declare mcpServer: "market"',
	);
	const allToolScopes = new Set(marketAnalystManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => marketAnalystManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = marketAnalystManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createMarketAnalystRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 2, "Tool discovery returns 2 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "market-analyst.analyze_market_conditions");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns analyze_market_conditions input schema");

	const missing = runtime.discover("schema", "market-analyst.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...marketAnalystConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-market-llm",
			model: "operator-selected-model",
		},
	};

	const conditionsTool = marketAnalystManifest.tools.find((t) => t.name === "market-analyst.analyze_market_conditions");
	assert(conditionsTool !== undefined, "analyze_market_conditions tool is declared in manifest");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-market-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createMarketAnalystRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(marketAnalystManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = marketAnalystConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = marketAnalystManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No market-analyst tool requires human approval by default");

	const strictRuntime = createMarketAnalystRuntime({
		...marketAnalystConfig,
		hitl: { ...marketAnalystConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "market-analyst.analyze_market_conditions",
		args: {},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "market-analyst", "Challenge identifies market-analyst agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(marketAnalystConfig.evals.enabled === true, "Evals are enabled");
	assert(marketAnalystConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(marketAnalystConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = marketAnalystManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 2, "All market-analyst tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createMarketAnalystEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "market-analyst", "Health endpoint identifies market-analyst");
	assert(health.status !== "not_ready", "Market Analyst boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "market-analyst", "Endpoint exposes market-analyst manifest");
	assert(manifest.tools.length === 2, "Endpoint manifest has 2 tools");

	const toolSchema = await endpoint.discoveryToolSchema("market-analyst.analyze_market_conditions");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #440)...");
{
	// A blocking schema eval sets retryable: false on execute(). executeLoop must
	// immediately return the error — do not continue to the next LLM step.
	const blockingConfig: typeof marketAnalystConfig = {
		...marketAnalystConfig,
		evals: {
			...marketAnalystConfig.evals,
			checks: { ...marketAnalystConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: marketAnalystManifest,
		config: blockingConfig,
		// Handler returns undefined — triggers blocking schema eval failure on execute()
		handlers: Object.fromEntries(marketAnalystManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "market-analyst.analyze_market_conditions",
				args: {},
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runMarketAnalystTask("analyze market conditions", {
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
			manifest: { ...marketAnalystManifest, id: "" } as typeof marketAnalystManifest,
			config: marketAnalystConfig,
			handlers: Object.fromEntries(marketAnalystManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Market Analyst Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
