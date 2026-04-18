/**
 * SHALE YEAH Agent OS - Execution Engine
 *
 * Handles single, parallel (scatter-gather), and bundled tool execution.
 * Implements Arcade patterns:
 * - Scatter-Gather (parallel execution via Promise.allSettled)
 * - Task Bundle (multi-step workflows with dependency ordering)
 * - Idempotent Operation (deterministic idempotency keys)
 */

import { createHash } from "node:crypto";
import type { Session, SessionManager } from "./context.js";
import type { CircuitBreaker } from "./middleware/circuit-breaker.js";
import { ResilienceMiddleware } from "./middleware/resilience.js";
import type { Registry } from "./registry.js";
import { ResultCache } from "./result-cache.js";
import type {
	BundleResponse,
	BundleStep,
	DegradationManifest,
	ExecutionOptions,
	FailedItem,
	FailureDetail,
	FallbackUsageRecord,
	GatheredResponse,
	PartialSuccessResult,
	PhaseResult,
	ResourceRef,
	SucceededItem,
	TaskBundle,
	ToolRequest,
	ToolResponse,
} from "./types.js";
import { type CancellationToken, ErrorType } from "./types.js";

// ==========================================
// Tool executor function type
// ==========================================

/**
 * Function that actually invokes a tool on an MCP server.
 * The kernel injects this — the executor doesn't know about MCP transport.
 */
export type ToolExecutorFn = (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse>;

// ==========================================
// Executor
// ==========================================

/**
 * Execution engine for tool invocations — single, parallel, and bundled.
 */
/** Pending action awaiting confirmation */
export interface PendingAction {
	actionId: string;
	toolName: string;
	args: Record<string, unknown>;
	createdAt: string;
	description: string;
}

/** Tools that require explicit confirmation before execution */
const CONFIRMATION_REQUIRED_TOOLS = new Set(["decision.make_recommendation", "decision.analyze"]);

/** Servers whose responses must never be cached (command tools with side effects). */
const NON_CACHEABLE_SERVERS = new Set(["reporter", "decision"]);

export class Executor {
	private executorFn: ToolExecutorFn | null = null;
	private maxParallel: number;
	private toolTimeoutMs: number;
	private serverTimeouts: Record<string, number>;
	private maxRetries: number;
	private retryBackoffMs: number;
	public readonly resilience: ResilienceMiddleware;
	private pendingActions: Map<string, PendingAction> = new Map();
	private circuitBreaker: CircuitBreaker | null = null;
	public readonly resultCache: ResultCache;
	/** Optional registry reference for fallback routing lookups. */
	private registry: Registry | null = null;
	/** Optional session manager reference for resource ref resolution (Issue #204). */
	private sessionManager: SessionManager | null = null;
	/** Audit log of every fallback invocation this executor has performed. */
	private fallbackUsage: FallbackUsageRecord[] = [];

	constructor(options?: {
		maxParallel?: number;
		toolTimeoutMs?: number;
		/** Per-server timeout overrides. Key is server name (e.g. "econobot"). */
		serverTimeouts?: Record<string, number>;
		maxRetries?: number;
		retryBackoffMs?: number;
		cacheTtlMs?: number;
	}) {
		this.maxParallel = options?.maxParallel ?? 6;
		// KERNEL_TIMEOUT_MS env var sets the default when no explicit option provided
		const envTimeoutMs = process.env.KERNEL_TIMEOUT_MS ? Number(process.env.KERNEL_TIMEOUT_MS) : undefined;
		this.toolTimeoutMs = options?.toolTimeoutMs ?? envTimeoutMs ?? 30000;
		this.serverTimeouts = options?.serverTimeouts ?? {};
		this.maxRetries = options?.maxRetries ?? 0;
		this.retryBackoffMs = options?.retryBackoffMs ?? 1000;
		this.resilience = new ResilienceMiddleware();
		this.resultCache = new ResultCache({ ttlMs: options?.cacheTtlMs ?? 300_000 });
	}

	/**
	 * Attach a CircuitBreaker for per-server health tracking.
	 */
	setCircuitBreaker(cb: CircuitBreaker): void {
		this.circuitBreaker = cb;
	}

	/**
	 * Set the underlying tool execution function.
	 * The kernel provides this after MCP connections are established.
	 */
	setExecutorFn(fn: ToolExecutorFn): void {
		this.executorFn = fn;
	}

	/**
	 * Attach the tool registry so the executor can look up registered fallbacks.
	 * Call this after the registry is populated during kernel initialization.
	 */
	setRegistry(registry: Registry): void {
		this.registry = registry;
	}

	/**
	 * Attach the session manager so the executor can resolve ResourceRef values
	 * in tool args before dispatch (Issue #204 — Resource Reference pattern).
	 * Call this during kernel initialization alongside setRegistry().
	 */
	setSessionManager(mgr: SessionManager): void {
		this.sessionManager = mgr;
	}

	/**
	 * Walk a tool's args object and replace any ResourceRef values with the
	 * actual payload stored in the session.
	 *
	 * A ResourceRef is any object with a "resourceId" string field.
	 * This lets a tool pass `{ formationData: { resourceId: "geowiz:formation:001", mimeType: "..." } }`
	 * and receive the full blob transparently — without the caller knowing the kernel resolved it.
	 *
	 * Returns the original args object unchanged if no refs are found or if no
	 * session/sessionManager is available, so there is zero overhead on the common path.
	 */
	private resolveResourceRefs(args: Record<string, unknown>, sessionId?: string): Record<string, unknown> {
		if (!this.sessionManager || !sessionId) return args;

		let changed = false;
		const resolved: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(args)) {
			if (this.isResourceRef(value)) {
				const payload = this.sessionManager.resolveResource(sessionId, (value as ResourceRef).resourceId);
				// If the resource isn't found, pass the ref through unchanged — let the tool
				// handle a missing value rather than silently dropping data.
				resolved[key] = payload !== undefined ? payload : value;
				changed = true;
			} else {
				resolved[key] = value;
			}
		}

		return changed ? resolved : args;
	}

	/**
	 * Return true if a value looks like a ResourceRef (has a non-empty resourceId string).
	 * Intentionally loose — only checks the discriminating field so tool authors can
	 * extend ResourceRef with extra fields without breaking resolution.
	 */
	private isResourceRef(value: unknown): boolean {
		return (
			typeof value === "object" &&
			value !== null &&
			"resourceId" in value &&
			typeof (value as Record<string, unknown>).resourceId === "string"
		);
	}

	/**
	 * Return the audit log of every fallback invocation this executor has performed.
	 * Callers can use this to surface fallback usage in audit logs or warnings.
	 */
	getFallbackUsage(): FallbackUsageRecord[] {
		return [...this.fallbackUsage];
	}

	/**
	 * Execute a single tool request with automatic retry for retryable errors.
	 * Uses exponential backoff with jitter based on resilience delay recommendations.
	 * Pass an optional CancellationToken to abort before execution starts.
	 *
	 * MA-COMPAT: Managed Agents calls wake(sessionId) to restart a stateless harness against
	 * a durable session log. The Executor is already stateless (no in-process session state),
	 * which matches that model exactly. The missing piece: each analysis run should carry an
	 * invocationId so audit events and session results can be sliced per harness activation.
	 * Add invocationId?: string here and thread it into AuditEntry when wiring to #285.
	 */
	async execute(request: ToolRequest, token?: CancellationToken): Promise<ToolResponse> {
		if (token?.isCancelled) {
			return this.cancelledResponse(request.toolName);
		}

		if (!this.executorFn) {
			return this.errorResponse(
				request.toolName,
				"Executor not connected — call setExecutorFn() first",
				ErrorType.PERMANENT,
			);
		}

		const serverName = request.toolName.split(".")[0];
		const cacheable = !NON_CACHEABLE_SERVERS.has(serverName);

		// Check result cache before executing (query tools only)
		if (cacheable) {
			const cacheKey = this.generateIdempotencyKey(request.toolName, request.args, request.sessionId);
			const cached = this.resultCache.get(cacheKey);
			if (cached) {
				return { ...cached, metadata: { ...cached.metadata, fromCache: true } };
			}
		}

		// Fast-fail if this server's circuit is open
		if (this.circuitBreaker?.isOpen(serverName)) {
			return this.errorResponse(
				request.toolName,
				`Circuit open for ${serverName} — server temporarily excluded due to repeated failures`,
				ErrorType.RETRYABLE,
			);
		}

		const overallStartMs = Date.now();
		let lastResponse: ToolResponse | null = null;
		// Use per-server timeout if configured, else fall back to global
		const effectiveTimeoutMs = this.serverTimeouts[serverName] ?? this.toolTimeoutMs;

		// Resolve any ResourceRef values in args before the first attempt.
		// Done once outside the retry loop — refs are stable across retries.
		const resolvedArgs = this.resolveResourceRefs(request.args, request.sessionId);

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			const startMs = Date.now();

			try {
				const result = await this.withTimeout(this.executorFn(serverName, resolvedArgs), effectiveTimeoutMs);
				if (result.success) {
					this.circuitBreaker?.record(serverName, true);
					if (attempt > 0) {
						result.metadata = {
							...result.metadata,
							retryAttempts: attempt,
							totalRetryDelayMs: startMs - overallStartMs,
						};
					}
					// Populate cache for query tools
					if (cacheable) {
						const cacheKey = this.generateIdempotencyKey(request.toolName, request.args, request.sessionId);
						this.resultCache.set(cacheKey, result, true);
					}
					return result;
				}
				// Non-success response — treat as error for retry classification
				lastResponse = result;
				const errorMsg = result.error?.message ?? result.summary ?? "Unknown failure";
				const errorType = this.resilience.classifyError(errorMsg, request.toolName);

				this.circuitBreaker?.record(serverName, false, errorType);

				if (errorType !== ErrorType.RETRYABLE || attempt >= this.maxRetries) {
					break;
				}

				await this.backoffDelay(errorMsg, attempt);
			} catch (err) {
				const elapsed = Date.now() - startMs;
				const isTimeout = err instanceof Error && err.message === "TIMEOUT";
				const errorMsg = isTimeout ? `Tool timed out after ${elapsed}ms` : `Tool execution failed: ${String(err)}`;
				const errorType = isTimeout ? ErrorType.RETRYABLE : this.resilience.classifyError(errorMsg);

				this.circuitBreaker?.record(serverName, false, errorType);
				lastResponse = this.errorResponse(request.toolName, errorMsg, errorType);

				if (errorType !== ErrorType.RETRYABLE || attempt >= this.maxRetries) {
					break;
				}

				await this.backoffDelay(errorMsg, attempt);
			}
		}

		// Attach retry metadata to the final failure response
		if (lastResponse && this.maxRetries > 0) {
			const attemptsUsed = Math.min(
				this.maxRetries,
				Math.max(1, Math.round((Date.now() - overallStartMs) / this.retryBackoffMs)),
			);
			lastResponse.metadata = {
				...lastResponse.metadata,
				retryAttempts: attemptsUsed,
				totalRetryDelayMs: Date.now() - overallStartMs,
			};
		}

		// Fallback chain routing — try each registered fallback in order when all primary retries fail.
		// Fallbacks are opt-in per tool: only fires if registerFallback() was called for this tool.
		// The chain stops at the first fallback that succeeds; all attempts are recorded for audit.
		const fallbackChain = this.registry?.getFallbacks(request.toolName) ?? [];
		if (fallbackChain.length > 0 && lastResponse && !lastResponse.success) {
			const primaryFailureReason = lastResponse.error?.message ?? lastResponse.summary ?? "Primary tool failed";
			for (const fallbackToolName of fallbackChain) {
				const fallbackServerName = fallbackToolName.split(".")[0];
				try {
					const fallbackResult = await this.withTimeout(
						this.executorFn!(fallbackServerName, resolvedArgs),
						this.serverTimeouts[fallbackServerName] ?? this.toolTimeoutMs,
					);
					// Record every fallback attempt for audit/observability
					const record: FallbackUsageRecord = {
						primaryTool: request.toolName,
						fallbackTool: fallbackToolName,
						reason: primaryFailureReason,
						timestamp: new Date().toISOString(),
					};
					this.fallbackUsage.push(record);
					if (fallbackResult.success) {
						// Stamp the result with fallback provenance so callers can surface it
						fallbackResult.metadata = {
							...fallbackResult.metadata,
							usedFallback: true,
							originalTool: request.toolName,
							fallbackTool: fallbackToolName,
						};
						return fallbackResult;
					}
					// This fallback failed — try the next one in the chain
				} catch {
					// Fallback threw — record and continue to next in chain
					this.fallbackUsage.push({
						primaryTool: request.toolName,
						fallbackTool: fallbackToolName,
						reason: `${primaryFailureReason} (fallback threw)`,
						timestamp: new Date().toISOString(),
					});
				}
			}
			// All fallbacks exhausted — fall through and return the primary failure
		}

		return lastResponse!;
	}

	/**
	 * Calculate and wait for exponential backoff delay with jitter.
	 * Base delay comes from resilience recommendations, then scaled by 2^attempt.
	 * Jitter adds 0-30% randomness to prevent thundering herd.
	 */
	private async backoffDelay(errorMsg: string, attempt: number): Promise<void> {
		const baseDelay = this.resilience.suggestRetryDelay(errorMsg) || this.retryBackoffMs;
		const exponentialDelay = baseDelay * 2 ** attempt;
		const jitter = exponentialDelay * Math.random() * 0.3;
		const totalDelay = Math.round(exponentialDelay + jitter);
		await new Promise((resolve) => setTimeout(resolve, totalDelay));
	}

	/**
	 * Execute multiple tool requests in parallel (scatter-gather).
	 * Uses Promise.allSettled so individual failures don't block others.
	 * Pass an optional CancellationToken to abort between chunks.
	 * Pass ExecutionOptions.aggregateTimeoutMs to cap total wall-clock time.
	 */
	async executeParallel(
		requests: ToolRequest[],
		token?: CancellationToken,
		options?: ExecutionOptions,
	): Promise<GatheredResponse> {
		const startMs = Date.now();
		const results = new Map<string, ToolResponse>();
		const failures: FailureDetail[] = [];
		let wasCancelled = false;
		let wasTimedOut = false;

		const deadlineMs = options?.aggregateTimeoutMs ? startMs + options.aggregateTimeoutMs : undefined;

		// Short-circuit if already cancelled
		if (token?.isCancelled) {
			return {
				results,
				completeness: 0,
				totalTimeMs: 0,
				failures,
				cancelled: true,
			};
		}

		// Pre-filter: fast-fail any requests whose server circuit is open
		const activeRequests: ToolRequest[] = [];
		for (const req of requests) {
			const serverName = req.toolName.split(".")[0];
			if (this.circuitBreaker?.isOpen(serverName)) {
				const errorDetail = {
					type: ErrorType.RETRYABLE,
					message: `Circuit open for ${serverName} — server temporarily excluded due to repeated failures`,
				};
				failures.push({ toolName: req.toolName, error: errorDetail });
			} else {
				activeRequests.push(req);
			}
		}

		// Batch into chunks of maxParallel
		const chunks = this.chunk(activeRequests, this.maxParallel);

		for (const chunk of chunks) {
			// Check cancellation between chunks
			if (token?.isCancelled) {
				wasCancelled = true;
				break;
			}

			// Check aggregate deadline between chunks
			if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
				wasTimedOut = true;
				break;
			}

			const settled = await Promise.allSettled(chunk.map((req) => this.execute(req)));

			for (let i = 0; i < settled.length; i++) {
				const req = chunk[i];
				const outcome = settled[i];

				if (outcome.status === "fulfilled") {
					const resp = outcome.value;
					if (resp.success) {
						results.set(req.toolName, resp);
					} else {
						results.set(req.toolName, resp);
						const rawError = resp.error ?? {
							type: ErrorType.PERMANENT,
							message: "Unknown failure",
						};
						const classified = this.resilience.classifyErrorDetail(rawError, req.toolName);
						const guide = this.resilience.addRecoveryGuide(classified.message, req.toolName);
						failures.push({
							toolName: req.toolName,
							error: classified,
							recoveryGuide: guide,
						});
					}
				} else {
					const msg = String(outcome.reason);
					const classified = this.resilience.classifyErrorDetail(
						{ type: ErrorType.PERMANENT, message: msg },
						req.toolName,
					);
					const guide = this.resilience.addRecoveryGuide(msg, req.toolName);
					failures.push({
						toolName: req.toolName,
						error: classified,
						recoveryGuide: guide,
					});
				}
			}

			// Post-chunk deadline check — stop before starting the next chunk
			if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
				wasTimedOut = true;
				break;
			}
		}

		const totalRequested = requests.length;
		const succeeded = totalRequested - failures.length;
		const completeness = totalRequested > 0 ? Math.round((succeeded / totalRequested) * 100) : 100;

		const isDegraded = failures.length > 0;
		const degradationManifest: DegradationManifest | undefined = isDegraded
			? {
					missingSections: failures.map((f) => f.toolName),
					reasons: failures.map((f) => f.error.message),
					completeness,
				}
			: undefined;

		const minSuccessRatio = options?.minSuccessRatio;
		const successRatio = totalRequested > 0 ? succeeded / totalRequested : 1;
		const isOverallFailure = isDegraded && minSuccessRatio !== undefined && successRatio < minSuccessRatio;

		return {
			results,
			completeness,
			totalTimeMs: Date.now() - startMs,
			failures,
			...(wasCancelled ? { cancelled: true } : {}),
			...(wasTimedOut ? { timedOut: true } : {}),
			...(isDegraded ? { degraded: true, degradationManifest } : {}),
			...(isOverallFailure ? { overallFailure: true } : {}),
		};
	}

	/**
	 * Execute a task bundle with phased dependency ordering.
	 * Steps are grouped into phases based on their dependency graph.
	 * Results are stored in the session after each successful step so downstream
	 * agents receive prior-phase outputs via _context.availableResults.
	 * Pass an optional CancellationToken to stop between phases.
	 */
	async executeBundle(
		bundle: TaskBundle,
		tractArgs?: Record<string, unknown>,
		session?: Session,
		token?: CancellationToken,
		options?: ExecutionOptions,
	): Promise<BundleResponse> {
		const startMs = Date.now();
		const allResults = new Map<string, ToolResponse>();
		const phases: PhaseResult[] = [];
		const completedSteps = new Set<string>();
		const skippedSteps = new Set<string>();
		let wasCancelled = false;
		let wasTimedOut = false;

		const deadlineMs = options?.aggregateTimeoutMs ? startMs + options.aggregateTimeoutMs : undefined;

		// Resolve execution phases from the dependency graph
		const phaseGroups = this.resolvePhases(bundle.steps);

		for (let phaseIdx = 0; phaseIdx < phaseGroups.length; phaseIdx++) {
			// Check cancellation between phases
			if (token?.isCancelled) {
				wasCancelled = true;
				break;
			}

			// Check aggregate deadline between phases
			if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
				wasTimedOut = true;
				break;
			}
			const phaseSteps = phaseGroups[phaseIdx];
			const phaseStart = Date.now();
			const phaseFailures: FailureDetail[] = [];

			// Execute phase — parallel steps use scatter-gather
			const hasParallel = phaseSteps.some((s) => s.parallel);
			if (hasParallel && phaseSteps.length > 1) {
				// Filter steps whose conditions are not met
				const activeSteps = phaseSteps.filter((step) => {
					if (!step.condition) return true;
					const shouldRun = step.condition(allResults);
					if (!shouldRun) skippedSteps.add(step.toolName);
					return shouldRun;
				});

				// Inject session context once for the parallel batch (all start simultaneously)
				const injectedContext = session?.getInjectedContext();
				const requests: ToolRequest[] = activeSteps.map((step) => ({
					toolName: step.toolName,
					args: {
						...step.args,
						...tractArgs,
						...(injectedContext ? { _context: injectedContext } : {}),
					},
					detailLevel: step.detailLevel,
				}));

				const gathered = await this.executeParallel(requests, token);
				for (const [name, resp] of gathered.results) {
					allResults.set(name, resp);
					if (resp.success) {
						completedSteps.add(name);
						session?.storeResult(name, resp);
					}
				}
				phaseFailures.push(...gathered.failures);
			} else {
				// Sequential execution — recompute context per step so each step sees
				// results stored by the previous step
				for (const step of phaseSteps) {
					if (step.condition && !step.condition(allResults)) {
						skippedSteps.add(step.toolName);
						continue;
					}

					const freshContext = session?.getInjectedContext();
					const req: ToolRequest = {
						toolName: step.toolName,
						args: {
							...step.args,
							...tractArgs,
							...(freshContext ? { _context: freshContext } : {}),
						},
						detailLevel: step.detailLevel,
					};

					const resp = await this.execute(req);
					allResults.set(req.toolName, resp);
					if (resp.success) {
						completedSteps.add(req.toolName);
						session?.storeResult(req.toolName, resp);
					} else {
						const rawError = resp.error ?? {
							type: ErrorType.PERMANENT,
							message: "Unknown failure",
						};
						const classified = this.resilience.classifyErrorDetail(rawError, req.toolName);
						const guide = this.resilience.addRecoveryGuide(classified.message, req.toolName);
						phaseFailures.push({
							toolName: req.toolName,
							error: classified,
							recoveryGuide: guide,
						});
					}
				}
			}

			const phaseSucceeded =
				phaseSteps.length -
				phaseFailures.length -
				[...skippedSteps].filter((s) => phaseSteps.some((ps) => ps.toolName === s)).length;
			phases.push({
				phase: phaseIdx + 1,
				tools: phaseSteps.map((s) => s.toolName),
				completeness: phaseSteps.length > 0 ? Math.round((phaseSucceeded / phaseSteps.length) * 100) : 100,
				timeMs: Date.now() - phaseStart,
				failures: phaseFailures,
			});

			// Post-phase deadline check — stop before starting the next phase
			if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
				wasTimedOut = true;
				break;
			}
		}

		// Calculate overall completeness — skipped steps are excluded from required count
		const requiredSteps = bundle.steps.filter((s) => !s.optional && !skippedSteps.has(s.toolName));
		const requiredCompleted = requiredSteps.filter((s) => completedSteps.has(s.toolName)).length;
		const completeness = requiredSteps.length > 0 ? Math.round((requiredCompleted / requiredSteps.length) * 100) : 100;

		const overallSuccess = this.evaluateGatherStrategy(
			bundle.gatherStrategy,
			bundle.steps.length,
			completedSteps.size,
			requiredSteps.length,
			requiredCompleted,
		);

		// Collect all failures across phases for the degradation manifest
		const allFailures = phases.flatMap((p) => p.failures);
		const isDegraded = allFailures.length > 0;
		const degradationManifest: DegradationManifest | undefined = isDegraded
			? {
					missingSections: allFailures.map((f) => f.toolName),
					reasons: allFailures.map((f) => f.error.message),
					completeness,
				}
			: undefined;

		return {
			bundleName: bundle.name,
			results: allResults,
			completeness,
			totalTimeMs: Date.now() - startMs,
			phases,
			overallSuccess,
			...(wasCancelled ? { cancelled: true } : {}),
			...(wasTimedOut ? { timedOut: true } : {}),
			...(isDegraded ? { degraded: true, degradationManifest } : {}),
		};
	}

	/**
	 * Generate a deterministic idempotency key from tool name, args, and session.
	 */
	generateIdempotencyKey(toolName: string, args: Record<string, unknown>, sessionId?: string): string {
		const payload = JSON.stringify({
			tool: toolName,
			args: this.sortKeys(args),
			session: sessionId ?? "default",
		});
		return createHash("sha256").update(payload).digest("hex").slice(0, 16);
	}

	// ==========================================
	// Confirmation Gate (Arcade: Confirmation Request pattern)
	// ==========================================

	/**
	 * Check whether a tool requires confirmation before execution.
	 */
	requiresConfirmation(toolName: string): boolean {
		return CONFIRMATION_REQUIRED_TOOLS.has(toolName);
	}

	/**
	 * Execute a tool with confirmation gate. If the tool requires confirmation,
	 * returns a pending action response instead of executing immediately.
	 */
	async executeWithConfirmation(request: ToolRequest): Promise<ToolResponse> {
		if (!this.requiresConfirmation(request.toolName)) {
			return this.execute(request);
		}

		// Create a pending action
		const actionId = this.generateIdempotencyKey(request.toolName, request.args, `confirm-${Date.now()}`);

		const pending: PendingAction = {
			actionId,
			toolName: request.toolName,
			args: request.args,
			createdAt: new Date().toISOString(),
			description: `Execute ${request.toolName} with provided arguments`,
		};

		this.pendingActions.set(actionId, pending);

		return {
			success: true,
			summary: `Action requires confirmation. Review and call confirmAction('${actionId}') to proceed.`,
			confidence: 0,
			data: {
				requires_confirmation: true,
				pending_action: pending,
			},
			detailLevel: "standard",
			completeness: 0,
			metadata: {
				server: request.toolName.split(".")[0],
				persona: "kernel",
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Confirm and execute a pending action.
	 */
	async confirmAction(actionId: string): Promise<ToolResponse> {
		const pending = this.pendingActions.get(actionId);
		if (!pending) {
			return this.errorResponse(
				"kernel.confirm_action",
				`No pending action found with ID '${actionId}'`,
				ErrorType.PERMANENT,
			);
		}

		this.pendingActions.delete(actionId);

		return this.execute({
			toolName: pending.toolName,
			args: pending.args,
		});
	}

	/**
	 * Get a pending action by ID (for inspection before confirming).
	 */
	getPendingAction(actionId: string): PendingAction | undefined {
		return this.pendingActions.get(actionId);
	}

	/**
	 * Get all pending actions.
	 */
	get allPendingActions(): PendingAction[] {
		return Array.from(this.pendingActions.values());
	}

	/**
	 * Cancel a pending action.
	 */
	cancelAction(actionId: string): boolean {
		return this.pendingActions.delete(actionId);
	}

	// ==========================================
	// Internal helpers
	// ==========================================

	/**
	 * Resolve bundle steps into ordered execution phases based on dependencies.
	 */
	resolvePhases(steps: BundleStep[]): BundleStep[][] {
		const phases: BundleStep[][] = [];
		const resolved = new Set<string>();
		const remaining = [...steps];

		while (remaining.length > 0) {
			// Find steps whose dependencies are all resolved
			const ready = remaining.filter((step) => {
				if (!step.dependsOn || step.dependsOn.length === 0) return true;
				return step.dependsOn.every((dep) => resolved.has(dep));
			});

			if (ready.length === 0) {
				// Circular dependency or unresolvable — push remaining as final phase
				phases.push(remaining.splice(0));
				break;
			}

			phases.push(ready);
			for (const step of ready) {
				resolved.add(step.toolName);
				const idx = remaining.indexOf(step);
				if (idx >= 0) remaining.splice(idx, 1);
			}
		}

		return phases;
	}

	private evaluateGatherStrategy(
		strategy: "all" | "majority" | "any",
		totalSteps: number,
		completedSteps: number,
		requiredSteps: number,
		requiredCompleted: number,
	): boolean {
		switch (strategy) {
			case "all":
				return requiredCompleted === requiredSteps;
			case "majority":
				return completedSteps > totalSteps / 2;
			case "any":
				return completedSteps > 0;
		}
	}

	private cancelledResponse(toolName: string): ToolResponse {
		return this.errorResponse(toolName, "Operation cancelled", ErrorType.PERMANENT);
	}

	private errorResponse(toolName: string, message: string, errorType: ErrorType): ToolResponse {
		return {
			success: false,
			summary: message,
			confidence: 0,
			data: null,
			detailLevel: "standard",
			completeness: 0,
			metadata: {
				server: toolName.split(".")[0],
				persona: "unknown",
				executionTimeMs: 0,
				timestamp: new Date().toISOString(),
			},
			error: {
				type: errorType,
				message,
			},
		};
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
			promise
				.then((val) => {
					clearTimeout(timer);
					resolve(val);
				})
				.catch((err) => {
					clearTimeout(timer);
					reject(err);
				});
		});
	}

	private chunk<T>(arr: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < arr.length; i += size) {
			chunks.push(arr.slice(i, i + size));
		}
		return chunks;
	}

	private sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(obj).sort()) {
			sorted[key] = obj[key];
		}
		return sorted;
	}
}

// ==========================================
// Partial Success Result Helpers (Issue #148)
// ==========================================

/**
 * Convert a GatheredResponse into a PartialSuccessResult with flat
 * succeeded[] / failed[] / errors[] arrays so agents can iterate
 * results without working with Maps.
 */
export function toPartialSuccessResult(gathered: GatheredResponse): PartialSuccessResult {
	const succeeded: SucceededItem[] = [];
	for (const [toolName, response] of gathered.results) {
		if (response.success) {
			succeeded.push({ toolName, serverName: toolName.split(".")[0], response });
		}
	}

	const failed: FailedItem[] = gathered.failures.map((f) => ({
		toolName: f.toolName,
		serverName: f.toolName.split(".")[0],
		errorType: f.error.type,
		message: f.error.message,
		recoveryHint: f.recoveryGuide?.recoverySteps?.[0] ?? f.error.message,
	}));

	const total = succeeded.length + failed.length;
	const completeness = total > 0 ? Math.round((succeeded.length / total) * 100) : 100;

	return { succeeded, failed, errors: failed, total, completeness };
}

/**
 * Convert a BundleResponse into a PartialSuccessResult.
 * Successes come from bundle.results; failures are collected from all phase failures.
 */
export function toBundlePartialSuccessResult(bundle: BundleResponse): PartialSuccessResult {
	const succeeded: SucceededItem[] = [];
	for (const [toolName, response] of bundle.results) {
		if (response.success) {
			succeeded.push({ toolName, serverName: toolName.split(".")[0], response });
		}
	}

	const allPhaseFailures = bundle.phases.flatMap((p) => p.failures);
	const failed: FailedItem[] = allPhaseFailures.map((f) => ({
		toolName: f.toolName,
		serverName: f.toolName.split(".")[0],
		errorType: f.error.type,
		message: f.error.message,
		recoveryHint: f.recoveryGuide?.recoverySteps?.[0] ?? f.error.message,
	}));

	const total = succeeded.length + failed.length;
	const completeness = total > 0 ? Math.round((succeeded.length / total) * 100) : 100;

	return { succeeded, failed, errors: failed, total, completeness };
}
