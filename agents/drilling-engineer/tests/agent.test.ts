/**
 * Drilling Engineer Agent Contract Tests — Issue #374
 *
 * Proves the drilling tools are accessible through the AgentRuntime contract
 * and that the drilling-engineer manifest satisfies all Arcade acceptance criteria.
 */

import { AgentManifestSchema, AgentRuntimeConfigSchema, LocalAgentRuntime } from "@shaleyeah/sdk";
import {
	createDrillingEngineerEndpoint,
	createDrillingEngineerRuntime,
	drillingEngineerConfig,
	drillingEngineerManifest,
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

async function drillingServerReachable(): Promise<boolean> {
	try {
		const url = drillingEngineerConfig.mcpServers?.drilling?.url ?? "http://localhost:3003";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
}

console.log("🧪 Starting Drilling Engineer Agent Contract Tests (#374)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(drillingEngineerManifest);
	assert(manifest.success, "Drilling engineer manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(drillingEngineerConfig);
	assert(config.success, "Drilling engineer runtime config validates");

	assert(drillingEngineerManifest.tools.length === 3, "Drilling engineer exposes 3 drilling tools");
	assert(
		drillingEngineerManifest.tools.every((t) => t.name.startsWith("drilling-engineer.")),
		"All tools follow drilling-engineer. naming convention",
	);
	assert(
		drillingEngineerManifest.tools.every((t) => !t.modelRequirement.includes("claude")),
		"Model requirements are capability labels, not provider names",
	);
	const allToolScopes = new Set(drillingEngineerManifest.tools.flatMap((t) => t.requiredScopes));
	assert(
		[...allToolScopes].every((s) => drillingEngineerManifest.requiredScopes.includes(s)),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = drillingEngineerManifest.providerRequirements.find((p) => p.type === "llm");
	assert(llmReq?.required === true, "LLM provider requirement is marked required");
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createDrillingEngineerRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(Array.isArray(tools) && tools.length === 3, "Tool discovery returns 3 tools");
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "drilling-engineer.design_drilling_program");
	assert(schema?.inputSchema !== undefined, "Schema discovery returns design_drilling_program input schema");
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"design_drilling_program schema declares required fields",
	);

	const missing = runtime.discover("schema", "drilling-engineer.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log("\n🧭 Testing organization-owned model routing...");
{
	const live = await drillingServerReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] drilling server not reachable — execute() tests require live server");
		console.log("     Start with: cd servers/drilling && PORT=3003 pnpm start");
	} else {
		const runtime = createDrillingEngineerRuntime({
			...drillingEngineerConfig,
			modelRouting: {
				...drillingEngineerConfig.modelRouting,
				"standard-analysis": {
					provider: "acme-drilling-llm",
					model: "operator-selected-model",
				},
			},
		});
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "drilling-engineer.design_drilling_program",
			args: {
				wellParameters: {
					targetDepth: 10000,
					wellType: "horizontal",
					formation: "wolfcamp",
				},
			},
		});

		assert(result.status === "completed", "Drilling program tool completes");

		await runtime.shutdown();
	}
}

console.log("\n📡 Testing model capability routing across requirement classes...");
{
	const runtime = createDrillingEngineerRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(drillingEngineerManifest.tools.map((t) => t.modelRequirement));
	assert(modelRequirements.has("standard-analysis"), "standard-analysis requirement present in tool suite");

	for (const req of modelRequirements) {
		const binding = drillingEngineerConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const live = await drillingServerReachable();

	if (live) {
		const runtime = createDrillingEngineerRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "drilling-engineer.design_drilling_program",
			args: {
				wellParameters: {
					targetDepth: 10000,
					wellType: "horizontal",
					formation: "wolfcamp",
				},
			},
		});
		assert(result.status === "completed", "Drilling tools complete without approval challenge");

		await runtime.shutdown();
	} else {
		console.log("  ⚠️  [skipped] execute() test requires live drilling server");
	}

	// approvalMode: "always" blocks BEFORE calling the handler — no server needed
	const strictRuntime = createDrillingEngineerRuntime({
		...drillingEngineerConfig,
		hitl: { ...drillingEngineerConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "drilling-engineer.design_drilling_program",
		args: {
			wellParameters: {
				targetDepth: 10000,
				wellType: "horizontal",
				formation: "wolfcamp",
			},
		},
	});
	assert(blocked.status === "approval_required", "approvalMode: 'always' blocks all tools");
	if (blocked.status === "approval_required") {
		assert(blocked.challenge.type === "human_approval_required", "Challenge is structured");
		assert(blocked.challenge.agentId === "drilling-engineer", "Challenge identifies drilling-engineer agent");
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	const live = await drillingServerReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] eval test requires live drilling server");
	} else {
		const runtime = createDrillingEngineerRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "drilling-engineer.design_drilling_program",
			args: {
				wellParameters: {
					targetDepth: 10000,
					wellType: "horizontal",
					formation: "wolfcamp",
				},
			},
		});

		assert(result.status === "completed", "design_drilling_program completes for eval test");
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
				"All evals pass on clean drilling output",
			);
		}

		await runtime.shutdown();
	}
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createDrillingEngineerEndpoint();
	const health = await endpoint.health();
	assert(health.agentId === "drilling-engineer", "Health endpoint identifies drilling-engineer");
	assert(health.status !== "not_ready", "Drilling engineer boots without external dependencies");

	const manifest = await endpoint.manifest();
	assert(manifest.id === "drilling-engineer", "Endpoint exposes drilling-engineer manifest");
	assert(manifest.tools.length === 3, "Endpoint manifest has 3 tools");

	const toolSchema = await endpoint.discoveryToolSchema("drilling-engineer.estimate_well_costs");
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔒 Testing scope enforcement...");
{
	const runtime = createDrillingEngineerRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "drilling-engineer.design_drilling_program",
		args: {
			wellParameters: {
				targetDepth: 10000,
				wellType: "horizontal",
				formation: "wolfcamp",
			},
		},
		grantedScopes: [],
	});
	assert(blocked.status === "failed", "Missing scope blocks tool execution");
	if (blocked.status === "failed") {
		assert(blocked.error.includes("Missing required scopes"), "Error message names missing scopes");
	}

	const allowed = await runtime.execute({
		toolName: "drilling-engineer.design_drilling_program",
		args: {
			wellParameters: {
				targetDepth: 10000,
				wellType: "horizontal",
				formation: "wolfcamp",
			},
		},
		grantedScopes: ["read:drilling"],
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
	const allHandlers = Object.fromEntries(drillingEngineerManifest.tools.map((t) => [t.name, undefinedHandler]));
	const testRuntime = new LocalAgentRuntime({
		manifest: drillingEngineerManifest,
		config: drillingEngineerConfig,
		handlers: allHandlers,
	});
	await testRuntime.initialize();
	const result = await testRuntime.execute({
		toolName: "drilling-engineer.design_drilling_program",
		args: {
			wellParameters: {
				targetDepth: 10000,
				wellType: "horizontal",
				formation: "wolfcamp",
			},
		},
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
	const standardAnalysis = drillingEngineerConfig.modelRouting["standard-analysis"];
	assert(standardAnalysis !== undefined, "standard-analysis binding is present");
	assert(
		standardAnalysis?.model !== "configured-by-operator",
		"standard-analysis model is a real model ID, not a placeholder",
	);
	assert(standardAnalysis?.provider === "anthropic", "standard-analysis provider is anthropic");
}

console.log("\n🛑 Testing invalid manifest fails early...");
try {
	new LocalAgentRuntime({
		manifest: {
			...drillingEngineerManifest,
			id: "",
		} as typeof drillingEngineerManifest,
		config: drillingEngineerConfig,
		handlers: Object.fromEntries(drillingEngineerManifest.tools.map((t) => [t.name, async () => ({})])),
	});
	assert(false, "Empty manifest id should fail validation");
} catch {
	assert(true, "Invalid manifest id fails at construction");
}

console.log("\n══════════════════════════════════════════════");
console.log(`Drilling Engineer Agent Contract Tests: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
