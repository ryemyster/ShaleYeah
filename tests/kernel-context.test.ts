/**
 * Kernel Context & Session Tests — Wave 4
 *
 * Tests for session lifecycle, identity anchoring, context injection,
 * result storage/retrieval, and kernel session integration.
 */

import { DEMO_IDENTITY, Session, SessionManager } from "../src/kernel/context.js";
import { Kernel } from "../src/kernel/index.js";
import type { Permission, ToolResponse, UserIdentity, UserPreferences } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Context & Session Tests (Wave 4)\n");

// ==========================================
// Helper: mock ToolResponse
// ==========================================

function mockResponse(server: string, confidence: number): ToolResponse {
	return {
		success: true,
		summary: `${server} analysis complete`,
		confidence,
		data: { server, mockData: true },
		detailLevel: "standard",
		completeness: 100,
		metadata: {
			server,
			persona: `${server}-persona`,
			executionTimeMs: 42,
			timestamp: new Date().toISOString(),
		},
	};
}

// ==========================================
// Test: DEMO_IDENTITY default
// ==========================================

console.log("👤 Testing default demo identity...");
{
	assert(DEMO_IDENTITY.userId === "demo", "Demo userId is 'demo'");
	assert(DEMO_IDENTITY.role === "analyst", "Demo role is 'analyst'");
	assert(DEMO_IDENTITY.permissions.includes("read:analysis"), "Demo has read:analysis permission");
	assert(DEMO_IDENTITY.organization === "SHALE YEAH Demo", "Demo org is set");
	assert(DEMO_IDENTITY.displayName === "Demo Analyst", "Demo display name is set");
}

// ==========================================
// Test: Session creation
// ==========================================

console.log("\n📋 Testing session creation...");
{
	const session = new Session(DEMO_IDENTITY);

	assert(typeof session.id === "string" && session.id.length > 0, "Session has UUID id");
	assert(session.identity === DEMO_IDENTITY, "Session identity matches");
	assert(typeof session.createdAt === "string", "createdAt is ISO string");
	assert(typeof session.lastActivity === "string", "lastActivity is ISO string");
	assert(session.createdAt === session.lastActivity, "createdAt === lastActivity initially");
	assert(session.availableResults.length === 0, "No results initially");
	assert(session.resultCount === 0, "Result count is 0 initially");
}

// ==========================================
// Test: Session with custom identity
// ==========================================

console.log("\n🔑 Testing session with custom identity...");
{
	const customIdentity: UserIdentity = {
		userId: "exec-123",
		role: "executive",
		permissions: ["read:analysis", "execute:decisions"] as Permission[],
		organization: "Acme Oil",
		displayName: "Jane Executive",
	};

	const session = new Session(customIdentity);

	assert(session.identity.userId === "exec-123", "Custom userId applied");
	assert(session.identity.role === "executive", "Custom role applied");
	assert(session.identity.permissions.length === 2, "Custom permissions applied");
	assert(session.identity.organization === "Acme Oil", "Custom org applied");
}

// ==========================================
// Test: Session with preferences
// ==========================================

console.log("\n⚙️ Testing session preferences...");
{
	const prefs: UserPreferences = {
		defaultBasin: "Permian",
		riskTolerance: "conservative",
		detailLevel: "summary",
		investmentCriteria: {
			minNPV: 1000000,
			minIRR: 15,
			maxPayback: 24,
			maxRisk: 60,
		},
	};

	const session = new Session(DEMO_IDENTITY, prefs);

	assert(session.preferences.defaultBasin === "Permian", "Basin preference set");
	assert(session.preferences.riskTolerance === "conservative", "Risk tolerance set");
	assert(session.preferences.detailLevel === "summary", "Detail level preference set");
	assert(session.preferences.investmentCriteria?.minIRR === 15, "Investment criteria set");
}

// ==========================================
// Test: Result storage and retrieval
// ==========================================

console.log("\n💾 Testing result storage and retrieval...");
{
	const session = new Session(DEMO_IDENTITY);

	const geoResult = mockResponse("geowiz", 87);
	const econResult = mockResponse("econobot", 82);

	session.storeResult("geological", geoResult);
	session.storeResult("economic", econResult);

	assert(session.resultCount === 2, `2 results stored (got ${session.resultCount})`);
	assert(session.availableResults.includes("geological"), "'geological' in available results");
	assert(session.availableResults.includes("economic"), "'economic' in available results");

	const retrieved = session.getResult("geological");
	assert(retrieved !== undefined, "Can retrieve stored result");
	assert(retrieved?.confidence === 87, "Retrieved result has correct confidence");
	assert((retrieved?.data as Record<string, unknown>)?.server === "geowiz", "Retrieved result has correct data");

	const missing = session.getResult("nonexistent");
	assert(missing === undefined, "Missing key returns undefined");
}

// ==========================================
// Test: lastActivity updates on access
// ==========================================

console.log("\n⏱️ Testing lastActivity updates...");
{
	const session = new Session(DEMO_IDENTITY);
	const initialActivity = session.lastActivity;

	// Small delay to ensure timestamp differs
	await new Promise((r) => setTimeout(r, 15));

	session.storeResult("test", mockResponse("test", 90));
	const afterStore = session.lastActivity;
	assert(afterStore >= initialActivity, "lastActivity updated after storeResult");

	await new Promise((r) => setTimeout(r, 15));

	session.getResult("test");
	const afterGet = session.lastActivity;
	assert(afterGet >= afterStore, "lastActivity updated after getResult");

	await new Promise((r) => setTimeout(r, 15));

	session.getInjectedContext();
	const afterContext = session.lastActivity;
	assert(afterContext >= afterGet, "lastActivity updated after getInjectedContext");
}

// ==========================================
// Test: Injected context
// ==========================================

console.log("\n💉 Testing context injection...");
{
	const prefs: UserPreferences = {
		defaultBasin: "Permian",
		riskTolerance: "moderate",
	};
	const session = new Session(DEMO_IDENTITY, prefs);
	session.storeResult("geo", mockResponse("geowiz", 90));
	session.storeResult("econ", mockResponse("econobot", 85));

	const ctx = session.getInjectedContext();

	assert(ctx.userId === "demo", "Context userId matches identity");
	assert(ctx.role === "analyst", "Context role matches identity");
	assert(ctx.sessionId === session.id, "Context sessionId matches session");
	assert(typeof ctx.timestamp === "string", "Context has timestamp");
	assert(typeof ctx.timezone === "string" && ctx.timezone.length > 0, "Context has timezone");
	assert(ctx.defaultBasin === "Permian", "Context includes basin preference");
	assert(ctx.riskTolerance === "moderate", "Context includes risk tolerance");
	assert(ctx.availableResults.length === 2, `Context lists 2 available results (got ${ctx.availableResults.length})`);
	assert(ctx.availableResults.includes("geo"), "Context lists 'geo' result");
	assert(ctx.availableResults.includes("econ"), "Context lists 'econ' result");
}

// ==========================================
// Test: SessionInfo serialization
// ==========================================

console.log("\n📄 Testing SessionInfo serialization...");
{
	const session = new Session(DEMO_IDENTITY);
	session.storeResult("risk", mockResponse("risk-analysis", 78));

	const info = session.toSessionInfo();

	assert(info.id === session.id, "SessionInfo id matches");
	assert(info.identity === DEMO_IDENTITY, "SessionInfo identity matches");
	assert(info.createdAt === session.createdAt, "SessionInfo createdAt matches");
	assert(typeof info.lastActivity === "string", "SessionInfo lastActivity present");
	assert(info.availableResults.length === 1, "SessionInfo lists available results");
	assert(info.availableResults[0] === "risk", "SessionInfo result key correct");
}

// ==========================================
// Test: SessionManager — create and get
// ==========================================

console.log("\n🏢 Testing SessionManager create/get...");
{
	const mgr = new SessionManager();

	const s1 = mgr.createSession();
	const s2 = mgr.createSession(DEMO_IDENTITY);

	assert(mgr.sessionCount === 2, `2 sessions created (got ${mgr.sessionCount})`);
	assert(s1.id !== s2.id, "Sessions have unique IDs");

	const retrieved = mgr.getSession(s1.id);
	assert(retrieved !== undefined, "getSession returns existing session");
	assert(retrieved?.id === s1.id, "Retrieved session matches by ID");

	const missing = mgr.getSession("nonexistent-id");
	assert(missing === undefined, "getSession returns undefined for unknown ID");
}

// ==========================================
// Test: SessionManager — default identity
// ==========================================

console.log("\n👤 Testing SessionManager default identity...");
{
	const mgr = new SessionManager();
	const session = mgr.createSession();

	assert(session.identity.userId === "demo", "Default session uses demo identity");
	assert(session.identity.role === "analyst", "Default session role is analyst");
}

// ==========================================
// Test: SessionManager — custom identity + preferences
// ==========================================

console.log("\n🔧 Testing SessionManager custom identity + prefs...");
{
	const mgr = new SessionManager();
	const identity: UserIdentity = {
		userId: "eng-456",
		role: "engineer",
		permissions: ["read:analysis", "write:reports"] as Permission[],
	};
	const prefs: UserPreferences = {
		defaultBasin: "Eagle Ford",
		riskTolerance: "aggressive",
	};

	const session = mgr.createSession(identity, prefs);

	assert(session.identity.userId === "eng-456", "Custom identity applied via manager");
	assert(session.preferences.defaultBasin === "Eagle Ford", "Custom prefs applied via manager");
}

// ==========================================
// Test: SessionManager — destroy
// ==========================================

console.log("\n🗑️ Testing SessionManager destroy...");
{
	const mgr = new SessionManager();
	const s1 = mgr.createSession();
	const s2 = mgr.createSession();

	assert(mgr.sessionCount === 2, "2 sessions before destroy");

	const destroyed = mgr.destroySession(s1.id);
	assert(destroyed === true, "destroySession returns true for existing session");
	assert(mgr.sessionCount === 1, "1 session after destroy");
	assert(mgr.getSession(s1.id) === undefined, "Destroyed session no longer retrievable");
	assert(mgr.getSession(s2.id) !== undefined, "Other session still exists");

	const destroyAgain = mgr.destroySession(s1.id);
	assert(destroyAgain === false, "destroySession returns false for already-destroyed session");
}

// ==========================================
// Test: SessionManager — listSessions
// ==========================================

console.log("\n📋 Testing SessionManager listSessions...");
{
	const mgr = new SessionManager();
	mgr.createSession();
	mgr.createSession();
	mgr.createSession();

	const list = mgr.listSessions();
	assert(list.length === 3, `listSessions returns 3 entries (got ${list.length})`);
	assert(typeof list[0].id === "string", "Listed session has id");
	assert(list[0].identity !== undefined, "Listed session has identity");
}

// ==========================================
// Test: Kernel — createSession
// ==========================================

console.log("\n🧠 Testing Kernel.createSession()...");
{
	const kernel = new Kernel();

	const session = kernel.createSession();
	assert(session.identity.userId === "demo", "Kernel default session uses demo identity");

	const custom = kernel.createSession({
		userId: "admin-1",
		role: "admin",
		permissions: ["admin:servers", "admin:users"] as Permission[],
	});
	assert(custom.identity.userId === "admin-1", "Kernel custom session identity applied");
	assert(custom.identity.role === "admin", "Kernel custom session role applied");
}

// ==========================================
// Test: Kernel — getSession
// ==========================================

console.log("\n📋 Testing Kernel.getSession()...");
{
	const kernel = new Kernel();
	const session = kernel.createSession();

	const info = kernel.getSession(session.id);
	assert(info !== undefined, "getSession returns session info");
	assert(info?.id === session.id, "Session info id matches");
	assert(info?.identity.userId === "demo", "Session info identity correct");

	const missing = kernel.getSession("bad-id");
	assert(missing === undefined, "getSession returns undefined for unknown id");
}

// ==========================================
// Test: Kernel — whoAmI
// ==========================================

console.log("\n🪪 Testing Kernel.whoAmI()...");
{
	const kernel = new Kernel();
	const session = kernel.createSession(undefined, {
		defaultBasin: "Bakken",
		riskTolerance: "conservative",
	});

	// Store a result via raw session
	const raw = kernel.getSessionRaw(session.id);
	raw?.storeResult("geo", mockResponse("geowiz", 92));

	const whoami = kernel.whoAmI(session.id);
	assert(whoami !== undefined, "whoAmI returns data for valid session");
	assert(whoami!.identity.userId === "demo", "whoAmI identity userId correct");
	assert(whoami!.identity.role === "analyst", "whoAmI identity role correct");
	assert(whoami!.context.sessionId === session.id, "whoAmI context sessionId correct");
	assert(whoami!.context.defaultBasin === "Bakken", "whoAmI context includes basin");
	assert(whoami!.context.riskTolerance === "conservative", "whoAmI context includes risk tolerance");
	assert(whoami!.context.availableResults.includes("geo"), "whoAmI context lists stored results");

	const missing = kernel.whoAmI("bad-id");
	assert(missing === undefined, "whoAmI returns undefined for unknown session");
}

// ==========================================
// Test: Kernel — destroySession
// ==========================================

console.log("\n🗑️ Testing Kernel.destroySession()...");
{
	const kernel = new Kernel();
	const session = kernel.createSession();

	assert(kernel.getSession(session.id) !== undefined, "Session exists before destroy");

	const result = kernel.destroySession(session.id);
	assert(result === true, "destroySession returns true");
	assert(kernel.getSession(session.id) === undefined, "Session gone after destroy");
	assert(kernel.whoAmI(session.id) === undefined, "whoAmI gone after destroy");
}

// ==========================================
// Test: Session isolation (context boundary)
// ==========================================

console.log("\n🔒 Testing session isolation...");
{
	const kernel = new Kernel();
	const s1 = kernel.createSession();
	const s2 = kernel.createSession();

	const raw1 = kernel.getSessionRaw(s1.id)!;
	const raw2 = kernel.getSessionRaw(s2.id)!;

	raw1.storeResult("geo", mockResponse("geowiz", 90));
	raw2.storeResult("econ", mockResponse("econobot", 85));

	assert(raw1.availableResults.includes("geo"), "Session 1 has geo result");
	assert(!raw1.availableResults.includes("econ"), "Session 1 does NOT have econ result");
	assert(raw2.availableResults.includes("econ"), "Session 2 has econ result");
	assert(!raw2.availableResults.includes("geo"), "Session 2 does NOT have geo result");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL CONTEXT & SESSION TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL CONTEXT & SESSION TESTS PASSED!");
}
