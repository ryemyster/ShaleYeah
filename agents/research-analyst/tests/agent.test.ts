/**
 * Research Analyst Agent Contract Tests — Issue #369
 *
 * Proves the research tools are accessible through the AgentRuntime contract
 * and that the research-analyst manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, type LLMCallOptions, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createResearchAnalystEndpoint,
	createResearchAnalystRuntime,
	researchAnalystConfig,
	researchAnalystManifest,
	runResearchAnalystTask,
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

async function researchReachable(): Promise<boolean> {
	try {
		const url = researchAnalystConfig.mcpServers?.research?.url ?? "http://localhost:3008";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
}

console.log("🧪 Starting Research Analyst Agent Contract Tests (#369)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(researchAnalystManifest);
	assert(manifest.success, "Research analyst manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(researchAnalystConfig);
	assert(config.success, "Research analyst runtime config validates");

	assert(researchAnalystManifest.tools.length === 2, "Research analyst exposes 2 research tools");
	assert(
		researchAnalystManifest.tools.every((t) => t.name.startsWith("research-analyst.")),
		"All tools follow research-analyst. naming convention",
	);
	assert(
		researchAnalystManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	const allToolScopes = new Set(researchAnalystManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => researchAnalystManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = researchAnalystManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createResearchAnalystRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 2, "Tool discovery returns 2 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "research-analyst.conduct_market_research");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns conduct_market_research input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"conduct_market_research schema declares required fields",
	);

	const missing = runtime.discover("schema", "research-analyst.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const live = await researchReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] research server not reachable — execute() tests require live server");
		console.log("     Start with: cd servers/research && PORT=3008 pnpm start");
	} else {
		const runtime = createResearchAnalystRuntime({
			...researchAnalystConfig,
			modelRouting: {
				...researchAnalystConfig.modelRouting,
				"standard-analysis": {
					provider: "acme-intelligence-llm",
					model: "operator-selected-model",
				},
			},
		});
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "research-analyst.conduct_market_research",
			args: { topic: "Permian Basin", scope: "regional" },
		});

		assert(result.status === "completed", "Market research tool completes");
		if (result.status === "completed") {
			assert(
				result.metadata.modelRequirement === "standard-analysis",
				"conduct_market_research routes to standard-analysis",
			);
		}

		await runtime.shutdown();
	}
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createResearchAnalystRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(researchAnalystManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = researchAnalystConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const live = await researchReachable();

	if (live) {
		const runtime = createResearchAnalystRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "research-analyst.conduct_market_research",
			args: { topic: "Permian Basin", scope: "regional" },
		});
		assert(result.status === "completed", "Research tools complete without approval challenge");

		await runtime.shutdown();
	} else {
		console.log("  ⚠️  [skipped] execute() test requires live research server");
	}

	// approvalMode: "always" blocks BEFORE calling the handler — no server needed
	const strictRuntime = createResearchAnalystRuntime({
		...researchAnalystConfig,
		hitl: { ...researchAnalystConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "research-analyst.conduct_market_research",
		args: { topic: "test", scope: "regional" },
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "research-analyst", "Challenge identifies research-analyst agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	const live = await researchReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] eval test requires live research server");
	} else {
		const runtime = createResearchAnalystRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "research-analyst.conduct_market_research",
			args: { topic: "Permian Basin", scope: "regional" },
		});

		assert(result.status === "completed", "conduct_market_research completes for eval test");
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
				"All evals pass on clean research output",
			);
		}

		await runtime.shutdown();
	}
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createResearchAnalystEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "research-analyst", "Health endpoint identifies research-analyst");
	assert(health.status !== "not_ready", "Research analyst boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "research-analyst", "Endpoint exposes research-analyst manifest");
	assert(manifest.tools.length === 2, "Endpoint manifest has 2 tools");

	const toolSchema = await endpoint.discoveryToolSchema("research-analyst.analyze_competition");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔒 Testing scope enforcement...");
{
	const runtime = createResearchAnalystRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "research-analyst.conduct_market_research",
		args: { topic: "Permian Basin", scope: "regional" },
		grantedScopes: [],
	});
	assert(blocked.status === "failed", "Missing scope blocks tool execution");
	if (blocked.status === "failed") {
		assert(blocked.error.includes("Missing required scopes"), "Error message names missing scopes");
	}

	const allowed = await runtime.execute({
		toolName: "research-analyst.conduct_market_research",
		args: { topic: "Permian Basin", scope: "regional" },
		grantedScopes: ["read:research"],
	});
	assert(
		allowed.status !== "failed" || !allowed.error.includes("Missing required scopes"),
		"Correct scopes are accepted",
	);

	await runtime.shutdown();
}

console.log("\n🧱 Testing blocking eval halt...");
{
	const undefinedHandler = async () => undefined;
	const allHandlers = Object.fromEntries(researchAnalystManifest.tools.map((t) => [t.name, undefinedHandler]));
	const testRuntime = new LocalAgentRuntime({
		manifest: researchAnalystManifest,
		config: researchAnalystConfig,
		handlers: allHandlers,
	});
	await testRuntime.initialize();
	const result = await testRuntime.execute({
		toolName: "research-analyst.conduct_market_research",
		args: { topic: "Permian Basin", scope: "regional" },
	});
	assert(result.status === "failed", "Blocking eval failure returns status: failed");
	if (result.status === "failed") {
		assert(result.error.includes("Blocking eval"), "Error message references blocking eval");
		assert(result.retryable === false, "Blocking eval failures are not retryable");
	}
	await testRuntime.shutdown();
}

console.log("\n🔀 Testing model routing resolution...");
{
	const standardAnalysis = researchAnalystConfig.modelRouting["standard-analysis"];
	assert(standardAnalysis !== undefined, "standard-analysis binding is present");
	assert(
		standardAnalysis?.model !== "configured-by-operator",
		"standard-analysis model is a real model ID, not a placeholder",
	);
	assert(standardAnalysis?.provider === "anthropic", "standard-analysis provider is anthropic");
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #429)...");
{
	const blockingConfig: typeof researchAnalystConfig = {
		...researchAnalystConfig,
		evals: {
			...researchAnalystConfig.evals,
			checks: { ...researchAnalystConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: researchAnalystManifest,
		config: blockingConfig,
		handlers: Object.fromEntries(researchAnalystManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "research-analyst.conduct_market_research",
				args: { commodity: "crude oil", region: "Permian Basin", timeframe: "2025" },
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runResearchAnalystTask("Research oil market", {
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
			manifest: { ...researchAnalystManifest, id: "" } as typeof researchAnalystManifest,
			config: researchAnalystConfig,
			handlers: Object.fromEntries(researchAnalystManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Research Analyst Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
