/**
 * Title Analyst Agent Contract Tests — Issue #372
 *
 * Proves the title server tools are accessible through the AgentRuntime contract
 * and that the title-analyst manifest satisfies all Arcade acceptance criteria.
 */

import {
	AgentManifestSchema,
	AgentRuntimeConfigSchema,
	LocalAgentRuntime,
} from "@shaleyeah/sdk";
import {
	createTitleAnalystEndpoint,
	createTitleAnalystRuntime,
	titleAnalystConfig,
	titleAnalystManifest,
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

async function titleServerReachable(): Promise<boolean> {
	try {
		const url =
			titleAnalystConfig.mcpServers?.title?.url ?? "http://localhost:3010";
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 500);
		await fetch(url, { method: "HEAD", signal: ctrl.signal });
		clearTimeout(timer);
		return true;
	} catch {
		return false;
	}
}

console.log("🧪 Starting Title Analyst Agent Contract Tests (#372)\n");

console.log("📋 Testing manifest and config validation...");
{
	const manifest = AgentManifestSchema.safeParse(titleAnalystManifest);
	assert(manifest.success, "Title analyst manifest validates");
	if (!manifest.success) console.error("  ", manifest.error.format());

	const config = AgentRuntimeConfigSchema.safeParse(titleAnalystConfig);
	assert(config.success, "Title analyst runtime config validates");

	assert(
		titleAnalystManifest.tools.length === 4,
		"Title analyst exposes 4 title tools",
	);
	assert(
		titleAnalystManifest.tools.every((t) =>
			t.name.startsWith("title-analyst."),
		),
		"All tools follow title-analyst. naming convention",
	);
	assert(
		titleAnalystManifest.tools.every(
			(t) => !t.modelRequirement.includes("claude"),
		),
		"Model requirements are capability labels, not provider names",
	);
	const allToolScopes = new Set(
		titleAnalystManifest.tools.flatMap((t) => t.requiredScopes),
	);
	assert(
		[...allToolScopes].every((s) =>
			titleAnalystManifest.requiredScopes.includes(s),
		),
		"Manifest requiredScopes is a superset of all tool requiredScopes",
	);
	const llmReq = titleAnalystManifest.providerRequirements.find(
		(p) => p.type === "llm",
	);
	assert(
		llmReq?.required === true,
		"LLM provider requirement is marked required",
	);
}

console.log("\n🔎 Testing progressive discovery...");
{
	const runtime = createTitleAnalystRuntime();
	await runtime.initialize();

	const summary = runtime.discover("summary");
	assert("capabilities" in summary, "Summary discovery returns capabilities");
	assert(!("tools" in summary), "Summary discovery does not include tool list");

	const tools = runtime.discover("tools");
	assert(
		Array.isArray(tools) && tools.length === 4,
		"Tool discovery returns 4 tools",
	);
	assert(!("inputSchema" in tools[0]), "Tool list omits input schemas");

	const schema = runtime.discover("schema", "title-analyst.examine_ownership");
	assert(
		schema?.inputSchema !== undefined,
		"Schema discovery returns examine_ownership input schema",
	);
	assert(
		(schema?.inputSchema as Record<string, unknown>)?.required !== undefined,
		"examine_ownership schema declares required fields",
	);

	const missing = runtime.discover("schema", "title-analyst.nonexistent");
	assert(missing === null, "Schema discovery returns null for unknown tool");

	await runtime.shutdown();
}

console.log(
	"\n📡 Testing model capability routing across requirement classes...",
);
{
	const runtime = createTitleAnalystRuntime();
	await runtime.initialize();

	const modelRequirements = new Set(
		titleAnalystManifest.tools.map((t) => t.modelRequirement),
	);
	assert(
		modelRequirements.has("standard-analysis"),
		"standard-analysis requirement present in tool suite",
	);

	for (const req of modelRequirements) {
		const binding = titleAnalystConfig.modelRouting[req];
		assert(binding !== undefined, `Model route exists for requirement: ${req}`);
	}

	await runtime.shutdown();
}

console.log("\n🙋 Testing HITL policy wires through to config...");
{
	const live = await titleServerReachable();

	if (live) {
		const runtime = createTitleAnalystRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "title-analyst.examine_ownership",
			args: {
				propertyDescription: "Section 12 Block A",
				county: "Reeves",
				state: "TX",
			},
		});
		assert(
			result.status === "completed",
			"Ownership tool completes without approval challenge",
		);

		await runtime.shutdown();
	} else {
		console.log("  ⚠️  [skipped] execute() test requires live title server");
	}

	// approvalMode: "always" blocks BEFORE calling the handler — no server needed
	const strictRuntime = createTitleAnalystRuntime({
		...titleAnalystConfig,
		hitl: { ...titleAnalystConfig.hitl, approvalMode: "always" },
	});
	await strictRuntime.initialize();
	const blocked = await strictRuntime.execute({
		toolName: "title-analyst.examine_ownership",
		args: {
			propertyDescription: "Section 12 Block A",
			county: "Reeves",
			state: "TX",
		},
	});
	assert(
		blocked.status === "approval_required",
		"approvalMode: 'always' blocks all tools",
	);
	if (blocked.status === "approval_required") {
		assert(
			blocked.challenge.type === "human_approval_required",
			"Challenge is structured",
		);
		assert(
			blocked.challenge.agentId === "title-analyst",
			"Challenge identifies title-analyst agent",
		);
	}

	await strictRuntime.shutdown();
}

console.log("\n🧪 Testing evals policy is configured correctly...");
{
	const live = await titleServerReachable();
	if (!live) {
		console.log("  ⚠️  [skipped] eval test requires live title server");
	} else {
		const runtime = createTitleAnalystRuntime();
		await runtime.initialize();

		const result = await runtime.execute({
			toolName: "title-analyst.examine_ownership",
			args: {
				propertyDescription: "Section 12 Block A",
				county: "Reeves",
				state: "TX",
			},
		});

		assert(
			result.status === "completed",
			"examine_ownership completes for eval test",
		);
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
				"All evals pass on clean title output",
			);
		}

		await runtime.shutdown();
	}
}

console.log("\n🏥 Testing health endpoint and standalone boot...");
{
	const endpoint = createTitleAnalystEndpoint();
	const health = await endpoint.health();
	assert(
		health.agentId === "title-analyst",
		"Health endpoint identifies title-analyst",
	);
	assert(
		health.status !== "not_ready",
		"Title analyst boots without external dependencies",
	);

	const manifest = await endpoint.manifest();
	assert(
		manifest.id === "title-analyst",
		"Endpoint exposes title-analyst manifest",
	);
	assert(manifest.tools.length === 4, "Endpoint manifest has 4 tools");

	const toolSchema = await endpoint.discoveryToolSchema(
		"title-analyst.analyze_lease",
	);
	assert(toolSchema !== null, "Endpoint exposes tool schemas by name");
}

console.log("\n🔒 Testing scope enforcement...");
{
	const runtime = createTitleAnalystRuntime();
	await runtime.initialize();

	const blocked = await runtime.execute({
		toolName: "title-analyst.examine_ownership",
		args: {
			propertyDescription: "Section 12 Block A",
			county: "Reeves",
			state: "TX",
		},
		grantedScopes: [],
	});
	assert(blocked.status === "failed", "Missing scope blocks tool execution");
	if (blocked.status === "failed") {
		assert(
			blocked.error.includes("Missing required scopes"),
			"Error message names missing scopes",
		);
	}

	const allowed = await runtime.execute({
		toolName: "title-analyst.examine_ownership",
		args: {
			propertyDescription: "Section 12 Block A",
			county: "Reeves",
			state: "TX",
		},
		grantedScopes: ["read:title"],
	});
	assert(
		allowed.status !== "failed" ||
			!allowed.error.includes("Missing required scopes"),
		"Correct scopes are accepted",
	);

	await runtime.shutdown();
}

console.log("\n🧱 Testing blocking eval halt...");
{
	const undefinedHandler = async () => undefined;
	const allHandlers = Object.fromEntries(
		titleAnalystManifest.tools.map((t) => [t.name, undefinedHandler]),
	);
	const testRuntime = new LocalAgentRuntime({
		manifest: titleAnalystManifest,
		config: titleAnalystConfig,
		handlers: allHandlers,
	});
	await testRuntime.initialize();
	const result = await testRuntime.execute({
		toolName: "title-analyst.examine_ownership",
		args: {
			propertyDescription: "Section 12 Block A",
			county: "Reeves",
			state: "TX",
		},
	});
	assert(
		result.status === "failed",
		"Blocking eval failure returns status: failed",
	);
	if (result.status === "failed") {
		assert(
			result.error.includes("Blocking eval"),
			"Error message references blocking eval",
		);
		assert(
			result.retryable === false,
			"Blocking eval failures are not retryable",
		);
	}
	await testRuntime.shutdown();
}

console.log("\n🛑 Testing invalid manifest fails early...");
{
	try {
		new LocalAgentRuntime({
			manifest: {
				...titleAnalystManifest,
				id: "",
			} as typeof titleAnalystManifest,
			config: titleAnalystConfig,
			handlers: Object.fromEntries(
				titleAnalystManifest.tools.map((t) => [t.name, async () => ({})]),
			),
		});
		assert(false, "Empty manifest id should fail validation");
	} catch {
		assert(true, "Invalid manifest id fails at construction");
	}
}

console.log("\n══════════════════════════════════════════════");
console.log(
	`Title Analyst Agent Contract Tests: ${passed} passed, ${failed} failed`,
);
console.log("══════════════════════════════════════════════");

if (failed > 0) {
	process.exit(1);
}
