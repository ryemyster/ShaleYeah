/**
 * Kernel Circuit Breaker Tests — Issue #111
 *
 * Tests for the CircuitBreaker state machine, executor fast-fail integration,
 * and registry health-aware server filtering.
 */

import { Executor } from "../src/kernel/executor.js";
import { CircuitBreaker } from "../src/kernel/middleware/circuit-breaker.js";
import { Registry } from "../src/kernel/registry.js";
import type { ToolResponse } from "../src/kernel/types.js";
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

console.log("🧪 Starting Kernel Circuit Breaker Tests (Issue #111)\n");

// ==========================================
// Helpers
// ==========================================

function mockSuccess(server: string): ToolResponse {
	return {
		success: true,
		summary: `${server} analysis complete`,
		confidence: 85,
		data: { server, result: "ok" },
		detailLevel: "standard",
		completeness: 100,
		metadata: {
			server,
			persona: `${server}-persona`,
			executionTimeMs: 5,
			timestamp: new Date().toISOString(),
		},
	};
}

function mockFailure(server: string, message = "connection reset", errorType = ErrorType.RETRYABLE): ToolResponse {
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
		error: { type: errorType, message },
	};
}

// ==========================================
// CircuitBreaker — State Machine
// ==========================================

console.log("🔌 Testing circuit breaker state machine...");
{
	const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 100, halfOpenMaxAttempts: 1 });

	// Initial state: closed
	assert(cb.getState("geowiz").state === "closed", "Initial state is closed");
	assert(!cb.isOpen("geowiz"), "Closed circuit: isOpen returns false");

	// Record failures below threshold — stays closed
	cb.record("geowiz", false, ErrorType.RETRYABLE);
	cb.record("geowiz", false, ErrorType.RETRYABLE);
	assert(cb.getState("geowiz").state === "closed", "Below threshold: still closed");
	assert(cb.getState("geowiz").failureCount === 2, "Failure count tracked correctly");

	// Third failure hits threshold — opens
	cb.record("geowiz", false, ErrorType.RETRYABLE);
	assert(cb.getState("geowiz").state === "open", "At threshold: circuit opens");
	assert(cb.isOpen("geowiz"), "Open circuit: isOpen returns true");
}

console.log("\n🚫 Testing that non-retryable errors do not trip the breaker...");
{
	const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100, halfOpenMaxAttempts: 1 });

	cb.record("econobot", false, ErrorType.PERMANENT);
	cb.record("econobot", false, ErrorType.AUTH_REQUIRED);
	cb.record("econobot", false, ErrorType.USER_ACTION);
	assert(cb.getState("econobot").state === "closed", "PERMANENT/AUTH/USER_ACTION failures do not open circuit");
	assert(cb.getState("econobot").failureCount === 0, "Non-retryable failures not counted");
}

console.log("\n⏱️  Testing open → half-open transition after reset timeout...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxAttempts: 1 });

	cb.record("risk-analysis", false, ErrorType.RETRYABLE);
	assert(cb.getState("risk-analysis").state === "open", "Circuit opens after 1 failure");
	assert(cb.isOpen("risk-analysis"), "isOpen true when open");

	// Wait for reset timeout
	await new Promise((resolve) => setTimeout(resolve, 60));

	assert(!cb.isOpen("risk-analysis"), "After timeout: isOpen returns false (half-open probe allowed)");
	assert(cb.getState("risk-analysis").state === "half-open", "State transitions to half-open");
}

console.log("\n✅ Testing half-open → closed on success...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxAttempts: 1 });

	cb.record("curve-smith", false, ErrorType.RETRYABLE);
	await new Promise((resolve) => setTimeout(resolve, 60));
	cb.isOpen("curve-smith"); // trigger open→half-open

	// Successful probe closes the circuit
	cb.record("curve-smith", true);
	assert(cb.getState("curve-smith").state === "closed", "Success in half-open → closed");
	assert(cb.getState("curve-smith").failureCount === 0, "Failure count reset on success");
	assert(!cb.isOpen("curve-smith"), "isOpen false after recovery");
}

console.log("\n🔁 Testing half-open → open on failure...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxAttempts: 1 });

	cb.record("decision", false, ErrorType.RETRYABLE);
	await new Promise((resolve) => setTimeout(resolve, 60));
	cb.isOpen("decision"); // trigger open→half-open

	// Failed probe re-opens
	cb.record("decision", false, ErrorType.RETRYABLE);
	assert(cb.getState("decision").state === "open", "Failure in half-open → re-opens");
	assert(cb.isOpen("decision"), "isOpen true after failed probe");
}

console.log("\n🔃 Testing manual reset...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });

	cb.record("reporter", false, ErrorType.RETRYABLE);
	assert(cb.getState("reporter").state === "open", "Circuit opens");

	cb.reset("reporter");
	assert(cb.getState("reporter").state === "closed", "Manual reset → closed");
	assert(cb.getState("reporter").failureCount === 0, "Failure count cleared by reset");
	assert(!cb.isOpen("reporter"), "isOpen false after reset");
}

console.log("\n🔀 Testing multiple independent servers...");
{
	const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });

	cb.record("geowiz", false, ErrorType.RETRYABLE);
	cb.record("geowiz", false, ErrorType.RETRYABLE);
	cb.record("econobot", false, ErrorType.RETRYABLE);

	assert(cb.getState("geowiz").state === "open", "geowiz circuit open");
	assert(cb.getState("econobot").state === "closed", "econobot circuit still closed (1 failure)");
	assert(cb.isOpen("geowiz"), "isOpen true for geowiz");
	assert(!cb.isOpen("econobot"), "isOpen false for econobot");
}

// ==========================================
// Executor Integration — Fast-fail
// ==========================================

console.log("\n⚡ Testing executor fast-fail on open circuit...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const executor = new Executor({ maxRetries: 0 });
	executor.setCircuitBreaker(cb);

	let executorCalls = 0;
	executor.setExecutorFn(async (serverName) => {
		executorCalls++;
		return mockSuccess(serverName);
	});

	// Trip the circuit
	cb.record("geowiz", false, ErrorType.RETRYABLE);

	const result = await executor.execute({ toolName: "geowiz.analyze", args: {} });

	assert(!result.success, "Fast-fail returns failure response");
	assert(result.error?.message?.includes("Circuit open"), "Fast-fail message mentions circuit open");
	assert(executorCalls === 0, "Executor function never called when circuit is open");
}

console.log("\n📊 Testing executor records successes into circuit breaker...");
{
	const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const executor = new Executor({ maxRetries: 0 });
	executor.setCircuitBreaker(cb);

	executor.setExecutorFn(async (serverName) => mockSuccess(serverName));

	await executor.execute({ toolName: "econobot.analyze", args: {} });
	assert(cb.getState("econobot").state === "closed", "Success keeps circuit closed");
	assert(cb.getState("econobot").failureCount === 0, "Failure count remains 0 after success");
}

console.log("\n📉 Testing executor records RETRYABLE failures into circuit breaker...");
{
	const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const executor = new Executor({ maxRetries: 0 });
	executor.setCircuitBreaker(cb);

	executor.setExecutorFn(async (serverName) => mockFailure(serverName, "ECONNRESET", ErrorType.RETRYABLE));

	await executor.execute({ toolName: "curve-smith.analyze", args: {} });
	assert(cb.getState("curve-smith").failureCount === 1, "One RETRYABLE failure recorded");
	assert(cb.getState("curve-smith").state === "closed", "Circuit still closed after 1 failure");

	await executor.execute({ toolName: "curve-smith.analyze", args: {} });
	assert(cb.getState("curve-smith").state === "open", "Circuit opens after hitting threshold");
}

console.log("\n🚧 Testing executeParallel pre-filters open-circuit servers...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const executor = new Executor({ maxRetries: 0 });
	executor.setCircuitBreaker(cb);

	let executorCalls = 0;
	executor.setExecutorFn(async (serverName) => {
		executorCalls++;
		return mockSuccess(serverName);
	});

	// Trip geowiz circuit
	cb.record("geowiz", false, ErrorType.RETRYABLE);

	const result = await executor.executeParallel([
		{ toolName: "geowiz.analyze", args: {} },
		{ toolName: "econobot.analyze", args: {} },
	]);

	assert(executorCalls === 1, "Only econobot executed (geowiz fast-failed)");
	assert(result.failures.length === 1, "One failure from open circuit");
	assert(result.failures[0].toolName === "geowiz.analyze", "geowiz is the failure");
	assert(result.completeness === 50, "50% completeness (1 of 2 succeeded)");
}

// ==========================================
// Registry Integration
// ==========================================

console.log("\n🗂️  Testing registry filters open-circuit servers from listServers...");
{
	const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const registry = new Registry();
	registry.setCircuitBreaker(cb);

	registry.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});
	registry.registerServer({
		name: "econobot",
		description: "Econ",
		persona: "Julius",
		domain: "economics",
		capabilities: ["economics"],
	});
	registry.setServerStatus("geowiz", "connected");
	registry.setServerStatus("econobot", "connected");

	// Both visible initially
	assert(registry.listServers().length === 2, "Both servers visible when circuits closed");

	// Trip geowiz circuit
	cb.record("geowiz", false, ErrorType.RETRYABLE);

	// geowiz excluded
	const visible = registry.listServers();
	assert(visible.length === 1, "Open-circuit server excluded from listServers");
	assert(visible[0].name === "econobot", "econobot still visible");
}

console.log("\n🔭 Testing registry getCircuitState passthrough...");
{
	const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60000, halfOpenMaxAttempts: 1 });
	const registry = new Registry();
	registry.setCircuitBreaker(cb);
	registry.registerServer({
		name: "geowiz",
		description: "Geo",
		persona: "Marcus",
		domain: "geology",
		capabilities: ["geology"],
	});

	cb.record("geowiz", false, ErrorType.RETRYABLE);

	const state = registry.getCircuitState("geowiz");
	assert(state !== undefined, "getCircuitState returns state");
	assert(state?.failureCount === 1, "Failure count reflected in registry state");
	assert(state?.state === "closed", "State is closed (threshold 2, only 1 failure)");
}

// ==========================================
// Summary
// ==========================================

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.error(`\n❌ ${failed} test(s) failed`);
	process.exit(1);
} else {
	console.log("\n✅ All circuit breaker tests passed!");
}
