/**
 * Kernel Resilience & Error Intelligence Tests — Wave 5
 *
 * Tests for error classification, recovery guides, graceful degradation,
 * alternative tool suggestions, and executor integration.
 */

import { Executor } from "../src/kernel/executor.js";
import { ResilienceMiddleware } from "../src/kernel/middleware/resilience.js";
import type { ErrorDetail, ToolResponse } from "../src/kernel/types.js";
import { ErrorType } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Resilience & Error Intelligence Tests (Wave 5)\n");

// ==========================================
// Helper: mock ToolResponse
// ==========================================

function mockSuccess(server: string, confidence = 85): ToolResponse {
	return {
		success: true,
		summary: `${server} analysis complete`,
		confidence,
		data: { server, result: "ok" },
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

function mockFailure(server: string, message: string, errorType?: ErrorType): ToolResponse {
	return {
		success: false,
		summary: message,
		confidence: 0,
		data: null,
		detailLevel: "standard",
		completeness: 0,
		metadata: {
			server,
			persona: `${server}-persona`,
			executionTimeMs: 0,
			timestamp: new Date().toISOString(),
		},
		error: {
			type: errorType ?? ErrorType.PERMANENT,
			message,
		},
	};
}

const middleware = new ResilienceMiddleware();

// ==========================================
// Test: Error Classification — Retryable
// ==========================================

console.log("🔄 Testing error classification — retryable...");
{
	assert(middleware.classifyError("Request rate limit exceeded") === ErrorType.RETRYABLE, "Rate limit → retryable");
	assert(middleware.classifyError("429 Too Many Requests") === ErrorType.RETRYABLE, "429 → retryable");
	assert(middleware.classifyError("Connection timeout after 30000ms") === ErrorType.RETRYABLE, "Timeout → retryable");
	assert(middleware.classifyError("Request timed out") === ErrorType.RETRYABLE, "Timed out → retryable");
	assert(middleware.classifyError("ECONNREFUSED 127.0.0.1:3000") === ErrorType.RETRYABLE, "ECONNREFUSED → retryable");
	assert(middleware.classifyError("ECONNRESET") === ErrorType.RETRYABLE, "ECONNRESET → retryable");
	assert(middleware.classifyError("ETIMEDOUT") === ErrorType.RETRYABLE, "ETIMEDOUT → retryable");
	assert(middleware.classifyError("socket hang up") === ErrorType.RETRYABLE, "Socket hang up → retryable");
	assert(
		middleware.classifyError("Service temporarily unavailable") === ErrorType.RETRYABLE,
		"Temporarily unavailable → retryable",
	);
	assert(middleware.classifyError("503 Service Unavailable") === ErrorType.RETRYABLE, "503 → retryable");
	assert(middleware.classifyError("502 Bad Gateway") === ErrorType.RETRYABLE, "502 → retryable");
	assert(middleware.classifyError("network error") === ErrorType.RETRYABLE, "Network error → retryable");
}

// ==========================================
// Test: Error Classification — Auth Required
// ==========================================

console.log("\n🔐 Testing error classification — auth_required...");
{
	assert(middleware.classifyError("Unauthorized access") === ErrorType.AUTH_REQUIRED, "Unauthorized → auth_required");
	assert(middleware.classifyError("403 Forbidden") === ErrorType.AUTH_REQUIRED, "403 Forbidden → auth_required");
	assert(middleware.classifyError("401 Unauthorized") === ErrorType.AUTH_REQUIRED, "401 → auth_required");
	assert(middleware.classifyError("Invalid API key") === ErrorType.AUTH_REQUIRED, "API key → auth_required");
	assert(
		middleware.classifyError("Authentication failed") === ErrorType.AUTH_REQUIRED,
		"Authentication failed → auth_required",
	);
	assert(
		middleware.classifyError("Access denied for this resource") === ErrorType.AUTH_REQUIRED,
		"Access denied → auth_required",
	);
	assert(middleware.classifyError("Token expired") === ErrorType.AUTH_REQUIRED, "Token expired → auth_required");
	assert(
		middleware.classifyError("Missing credentials") === ErrorType.AUTH_REQUIRED,
		"Missing credentials → auth_required",
	);
	assert(
		middleware.classifyError("Permission denied") === ErrorType.AUTH_REQUIRED,
		"Permission denied → auth_required",
	);
}

// ==========================================
// Test: Error Classification — User Action
// ==========================================

console.log("\n👤 Testing error classification — user_action...");
{
	assert(
		middleware.classifyError("File not found: tract-data.las") === ErrorType.USER_ACTION,
		"File not found → user_action",
	);
	assert(
		middleware.classifyError("ENOENT: no such file or directory") === ErrorType.USER_ACTION,
		"ENOENT → user_action",
	);
	assert(middleware.classifyError("Missing data for analysis") === ErrorType.USER_ACTION, "Missing data → user_action");
	assert(middleware.classifyError("Missing input files") === ErrorType.USER_ACTION, "Missing input → user_action");
	assert(middleware.classifyError("No data provided") === ErrorType.USER_ACTION, "No data → user_action");
	assert(
		middleware.classifyError("Please provide geological data") === ErrorType.USER_ACTION,
		"Please provide → user_action",
	);
}

// ==========================================
// Test: Error Classification — Permanent
// ==========================================

console.log("\n❌ Testing error classification — permanent...");
{
	assert(middleware.classifyError("Invalid basin name: Atlantis") === ErrorType.PERMANENT, "Invalid → permanent");
	assert(
		middleware.classifyError("Zod validation error: expected number") === ErrorType.PERMANENT,
		"Zod validation → permanent",
	);
	assert(middleware.classifyError("Schema validation failed") === ErrorType.PERMANENT, "Schema validation → permanent");
	assert(middleware.classifyError("Malformed request body") === ErrorType.PERMANENT, "Malformed → permanent");
	assert(middleware.classifyError("Unsupported file format") === ErrorType.PERMANENT, "Unsupported → permanent");
	assert(
		middleware.classifyError("Unknown tool: nonexistent.analyze") === ErrorType.PERMANENT,
		"Unknown tool → permanent",
	);
	assert(middleware.classifyError("Parse error in JSON input") === ErrorType.PERMANENT, "Parse error → permanent");
}

// ==========================================
// Test: Error Classification — Default
// ==========================================

console.log("\n🔀 Testing error classification — default (retryable)...");
{
	assert(
		middleware.classifyError("Something unexpected happened") === ErrorType.RETRYABLE,
		"Unknown error → retryable (optimistic default)",
	);
	assert(middleware.classifyError("") === ErrorType.RETRYABLE, "Empty error → retryable (optimistic default)");
}

// ==========================================
// Test: Error Classification — Priority Order
// ==========================================

console.log("\n⚖️ Testing error classification — priority order...");
{
	// Auth patterns should take priority over retryable patterns
	assert(
		middleware.classifyError("Unauthorized: rate limit may apply") === ErrorType.AUTH_REQUIRED,
		"Auth takes priority over retryable",
	);
	// User action should take priority over permanent
	assert(
		middleware.classifyError("File not found: invalid path") === ErrorType.USER_ACTION,
		"User action takes priority over permanent ('invalid')",
	);
}

// ==========================================
// Test: Error Classification with Error objects
// ==========================================

console.log("\n🔧 Testing error classification with Error objects...");
{
	assert(
		middleware.classifyError(new Error("Connection timeout")) === ErrorType.RETRYABLE,
		"Error object: timeout → retryable",
	);
	assert(
		middleware.classifyError(new Error("Unauthorized")) === ErrorType.AUTH_REQUIRED,
		"Error object: unauthorized → auth_required",
	);
}

// ==========================================
// Test: Recovery Guide
// ==========================================

console.log("\n📋 Testing recovery guides...");
{
	const guide = middleware.addRecoveryGuide("Connection timeout", "geowiz.analyze");
	assert(guide.errorType === ErrorType.RETRYABLE, "Guide errorType matches classification");
	assert(guide.message === "Connection timeout", "Guide preserves error message");
	assert(guide.reason.length > 0, "Guide has a reason string");
	assert(guide.recoverySteps.length > 0, "Guide has recovery steps");
	assert(
		guide.recoverySteps.some((s) => /retry/i.test(s)),
		"Retryable guide suggests retry",
	);
	assert(guide.retryAfterMs !== undefined, "Retryable guide has retryAfterMs");
	assert(guide.retryAfterMs! > 0, "retryAfterMs is positive");
}

{
	const guide = middleware.addRecoveryGuide("Invalid basin name", "geowiz.analyze");
	assert(guide.errorType === ErrorType.PERMANENT, "Permanent error classified correctly");
	assert(
		guide.recoverySteps.some((s) => /parameter/i.test(s) || /input/i.test(s) || /schema/i.test(s)),
		"Permanent guide suggests checking input",
	);
	assert(guide.retryAfterMs === undefined, "Permanent error has no retryAfterMs");
}

{
	const guide = middleware.addRecoveryGuide("401 Unauthorized", "econobot.analyze");
	assert(guide.errorType === ErrorType.AUTH_REQUIRED, "Auth error classified correctly");
	assert(
		guide.recoverySteps.some((s) => /api.?key|credential|authenticate/i.test(s)),
		"Auth guide suggests checking credentials",
	);
}

{
	const guide = middleware.addRecoveryGuide("Missing data for analysis", "geowiz.analyze");
	assert(guide.errorType === ErrorType.USER_ACTION, "User action classified correctly");
	assert(
		guide.recoverySteps.some((s) => /provide|input|data/i.test(s)),
		"User action guide suggests providing data",
	);
}

// ==========================================
// Test: Alternative Tools
// ==========================================

console.log("\n🔄 Testing alternative tool suggestions...");
{
	const guide = middleware.addRecoveryGuide("timeout", "geowiz.analyze");
	assert(guide.alternativeTools !== undefined && guide.alternativeTools.length > 0, "geowiz has alternative tools");
	assert(guide.alternativeTools!.includes("research.analyze"), "geowiz suggests research as alternative");
}

{
	const guide = middleware.addRecoveryGuide("timeout", "econobot.analyze");
	assert(guide.alternativeTools!.includes("market.analyze"), "econobot suggests market as alternative");
}

{
	const guide = middleware.addRecoveryGuide("timeout", "legal.analyze");
	assert(guide.alternativeTools!.includes("title.analyze"), "legal suggests title as alternative");
}

{
	const guide = middleware.addRecoveryGuide("timeout", "title.analyze");
	assert(guide.alternativeTools!.includes("legal.analyze"), "title suggests legal as alternative");
}

{
	const guide = middleware.addRecoveryGuide("timeout", "reporter.analyze");
	assert(
		guide.alternativeTools !== undefined && guide.alternativeTools.length === 0,
		"reporter has no alternative tools (unique function)",
	);
}

// ==========================================
// Test: Retry Delay Suggestions
// ==========================================

console.log("\n⏱️ Testing retry delay suggestions...");
{
	const rateGuide = middleware.addRecoveryGuide("Rate limit exceeded", "geowiz.analyze");
	assert(rateGuide.retryAfterMs === 5000, "Rate limit → 5000ms delay");

	const timeoutGuide = middleware.addRecoveryGuide("Connection timeout", "geowiz.analyze");
	assert(timeoutGuide.retryAfterMs === 2000, "Timeout → 2000ms delay");

	const connGuide = middleware.addRecoveryGuide("ECONNREFUSED", "geowiz.analyze");
	assert(connGuide.retryAfterMs === 1000, "Connection refused → 1000ms delay");
}

// ==========================================
// Test: classifyErrorDetail
// ==========================================

console.log("\n🏷️ Testing classifyErrorDetail enrichment...");
{
	const raw: ErrorDetail = {
		type: ErrorType.PERMANENT,
		message: "Connection timeout after 30s",
	};
	const enriched = middleware.classifyErrorDetail(raw, "geowiz.analyze");

	assert(enriched.type === ErrorType.RETRYABLE, "Reclassified timeout from permanent to retryable");
	assert(enriched.reason !== undefined && enriched.reason.length > 0, "Added reason string");
	assert(enriched.recoverySteps !== undefined && enriched.recoverySteps.length > 0, "Added recovery steps");
	assert(enriched.alternativeTools !== undefined, "Added alternative tools");
	assert(enriched.retryAfterMs !== undefined && enriched.retryAfterMs > 0, "Added retry delay");
}

{
	const raw: ErrorDetail = {
		type: ErrorType.RETRYABLE,
		message: "Invalid input format",
	};
	const enriched = middleware.classifyErrorDetail(raw, "econobot.analyze");
	assert(enriched.type === ErrorType.PERMANENT, "Reclassified invalid from retryable to permanent");
}

// ==========================================
// Test: Graceful Degradation — Full Success
// ==========================================

console.log("\n✅ Testing graceful degradation — full success...");
{
	const results = new Map<string, ToolResponse>();
	const expected = ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"];
	results.set("geowiz.analyze", mockSuccess("geowiz"));
	results.set("econobot.analyze", mockSuccess("econobot"));
	results.set("risk-analysis.analyze", mockSuccess("risk-analysis"));

	const degraded = middleware.handleDegradation(results, expected);
	assert(degraded.completeness === 100, "100% completeness when all succeed");
	assert(degraded.missingAnalyses.length === 0, "No missing analyses");
	assert(degraded.partialResults.length === 3, "3 partial results");
	assert(degraded.suggestions.length === 0, "No suggestions needed");
	assert(/all.*completed/i.test(degraded.degradationReason), "Reason says all completed");
}

// ==========================================
// Test: Graceful Degradation — 12/14 (86%)
// ==========================================

console.log("\n📊 Testing graceful degradation — 12/14 success (86%)...");
{
	const allServers = [
		"geowiz",
		"econobot",
		"curve-smith",
		"market",
		"research",
		"risk-analysis",
		"legal",
		"title",
		"drilling",
		"infrastructure",
		"development",
		"test",
		"reporter",
		"decision",
	].map((s) => `${s}.analyze`);

	const results = new Map<string, ToolResponse>();

	// 12 succeed
	for (const tool of allServers.slice(0, 12)) {
		results.set(tool, mockSuccess(tool.split(".")[0]));
	}
	// 2 fail (reporter, decision)
	results.set("reporter.analyze", mockFailure("reporter", "Connection timeout"));
	results.set("decision.analyze", mockFailure("decision", "Connection timeout"));

	const degraded = middleware.handleDegradation(results, allServers);
	assert(degraded.completeness === 86, `Completeness is 86% (got ${degraded.completeness}%)`);
	assert(degraded.missingAnalyses.length === 2, `2 missing analyses (got ${degraded.missingAnalyses.length})`);
	assert(degraded.missingAnalyses.includes("reporter.analyze"), "reporter.analyze listed as missing");
	assert(degraded.missingAnalyses.includes("decision.analyze"), "decision.analyze listed as missing");
	assert(degraded.partialResults.length === 12, "12 partial results");
	assert(
		degraded.suggestions.some((s) => /partial.*available|sufficient/i.test(s)),
		"Suggests partial results may be sufficient (>50%)",
	);
}

// ==========================================
// Test: Graceful Degradation — 3/14 (21%, not useful)
// ==========================================

console.log("\n⚠️ Testing graceful degradation — 3/14 success (not useful)...");
{
	const allServers = [
		"geowiz",
		"econobot",
		"curve-smith",
		"market",
		"research",
		"risk-analysis",
		"legal",
		"title",
		"drilling",
		"infrastructure",
		"development",
		"test",
		"reporter",
		"decision",
	].map((s) => `${s}.analyze`);

	const results = new Map<string, ToolResponse>();

	// Only 3 succeed
	results.set("geowiz.analyze", mockSuccess("geowiz"));
	results.set("econobot.analyze", mockSuccess("econobot"));
	results.set("curve-smith.analyze", mockSuccess("curve-smith"));

	// 11 fail
	for (const tool of allServers.slice(3)) {
		results.set(tool, mockFailure(tool.split(".")[0], "Server down"));
	}

	const degraded = middleware.handleDegradation(results, allServers);
	assert(degraded.completeness === 21, `Completeness is 21% (got ${degraded.completeness}%)`);
	assert(degraded.missingAnalyses.length === 11, `11 missing analyses (got ${degraded.missingAnalyses.length})`);
	assert(degraded.partialResults.length === 3, "3 partial results");
	assert(
		degraded.suggestions.some((s) => /insufficient|retrying/i.test(s)),
		"Suggests results are insufficient (<50%)",
	);
}

// ==========================================
// Test: Graceful Degradation — Missing (not in results map)
// ==========================================

console.log("\n🕳️ Testing graceful degradation — missing from results map...");
{
	const results = new Map<string, ToolResponse>();
	const expected = ["geowiz.analyze", "econobot.analyze", "risk-analysis.analyze"];
	results.set("geowiz.analyze", mockSuccess("geowiz"));
	// econobot and risk-analysis not in map at all

	const degraded = middleware.handleDegradation(results, expected);
	assert(degraded.completeness === 33, `Completeness is 33% (got ${degraded.completeness}%)`);
	assert(degraded.missingAnalyses.length === 2, "2 missing (not in map)");
	assert(degraded.missingAnalyses.includes("econobot.analyze"), "econobot listed as missing");
	assert(degraded.missingAnalyses.includes("risk-analysis.analyze"), "risk-analysis listed as missing");
}

// ==========================================
// Test: Degradation Suggestions Include Alternatives
// ==========================================

console.log("\n💡 Testing degradation suggestions include alternatives...");
{
	const results = new Map<string, ToolResponse>();
	const expected = ["geowiz.analyze", "econobot.analyze"];
	results.set("geowiz.analyze", mockSuccess("geowiz"));
	results.set("econobot.analyze", mockFailure("econobot", "Server down"));

	const degraded = middleware.handleDegradation(results, expected);
	assert(
		degraded.suggestions.some((s) => /econobot.*market|research/i.test(s)),
		"Degradation suggests alternatives for econobot",
	);
}

// ==========================================
// Test: Executor integration — errors classified in parallel
// ==========================================

console.log("\n🧠 Testing executor integration — parallel error classification...");
{
	const executor = new Executor({ maxParallel: 6, toolTimeoutMs: 100 });

	// Set up executor fn: geowiz succeeds, econobot times out, risk returns auth error
	executor.setExecutorFn(async (serverName, _args) => {
		if (serverName === "geowiz") return mockSuccess("geowiz", 90);
		if (serverName === "econobot") {
			await new Promise((r) => setTimeout(r, 200)); // will timeout
			return mockSuccess("econobot");
		}
		if (serverName === "risk-analysis") {
			return mockFailure("risk-analysis", "401 Unauthorized", ErrorType.PERMANENT);
		}
		return mockSuccess(serverName);
	});

	const gathered = await executor.executeParallel([
		{ toolName: "geowiz.analyze", args: {} },
		{ toolName: "econobot.analyze", args: {} },
		{ toolName: "risk-analysis.analyze", args: {} },
	]);

	assert(gathered.results.has("geowiz.analyze"), "geowiz result present");
	assert(gathered.results.get("geowiz.analyze")!.success, "geowiz succeeded");

	// Check econobot failure is classified as retryable (timeout)
	const econobotFailure = gathered.failures.find((f) => f.toolName === "econobot.analyze");
	assert(econobotFailure !== undefined, "econobot failure recorded");
	assert(
		econobotFailure!.error.type === ErrorType.RETRYABLE,
		`econobot error classified as retryable (got ${econobotFailure!.error.type})`,
	);
	assert(econobotFailure!.recoveryGuide !== undefined, "econobot failure has recovery guide");
	assert(econobotFailure!.recoveryGuide!.recoverySteps.length > 0, "econobot recovery guide has steps");

	// Check risk-analysis failure is classified as auth_required (reclassified from permanent)
	const riskFailure = gathered.failures.find((f) => f.toolName === "risk-analysis.analyze");
	assert(riskFailure !== undefined, "risk-analysis failure recorded");
	assert(
		riskFailure!.error.type === ErrorType.AUTH_REQUIRED,
		`risk-analysis error reclassified to auth_required (got ${riskFailure!.error.type})`,
	);
	assert(riskFailure!.recoveryGuide !== undefined, "risk-analysis failure has recovery guide");
	assert(
		riskFailure!.recoveryGuide!.alternativeTools !== undefined &&
			riskFailure!.recoveryGuide!.alternativeTools!.length > 0,
		"risk-analysis recovery guide has alternative tools",
	);

	// Check completeness
	assert(gathered.completeness === 33, `Completeness is 33% (1/3 succeeded, got ${gathered.completeness}%)`);
}

// ==========================================
// Test: Executor — resilience accessible
// ==========================================

console.log("\n🔌 Testing executor.resilience accessibility...");
{
	const executor = new Executor();
	assert(executor.resilience instanceof ResilienceMiddleware, "Executor exposes resilience middleware");
}

// ==========================================
// Test: handleDegradation — edge cases
// ==========================================

console.log("\n🔲 Testing handleDegradation edge cases...");
{
	// Empty expected list
	const degraded = middleware.handleDegradation(new Map(), []);
	assert(degraded.completeness === 100, "Empty expected → 100% completeness");
	assert(degraded.missingAnalyses.length === 0, "Empty expected → no missing");
	assert(degraded.partialResults.length === 0, "Empty expected → no results");
}

{
	// All tools missing from results map
	const degraded = middleware.handleDegradation(new Map(), ["geowiz.analyze", "econobot.analyze"]);
	assert(degraded.completeness === 0, "All missing → 0% completeness");
	assert(degraded.missingAnalyses.length === 2, "All missing → 2 missing");
}

{
	// Single tool, succeeds
	const results = new Map<string, ToolResponse>();
	results.set("geowiz.analyze", mockSuccess("geowiz"));
	const degraded = middleware.handleDegradation(results, ["geowiz.analyze"]);
	assert(degraded.completeness === 100, "Single success → 100%");
	assert(degraded.missingAnalyses.length === 0, "Single success → no missing");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL RESILIENCE & ERROR INTELLIGENCE TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL RESILIENCE & ERROR INTELLIGENCE TESTS PASSED!");
}
