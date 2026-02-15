/**
 * Kernel Auth Middleware Tests — Wave 6
 *
 * Tests for permission gates, role-based access control,
 * tool-permission mapping, and auth enable/disable.
 */

import { Kernel } from "../src/kernel/index.js";
import { AuthMiddleware, ROLE_PERMISSIONS } from "../src/kernel/middleware/auth.js";
import type { Permission, UserIdentity } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Auth Middleware Tests (Wave 6)\n");

// ==========================================
// Helper identities
// ==========================================

const analyst: UserIdentity = {
	userId: "analyst-1",
	role: "analyst",
	permissions: ["read:analysis"] as Permission[],
};

const engineer: UserIdentity = {
	userId: "eng-1",
	role: "engineer",
	permissions: ["read:analysis", "write:reports"] as Permission[],
};

const executive: UserIdentity = {
	userId: "exec-1",
	role: "executive",
	permissions: ["read:analysis", "write:reports", "execute:decisions"] as Permission[],
};

const admin: UserIdentity = {
	userId: "admin-1",
	role: "admin",
	permissions: ["read:analysis", "write:reports", "execute:decisions", "admin:servers", "admin:users"] as Permission[],
};

// ==========================================
// Test: ROLE_PERMISSIONS map
// ==========================================

console.log("📋 Testing ROLE_PERMISSIONS map...");
{
	assert(ROLE_PERMISSIONS.analyst.includes("read:analysis"), "Analyst has read:analysis");
	assert(!ROLE_PERMISSIONS.analyst.includes("write:reports"), "Analyst does NOT have write:reports");
	assert(!ROLE_PERMISSIONS.analyst.includes("execute:decisions"), "Analyst does NOT have execute:decisions");

	assert(ROLE_PERMISSIONS.engineer.includes("read:analysis"), "Engineer has read:analysis");
	assert(ROLE_PERMISSIONS.engineer.includes("write:reports"), "Engineer has write:reports");
	assert(!ROLE_PERMISSIONS.engineer.includes("execute:decisions"), "Engineer does NOT have execute:decisions");

	assert(ROLE_PERMISSIONS.executive.includes("execute:decisions"), "Executive has execute:decisions");
	assert(ROLE_PERMISSIONS.executive.includes("write:reports"), "Executive has write:reports");

	assert(ROLE_PERMISSIONS.admin.includes("admin:servers"), "Admin has admin:servers");
	assert(ROLE_PERMISSIONS.admin.includes("admin:users"), "Admin has admin:users");
	assert(ROLE_PERMISSIONS.admin.length === 5, "Admin has all 5 permissions");
}

// ==========================================
// Test: Auth disabled allows everything
// ==========================================

console.log("\n🔓 Testing auth disabled (default)...");
{
	const auth = new AuthMiddleware(false);

	assert(!auth.isEnabled, "Auth is disabled");

	const r1 = auth.check("geowiz.analyze", analyst);
	assert(r1.allowed, "Analyst can call geowiz when auth disabled");

	const r2 = auth.check("decision.make_recommendation", analyst);
	assert(r2.allowed, "Analyst can call decision when auth disabled");

	const r3 = auth.check("admin.manage_servers", analyst);
	assert(r3.allowed, "Analyst can call admin when auth disabled");
}

// ==========================================
// Test: Auth enabled — analyst permissions
// ==========================================

console.log("\n🔐 Testing auth enabled — analyst...");
{
	const auth = new AuthMiddleware(true);

	assert(auth.isEnabled, "Auth is enabled");

	// Analyst can call query tools
	const r1 = auth.check("geowiz.analyze", analyst);
	assert(r1.allowed, "Analyst CAN call geowiz.analyze");

	const r2 = auth.check("econobot.analyze", analyst);
	assert(r2.allowed, "Analyst CAN call econobot.analyze");

	const r3 = auth.check("risk-analysis.analyze", analyst);
	assert(r3.allowed, "Analyst CAN call risk-analysis.analyze");

	const r4 = auth.check("market.analyze", analyst);
	assert(r4.allowed, "Analyst CAN call market.analyze");

	// Analyst CANNOT call command tools
	const r5 = auth.check("decision.make_recommendation", analyst);
	assert(!r5.allowed, "Analyst CANNOT call decision.make_recommendation");
	assert(r5.reason !== undefined, "Denial has reason");
	assert(r5.requiredPermissions?.includes("execute:decisions"), "Denial lists required permission: execute:decisions");
	assert(r5.requiredRole === "executive", `Denial suggests required role: executive (got ${r5.requiredRole})`);

	const r6 = auth.check("reporter.generate_report", analyst);
	assert(!r6.allowed, "Analyst CANNOT call reporter.generate_report");
	assert(r6.requiredPermissions?.includes("write:reports"), "Denial lists required permission: write:reports");
}

// ==========================================
// Test: Auth enabled — engineer permissions
// ==========================================

console.log("\n🔧 Testing auth enabled — engineer...");
{
	const auth = new AuthMiddleware(true);

	const r1 = auth.check("geowiz.analyze", engineer);
	assert(r1.allowed, "Engineer CAN call geowiz.analyze");

	const r2 = auth.check("reporter.generate_report", engineer);
	assert(r2.allowed, "Engineer CAN call reporter.generate_report");

	const r3 = auth.check("decision.make_recommendation", engineer);
	assert(!r3.allowed, "Engineer CANNOT call decision.make_recommendation");
}

// ==========================================
// Test: Auth enabled — executive permissions
// ==========================================

console.log("\n👔 Testing auth enabled — executive...");
{
	const auth = new AuthMiddleware(true);

	const r1 = auth.check("geowiz.analyze", executive);
	assert(r1.allowed, "Executive CAN call geowiz.analyze");

	const r2 = auth.check("reporter.generate_report", executive);
	assert(r2.allowed, "Executive CAN call reporter.generate_report");

	const r3 = auth.check("decision.make_recommendation", executive);
	assert(r3.allowed, "Executive CAN call decision.make_recommendation");

	const r4 = auth.check("admin.manage_servers", executive);
	assert(!r4.allowed, "Executive CANNOT call admin.manage_servers");
}

// ==========================================
// Test: Auth enabled — admin permissions
// ==========================================

console.log("\n👑 Testing auth enabled — admin...");
{
	const auth = new AuthMiddleware(true);

	const r1 = auth.check("geowiz.analyze", admin);
	assert(r1.allowed, "Admin CAN call geowiz.analyze");

	const r2 = auth.check("reporter.generate_report", admin);
	assert(r2.allowed, "Admin CAN call reporter.generate_report");

	const r3 = auth.check("decision.make_recommendation", admin);
	assert(r3.allowed, "Admin CAN call decision.make_recommendation");

	const r4 = auth.check("admin.manage_servers", admin);
	assert(r4.allowed, "Admin CAN call admin.manage_servers");
}

// ==========================================
// Test: Tool → permission mapping
// ==========================================

console.log("\n🗺️ Testing tool → permission mapping...");
{
	const auth = new AuthMiddleware(true);

	assert(auth.getRequiredPermission("geowiz.analyze") === "read:analysis", "geowiz.analyze requires read:analysis");
	assert(auth.getRequiredPermission("econobot.analyze") === "read:analysis", "econobot.analyze requires read:analysis");
	assert(
		auth.getRequiredPermission("reporter.generate_report") === "write:reports",
		"reporter.generate_report requires write:reports",
	);
	assert(auth.getRequiredPermission("reporter.analyze") === "write:reports", "reporter.analyze requires write:reports");
	assert(
		auth.getRequiredPermission("decision.make_recommendation") === "execute:decisions",
		"decision.make_recommendation requires execute:decisions",
	);
	assert(
		auth.getRequiredPermission("decision.analyze") === "execute:decisions",
		"decision.analyze requires execute:decisions",
	);
	assert(
		auth.getRequiredPermission("admin.manage_servers") === "admin:servers",
		"admin.manage_servers requires admin:servers",
	);
	assert(auth.getRequiredPermission("unknown.tool") === "read:analysis", "Unknown tool defaults to read:analysis");
}

// ==========================================
// Test: Effective permissions merge
// ==========================================

console.log("\n🔀 Testing effective permissions merge...");
{
	const auth = new AuthMiddleware(true);

	// Identity with extra explicit permissions beyond role
	const customAnalyst: UserIdentity = {
		userId: "custom-1",
		role: "analyst",
		permissions: ["read:analysis", "write:reports"] as Permission[],
	};

	const perms = auth.getEffectivePermissions(customAnalyst);
	assert(perms.includes("read:analysis"), "Has role-based read:analysis");
	assert(perms.includes("write:reports"), "Has explicitly granted write:reports");

	const r = auth.check("reporter.generate_report", customAnalyst);
	assert(r.allowed, "Analyst with explicit write:reports CAN call reporter");
}

// ==========================================
// Test: Kernel integration — callTool with auth
// ==========================================

console.log("\n🧠 Testing Kernel.callTool() with auth...");
{
	const kernel = new Kernel({
		security: { requireAuth: true, auditEnabled: false, auditPath: "data/audit" },
	});

	// Create analyst session
	const session = kernel.createSession(analyst);

	// Mock executor
	kernel.setExecutorFn(async (serverName) => ({
		success: true,
		summary: `${serverName} done`,
		confidence: 85,
		data: { ok: true },
		detailLevel: "standard" as const,
		completeness: 100,
		metadata: {
			server: serverName,
			persona: "test",
			executionTimeMs: 1,
			timestamp: new Date().toISOString(),
		},
	}));

	// Analyst can call query tool
	const r1 = await kernel.callTool({ toolName: "geowiz.analyze", args: {} }, session.id);
	assert(r1.success, "Analyst callTool geowiz succeeds");

	// Analyst cannot call decision tool
	const r2 = await kernel.callTool({ toolName: "decision.make_recommendation", args: {} }, session.id);
	assert(!r2.success, "Analyst callTool decision fails");
	assert(r2.error?.type === "auth_required", "Denial error type is auth_required");
	assert(r2.error?.recoverySteps !== undefined && r2.error.recoverySteps.length > 0, "Denial has recovery steps");
}

// ==========================================
// Test: Kernel.authCheck convenience method
// ==========================================

console.log("\n✅ Testing Kernel.authCheck()...");
{
	const kernel = new Kernel({
		security: { requireAuth: true, auditEnabled: false, auditPath: "data/audit" },
	});

	const session = kernel.createSession(analyst);

	const r1 = kernel.authCheck("geowiz.analyze", session.id);
	assert(r1.allowed, "authCheck: analyst allowed for geowiz");

	const r2 = kernel.authCheck("decision.make_recommendation", session.id);
	assert(!r2.allowed, "authCheck: analyst denied for decision");
	assert(r2.requiredRole === "executive", "authCheck: suggests executive role");
}

// ==========================================
// Test: Kernel — no session defaults to demo identity
// ==========================================

console.log("\n👤 Testing callTool without session...");
{
	const kernel = new Kernel({
		security: { requireAuth: true, auditEnabled: false, auditPath: "data/audit" },
	});

	kernel.setExecutorFn(async (serverName) => ({
		success: true,
		summary: `${serverName} done`,
		confidence: 85,
		data: { ok: true },
		detailLevel: "standard" as const,
		completeness: 100,
		metadata: {
			server: serverName,
			persona: "test",
			executionTimeMs: 1,
			timestamp: new Date().toISOString(),
		},
	}));

	// No session → DEMO_IDENTITY (analyst)
	const r1 = await kernel.callTool({ toolName: "geowiz.analyze", args: {} });
	assert(r1.success, "No session: analyst can call query tool");

	const r2 = await kernel.callTool({ toolName: "decision.analyze", args: {} });
	assert(!r2.success, "No session: analyst cannot call decision tool");
}

// ==========================================
// Test: Denial response format
// ==========================================

console.log("\n📝 Testing denial response format...");
{
	const auth = new AuthMiddleware(true);

	const result = auth.check("decision.make_recommendation", analyst);
	assert(!result.allowed, "Denied");
	assert(typeof result.reason === "string" && result.reason.length > 0, "Has reason string");
	assert(result.reason!.includes("execute:decisions"), "Reason mentions required permission");
	assert(result.reason!.includes("analyst"), "Reason mentions the user's role");
	assert(result.requiredRole === "executive", "Suggests minimum required role");
	assert(
		Array.isArray(result.requiredPermissions) && result.requiredPermissions.length === 1,
		"Lists required permissions array",
	);
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL AUTH MIDDLEWARE TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL AUTH MIDDLEWARE TESTS PASSED!");
}
