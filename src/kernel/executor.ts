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
import { ResilienceMiddleware } from "./middleware/resilience.js";
import type {
	BundleResponse,
	BundleStep,
	FailureDetail,
	GatheredResponse,
	PhaseResult,
	TaskBundle,
	ToolRequest,
	ToolResponse,
} from "./types.js";
import { ErrorType } from "./types.js";

// ==========================================
// Tool executor function type
// ==========================================

/**
 * Function that actually invokes a tool on an MCP server.
 * The kernel injects this — the executor doesn't know about MCP transport.
 */
export type ToolExecutorFn = (serverName: string, args: Record<string, unknown>) => Promise<ToolResponse>;

// ==========================================
// Bundle Definitions
// ==========================================

/**
 * Quick Screen bundle — 4 core servers in parallel.
 * Fast first-pass assessment for go/no-go screening.
 */
export const QUICK_SCREEN_BUNDLE: TaskBundle = {
	name: "quick_screen",
	description: "Fast parallel screening: geology, economics, engineering, and risk in one pass.",
	steps: [
		{
			toolName: "geowiz.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "econobot.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "curve-smith.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "risk-analysis.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
	],
	gatherStrategy: "all",
};

/**
 * Full Due Diligence bundle — all 14 servers in 4 phases.
 * Complete investment analysis with dependency ordering.
 */
export const FULL_DUE_DILIGENCE_BUNDLE: TaskBundle = {
	name: "full_due_diligence",
	description: "Comprehensive investment analysis across all 14 domain experts with phased execution.",
	steps: [
		// Phase 1: Core analysis (parallel)
		{
			toolName: "geowiz.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "econobot.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "curve-smith.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "market.analyze",
			args: {},
			parallel: true,
			optional: true,
			detailLevel: "standard",
		},
		{
			toolName: "research.analyze",
			args: {},
			parallel: true,
			optional: true,
			detailLevel: "standard",
		},
		// Phase 2: Extended analysis (parallel, depends on phase 1)
		{
			toolName: "risk-analysis.analyze",
			args: {},
			parallel: true,
			optional: false,
			dependsOn: ["geowiz.analyze", "econobot.analyze", "curve-smith.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "legal.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "title.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "drilling.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "infrastructure.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "development.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze", "econobot.analyze"],
			detailLevel: "standard",
		},
		// Phase 3: QA (depends on phase 2)
		{
			toolName: "test.analyze",
			args: {},
			parallel: false,
			optional: true,
			dependsOn: ["risk-analysis.analyze"],
			detailLevel: "standard",
		},
		// Phase 4: Reporting & decision (sequential, depends on all)
		{
			toolName: "reporter.analyze",
			args: {},
			parallel: false,
			optional: false,
			dependsOn: ["test.analyze"],
			detailLevel: "full",
		},
		{
			toolName: "decision.analyze",
			args: {},
			parallel: false,
			optional: false,
			dependsOn: ["reporter.analyze"],
			detailLevel: "full",
		},
	],
	gatherStrategy: "majority",
};

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

export class Executor {
	private executorFn: ToolExecutorFn | null = null;
	private maxParallel: number;
	private toolTimeoutMs: number;
	private maxRetries: number;
	private retryBackoffMs: number;
	public readonly resilience: ResilienceMiddleware;
	private pendingActions: Map<string, PendingAction> = new Map();

	constructor(options?: {
		maxParallel?: number;
		toolTimeoutMs?: number;
		maxRetries?: number;
		retryBackoffMs?: number;
	}) {
		this.maxParallel = options?.maxParallel ?? 6;
		this.toolTimeoutMs = options?.toolTimeoutMs ?? 30000;
		this.maxRetries = options?.maxRetries ?? 0;
		this.retryBackoffMs = options?.retryBackoffMs ?? 1000;
		this.resilience = new ResilienceMiddleware();
	}

	/**
	 * Set the underlying tool execution function.
	 * The kernel provides this after MCP connections are established.
	 */
	setExecutorFn(fn: ToolExecutorFn): void {
		this.executorFn = fn;
	}

	/**
	 * Execute a single tool request with automatic retry for retryable errors.
	 * Uses exponential backoff with jitter based on resilience delay recommendations.
	 */
	async execute(request: ToolRequest): Promise<ToolResponse> {
		if (!this.executorFn) {
			return this.errorResponse(
				request.toolName,
				"Executor not connected — call setExecutorFn() first",
				ErrorType.PERMANENT,
			);
		}

		const serverName = request.toolName.split(".")[0];
		const overallStartMs = Date.now();
		let lastResponse: ToolResponse | null = null;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			const startMs = Date.now();

			try {
				const result = await this.withTimeout(this.executorFn(serverName, request.args), this.toolTimeoutMs);
				if (result.success) {
					if (attempt > 0) {
						result.metadata = {
							...result.metadata,
							retryAttempts: attempt,
							totalRetryDelayMs: startMs - overallStartMs,
						};
					}
					return result;
				}
				// Non-success response — treat as error for retry classification
				lastResponse = result;
				const errorMsg = result.error?.message ?? result.summary ?? "Unknown failure";
				const errorType = this.resilience.classifyError(errorMsg, request.toolName);

				if (errorType !== ErrorType.RETRYABLE || attempt >= this.maxRetries) {
					break;
				}

				await this.backoffDelay(errorMsg, attempt);
			} catch (err) {
				const elapsed = Date.now() - startMs;
				const isTimeout = err instanceof Error && err.message === "TIMEOUT";
				const errorMsg = isTimeout ? `Tool timed out after ${elapsed}ms` : `Tool execution failed: ${String(err)}`;
				const errorType = isTimeout ? ErrorType.RETRYABLE : this.resilience.classifyError(errorMsg);

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
	 */
	async executeParallel(requests: ToolRequest[]): Promise<GatheredResponse> {
		const startMs = Date.now();
		const results = new Map<string, ToolResponse>();
		const failures: FailureDetail[] = [];

		// Batch into chunks of maxParallel
		const chunks = this.chunk(requests, this.maxParallel);

		for (const chunk of chunks) {
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
		}

		const totalRequested = requests.length;
		const succeeded = totalRequested - failures.length;
		const completeness = totalRequested > 0 ? Math.round((succeeded / totalRequested) * 100) : 100;

		return {
			results,
			completeness,
			totalTimeMs: Date.now() - startMs,
			failures,
		};
	}

	/**
	 * Execute a task bundle with phased dependency ordering.
	 * Steps are grouped into phases based on their dependency graph.
	 */
	async executeBundle(bundle: TaskBundle, tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		const startMs = Date.now();
		const allResults = new Map<string, ToolResponse>();
		const phases: PhaseResult[] = [];
		const completedSteps = new Set<string>();

		// Resolve execution phases from the dependency graph
		const phaseGroups = this.resolvePhases(bundle.steps);

		for (let phaseIdx = 0; phaseIdx < phaseGroups.length; phaseIdx++) {
			const phaseSteps = phaseGroups[phaseIdx];
			const phaseStart = Date.now();
			const phaseFailures: FailureDetail[] = [];

			// Build requests for this phase, merging tract args
			const requests: ToolRequest[] = phaseSteps.map((step) => ({
				toolName: step.toolName,
				args: { ...step.args, ...tractArgs },
				detailLevel: step.detailLevel,
			}));

			// Execute phase — parallel steps use scatter-gather
			const hasParallel = phaseSteps.some((s) => s.parallel);
			if (hasParallel && requests.length > 1) {
				const gathered = await this.executeParallel(requests);
				for (const [name, resp] of gathered.results) {
					allResults.set(name, resp);
					if (resp.success) completedSteps.add(name);
				}
				phaseFailures.push(...gathered.failures);
			} else {
				// Sequential execution
				for (const req of requests) {
					const resp = await this.execute(req);
					allResults.set(req.toolName, resp);
					if (resp.success) {
						completedSteps.add(req.toolName);
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

			const phaseSucceeded = phaseSteps.length - phaseFailures.length;
			phases.push({
				phase: phaseIdx + 1,
				tools: phaseSteps.map((s) => s.toolName),
				completeness: phaseSteps.length > 0 ? Math.round((phaseSucceeded / phaseSteps.length) * 100) : 100,
				timeMs: Date.now() - phaseStart,
				failures: phaseFailures,
			});
		}

		// Calculate overall completeness
		const requiredSteps = bundle.steps.filter((s) => !s.optional);
		const requiredCompleted = requiredSteps.filter((s) => completedSteps.has(s.toolName)).length;
		const completeness = requiredSteps.length > 0 ? Math.round((requiredCompleted / requiredSteps.length) * 100) : 100;

		const overallSuccess = this.evaluateGatherStrategy(
			bundle.gatherStrategy,
			bundle.steps.length,
			completedSteps.size,
			requiredSteps.length,
			requiredCompleted,
		);

		return {
			bundleName: bundle.name,
			results: allResults,
			completeness,
			totalTimeMs: Date.now() - startMs,
			phases,
			overallSuccess,
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
