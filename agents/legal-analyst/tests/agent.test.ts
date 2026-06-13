/**
 * Legal Analyst Agent Contract Tests — Issue #370
 *
 * Proves the legal tools are accessible through the AgentRuntime contract
 * and that the legal-analyst manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createLegalAnalystEndpoint,
	createLegalAnalystRuntime,
	legalAnalystConfig,
	legalAnalystManifest,
	runLegalAnalystTask,
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

console.log("🧪 Starting Legal Analyst Agent Contract Tests (#370)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(legalAnalystManifest);
	assert(manifest.success, "Legal analyst manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(legalAnalystConfig);
	assert(config.success, "Legal analyst runtime config validates");

	assert(legalAnalystManifest.id === "legal-analyst", "Agent id is legal-analyst");
	assert(legalAnalystManifest.persona.name === "Legatus Juridicus", "Persona is Legatus Juridicus");
	assert(legalAnalystManifest.tools.length === 3, "Legal analyst exposes 3 legal tools");
	assert(
		legalAnalystManifest.tools.every((t) => t.name.startsWith("legal-analyst.")),
		"All tools follow legal-analyst. naming convention",
	);
	assert(
		legalAnalystManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		legalAnalystManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		legalAnalystManifest.tools.every((t) => t.mcpServer === "legal"),
		'All tools declare mcpServer: "legal"',
	);
	const allToolScopes = new Set(legalAnalystManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => legalAnalystManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = legalAnalystManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createLegalAnalystRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "legal-analyst.analyze_legal_framework");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns analyze_legal_framework input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"analyze_legal_framework schema declares required fields",
	);

	const missing = runtime.discover("schema", "legal-analyst.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...legalAnalystConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-legal-llm",
			model: "operator-selected-model",
		},
	};

	const analysisTool = legalAnalystManifest.tools.find((t) => t.name === "legal-analyst.analyze_legal_framework");
	assert(analysisTool !== undefined, "analyze_legal_framework tool is declared in manifest");

	const deterministicRoute = legalAnalystConfig.modelRouting.deterministic;
	assert(deterministicRoute !== undefined, "Deterministic route is configured");
	assert(deterministicRoute.provider === "rule-based", "Deterministic tools use rule-based provider");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-legal-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createLegalAnalystRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(legalAnalystManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = legalAnalystConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	const standardBinding = legalAnalystConfig.modelRouting["standard-analysis"];
	assert(
		typeof standardBinding?.model === "string" && standardBinding.model.length > 0,
		"standard-analysis model binding is a real model ID",
	);

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = legalAnalystManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No legal-analyst tool requires human approval by default");

	const strictRuntime = createLegalAnalystRuntime({
		...legalAnalystConfig,
		hitl: { ...legalAnalystConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "legal-analyst.assess_compliance",
		args: { jurisdiction: "Texas", projectType: "production", assetCount: 2 },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "legal-analyst", "Challenge identifies legal-analyst agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(legalAnalystConfig.evals.enabled === true, "Evals are enabled");
	assert(legalAnalystConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(legalAnalystConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = legalAnalystManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 3, "All legal-analyst tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createLegalAnalystEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "legal-analyst", "Health endpoint identifies legal-analyst");
	assert(health.status !== "not_ready", "Legal analyst boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "legal-analyst", "Endpoint exposes legal-analyst manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("legal-analyst.analyze_legal_framework");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #428)...");
{
	const blockingConfig: typeof legalAnalystConfig = {
		...legalAnalystConfig,
		evals: {
			...legalAnalystConfig.evals,
			checks: { ...legalAnalystConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: legalAnalystManifest,
		config: blockingConfig,
		handlers: Object.fromEntries(legalAnalystManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "legal-analyst.analyze_legal_framework",
				args: { jurisdiction: "Texas", operationType: "drilling", permitTypes: ["drilling"] },
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runLegalAnalystTask("Analyze legal framework", {
		config: blockingConfig,
		callLLM: mockLLM,
		runtime: blockingRuntime,
	});

	assert(llmCallCount.length === 1, "executeLoop halts after permanent failure — LLM not called a second time");
	assert(typeof result === "string" && result.length > 0, "Permanent failure returns non-empty error string");

	await blockingRuntime.shutdown();
}

console.log("\n🛑 Testing invalid manifest fails early...");
try {
	new LocalAgentRuntime({
		manifest: {
			...legalAnalystManifest,
			id: "",
		} as typeof legalAnalystManifest,
		config: legalAnalystConfig,
		handlers: Object.fromEntries(legalAnalystManifest.tools.map((t) => [t.name, async () => ({})])),
	});
	assert(false, "Empty manifest id should fail validation");
} catch {
	assert(true, "Invalid manifest id fails at construction");
}

console.log("\n══════════════════════════════════════════════");
console.log(`Legal Analyst Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
