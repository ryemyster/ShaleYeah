/**
 * Infrastructure Planner Agent Contract Tests — Issue #375
 *
 * Proves the infrastructure server tools are accessible through the AgentRuntime
 * contract and that the infrastructure-planner manifest satisfies all Arcade
 * acceptance criteria.
 */

import {
	AgentManifestSchema,
	AgentRuntimeConfigSchema,
	ContextStore,
	type LLMCallOptions,
	LocalAgentRuntime,
} from "@shaleyeah/sdk";
import {
	createInfrastructurePlannerEndpoint,
	createInfrastructurePlannerRuntime,
	infrastructurePlannerConfig,
	infrastructurePlannerManifest,
	runInfrastructurePlannerTask,
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

async function infrastructureServerReachable(): Promise<boolean> {
	try {
		const url = infrastructurePlannerConfig.mcpServers?.infrastructure?.url ?? "http://localhost:3012";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
}

console.log("🧪 Starting Infrastructure Planner Agent Contract Tests (#375)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(infrastructurePlannerManifest);
	assert(manifest.success, "Infrastructure planner manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(infrastructurePlannerConfig);
	assert(config.success, "Infrastructure planner runtime config validates");

	assert(infrastructurePlannerManifest.tools.length === 4, "Infrastructure planner exposes 4 tools");
	assert(
		infrastructurePlannerManifest.tools.every((t) => t.name.startsWith("infrastructure-planner.")),
		"All tools follow infrastructure-planner. naming convention",
	);
	assert(
		infrastructurePlannerManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	const allToolScopes = new Set(infrastructurePlannerManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => infrastructurePlannerManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = infrastructurePlannerManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createInfrastructurePlannerRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 4, "Tool discovery returns 4 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "infrastructure-planner.plan_pipeline");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns plan_pipeline input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"plan_pipeline schema declares required fields",
	);

	const missing = runtime.discover("schema", "infrastructure-planner.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n📡 Testing model capability routing...");
{
	const runtime = createInfrastructurePlannerRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(infrastructurePlannerManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = infrastructurePlannerConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy...");
{
	const live = await infrastructureServerReachable();

	if (live) {
		const runtime = createInfrastructurePlannerRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "infrastructure-planner.plan_pipeline",
			args: {
				wellCount: 10,
				expectedProduction: 5000,
				location: "Reeves County, Texas",
			},
		});
		assert(result.status === "completed", "plan_pipeline completes without approval challenge");

		await runtime.shutdown();
	} else {
		console.log("  ⚠️  [skipped] execute() test requires live infrastructure server");
	}

	const strictRuntime = createInfrastructurePlannerRuntime({
		...infrastructurePlannerConfig,
		hitl: { ...infrastructurePlannerConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "infrastructure-planner.plan_pipeline",
		args: {
			wellCount: 10,
			expectedProduction: 5000,
			location: "Reeves County, Texas",
		},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "infrastructure-planner", "Challenge identifies infrastructure-planner agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy...");
{
	const live = await infrastructureServerReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] eval test requires live infrastructure server");
	} else {
		const runtime = createInfrastructurePlannerRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "infrastructure-planner.plan_pipeline",
			args: {
				wellCount: 10,
				expectedProduction: 5000,
				location: "Reeves County, Texas",
			},
		});

		assert(result.status === "completed", "plan_pipeline completes for eval test");
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
				"All evals pass on clean output",
			);
		}

		await runtime.shutdown();
	}
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createInfrastructurePlannerEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "infrastructure-planner", "Health endpoint identifies infrastructure-planner");
	assert(health.status !== "not_ready", "Infrastructure planner boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "infrastructure-planner", "Endpoint exposes infrastructure-planner manifest");
	assert(manifest.tools.length === 4, "Endpoint manifest has 4 tools");

	const toolSchema = await endpoint.discoveryToolSchema("infrastructure-planner.size_facilities");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔒 Testing scope enforcement...");
{
	const runtime = createInfrastructurePlannerRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "infrastructure-planner.plan_pipeline",
		args: {
			wellCount: 10,
			expectedProduction: 5000,
			location: "Reeves County, Texas",
		},
		grantedScopes: [],
	});
	assert(blocked.status === "failed", "Missing scope blocks tool execution");
	if (blocked.status === "failed") {
		assert(blocked.error.includes("Missing required scopes"), "Error message names missing scopes");
	}

	const allowed = await runtime.execute({
		toolName: "infrastructure-planner.plan_pipeline",
		args: {
			wellCount: 10,
			expectedProduction: 5000,
			location: "Reeves County, Texas",
		},
		grantedScopes: ["read:infrastructure"],
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
	const allHandlers = Object.fromEntries(infrastructurePlannerManifest.tools.map((t) => [t.name, undefinedHandler]));
	const testRuntime = new LocalAgentRuntime({
		manifest: infrastructurePlannerManifest,
		config: infrastructurePlannerConfig,
		handlers: allHandlers,
	});
	await testRuntime.initialize();
	const result = await testRuntime.execute({
		toolName: "infrastructure-planner.plan_pipeline",
		args: {
			wellCount: 10,
			expectedProduction: 5000,
			location: "Reeves County, Texas",
		},
	});
	assert(result.status === "failed", "Blocking eval failure returns status: failed");
	if (result.status === "failed") {
		assert(result.error.includes("Blocking eval"), "Error message references blocking eval");
		assert(result.retryable === false, "Blocking eval failures are not retryable");
	}
	await testRuntime.shutdown();
}

console.log("\n🔴 Testing permanent halt on non-retryable failure (issue #427)...");
{
	const blockingConfig: typeof infrastructurePlannerConfig = {
		...infrastructurePlannerConfig,
		evals: {
			...infrastructurePlannerConfig.evals,
			checks: { ...infrastructurePlannerConfig.evals.checks, schema: "blocking" },
		},
	};
	const blockingRuntime = new LocalAgentRuntime({
		manifest: infrastructurePlannerManifest,
		config: blockingConfig,
		handlers: Object.fromEntries(infrastructurePlannerManifest.tools.map((t) => [t.name, async () => undefined])),
	});
	await blockingRuntime.initialize();

	const llmCallCount: number[] = [];
	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		llmCallCount.push(1);
		if (llmCallCount.length === 1) {
			return JSON.stringify({
				action: "tool",
				tool: "infrastructure-planner.plan_pipeline",
				args: { wellCount: 10, expectedProduction: 500, location: "Reeves County, Texas" },
			});
		}
		return JSON.stringify({ action: "done", answer: "should not reach here" });
	};

	const result = await runInfrastructurePlannerTask("Plan pipeline infrastructure", {
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
	const ns = infrastructurePlannerManifest.memory?.namespace ?? "infrastructure-planner";
	ContextStore.clear(ns);
	ContextStore.write(ns, "Prior finding: test context seeded for Infrastructure Planner.");

	let capturedSystem = "";
	const mockLLM = async (opts: LLMCallOptions): Promise<string> => {
		capturedSystem = opts.system ?? "";
		return JSON.stringify({ action: "done", answer: "Analysis complete." });
	};

	const rt = createInfrastructurePlannerRuntime();
	await rt.initialize();
	await runInfrastructurePlannerTask("Analyze test data.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	assert(
		capturedSystem.includes("Prior finding: test context seeded for Infrastructure Planner."),
		"Prior context from namespace is injected into system prompt",
	);
	ContextStore.clear(ns);
}

console.log("\n🗂️  Testing context injection — findings written after run...");
{
	const ns = infrastructurePlannerManifest.memory?.namespace ?? "infrastructure-planner";
	ContextStore.clear(ns);

	const mockLLM = async (_opts: LLMCallOptions): Promise<string> => {
		return JSON.stringify({
			action: "done",
			answer: "Infrastructure Planner analysis: test finding written to store.",
		});
	};

	const rt = createInfrastructurePlannerRuntime();
	await rt.initialize();
	await runInfrastructurePlannerTask("Summarize the analysis.", { runtime: rt, callLLM: mockLLM });
	await rt.shutdown();

	const stored = ContextStore.read(ns);
	assert(
		stored.includes("Infrastructure Planner analysis: test finding written to store."),
		"Answer is written to context store after task completes",
	);
	ContextStore.clear(ns);
}
console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: {
				...infrastructurePlannerManifest,
				id: "",
			} as typeof infrastructurePlannerManifest,
			config: infrastructurePlannerConfig,
			handlers: Object.fromEntries(infrastructurePlannerManifest.tools.map((t) => [t.name, async () => ({})])),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(`Infrastructure Planner Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
