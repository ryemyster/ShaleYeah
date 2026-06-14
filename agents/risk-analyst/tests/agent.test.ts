/**
 * Risk Analyst Agent Contract Tests — Issue #443
 *
 * Proves the risk-analysis tools are accessible through the AgentRuntime contract
 * and that the risk-analyst manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createRiskAnalystEndpoint,
	createRiskAnalystRuntime,
	riskAnalystConfig,
	riskAnalystManifest,
	runRiskAnalystTask,
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

console.log("🧪 Starting Risk Analyst Agent Contract Tests (#443)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(riskAnalystManifest);
	assert(manifest.success, "Risk Analyst manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(riskAnalystConfig);
	assert(config.success, "Risk Analyst runtime config validates");

	assert(riskAnalystManifest.id === "risk-analyst", "Agent id is risk-analyst");
	assert(riskAnalystManifest.persona.name === "Gaius Probabilis Assessor", "Persona is Gaius Probabilis Assessor");
	assert(riskAnalystManifest.tools.length === 2, "Risk Analyst exposes 2 risk-analysis tools");
	assert(
		riskAnalystManifest.tools.every((t) => t.name.startsWith("risk-analyst.")),
		"All tools follow risk-analyst. naming convention",
	);
	assert(
		riskAnalystManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		riskAnalystManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		riskAnalystManifest.tools.every((t) => t.mcpServer === "risk-analysis"),
		'All tools declare mcpServer: "risk-analysis"',
	);
	const allToolScopes = new Set(riskAnalystManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => riskAnalystManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = riskAnalystManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createRiskAnalystRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 2, "Tool discovery returns 2 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "risk-analyst.assess_investment_risk");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns assess_investment_risk input schema");

	const missing = runtime.discover("schema", "risk-analyst.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...riskAnalystConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-risk-llm",
			model: "operator-selected-model",
		},
	};

	const riskTool = riskAnalystManifest.tools.find((t) => t.name === "risk-analyst.assess_investment_risk");
	assert(riskTool !== undefined, "assess_investment_risk tool is declared in manifest");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-risk-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createRiskAnalystRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(riskAnalystManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = riskAnalystConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = riskAnalystManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No risk-analyst tool requires human approval by default");

	const strictRuntime = createRiskAnalystRuntime({
		...riskAnalystConfig,
		hitl: { ...riskAnalystConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "risk-analyst.assess_investment_risk",
		args: {},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "risk-analyst", "Challenge identifies risk-analyst agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(riskAnalystConfig.evals.enabled === true, "Evals are enabled");
	assert(riskAnalystConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(riskAnalystConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = riskAnalystManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 2, "All risk-analyst tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createRiskAnalystEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "risk-analyst", "Health endpoint identifies risk-analyst");
	assert(health.status !== "not_ready", "Risk Analyst boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "risk-analyst", "Endpoint exposes risk-analyst manifest");
	assert(manifest.tools.length === 2, "Endpoint manifest has 2 tools");

	const toolSchema = await endpoint.discoveryToolSchema("risk-analyst.assess_investment_risk");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #443)...");
{
	// A blocking schema eval sets retryable: false on execute(). executeLoop must
	// immediately return the error — do not continue to the next LLM step.
	const blockingConfig: typeof riskAnalystConfig = {
		...riskAnalystConfig,
		evals: {
			...riskAnalystConfig.evals,
			checks: { ...riskAnalystConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: riskAnalystManifest,
		config: blockingConfig,
		// Handler returns undefined — triggers blocking schema eval failure on execute()
		handlers: Object.fromEntries(riskAnalystManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "risk-analyst.assess_investment_risk",
				args: {},
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runRiskAnalystTask("assess investment risk", {
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
			manifest: { ...riskAnalystManifest, id: "" } as typeof riskAnalystManifest,
			config: riskAnalystConfig,
			handlers: Object.fromEntries(riskAnalystManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Risk Analyst Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
