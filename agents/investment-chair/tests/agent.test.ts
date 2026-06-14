/**
 * Investment Chair Agent Contract Tests — Issue #439
 *
 * Proves the decision tools are accessible through the AgentRuntime contract
 * and that the investment-chair manifest satisfies all Arcade acceptance criteria.
 */

import {
	AgentManifestSchema,
	AgentRuntimeConfigSchema,
	ContextStore,
	type LLMCallOptions,
	LocalAgentRuntime,
} from "@shaleyeah/sdk";
import {
	createInvestmentChairEndpoint,
	createInvestmentChairRuntime,
	investmentChairConfig,
	investmentChairManifest,
	runInvestmentChairTask,
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

console.log("🧪 Starting Investment Chair Agent Contract Tests (#439)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(investmentChairManifest);
	assert(manifest.success, "Investment Chair manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(investmentChairConfig);
	assert(config.success, "Investment Chair runtime config validates");

	assert(investmentChairManifest.id === "investment-chair", "Agent id is investment-chair");
	assert(investmentChairManifest.persona.name === "Augustus Decidius Maximus", "Persona is Augustus Decidius Maximus");
	assert(investmentChairManifest.tools.length === 3, "Investment Chair exposes 3 decision tools");
	assert(
		investmentChairManifest.tools.every((t) => t.name.startsWith("investment-chair.")),
		"All tools follow investment-chair. naming convention",
	);
	assert(
		investmentChairManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		investmentChairManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		investmentChairManifest.tools.every((t) => t.mcpServer === "decision"),
		'All tools declare mcpServer: "decision"',
	);
	const allToolScopes = new Set(investmentChairManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => investmentChairManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = investmentChairManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createInvestmentChairRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "investment-chair.make_investment_decision");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns make_investment_decision input schema");

	const missing = runtime.discover("schema", "investment-chair.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...investmentChairConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-investment-llm",
			model: "operator-selected-model",
		},
	};

	const decisionTool = investmentChairManifest.tools.find(
		(t) => t.name === "investment-chair.make_investment_decision",
	);
	assert(decisionTool !== undefined, "make_investment_decision tool is declared in manifest");

	const deepReasoningRoute = investmentChairConfig.modelRouting["deep-reasoning"];
	assert(deepReasoningRoute !== undefined, "Deep reasoning route is configured");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-investment-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createInvestmentChairRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(investmentChairManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deep-reasoning"), "deep-reasoning requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = investmentChairConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = investmentChairManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No investment-chair tool requires human approval by default");

	const strictRuntime = createInvestmentChairRuntime({
		...investmentChairConfig,
		hitl: { ...investmentChairConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "investment-chair.make_investment_decision",
		args: {},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "investment-chair", "Challenge identifies investment-chair agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(investmentChairConfig.evals.enabled === true, "Evals are enabled");
	assert(investmentChairConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(investmentChairConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = investmentChairManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 3, "All investment-chair tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createInvestmentChairEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "investment-chair", "Health endpoint identifies investment-chair");
	assert(health.status !== "not_ready", "Investment Chair boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "investment-chair", "Endpoint exposes investment-chair manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("investment-chair.make_investment_decision");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #439)...");
{
	// A blocking schema eval sets retryable: false on execute(). executeLoop must
	// immediately return the error — do not continue to the next LLM step.
	const blockingConfig: typeof investmentChairConfig = {
		...investmentChairConfig,
		evals: {
			...investmentChairConfig.evals,
			checks: { ...investmentChairConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: investmentChairManifest,
		config: blockingConfig,
		// Handler returns undefined — triggers blocking schema eval failure on execute()
		handlers: Object.fromEntries(investmentChairManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "investment-chair.make_investment_decision",
				args: {},
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runInvestmentChairTask("make investment decision", {
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
	const ns = investmentChairManifest.memory?.namespace ?? "investment-chair";
	ContextStore.clear(ns);
	ContextStore.write(ns, "Prior finding: test context seeded for Investment Chair.");

	let capturedSystem = "";
	const mockLLM = async (opts: LLMCallOptions): Promise<string> => {
		capturedSystem = opts.system ?? "";
		return JSON.stringify({ action: "done", answer: "Analysis complete." });
	};

	const rt = createInvestmentChairRuntime();
	await rt.initialize();
	await runInvestmentChairTask("Analyze test data.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	assert(
		capturedSystem.includes("Prior finding: test context seeded for Investment Chair."),
		"Prior context from namespace is injected into system prompt",
	);
	ContextStore.clear(ns);
}

console.log("\n🗂️  Testing context injection — findings written after run...");
{
	const ns = investmentChairManifest.memory?.namespace ?? "investment-chair";
	ContextStore.clear(ns);

	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		return JSON.stringify({ action: "done", answer: "Investment Chair analysis: test finding written to store." });
	};

	const rt = createInvestmentChairRuntime();
	await rt.initialize();
	await runInvestmentChairTask("Summarize the analysis.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	const stored = ContextStore.read(ns);
	assert(
		stored.includes("Investment Chair analysis: test finding written to store."),
		"Answer is written to context store after task completes",
	);
	ContextStore.clear(ns);
}
console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: { ...investmentChairManifest, id: "" } as typeof investmentChairManifest,
			config: investmentChairConfig,
			handlers: Object.fromEntries(investmentChairManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Investment Chair Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
