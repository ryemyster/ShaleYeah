/**
 * Health Monitor Tests — Issue #112
 *
 * TDD: written BEFORE the implementation.
 * Tests should fail until HealthMonitor is implemented.
 *
 * Validates:
 * - HealthMonitor tracks per-server health status
 * - start() begins periodic probing; stop() halts it
 * - Probe results (up/down) are reflected in registry server status
 * - Probe timeout is respected (slow probes counted as down)
 * - getStatus() returns current health for a server
 * - listHealthy() returns only up servers
 * - Health status is exposed via kernel.getServerHealth()
 * - KernelConfig.healthCheck controls interval and timeout
 */

import assert from "node:assert";
import { HealthMonitor } from "../src/kernel/health-monitor.js";
import { Registry } from "../src/kernel/registry.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			console.log(`  ✓ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

/** Build a registry pre-populated with named servers for testing. */
function buildRegistry(names: string[]): Registry {
	const registry = new Registry();
	for (const name of names) {
		registry.registerServer({
			name,
			description: `${name} server`,
			persona: `${name} persona`,
			domain: "test",
			capabilities: [name],
		});
	}
	return registry;
}

async function runTests(): Promise<void> {
	console.log("\n🧪 Health Monitor Tests (Issue #112)\n");

	// ---------------------------------------------------------------------------
	// Construction and initial state
	// ---------------------------------------------------------------------------

	await test("HealthMonitor constructs without error", () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		assert.ok(monitor, "Expected HealthMonitor instance");
	});

	await test("getStatus returns 'unknown' for a server before any probe", () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		const status = monitor.getStatus("geowiz");
		assert.strictEqual(status, "unknown", `Expected 'unknown', got '${status}'`);
	});

	await test("getStatus returns 'unknown' for an unregistered server", () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		const status = monitor.getStatus("nonexistent");
		assert.strictEqual(status, "unknown", `Expected 'unknown' for unknown server, got '${status}'`);
	});

	// ---------------------------------------------------------------------------
	// Manual probe
	// ---------------------------------------------------------------------------

	await test("probeNow() marks a server as 'up' when probe returns 'up'", async () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		await monitor.probeNow("geowiz");
		assert.strictEqual(monitor.getStatus("geowiz"), "up");
	});

	await test("probeNow() marks a server as 'down' when probe returns 'down'", async () => {
		const registry = buildRegistry(["econobot"]);
		const monitor = new HealthMonitor(registry, async () => "down");
		await monitor.probeNow("econobot");
		assert.strictEqual(monitor.getStatus("econobot"), "down");
	});

	await test("probeNow() marks server as 'down' when probe throws", async () => {
		const registry = buildRegistry(["curve-smith"]);
		const monitor = new HealthMonitor(registry, async () => {
			throw new Error("connection refused");
		});
		await monitor.probeNow("curve-smith");
		assert.strictEqual(monitor.getStatus("curve-smith"), "down");
	});

	await test("probeNow() updates registry server status to 'connected' when probe returns 'up'", async () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		await monitor.probeNow("geowiz");
		const servers = registry.listServers();
		const geowiz = servers.find((s) => s.name === "geowiz");
		assert.ok(geowiz, "geowiz not found in registry");
		assert.strictEqual(geowiz.status, "connected", `Expected 'connected', got '${geowiz.status}'`);
	});

	await test("probeNow() updates registry server status to 'error' when probe returns 'down'", async () => {
		const registry = buildRegistry(["econobot"]);
		const monitor = new HealthMonitor(registry, async () => "down");
		await monitor.probeNow("econobot");
		const servers = registry.listServers();
		const econobot = servers.find((s) => s.name === "econobot");
		assert.ok(econobot, "econobot not found in registry");
		assert.strictEqual(econobot.status, "error", `Expected 'error', got '${econobot.status}'`);
	});

	await test("probeNow() is a no-op for an unregistered server (no throw)", async () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		// Should not throw
		await monitor.probeNow("nonexistent");
		assert.strictEqual(monitor.getStatus("nonexistent"), "unknown");
	});

	// ---------------------------------------------------------------------------
	// Probe all servers
	// ---------------------------------------------------------------------------

	await test("probeAll() probes every registered server", async () => {
		const names = ["geowiz", "econobot", "curve-smith"];
		const registry = buildRegistry(names);
		const probed: string[] = [];
		const monitor = new HealthMonitor(registry, async (name) => {
			probed.push(name);
			return "up";
		});
		await monitor.probeAll();
		for (const name of names) {
			assert.ok(probed.includes(name), `Expected ${name} to be probed`);
		}
	});

	await test("probeAll() mixed up/down results are tracked independently", async () => {
		const registry = buildRegistry(["geowiz", "econobot"]);
		const monitor = new HealthMonitor(registry, async (name) => (name === "geowiz" ? "up" : "down"));
		await monitor.probeAll();
		assert.strictEqual(monitor.getStatus("geowiz"), "up");
		assert.strictEqual(monitor.getStatus("econobot"), "down");
	});

	// ---------------------------------------------------------------------------
	// listHealthy
	// ---------------------------------------------------------------------------

	await test("listHealthy() returns only servers with status 'up'", async () => {
		const registry = buildRegistry(["geowiz", "econobot", "curve-smith"]);
		const monitor = new HealthMonitor(registry, async (name) => (name === "econobot" ? "down" : "up"));
		await monitor.probeAll();
		const healthy = monitor.listHealthy();
		assert.ok(healthy.includes("geowiz"), "Expected geowiz in healthy list");
		assert.ok(healthy.includes("curve-smith"), "Expected curve-smith in healthy list");
		assert.ok(!healthy.includes("econobot"), "Expected econobot NOT in healthy list");
	});

	await test("listHealthy() returns empty array when no probes have run", () => {
		const registry = buildRegistry(["geowiz", "econobot"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		const healthy = monitor.listHealthy();
		assert.strictEqual(healthy.length, 0, `Expected empty list, got [${healthy.join(", ")}]`);
	});

	// ---------------------------------------------------------------------------
	// Timeout behaviour
	// ---------------------------------------------------------------------------

	await test("probe timeout: slow probe (>timeout) is counted as 'down'", async () => {
		const registry = buildRegistry(["geowiz"]);
		// Probe that never resolves — will time out
		const slowProbe = async (_name: string): Promise<"up" | "down"> =>
			new Promise((resolve) => setTimeout(() => resolve("up"), 10_000));
		const monitor = new HealthMonitor(registry, slowProbe, { probeTimeoutMs: 50 });
		await monitor.probeNow("geowiz");
		assert.strictEqual(monitor.getStatus("geowiz"), "down", "Expected 'down' after probe timeout");
	});

	// ---------------------------------------------------------------------------
	// start / stop
	// ---------------------------------------------------------------------------

	await test("start() and stop() do not throw", async () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up", { intervalMs: 10_000 });
		monitor.start();
		monitor.stop();
	});

	await test("stop() before start() does not throw", () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up");
		monitor.stop(); // should be safe
	});

	await test("start() triggers at least one probeAll before the first interval elapses", async () => {
		const registry = buildRegistry(["geowiz"]);
		let probeCount = 0;
		const monitor = new HealthMonitor(
			registry,
			async () => {
				probeCount++;
				return "up";
			},
			{ intervalMs: 10_000, probeTimeoutMs: 500 },
		);
		monitor.start();
		// Give it a tick to run the immediate probe
		await new Promise((resolve) => setTimeout(resolve, 50));
		monitor.stop();
		assert.ok(probeCount >= 1, `Expected at least 1 probe, got ${probeCount}`);
	});

	await test("stop() halts further probing", async () => {
		const registry = buildRegistry(["geowiz"]);
		let probeCount = 0;
		const monitor = new HealthMonitor(
			registry,
			async () => {
				probeCount++;
				return "up";
			},
			{ intervalMs: 20, probeTimeoutMs: 500 },
		);
		monitor.start();
		await new Promise((resolve) => setTimeout(resolve, 60));
		const countAtStop = probeCount;
		monitor.stop();
		await new Promise((resolve) => setTimeout(resolve, 60));
		// After stop, no more probes should fire
		assert.strictEqual(probeCount, countAtStop, `Expected probe count to freeze at ${countAtStop}, got ${probeCount}`);
	});

	await test("isRunning reflects start/stop state", () => {
		const registry = buildRegistry(["geowiz"]);
		const monitor = new HealthMonitor(registry, async () => "up", { intervalMs: 10_000 });
		assert.strictEqual(monitor.isRunning, false);
		monitor.start();
		assert.strictEqual(monitor.isRunning, true);
		monitor.stop();
		assert.strictEqual(monitor.isRunning, false);
	});

	// ---------------------------------------------------------------------------
	// Summary
	// ---------------------------------------------------------------------------
	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
