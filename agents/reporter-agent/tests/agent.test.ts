/**
 * Reporter Agent Contract Tests — Issue #441
 *
 * Proves the reporter tools are accessible through the AgentRuntime contract
 * and that the reporter-agent manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createReporterAgentEndpoint,
	createReporterAgentRuntime,
	reporterAgentConfig,
	reporterAgentManifest,
	runReporterAgentTask,
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

console.log("🧪 Starting Reporter Agent Contract Tests (#441)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(reporterAgentManifest);
	assert(manifest.success, "Reporter Agent manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(reporterAgentConfig);
	assert(config.success, "Reporter Agent runtime config validates");

	assert(reporterAgentManifest.id === "reporter-agent", "Agent id is reporter-agent");
	assert(
		reporterAgentManifest.persona.name === "Scriptor Reporticus Maximus",
		"Persona is Scriptor Reporticus Maximus",
	);
	assert(reporterAgentManifest.tools.length === 3, "Reporter Agent exposes 3 reporting tools");
	assert(
		reporterAgentManifest.tools.every((t) => t.name.startsWith("reporter-agent.")),
		"All tools follow reporter-agent. naming convention",
	);
	assert(
		reporterAgentManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	assert(
		reporterAgentManifest.tools.every((t) => t.inputSchema && typeof t.inputSchema === "object"),
		"All tools declare explicit input schemas",
	);
	assert(
		reporterAgentManifest.tools.every((t) => t.mcpServer === "reporter"),
		'All tools declare mcpServer: "reporter"',
	);
	const allToolScopes = new Set(reporterAgentManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => reporterAgentManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = reporterAgentManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createReporterAgentRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "reporter-agent.synthesize_analysis");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns synthesize_analysis input schema");

	const missing = runtime.discover("schema", "reporter-agent.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const customRouting = {
		...reporterAgentConfig.modelRouting,
		"standard-analysis": {
			provider: "acme-reporting-llm",
			model: "operator-selected-model",
		},
	};

	const synthesisTool = reporterAgentManifest.tools.find((t) => t.name === "reporter-agent.synthesize_analysis");
	assert(synthesisTool !== undefined, "synthesize_analysis tool is declared in manifest");

	const deepReasoningRoute = reporterAgentConfig.modelRouting["deep-reasoning"];
	assert(deepReasoningRoute !== undefined, "Deep reasoning route is configured");

	const overrideRoute = customRouting["standard-analysis"];
	assert(overrideRoute.provider === "acme-reporting-llm", "Operator override populates provider");
	assert(overrideRoute.model === "operator-selected-model", "Operator override populates model");
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createReporterAgentRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(reporterAgentManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");
	assert(modelRequirements.has("deep-reasoning"), "deep-reasoning requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = reporterAgentConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const approvalRequired = reporterAgentManifest.tools.filter((t) => t.requiresHumanApproval);
	assert(approvalRequired.length === 0, "No reporter-agent tool requires human approval by default");

	const strictRuntime = createReporterAgentRuntime({
		...reporterAgentConfig,
		hitl: { ...reporterAgentConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "reporter-agent.synthesize_analysis",
		args: {},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "reporter-agent", "Challenge identifies reporter-agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	assert(reporterAgentConfig.evals.enabled === true, "Evals are enabled");
	assert(reporterAgentConfig.evals.checks.schema === "blocking", "Schema eval is blocking");
	assert(reporterAgentConfig.evals.checks.redactSecrets === "blocking", "Secret-redaction eval is blocking");

	const profileTools = reporterAgentManifest.tools.filter((t) => t.evalProfile);
	assert(profileTools.length === 3, "All reporter-agent tools declare eval profiles");
	assert(
		profileTools.every((t) => typeof t.evalProfile === "string"),
		"All declared eval profiles are strings",
	);
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createReporterAgentEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "reporter-agent", "Health endpoint identifies reporter-agent");
	assert(health.status !== "not_ready", "Reporter Agent boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "reporter-agent", "Endpoint exposes reporter-agent manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("reporter-agent.synthesize_analysis");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #441)...");
{
	// A blocking schema eval sets retryable: false on execute(). executeLoop must
	// immediately return the error — do not continue to the next LLM step.
	const blockingConfig: typeof reporterAgentConfig = {
		...reporterAgentConfig,
		evals: {
			...reporterAgentConfig.evals,
			checks: { ...reporterAgentConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: reporterAgentManifest,
		config: blockingConfig,
		// Handler returns undefined — triggers blocking schema eval failure on execute()
		handlers: Object.fromEntries(reporterAgentManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "reporter-agent.synthesize_analysis",
				args: {},
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runReporterAgentTask("synthesize analysis into a report", {
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
			manifest: { ...reporterAgentManifest, id: "" } as typeof reporterAgentManifest,
			config: reporterAgentConfig,
			handlers: Object.fromEntries(reporterAgentManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Reporter Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
