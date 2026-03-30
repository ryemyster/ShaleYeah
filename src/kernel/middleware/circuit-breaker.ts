/**
 * SHALE YEAH Agent OS - Circuit Breaker Middleware
 *
 * Prevents cascading failures by tracking per-server failure rates and
 * temporarily excluding unhealthy servers from execution.
 *
 * State machine: closed → open → half-open → closed (or back to open)
 *
 * - closed: normal operation, failures are counted
 * - open: server excluded, fast-fail all requests
 * - half-open: one probe request allowed to test recovery
 */

import { type CircuitBreakerState, type CircuitState, ErrorType } from "../types.js";

interface CircuitBreakerOptions {
	/** Consecutive RETRYABLE failures before opening (default: 3) */
	failureThreshold?: number;
	/** Ms in open state before allowing a half-open probe (default: 30000) */
	resetTimeoutMs?: number;
	/** Max half-open probe attempts before re-opening (default: 1) */
	halfOpenMaxAttempts?: number;
}

const DEFAULT_OPTIONS = {
	failureThreshold: 3,
	resetTimeoutMs: 30000,
	halfOpenMaxAttempts: 1,
} satisfies Required<CircuitBreakerOptions>;

export class CircuitBreaker {
	private readonly failureThreshold: number;
	private readonly resetTimeoutMs: number;
	private readonly halfOpenMaxAttempts: number;
	private readonly states = new Map<string, CircuitBreakerState>();

	constructor(options?: CircuitBreakerOptions) {
		this.failureThreshold = options?.failureThreshold ?? DEFAULT_OPTIONS.failureThreshold;
		this.resetTimeoutMs = options?.resetTimeoutMs ?? DEFAULT_OPTIONS.resetTimeoutMs;
		this.halfOpenMaxAttempts = options?.halfOpenMaxAttempts ?? DEFAULT_OPTIONS.halfOpenMaxAttempts;
	}

	/**
	 * Returns true if the server's circuit is open and requests should be fast-failed.
	 * Automatically transitions open → half-open when resetTimeout has elapsed.
	 */
	isOpen(serverName: string): boolean {
		const state = this.getOrInit(serverName);

		if (state.state === "closed") return false;

		if (state.state === "open") {
			const elapsed = Date.now() - state.lastFailureMs;
			if (elapsed >= this.resetTimeoutMs) {
				// Transition to half-open: allow one probe
				state.state = "half-open";
				state.halfOpenAttempts = 0;
				return false;
			}
			return true;
		}

		// half-open: allow up to halfOpenMaxAttempts probes
		if (state.halfOpenAttempts < this.halfOpenMaxAttempts) {
			return false;
		}

		// Max half-open probes exhausted without success — re-open
		state.state = "open";
		state.lastFailureMs = Date.now();
		return true;
	}

	/**
	 * Record the outcome of a tool call for a server.
	 * Only RETRYABLE errors trip the breaker; PERMANENT/AUTH/USER_ACTION do not.
	 */
	record(serverName: string, success: boolean, errorType?: ErrorType): void {
		const state = this.getOrInit(serverName);

		if (success) {
			// Any success resets the circuit to closed
			state.state = "closed";
			state.failureCount = 0;
			state.halfOpenAttempts = 0;
			return;
		}

		// Only RETRYABLE errors (transient) trip the breaker.
		// PERMANENT / AUTH_REQUIRED / USER_ACTION are request-level issues, not server-level.
		if (errorType !== ErrorType.RETRYABLE) return;

		state.failureCount++;
		state.lastFailureMs = Date.now();

		if (state.state === "half-open") {
			state.halfOpenAttempts++;
			// Failed probe — re-open immediately
			state.state = "open";
			return;
		}

		if (state.state === "closed" && state.failureCount >= this.failureThreshold) {
			state.state = "open";
		}
	}

	/**
	 * Get the current circuit state for a server (for observability).
	 */
	getState(serverName: string): CircuitBreakerState {
		return { ...this.getOrInit(serverName) };
	}

	/**
	 * Manually reset a server's circuit to closed (for admin/testing use).
	 */
	reset(serverName: string): void {
		this.states.set(serverName, this.initialState());
	}

	/**
	 * Returns the human-readable circuit state label for a server.
	 */
	getStateName(serverName: string): CircuitState {
		return this.getOrInit(serverName).state;
	}

	private getOrInit(serverName: string): CircuitBreakerState {
		let state = this.states.get(serverName);
		if (!state) {
			state = this.initialState();
			this.states.set(serverName, state);
		}
		return state;
	}

	private initialState(): CircuitBreakerState {
		return {
			state: "closed",
			failureCount: 0,
			lastFailureMs: 0,
			halfOpenAttempts: 0,
		};
	}
}
