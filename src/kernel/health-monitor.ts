/**
 * SHALE YEAH Agent OS — Health Monitor
 *
 * Proactive server health monitoring for the kernel (Issue #112).
 *
 * Periodically calls an injected probe function for each registered server
 * and updates the registry's server status accordingly. Unhealthy servers
 * are excluded from scatter-gather and bundle execution via the registry's
 * listServers() filter.
 *
 * The probe function is injected at construction so tests can run without
 * real MCP server processes.
 */

import type { Registry } from "./registry.js";

/** Result of a single health probe for one server. */
export type ProbeResult = "up" | "down";

/**
 * Function that tests whether a named server is reachable.
 * Should resolve to "up" if healthy, "down" if not.
 * May throw — the monitor treats throws as "down".
 */
export type ProbeFn = (serverName: string) => Promise<ProbeResult>;

/** Health state tracked per server. "unknown" until first probe. */
export type HealthStatus = "up" | "down" | "unknown";

/** Configuration for the HealthMonitor. */
export interface HealthMonitorConfig {
	/** Ms between probeAll() cycles (default: 60_000). */
	intervalMs?: number;
	/** Ms before an individual probe is abandoned and counted as "down" (default: 5_000). */
	probeTimeoutMs?: number;
}

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

/**
 * HealthMonitor — proactive per-server health checking.
 *
 * Usage:
 *   const monitor = new HealthMonitor(registry, myProbeFn);
 *   monitor.start();          // begin periodic probing
 *   monitor.getStatus("geowiz"); // "up" | "down" | "unknown"
 *   monitor.listHealthy();    // string[] of servers currently "up"
 *   monitor.stop();           // halt periodic probing
 */
export class HealthMonitor {
	private readonly registry: Registry;
	private readonly probeFn: ProbeFn;
	private readonly intervalMs: number;
	private readonly probeTimeoutMs: number;

	private statusMap: Map<string, HealthStatus> = new Map();
	private intervalHandle: ReturnType<typeof setInterval> | null = null;

	constructor(registry: Registry, probeFn: ProbeFn, config?: HealthMonitorConfig) {
		this.registry = registry;
		this.probeFn = probeFn;
		this.intervalMs = config?.intervalMs ?? DEFAULT_INTERVAL_MS;
		this.probeTimeoutMs = config?.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
	}

	// ==========================================
	// Public API
	// ==========================================

	/** Whether the periodic probe loop is currently running. */
	get isRunning(): boolean {
		return this.intervalHandle !== null;
	}

	/**
	 * Get the current health status for a single server.
	 * Returns "unknown" if the server has never been probed or is not registered.
	 */
	getStatus(serverName: string): HealthStatus {
		return this.statusMap.get(serverName) ?? "unknown";
	}

	/**
	 * Return the names of all servers currently marked as "up".
	 * Servers that have never been probed ("unknown") are excluded.
	 */
	listHealthy(): string[] {
		const healthy: string[] = [];
		for (const [name, status] of this.statusMap) {
			if (status === "up") healthy.push(name);
		}
		return healthy;
	}

	/**
	 * Probe a single server by name.
	 * Updates internal status and registry server status.
	 * No-op (no throw) if the server is not registered.
	 */
	async probeNow(serverName: string): Promise<void> {
		// Ignore unregistered servers
		const servers = this.registry.listServers();
		if (!servers.some((s) => s.name === serverName)) {
			return;
		}

		const result = await this.runProbeWithTimeout(serverName);
		this.applyResult(serverName, result);
	}

	/**
	 * Probe all registered servers in parallel.
	 * Updates status for each server.
	 */
	async probeAll(): Promise<void> {
		const servers = this.registry.listServers();
		await Promise.allSettled(
			servers.map((s) => this.runProbeWithTimeout(s.name).then((r) => this.applyResult(s.name, r))),
		);
	}

	/**
	 * Start periodic probing. Runs an immediate probeAll(), then repeats
	 * every intervalMs. Safe to call multiple times (idempotent).
	 */
	start(): void {
		if (this.intervalHandle !== null) return;

		// Fire immediately, don't wait for first interval
		void this.probeAll();

		this.intervalHandle = setInterval(() => {
			void this.probeAll();
		}, this.intervalMs);
	}

	/**
	 * Stop periodic probing. Safe to call before start() or multiple times.
	 */
	stop(): void {
		if (this.intervalHandle !== null) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}

	// ==========================================
	// Private helpers
	// ==========================================

	/**
	 * Run the probe for serverName, racing against the configured timeout.
	 * Returns "down" if the probe throws or times out.
	 */
	private async runProbeWithTimeout(serverName: string): Promise<ProbeResult> {
		const timeout = new Promise<ProbeResult>((resolve) => setTimeout(() => resolve("down"), this.probeTimeoutMs));
		try {
			return await Promise.race([this.probeFn(serverName), timeout]);
		} catch {
			return "down";
		}
	}

	/**
	 * Record a probe result and update the registry server status.
	 */
	private applyResult(serverName: string, result: ProbeResult): void {
		this.statusMap.set(serverName, result);
		this.registry.setServerStatus(serverName, result === "up" ? "connected" : "error");
	}
}
