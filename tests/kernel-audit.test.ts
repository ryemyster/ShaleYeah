/**
 * Kernel Audit Middleware Tests — Wave 6
 *
 * Tests for audit trail logging, sensitive value redaction,
 * entry building, file persistence, and enable/disable.
 */

import fs from "node:fs";
import path from "node:path";
import { Kernel } from "../src/kernel/index.js";
import { AuditMiddleware } from "../src/kernel/middleware/audit.js";
import type { AuditEntry, Permission, UserIdentity } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Audit Middleware Tests (Wave 6)\n");

// ==========================================
// Setup: temp audit directory
// ==========================================

const AUDIT_DIR = path.join("tests", "temp", `audit-test-${Date.now()}`);

function cleanup(): void {
	try {
		fs.rmSync(AUDIT_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

// Clean up at start in case of previous failed run
cleanup();

// ==========================================
// Test: Audit disabled — no-op
// ==========================================

console.log("🔇 Testing audit disabled...");
{
	const audit = new AuditMiddleware({ enabled: false, auditPath: AUDIT_DIR });

	assert(!audit.isEnabled, "Audit is disabled");

	const entry: AuditEntry = {
		tool: "geowiz.analyze",
		action: "request",
		parameters: { basin: "Permian" },
		userId: "demo",
		sessionId: "test-session",
		role: "analyst",
		timestamp: new Date().toISOString(),
	};

	audit.logRequest(entry);
	audit.logResponse(entry);
	audit.logDenial(entry);
	audit.logError(entry);

	// No file should be created
	const exists = fs.existsSync(AUDIT_DIR);
	assert(!exists, "No audit directory created when disabled");

	const entries = audit.getEntries();
	assert(entries.length === 0, "getEntries returns empty when disabled");
}

// ==========================================
// Test: Sensitive value redaction
// ==========================================

console.log("\n🔒 Testing sensitive value redaction...");
{
	const audit = new AuditMiddleware({ enabled: true, auditPath: AUDIT_DIR });

	const params = {
		basin: "Permian",
		apiKey: "sk-secret-123",
		api_key: "sk-another-456",
		token: "bearer-abc",
		password: "my-password",
		secretValue: "hidden",
		credentials: "user:pass",
		normal: "visible",
		nested: {
			innerKey: "nested-secret",
			safeField: "ok",
			authToken: "xyz",
		},
	};

	const redacted = audit.redactSensitive(params);

	assert(redacted.basin === "Permian", "Non-sensitive 'basin' preserved");
	assert(redacted.normal === "visible", "Non-sensitive 'normal' preserved");
	assert(redacted.apiKey === "[REDACTED]", "apiKey redacted");
	assert(redacted.api_key === "[REDACTED]", "api_key redacted");
	assert(redacted.token === "[REDACTED]", "token redacted");
	assert(redacted.password === "[REDACTED]", "password redacted");
	assert(redacted.secretValue === "[REDACTED]", "secretValue redacted");
	assert(redacted.credentials === "[REDACTED]", "credentials redacted");

	// Nested redaction
	const nested = redacted.nested as Record<string, unknown>;
	assert(nested.innerKey === "[REDACTED]", "Nested key redacted");
	assert(nested.safeField === "ok", "Nested safe field preserved");
	assert(nested.authToken === "[REDACTED]", "Nested authToken redacted");
}

// ==========================================
// Test: Build entry
// ==========================================

console.log("\n🏗️ Testing buildEntry...");
{
	const audit = new AuditMiddleware({ enabled: true, auditPath: AUDIT_DIR });

	const entry = audit.buildEntry(
		"geowiz.analyze",
		"request",
		{ basin: "Permian", apiKey: "secret" },
		"user-1",
		"session-1",
		"analyst",
	);

	assert(entry.tool === "geowiz.analyze", "Entry tool correct");
	assert(entry.action === "request", "Entry action correct");
	assert(entry.userId === "user-1", "Entry userId correct");
	assert(entry.sessionId === "session-1", "Entry sessionId correct");
	assert(entry.role === "analyst", "Entry role correct");
	assert(typeof entry.timestamp === "string", "Entry has timestamp");
	assert(entry.parameters.basin === "Permian", "Non-sensitive param preserved");
	assert(entry.parameters.apiKey === "[REDACTED]", "Sensitive param redacted in entry");
}

// ==========================================
// Test: Build entry with extras
// ==========================================

console.log("\n➕ Testing buildEntry with extras...");
{
	const audit = new AuditMiddleware({ enabled: true, auditPath: AUDIT_DIR });

	const entry = audit.buildEntry(
		"econobot.analyze",
		"response",
		{ tractId: "T-100" },
		"user-2",
		"session-2",
		"engineer",
		{ success: true, durationMs: 42 },
	);

	assert(entry.success === true, "Extra 'success' merged");
	assert(entry.durationMs === 42, "Extra 'durationMs' merged");
	assert(entry.action === "response", "Action is response");
}

// ==========================================
// Test: File persistence — write and read entries
// ==========================================

console.log("\n💾 Testing file persistence...");
{
	const auditDir = path.join(AUDIT_DIR, "persist-test");
	const audit = new AuditMiddleware({ enabled: true, auditPath: auditDir });

	const entry1 = audit.buildEntry("geowiz.analyze", "request", { basin: "Permian" }, "user-1", "sess-1", "analyst");
	const entry2 = audit.buildEntry("econobot.analyze", "response", { tractId: "T-1" }, "user-1", "sess-1", "analyst", {
		success: true,
		durationMs: 100,
	});
	const entry3 = audit.buildEntry("decision.recommend", "denied", {}, "user-1", "sess-1", "analyst", {
		success: false,
	});

	audit.logRequest(entry1);
	audit.logResponse(entry2);
	audit.logDenial(entry3);

	// Read back entries
	const today = new Date().toISOString().slice(0, 10);
	const entries = audit.getEntries(today);

	assert(entries.length === 3, `3 entries written and read back (got ${entries.length})`);
	assert(entries[0].action === "request", "First entry is request");
	assert(entries[1].action === "response", "Second entry is response");
	assert(entries[2].action === "denied", "Third entry is denied");
	assert(entries[0].tool === "geowiz.analyze", "First entry tool correct");
	assert(entries[1].success === true, "Second entry success flag correct");
	assert(entries[2].success === false, "Third entry success flag correct");

	// Verify JSONL format (each line is valid JSON)
	const filePath = path.join(auditDir, `${today}.jsonl`);
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.trim().split("\n");
	assert(lines.length === 3, "JSONL file has 3 lines");

	let allValid = true;
	for (const line of lines) {
		try {
			JSON.parse(line);
		} catch {
			allValid = false;
		}
	}
	assert(allValid, "All lines are valid JSON");
}

// ==========================================
// Test: Sensitive values redacted in persisted entries
// ==========================================

console.log("\n🔐 Testing redaction in persisted entries...");
{
	const auditDir = path.join(AUDIT_DIR, "redact-test");
	const audit = new AuditMiddleware({ enabled: true, auditPath: auditDir });

	const entry = audit.buildEntry(
		"geowiz.analyze",
		"request",
		{ basin: "Permian", apiKey: "sk-live-123", token: "bearer-xyz" },
		"user-1",
		"sess-1",
		"analyst",
	);
	audit.logRequest(entry);

	const entries = audit.getEntries();
	assert(entries.length >= 1, "Entry persisted");
	assert(entries[0].parameters.apiKey === "[REDACTED]", "apiKey redacted in file");
	assert(entries[0].parameters.token === "[REDACTED]", "token redacted in file");
	assert(entries[0].parameters.basin === "Permian", "basin preserved in file");
}

// ==========================================
// Test: Audit path configuration
// ==========================================

console.log("\n📁 Testing audit path configuration...");
{
	const audit = new AuditMiddleware({
		enabled: true,
		auditPath: "/tmp/custom-audit-path",
	});
	assert(audit.path === "/tmp/custom-audit-path", "Custom audit path set");
}

// ==========================================
// Test: Error entry logging
// ==========================================

console.log("\n🚨 Testing error entry logging...");
{
	const auditDir = path.join(AUDIT_DIR, "error-test");
	const audit = new AuditMiddleware({ enabled: true, auditPath: auditDir });

	const entry = audit.buildEntry("risk-analysis.analyze", "error", { tractId: "T-1" }, "user-1", "sess-1", "analyst", {
		success: false,
		errorType: "retryable",
		durationMs: 30000,
	});
	audit.logError(entry);

	const entries = audit.getEntries();
	assert(entries.length === 1, "Error entry persisted");
	assert(entries[0].action === "error", "Action is error");
	assert(entries[0].errorType === "retryable", "ErrorType preserved");
	assert(entries[0].durationMs === 30000, "DurationMs preserved");
}

// ==========================================
// Test: Kernel integration — callTool produces audit entries
// ==========================================

console.log("\n🧠 Testing Kernel.callTool() produces audit entries...");
{
	const auditDir = path.join(AUDIT_DIR, "kernel-test");
	const kernel = new Kernel({
		security: { requireAuth: false, auditEnabled: true, auditPath: auditDir },
	});

	const session = kernel.createSession();

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

	await kernel.callTool({ toolName: "geowiz.analyze", args: { basin: "Permian" } }, session.id);

	const entries = kernel.audit.getEntries();
	assert(entries.length >= 2, `At least 2 entries: request + response (got ${entries.length})`);

	const reqEntry = entries.find((e) => e.action === "request");
	assert(reqEntry !== undefined, "Request entry logged");
	assert(reqEntry!.tool === "geowiz.analyze", "Request entry has correct tool");
	assert(reqEntry!.userId === "demo", "Request entry has user from session");
	assert(reqEntry!.sessionId === session.id, "Request entry has session ID");

	const respEntry = entries.find((e) => e.action === "response");
	assert(respEntry !== undefined, "Response entry logged");
	assert(respEntry!.success === true, "Response entry success flag correct");
	assert(typeof respEntry!.durationMs === "number", "Response entry has durationMs");
}

// ==========================================
// Test: Kernel — denial audit entry
// ==========================================

console.log("\n🚫 Testing Kernel denial produces audit entry...");
{
	const auditDir = path.join(AUDIT_DIR, "denial-test");
	const kernel = new Kernel({
		security: { requireAuth: true, auditEnabled: true, auditPath: auditDir },
	});

	const analystIdentity: UserIdentity = {
		userId: "analyst-audit",
		role: "analyst",
		permissions: ["read:analysis"] as Permission[],
	};
	const session = kernel.createSession(analystIdentity);

	kernel.setExecutorFn(async () => ({
		success: true,
		summary: "ok",
		confidence: 100,
		data: null,
		detailLevel: "standard" as const,
		completeness: 100,
		metadata: { server: "test", persona: "test", executionTimeMs: 0, timestamp: new Date().toISOString() },
	}));

	await kernel.callTool({ toolName: "decision.make_recommendation", args: { tractId: "T-1" } }, session.id);

	const entries = kernel.audit.getEntries();
	const denialEntry = entries.find((e) => e.action === "denied");
	assert(denialEntry !== undefined, "Denial entry logged");
	assert(denialEntry!.tool === "decision.make_recommendation", "Denial entry tool correct");
	assert(denialEntry!.userId === "analyst-audit", "Denial entry userId correct");
	assert(denialEntry!.success === false, "Denial entry success is false");
}

// ==========================================
// Test: Kernel — error audit entry
// ==========================================

console.log("\n💥 Testing Kernel error produces audit entry...");
{
	const auditDir = path.join(AUDIT_DIR, "error-audit-test");
	const kernel = new Kernel({
		security: { requireAuth: false, auditEnabled: true, auditPath: auditDir },
	});

	const session = kernel.createSession();

	kernel.setExecutorFn(async () => ({
		success: false,
		summary: "Server timeout",
		confidence: 0,
		data: null,
		detailLevel: "standard" as const,
		completeness: 0,
		metadata: { server: "geowiz", persona: "test", executionTimeMs: 30000, timestamp: new Date().toISOString() },
		error: { type: "retryable" as const, message: "Connection timeout" },
	}));

	await kernel.callTool({ toolName: "geowiz.analyze", args: {} }, session.id);

	const entries = kernel.audit.getEntries();
	const errorEntry = entries.find((e) => e.action === "error");
	assert(errorEntry !== undefined, "Error entry logged");
	assert(errorEntry!.success === false, "Error entry success is false");
	assert(errorEntry!.errorType === "retryable", "Error entry has errorType");
}

// ==========================================
// Cleanup
// ==========================================

cleanup();

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL AUDIT MIDDLEWARE TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL AUDIT MIDDLEWARE TESTS PASSED!");
}
