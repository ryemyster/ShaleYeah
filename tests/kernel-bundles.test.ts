/**
 * Kernel Bundles & Composition Tests — Wave 7
 *
 * Tests for pre-built bundles, high-level composition methods,
 * confirmation gate, and abstraction ladder.
 */

import { BUNDLES, FINANCIAL_REVIEW_BUNDLE, GEOLOGICAL_DEEP_DIVE_BUNDLE } from "../src/kernel/bundles.js";
import { Executor, FULL_DUE_DILIGENCE_BUNDLE, QUICK_SCREEN_BUNDLE } from "../src/kernel/executor.js";
import { Kernel } from "../src/kernel/index.js";
import type { ToolResponse } from "../src/kernel/types.js";

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

console.log("🧪 Starting Kernel Bundles & Composition Tests (Wave 7)\n");

// ==========================================
// Helper: mock executor fn
// ==========================================

function mockExecutorFn(): (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse> {
	return async (serverName: string, _args: Record<string, unknown>): Promise<ToolResponse> => ({
		success: true,
		summary: `${serverName} analysis complete`,
		confidence: 85,
		data: { server: serverName, mock: true },
		detailLevel: "standard",
		completeness: 100,
		metadata: {
			server: serverName,
			persona: `${serverName}-persona`,
			executionTimeMs: 1,
			timestamp: new Date().toISOString(),
		},
	});
}

// ==========================================
// Test: QUICK_SCREEN_BUNDLE structure
// ==========================================

console.log("📦 Testing QUICK_SCREEN_BUNDLE structure...");
{
	assert(QUICK_SCREEN_BUNDLE.name === "quick_screen", "Name is quick_screen");
	assert(QUICK_SCREEN_BUNDLE.steps.length === 4, "Has 4 steps");
	assert(QUICK_SCREEN_BUNDLE.gatherStrategy === "all", "Strategy is all");

	const toolNames = QUICK_SCREEN_BUNDLE.steps.map((s) => s.toolName);
	assert(toolNames.includes("geowiz.analyze"), "Includes geowiz");
	assert(toolNames.includes("econobot.analyze"), "Includes econobot");
	assert(toolNames.includes("curve-smith.analyze"), "Includes curve-smith");
	assert(toolNames.includes("risk-analysis.analyze"), "Includes risk-analysis");

	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => s.parallel),
		"All steps are parallel",
	);
	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => !s.optional),
		"All steps are required",
	);
	assert(
		QUICK_SCREEN_BUNDLE.steps.every((s) => s.detailLevel === "summary"),
		"All steps at summary detail level",
	);
}

// ==========================================
// Test: FULL_DUE_DILIGENCE_BUNDLE structure
// ==========================================

console.log("\n📦 Testing FULL_DUE_DILIGENCE_BUNDLE structure...");
{
	assert(FULL_DUE_DILIGENCE_BUNDLE.name === "full_due_diligence", "Name is full_due_diligence");
	assert(FULL_DUE_DILIGENCE_BUNDLE.steps.length === 14, "Has 14 steps (all servers)");
	assert(FULL_DUE_DILIGENCE_BUNDLE.gatherStrategy === "majority", "Strategy is majority");

	// Check phase ordering via dependencies
	const decision = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "decision.analyze");
	assert(decision !== undefined, "Has decision step");
	assert(decision!.dependsOn?.includes("reporter.analyze"), "Decision depends on reporter");

	const reporter = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "reporter.analyze");
	assert(reporter !== undefined, "Has reporter step");
	assert(reporter!.dependsOn?.includes("test.analyze"), "Reporter depends on test");

	const riskAnalysis = FULL_DUE_DILIGENCE_BUNDLE.steps.find((s) => s.toolName === "risk-analysis.analyze");
	assert(riskAnalysis!.dependsOn?.includes("geowiz.analyze"), "Risk-analysis depends on geowiz");

	// Check detail levels
	assert(decision!.detailLevel === "full", "Decision at full detail");
	assert(reporter!.detailLevel === "full", "Reporter at full detail");
}

// ==========================================
// Test: GEOLOGICAL_DEEP_DIVE_BUNDLE structure
// ==========================================

console.log("\n🪨 Testing GEOLOGICAL_DEEP_DIVE_BUNDLE structure...");
{
	assert(GEOLOGICAL_DEEP_DIVE_BUNDLE.name === "geological_deep_dive", "Name is geological_deep_dive");
	assert(GEOLOGICAL_DEEP_DIVE_BUNDLE.steps.length === 3, "Has 3 steps");
	assert(GEOLOGICAL_DEEP_DIVE_BUNDLE.gatherStrategy === "all", "Strategy is all");

	const geo = GEOLOGICAL_DEEP_DIVE_BUNDLE.steps.find((s) => s.toolName === "geowiz.analyze");
	const curve = GEOLOGICAL_DEEP_DIVE_BUNDLE.steps.find((s) => s.toolName === "curve-smith.analyze");
	const research = GEOLOGICAL_DEEP_DIVE_BUNDLE.steps.find((s) => s.toolName === "research.analyze");

	assert(geo !== undefined, "Has geowiz step");
	assert(geo!.detailLevel === "full", "geowiz at full detail");
	assert(!geo!.optional, "geowiz is required");

	assert(curve !== undefined, "Has curve-smith step");
	assert(curve!.detailLevel === "standard", "curve-smith at standard detail");

	assert(research !== undefined, "Has research step");
	assert(research!.detailLevel === "summary", "research at summary detail");
	assert(research!.optional, "research is optional");

	assert(
		GEOLOGICAL_DEEP_DIVE_BUNDLE.steps.every((s) => s.parallel),
		"All steps are parallel",
	);
}

// ==========================================
// Test: FINANCIAL_REVIEW_BUNDLE structure
// ==========================================

console.log("\n💰 Testing FINANCIAL_REVIEW_BUNDLE structure...");
{
	assert(FINANCIAL_REVIEW_BUNDLE.name === "financial_review", "Name is financial_review");
	assert(FINANCIAL_REVIEW_BUNDLE.steps.length === 3, "Has 3 steps");
	assert(FINANCIAL_REVIEW_BUNDLE.gatherStrategy === "all", "Strategy is all");

	const econ = FINANCIAL_REVIEW_BUNDLE.steps.find((s) => s.toolName === "econobot.analyze");
	const risk = FINANCIAL_REVIEW_BUNDLE.steps.find((s) => s.toolName === "risk-analysis.analyze");
	const market = FINANCIAL_REVIEW_BUNDLE.steps.find((s) => s.toolName === "market.analyze");

	assert(econ !== undefined, "Has econobot step");
	assert(econ!.detailLevel === "full", "econobot at full detail");
	assert(!econ!.optional, "econobot is required");

	assert(risk !== undefined, "Has risk-analysis step");
	assert(risk!.detailLevel === "standard", "risk-analysis at standard detail");

	assert(market !== undefined, "Has market step");
	assert(market!.detailLevel === "summary", "market at summary detail");
	assert(market!.optional, "market is optional");
}

// ==========================================
// Test: BUNDLES map
// ==========================================

console.log("\n📚 Testing BUNDLES index...");
{
	assert(BUNDLES.geological_deep_dive === GEOLOGICAL_DEEP_DIVE_BUNDLE, "BUNDLES has geological_deep_dive");
	assert(BUNDLES.financial_review === FINANCIAL_REVIEW_BUNDLE, "BUNDLES has financial_review");
	assert(Object.keys(BUNDLES).length === 2, "BUNDLES has 2 entries (domain bundles)");
}

// ==========================================
// Test: Kernel.quickScreen() execution
// ==========================================

console.log("\n⚡ Testing Kernel.quickScreen() execution...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.quickScreen({ basin: "Permian" });

	assert(result.bundleName === "quick_screen", "Bundle name is quick_screen");
	assert(result.results.size === 4, `4 results (got ${result.results.size})`);
	assert(result.completeness === 100, `100% completeness (got ${result.completeness})`);
	assert(result.overallSuccess, "Overall success");
	assert(result.results.has("geowiz.analyze"), "Has geowiz result");
	assert(result.results.has("econobot.analyze"), "Has econobot result");
}

// ==========================================
// Test: Kernel.geologicalDeepDive() execution
// ==========================================

console.log("\n🪨 Testing Kernel.geologicalDeepDive() execution...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.geologicalDeepDive({ tractId: "T-100" });

	assert(result.bundleName === "geological_deep_dive", "Bundle name correct");
	assert(result.results.size === 3, `3 results (got ${result.results.size})`);
	assert(result.overallSuccess, "Overall success");
	assert(result.results.has("geowiz.analyze"), "Has geowiz result");
	assert(result.results.has("curve-smith.analyze"), "Has curve-smith result");
	assert(result.results.has("research.analyze"), "Has research result");
}

// ==========================================
// Test: Kernel.financialReview() execution
// ==========================================

console.log("\n💰 Testing Kernel.financialReview() execution...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.financialReview({ tractId: "T-200" });

	assert(result.bundleName === "financial_review", "Bundle name correct");
	assert(result.results.size === 3, `3 results (got ${result.results.size})`);
	assert(result.overallSuccess, "Overall success");
	assert(result.results.has("econobot.analyze"), "Has econobot result");
	assert(result.results.has("risk-analysis.analyze"), "Has risk-analysis result");
	assert(result.results.has("market.analyze"), "Has market result");
}

// ==========================================
// Test: Kernel.fullAnalysis() execution
// ==========================================

console.log("\n📊 Testing Kernel.fullAnalysis() execution...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.fullAnalysis({ basin: "Permian" });

	assert(result.bundleName === "full_due_diligence", "Bundle name correct");
	assert(result.results.size === 14, `14 results (got ${result.results.size})`);
	assert(result.overallSuccess, "Overall success");
	assert(result.phases.length > 1, `Multiple phases (got ${result.phases.length})`);
}

// ==========================================
// Test: Confirmation gate — executor level
// ==========================================

console.log("\n🚦 Testing confirmation gate — executor...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	assert(
		executor.requiresConfirmation("decision.make_recommendation"),
		"decision.make_recommendation requires confirmation",
	);
	assert(executor.requiresConfirmation("decision.analyze"), "decision.analyze requires confirmation");
	assert(!executor.requiresConfirmation("geowiz.analyze"), "geowiz.analyze does NOT require confirmation");
	assert(!executor.requiresConfirmation("reporter.analyze"), "reporter.analyze does NOT require confirmation");

	// Execute with confirmation — should NOT execute, returns pending
	const result = await executor.executeWithConfirmation({
		toolName: "decision.analyze",
		args: { basin: "Permian" },
	});

	assert(result.success, "Confirmation gate returns success=true (pending)");
	const data = result.data as Record<string, unknown>;
	assert(data.requires_confirmation === true, "Response has requires_confirmation: true");
	assert(data.pending_action !== undefined, "Response has pending_action");

	const pending = data.pending_action as { actionId: string; toolName: string };
	assert(typeof pending.actionId === "string", "Pending action has actionId");
	assert(pending.toolName === "decision.analyze", "Pending action has correct toolName");

	// Should be in pending actions list
	assert(executor.allPendingActions.length === 1, "1 pending action");
	assert(executor.getPendingAction(pending.actionId) !== undefined, "Can retrieve pending action by ID");
}

// ==========================================
// Test: Confirmation gate — confirm action
// ==========================================

console.log("\n✅ Testing confirmation gate — confirmAction...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const gateResult = await executor.executeWithConfirmation({
		toolName: "decision.analyze",
		args: { basin: "Permian" },
	});
	const pending = (gateResult.data as Record<string, any>).pending_action;
	const actionId = pending.actionId;

	// Confirm the action
	const confirmed = await executor.confirmAction(actionId);

	assert(confirmed.success, "Confirmed action executes successfully");
	assert((confirmed.data as Record<string, unknown>)?.server === "decision", "Confirmed result from decision server");
	assert(executor.allPendingActions.length === 0, "No pending actions after confirm");
	assert(executor.getPendingAction(actionId) === undefined, "Action removed from pending after confirm");
}

// ==========================================
// Test: Confirmation gate — cancel action
// ==========================================

console.log("\n❌ Testing confirmation gate — cancelAction...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const gateResult = await executor.executeWithConfirmation({
		toolName: "decision.analyze",
		args: { basin: "Permian" },
	});
	const actionId = (gateResult.data as Record<string, any>).pending_action.actionId;

	const cancelled = executor.cancelAction(actionId);
	assert(cancelled, "cancelAction returns true");
	assert(executor.allPendingActions.length === 0, "No pending actions after cancel");

	// Trying to confirm cancelled action fails
	const result = await executor.confirmAction(actionId);
	assert(!result.success, "Confirming cancelled action fails");
}

// ==========================================
// Test: Confirmation gate — unknown action ID
// ==========================================

console.log("\n🔍 Testing confirmation gate — unknown actionId...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const result = await executor.confirmAction("nonexistent-id");
	assert(!result.success, "Unknown actionId fails");
	assert(result.error !== undefined, "Error included in response");
}

// ==========================================
// Test: Non-confirmation tool bypasses gate
// ==========================================

console.log("\n🔓 Testing executeWithConfirmation — non-gated tool...");
{
	const executor = new Executor();
	executor.setExecutorFn(mockExecutorFn());

	const result = await executor.executeWithConfirmation({
		toolName: "geowiz.analyze",
		args: { basin: "Permian" },
	});

	assert(result.success, "Non-gated tool executes immediately");
	assert((result.data as Record<string, unknown>)?.server === "geowiz", "Returns actual result (not pending)");
	assert(executor.allPendingActions.length === 0, "No pending actions created");
}

// ==========================================
// Test: Kernel.shouldWeInvest() with confirmation
// ==========================================

console.log("\n🤔 Testing Kernel.shouldWeInvest()...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.shouldWeInvest({ basin: "Permian", tractId: "T-300" });

	assert(result.bundleName === "full_due_diligence", "Bundle name is full_due_diligence");
	assert(result.results.size === 14, `14 results (got ${result.results.size})`);

	// The decision step should have been replaced with confirmation gate
	const decisionResult = result.results.get("decision.analyze");
	assert(decisionResult !== undefined, "Has decision result");
	const decisionData = decisionResult!.data as Record<string, unknown>;
	assert(decisionData.requires_confirmation === true, "Decision result has requires_confirmation: true");

	const pendingAction = decisionData.pending_action as { actionId: string };
	assert(typeof pendingAction.actionId === "string", "Has pending actionId");

	// Confirm the decision
	const confirmed = await kernel.confirmAction(pendingAction.actionId);
	assert(confirmed.success, "Confirming investment decision succeeds");
}

// ==========================================
// Test: Kernel.cancelAction()
// ==========================================

console.log("\n🚫 Testing Kernel.cancelAction()...");
{
	const kernel = new Kernel();
	kernel.setExecutorFn(mockExecutorFn());

	const result = await kernel.shouldWeInvest({ basin: "Eagle Ford" });
	const decisionData = result.results.get("decision.analyze")!.data as Record<string, any>;
	const actionId = decisionData.pending_action.actionId;

	assert(kernel.cancelAction(actionId), "Kernel.cancelAction returns true");
}

// ==========================================
// Test: Kernel.listBundles()
// ==========================================

console.log("\n📋 Testing Kernel.listBundles()...");
{
	const kernel = new Kernel();
	const bundles = kernel.listBundles();

	assert(bundles.quick_screen !== undefined, "Lists quick_screen");
	assert(bundles.full_due_diligence !== undefined, "Lists full_due_diligence");
	assert(bundles.geological_deep_dive !== undefined, "Lists geological_deep_dive");
	assert(bundles.financial_review !== undefined, "Lists financial_review");

	assert(Object.keys(bundles).length === 4, `4 bundles total (got ${Object.keys(bundles).length})`);
	assert(bundles.quick_screen.stepCount === 4, "quick_screen has 4 steps");
	assert(bundles.full_due_diligence.stepCount === 14, "full_due_diligence has 14 steps");
	assert(bundles.geological_deep_dive.stepCount === 3, "geological_deep_dive has 3 steps");
	assert(bundles.financial_review.stepCount === 3, "financial_review has 3 steps");

	assert(typeof bundles.quick_screen.description === "string", "Bundle has description");
}

// ==========================================
// Test: Phase ordering in full due diligence
// ==========================================

console.log("\n📊 Testing phase ordering in full due diligence...");
{
	const executor = new Executor();
	const phases = executor.resolvePhases(FULL_DUE_DILIGENCE_BUNDLE.steps);

	assert(phases.length >= 4, `At least 4 phases (got ${phases.length})`);

	// Phase 1 should include core parallel servers (no dependencies)
	const phase1Tools = phases[0].map((s) => s.toolName);
	assert(phase1Tools.includes("geowiz.analyze"), "Phase 1 has geowiz");
	assert(phase1Tools.includes("econobot.analyze"), "Phase 1 has econobot");

	// Decision should be in the last phase
	const lastPhase = phases[phases.length - 1];
	const lastTools = lastPhase.map((s) => s.toolName);
	assert(lastTools.includes("decision.analyze"), "Last phase has decision");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n${"=".repeat(70)}`);
console.log("📊 KERNEL BUNDLES & COMPOSITION TEST SUMMARY");
console.log("=".repeat(70));
console.log(`📋 Tests Run: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
	console.log("\n❌ SOME TESTS FAILED!");
	process.exit(1);
} else {
	console.log("\n🎉 ALL KERNEL BUNDLES & COMPOSITION TESTS PASSED!");
}
