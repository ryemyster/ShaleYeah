/**
 * Kernel Registry Tests — Wave 1
 *
 * Tests for the Tool Registry and Kernel discovery capabilities.
 */

import { Kernel } from "../src/kernel/index.js";
import { ShaleYeahMCPClient } from "../src/mcp-client.js";

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

console.log("🧪 Starting Kernel Registry Tests (Wave 1)\n");

// ==========================================
// Setup: Build kernel from real server configs
// ==========================================

const client = new ShaleYeahMCPClient();
const kernel = new Kernel();
kernel.initialize(client.serverConfigs);

// ==========================================
// Test: Kernel initialization
// ==========================================

console.log("⚙️ Testing Kernel Initialization...");
assert(kernel.initialized, "Kernel is initialized");
assert(kernel.registry.serverCount === 14, `Registry has 14 servers (got ${kernel.registry.serverCount})`);
assert(kernel.registry.toolCount === 14, `Registry has 14 tools (got ${kernel.registry.toolCount})`);

// ==========================================
// Test: listServers returns all 14
// ==========================================

console.log("\n📡 Testing listServers...");
const allServers = kernel.listServers();
assert(allServers.length === 14, `listServers returns 14 servers (got ${allServers.length})`);

const serverNames = allServers.map((s) => s.name);
assert(serverNames.includes("geowiz"), "Includes geowiz");
assert(serverNames.includes("econobot"), "Includes econobot");
assert(serverNames.includes("decision"), "Includes decision");
assert(serverNames.includes("reporter"), "Includes reporter");
assert(serverNames.includes("research"), "Includes research");

// Check server info shape
const geowiz = allServers.find((s) => s.name === "geowiz")!;
assert(geowiz.domain === "geology", `geowiz domain is geology (got ${geowiz.domain})`);
assert(geowiz.persona === "Marcus Aurelius Geologicus", `geowiz persona correct`);
assert(geowiz.capabilities.length > 0, "geowiz has capabilities");
assert(geowiz.status === "disconnected", "geowiz status is disconnected (not connected yet)");

// ==========================================
// Test: listServers with filters
// ==========================================

console.log("\n🔍 Testing listServers with filters...");
const geologyServers = kernel.listServers({ domain: "geology" });
assert(geologyServers.length === 1, `Domain filter 'geology' returns 1 server (got ${geologyServers.length})`);
assert(geologyServers[0].name === "geowiz", "Geology server is geowiz");

const commandServers = kernel.listServers({ type: "command" });
assert(commandServers.length === 2, `Type filter 'command' returns 2 servers (got ${commandServers.length})`);
const commandNames = commandServers.map((s) => s.name).sort();
assert(commandNames[0] === "decision", "Command servers include decision");
assert(commandNames[1] === "reporter", "Command servers include reporter");

const queryServers = kernel.listServers({ type: "query" });
assert(queryServers.length === 12, `Type filter 'query' returns 12 servers (got ${queryServers.length})`);

const capFilter = kernel.listServers({ capability: "formation" });
assert(capFilter.length >= 1, `Capability filter 'formation' returns at least 1 (got ${capFilter.length})`);
assert(
	capFilter.some((s) => s.name === "geowiz"),
	"Capability 'formation' matches geowiz",
);

// ==========================================
// Test: describeTools
// ==========================================

console.log("\n🔧 Testing describeTools...");
const allTools = kernel.describeTools();
assert(allTools.length === 14, `describeTools() returns 14 tools (got ${allTools.length})`);

const geowizTools = kernel.describeTools("geowiz");
assert(geowizTools.length === 1, `describeTools('geowiz') returns 1 tool (got ${geowizTools.length})`);
assert(geowizTools[0].name === "geowiz.analyze", `Primary tool is geowiz.analyze`);
assert(geowizTools[0].type === "query", "geowiz tool is type query");
assert(geowizTools[0].readOnly === true, "geowiz tool is readOnly");
assert(geowizTools[0].requiresConfirmation === false, "geowiz does not require confirmation");

const decisionTools = kernel.describeTools("decision");
assert(decisionTools[0].type === "command", "decision tool is type command");
assert(decisionTools[0].readOnly === false, "decision tool is not readOnly");
assert(decisionTools[0].requiresConfirmation === true, "decision requires confirmation");

// Detail levels
assert(geowizTools[0].detailLevels.includes("summary"), "Tool supports summary detail level");
assert(geowizTools[0].detailLevels.includes("full"), "Tool supports full detail level");

// ==========================================
// Test: findCapability
// ==========================================

console.log("\n🎯 Testing findCapability...");
const formationTools = kernel.findCapability("formation_analysis");
assert(
	formationTools.length >= 1,
	`findCapability('formation_analysis') finds at least 1 (got ${formationTools.length})`,
);
assert(
	formationTools.some((t) => t.server === "geowiz"),
	"formation_analysis matches geowiz",
);

const investmentTools = kernel.findCapability("investment_strategy");
assert(
	investmentTools.length >= 1,
	`findCapability('investment_strategy') finds at least 1 (got ${investmentTools.length})`,
);
assert(
	investmentTools.some((t) => t.server === "decision"),
	"investment_strategy matches decision",
);

const monteCarloTools = kernel.findCapability("monte_carlo");
assert(monteCarloTools.length >= 1, `findCapability('monte_carlo') finds at least 1 (got ${monteCarloTools.length})`);
assert(
	monteCarloTools.some((t) => t.server === "risk-analysis"),
	"monte_carlo matches risk-analysis",
);

const noMatch = kernel.findCapability("quantum_computing");
assert(noMatch.length === 0, "findCapability('quantum_computing') returns 0 (no match)");

// Case insensitive
const caseTest = kernel.findCapability("FORMATION_ANALYSIS");
assert(caseTest.length >= 1, "findCapability is case-insensitive");

// ==========================================
// Test: resolveServer
// ==========================================

console.log("\n🗺️ Testing resolveServer...");
assert(kernel.resolveServer("geowiz.analyze") === "geowiz", "Resolves fully qualified name");
assert(kernel.resolveServer("geowiz") === "geowiz", "Resolves short server name");
assert(kernel.resolveServer("decision.analyze") === "decision", "Resolves decision.analyze");
assert(kernel.resolveServer("decision") === "decision", "Resolves decision shorthand");
assert(kernel.resolveServer("nonexistent") === undefined, "Returns undefined for unknown tool");

// ==========================================
// Test: Tool type classification
// ==========================================

console.log("\n🏷️ Testing tool type classification...");
const queryToolNames = [
	"geowiz",
	"econobot",
	"curve-smith",
	"risk-analysis",
	"market",
	"research",
	"legal",
	"title",
	"drilling",
	"infrastructure",
	"development",
	"test",
];
for (const name of queryToolNames) {
	const tools = kernel.describeTools(name);
	assert(tools[0]?.type === "query", `${name} is classified as query`);
}

const commandToolNames = ["reporter", "decision"];
for (const name of commandToolNames) {
	const tools = kernel.describeTools(name);
	assert(tools[0]?.type === "command", `${name} is classified as command`);
}

// ==========================================
// Test: Double initialization is idempotent
// ==========================================

console.log("\n🔄 Testing idempotent initialization...");
kernel.initialize(client.serverConfigs);
assert(kernel.registry.serverCount === 14, "Double init still has 14 servers (idempotent)");

// ==========================================
// Test: Fallback chain — Issue #149
// ==========================================

console.log("\n🔁 Testing fallback chain registration (Issue #149)...");
{
	const { Registry } = await import("../src/kernel/registry.js");
	const reg = new Registry();

	// getFallbacks returns empty array when nothing registered
	const none = reg.getFallbacks("geowiz.analyze");
	assert(Array.isArray(none), "getFallbacks returns an array");
	assert(none.length === 0, "getFallbacks returns [] for unregistered tool");

	// Single-string registration
	reg.registerFallback("geowiz.analyze", "risk-analysis.analyze");
	const single = reg.getFallbacks("geowiz.analyze");
	assert(single.length === 1, `Single fallback: chain length 1 (got ${single.length})`);
	assert(single[0] === "risk-analysis.analyze", "Single fallback: correct tool name");

	// getFallback compat alias returns first in chain
	const compat = reg.getFallback("geowiz.analyze");
	assert(compat === "risk-analysis.analyze", "getFallback() compat alias returns first entry");

	// Array registration — ordered hierarchy
	reg.registerFallback("econobot.analyze", ["decision.analyze", "research.analyze"]);
	const chain = reg.getFallbacks("econobot.analyze");
	assert(chain.length === 2, `Ordered chain: length 2 (got ${chain.length})`);
	assert(chain[0] === "decision.analyze", "Chain order preserved: first is decision");
	assert(chain[1] === "research.analyze", "Chain order preserved: second is research");

	// getFallback compat alias returns first in multi-chain
	const compatChain = reg.getFallback("econobot.analyze");
	assert(compatChain === "decision.analyze", "getFallback() compat alias returns first of multi-chain");

	// Overwrite replaces mapping
	reg.registerFallback("econobot.analyze", "market.analyze");
	const overwritten = reg.getFallbacks("econobot.analyze");
	assert(overwritten.length === 1, "Overwrite replaces previous mapping");
	assert(overwritten[0] === "market.analyze", "Overwrite: new fallback is correct");
}

// ==========================================
// Test: Schema Explorer — layered discovery
// ==========================================

console.log("\n🔍 Testing Schema Explorer (layered discovery)...");

{
	// Level 1 — schemaExplorerListServers()
	const servers = kernel.schemaExplorerListServers();
	assert(servers.length === 14, `Level 1: returns 14 server entries (got ${servers.length})`);

	const geowizEntry = servers.find((s) => s.name === "geowiz");
	assert(geowizEntry !== undefined, "Level 1: geowiz entry exists");
	assert(
		typeof geowizEntry?.description === "string" && geowizEntry.description.length > 0,
		"Level 1: geowiz has description",
	);
	assert(typeof geowizEntry?.toolCount === "number" && geowizEntry.toolCount > 0, "Level 1: geowiz toolCount > 0");

	// Level 1 entries must NOT include inputSchema (that would defeat the purpose)
	const hasSchema = Object.hasOwn(geowizEntry ?? {}, "inputSchema");
	assert(!hasSchema, "Level 1: server entries do not expose inputSchema");
}

{
	// Level 2 — schemaExplorerListTools()
	const tools = kernel.schemaExplorerListTools("geowiz");
	assert(tools.length > 0, `Level 2: geowiz has at least 1 tool (got ${tools.length})`);

	const first = tools[0];
	assert(typeof first?.name === "string" && first.name.length > 0, "Level 2: tool has name");
	assert(typeof first?.description === "string", "Level 2: tool has description");
	assert(
		first?.type === "query" || first?.type === "command" || first?.type === "discovery",
		"Level 2: tool type is valid",
	);

	// Level 2 must NOT expose inputSchema
	const hasSchema = Object.hasOwn(first ?? {}, "inputSchema");
	assert(!hasSchema, "Level 2: tool entries do not expose inputSchema");

	// Unknown server → empty array, not a throw
	const unknown = kernel.schemaExplorerListTools("nonexistent_server");
	assert(Array.isArray(unknown) && unknown.length === 0, "Level 2: unknown server returns []");
}

{
	// Level 3 — schemaExplorerDescribe()
	const toolName = kernel.schemaExplorerListTools("geowiz")[0]?.name ?? "geowiz.analyze";
	const descriptor = kernel.schemaExplorerDescribe("geowiz", toolName);
	assert(descriptor !== null, "Level 3: known tool returns a descriptor");
	assert(
		descriptor?.name === toolName || descriptor?.name === `geowiz.${toolName}`,
		"Level 3: descriptor name matches",
	);
	assert(typeof descriptor?.inputSchema === "object", "Level 3: full descriptor includes inputSchema");

	// Unknown tool → null, not a throw
	const missing = kernel.schemaExplorerDescribe("geowiz", "nonexistent_tool");
	assert(missing === null, "Level 3: unknown tool returns null");

	// Unknown server → null, not a throw
	const badServer = kernel.schemaExplorerDescribe("nonexistent_server", "any_tool");
	assert(badServer === null, "Level 3: unknown server returns null");
}

{
	// Unified schemaExplorer() dispatcher
	const lvl1 = kernel.schemaExplorer("servers");
	assert(
		Array.isArray(lvl1) && (lvl1 as unknown[]).length === 14,
		"Unified dispatcher: level=servers returns 14 entries",
	);

	const lvl2 = kernel.schemaExplorer("tools", "geowiz");
	assert(Array.isArray(lvl2) && (lvl2 as unknown[]).length > 0, "Unified dispatcher: level=tools returns geowiz tools");

	const toolName = (lvl2 as Array<{ name: string }>)[0]?.name ?? "geowiz.analyze";
	const lvl3 = kernel.schemaExplorer("schema", "geowiz", toolName);
	assert(lvl3 !== null && !Array.isArray(lvl3), "Unified dispatcher: level=schema returns single descriptor");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL REGISTRY TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL REGISTRY TESTS PASSED!");
}
