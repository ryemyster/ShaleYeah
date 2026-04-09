/**
 * SHALE YEAH Agent OS - Kernel Type Definitions
 *
 * Core types for the Agent OS runtime layer based on Arcade.dev's
 * 52 agentic tool patterns. These types define the contracts for
 * tool classification, discovery, execution, context, resilience,
 * security, and composition.
 */

// ==========================================
// Tool Classification (Arcade: Query/Command/Discovery Tool patterns)
// ==========================================

/** Tool type determines execution semantics and agent behavior */
export type ToolType = "query" | "command" | "discovery";

/** Response detail granularity (Arcade: Progressive Detail pattern) */
export type DetailLevel = "summary" | "standard" | "full";

// ==========================================
// Error Classification (Arcade: Error Classification pattern)
// ==========================================

/** Error types guide agent recovery strategy */
export enum ErrorType {
	/** Transient failure — retry likely succeeds */
	RETRYABLE = "retryable",
	/** Permanent failure — request must change */
	PERMANENT = "permanent",
	/** Credentials expired or missing */
	AUTH_REQUIRED = "auth_required",
	/** Human intervention needed */
	USER_ACTION = "user_action",
}

// ==========================================
// Tool Descriptors (Arcade: Tool Registry + Capability Matching)
// ==========================================

/** Complete tool metadata for registry indexing and agent discovery */
export interface ToolDescriptor {
	/** Fully qualified name: server.tool_name */
	name: string;
	/** Server that owns this tool */
	server: string;
	/** Classification: query (read-only), command (side effects), discovery (meta) */
	type: ToolType;
	/** LLM-optimized description of what this tool does */
	description: string;
	/** Capability tags for fuzzy matching */
	capabilities: string[];
	/** JSON Schema for tool inputs */
	inputSchema: Record<string, unknown>;
	/** No side effects — safe to parallelize and cache */
	readOnly: boolean;
	/** Irreversible side effects — warn before execution */
	destructive: boolean;
	/** Requires explicit user confirmation before execution */
	requiresConfirmation: boolean;
	/** Supported detail levels for response shaping */
	detailLevels: DetailLevel[];
	/** Default parameter values when not specified */
	smartDefaults: Record<string, unknown>;
}

/** Minimal server info returned by discovery tools */
export interface ServerInfo {
	name: string;
	description: string;
	domain: string;
	persona: string;
	toolCount: number;
	capabilities: string[];
	status: "connected" | "disconnected" | "error";
}

/** Filter for server/tool discovery queries */
export interface ServerFilter {
	domain?: string;
	type?: ToolType;
	capability?: string;
}

// ==========================================
// Requests & Responses (Arcade: Token-Efficient Response + Progressive Detail)
// ==========================================

/** Standardized tool invocation request */
export interface ToolRequest {
	/** Fully qualified tool name or short name */
	toolName: string;
	/** Tool arguments */
	args: Record<string, unknown>;
	/** Session ID for context injection */
	sessionId?: string;
	/** Desired response detail level (default: standard) */
	detailLevel?: DetailLevel;
	/** Client-provided idempotency key for deduplication */
	idempotencyKey?: string;
}

/** Universal response envelope for all tool invocations */
export interface AgentOSResponse<T = unknown> {
	/** Whether the tool executed successfully */
	success: boolean;
	/** 1-2 sentence natural language summary for the agent */
	summary: string;
	/** Confidence score 0-100 */
	confidence: number;

	/** Response payload at the requested detail level */
	data: T;
	/** Actual detail level of this response */
	detailLevel: DetailLevel;

	/** Completeness percentage for graceful degradation (0-100) */
	completeness: number;
	/** What analyses/sources are missing (if degraded) */
	missing?: string[];
	/** Whether this is a partial/degraded result */
	degraded?: boolean;

	/** Execution metadata */
	metadata: ResponseMetadata;

	/** Error intelligence (present on failure) */
	error?: ErrorDetail;
}

export interface ResponseMetadata {
	server: string;
	persona: string;
	executionTimeMs: number;
	idempotencyKey?: string;
	timestamp: string;
	retryAttempts?: number;
	totalRetryDelayMs?: number;
	/** True when this response was served from the result cache. */
	fromCache?: boolean;
}

/** Classified error with recovery guidance (Arcade: Recovery Guide pattern) */
export interface ErrorDetail {
	type: ErrorType;
	message: string;
	reason?: string;
	recoverySteps?: string[];
	alternativeTools?: string[];
	retryAfterMs?: number;
}

/** Typed wrapper around AgentOSResponse */
export type ToolResponse = AgentOSResponse;

// ==========================================
// Circuit Breaker (Arcade: Circuit Breaker pattern)
// ==========================================

/** Circuit breaker state machine states */
export type CircuitState = "closed" | "open" | "half-open";

/** Per-server circuit breaker runtime state */
export interface CircuitBreakerState {
	state: CircuitState;
	/** Consecutive RETRYABLE failure count (resets on success) */
	failureCount: number;
	/** Timestamp of the last RETRYABLE failure */
	lastFailureMs: number;
	/** Number of half-open probe attempts made */
	halfOpenAttempts: number;
}

// ==========================================
// Recovery & Resilience (Arcade: Recovery Guide + Graceful Degradation)
// ==========================================

/** Structured recovery guidance for agent error handling */
export interface RecoveryGuide {
	errorType: ErrorType;
	message: string;
	reason: string;
	recoverySteps: string[];
	alternativeTools?: string[];
	retryAfterMs?: number;
}

/** Result of graceful degradation when some servers fail */
export interface DegradedResponse {
	partialResults: ToolResponse[];
	completeness: number;
	missingAnalyses: string[];
	degradationReason: string;
	suggestions: string[];
}

// ==========================================
// Security (Arcade: Permission Gate + Secret Injection + Audit Trail)
// ==========================================

// ==========================================
// Secret Injection (Arcade: Secret Injection pattern)
// ==========================================

/**
 * A secret value — either a static string or an async resolver (e.g. fetching from a vault).
 * Dynamic resolvers are called fresh on every resolve() call — no caching.
 */
export type SecretValue = string | (() => Promise<string>);

/**
 * Initial secrets to load into the SecretsStore at kernel startup.
 * Keys are secret names (e.g. "ANTHROPIC_API_KEY"); values are static strings or async resolvers.
 * If a key is not provided here, resolve() falls back to process.env[key].
 */
export type SecretsConfig = Record<string, SecretValue>;

/** Permission scopes for tool access control */
export type Permission = "read:analysis" | "write:reports" | "execute:decisions" | "admin:servers" | "admin:users";

/** User identity for session context (Arcade: Identity Anchor pattern) */
export interface UserIdentity {
	userId: string;
	role: "analyst" | "engineer" | "executive" | "admin";
	permissions: Permission[];
	organization?: string;
	displayName?: string;
}

/** User preferences injected into tool context */
export interface UserPreferences {
	investmentCriteria?: {
		minNPV: number;
		minIRR: number;
		maxPayback: number;
		maxRisk: number;
	};
	defaultBasin?: string;
	riskTolerance?: "conservative" | "moderate" | "aggressive";
	detailLevel?: DetailLevel;
}

/** Auth check result from permission gate */
export interface AuthResult {
	allowed: boolean;
	reason?: string;
	requiredRole?: string;
	requiredPermissions?: Permission[];
}

/** Audit log entry (Arcade: Audit Trail pattern) */
export interface AuditEntry {
	/** Tool name that was called */
	tool: string;
	/** What happened: request, response, error, or denied */
	action: "request" | "response" | "error" | "denied";
	/** Tool parameters (sensitive values redacted) */
	parameters: Record<string, unknown>;

	/** Who made the call */
	userId: string;
	sessionId: string;
	role: string;

	/** When it happened */
	timestamp: string;

	/** Outcome */
	success?: boolean;
	durationMs?: number;
	errorType?: string;
}

// ==========================================
// Context & Sessions (Arcade: Identity Anchor + Context Injection)
// ==========================================

/** Session info returned by discovery tools */
export interface SessionInfo {
	id: string;
	identity: UserIdentity;
	createdAt: string;
	lastActivity: string;
	/** IDs of analysis results stored this session */
	availableResults: string[];
}

/** Context automatically injected into tool calls */
export interface InjectedContext {
	userId: string;
	role: string;
	sessionId: string;
	timestamp: string;
	timezone: string;
	defaultBasin?: string;
	riskTolerance?: string;
	/** Keys of previously completed analyses available for reference */
	availableResults: string[];
}

// ==========================================
// Composition (Arcade: Task Bundle + Scatter-Gather)
// ==========================================

/** Pre-defined multi-tool workflow */
export interface TaskBundle {
	/** Bundle identifier */
	name: string;
	/** Human-readable description */
	description: string;
	/** Ordered steps (respecting parallel groups and dependencies) */
	steps: BundleStep[];
	/** How to determine overall success */
	gatherStrategy: "all" | "majority" | "any";
}

/** Single step within a task bundle */
export interface BundleStep {
	/** Tool to invoke */
	toolName: string;
	/** Static args or function that derives args from previous results */
	args: Record<string, unknown>;
	/** Can run alongside other parallel steps */
	parallel: boolean;
	/** Bundle succeeds even if this step fails */
	optional: boolean;
	/** Step names that must complete before this one starts */
	dependsOn?: string[];
	/** Override detail level for this step */
	detailLevel?: DetailLevel;
	/**
	 * Optional guard evaluated before execution.
	 * Receives the map of all prior completed results.
	 * Return false to skip this step (treated as neither success nor failure).
	 */
	condition?: (priorResults: Map<string, ToolResponse>) => boolean;
}

/** Manifest describing what is missing in a degraded response. */
export interface DegradationManifest {
	/** Tool names that failed or were not executed. */
	missingSections: string[];
	/** Human-readable failure reasons (one per missing section). */
	reasons: string[];
	/** Completeness percentage (0–100) based on successful results. */
	completeness: number;
}

/** A single successful item in a PartialSuccessResult. */
export interface SucceededItem {
	toolName: string;
	serverName: string;
	response: ToolResponse;
}

/** A single failed item in a PartialSuccessResult, with agent-actionable retry info. */
export interface FailedItem {
	toolName: string;
	serverName: string;
	errorType: ErrorType;
	message: string;
	/** First recovery step from the RecoveryGuide, or the error message as fallback. */
	recoveryHint: string;
}

/** Structured mixed-result schema for batch/scatter-gather operations.
 *  Enables agents to programmatically identify which items succeeded
 *  and which to retry, without iterating Maps. */
export interface PartialSuccessResult {
	succeeded: SucceededItem[];
	/** Items that failed — same reference as errors[]. */
	failed: FailedItem[];
	/** Alias for failed[] — structured error details per failed item. */
	errors: FailedItem[];
	/** Total items attempted (succeeded + failed). */
	total: number;
	/** Completeness percentage (0–100). */
	completeness: number;
}

/** Options for a single executeParallel or executeBundle call. */
export interface ExecutionOptions {
	/** Wall-clock deadline for the entire operation. When exceeded, returns
	 *  completed results so far with timedOut: true. */
	aggregateTimeoutMs?: number;
	/** Minimum ratio (0–1) of tools that must succeed for the result to be
	 *  considered non-failure. Defaults to 0 (any partial result is acceptable).
	 *  When the success ratio falls below this threshold, overallFailure is set. */
	minSuccessRatio?: number;
}

/** Result of scatter-gather parallel execution */
export interface GatheredResponse {
	results: Map<string, ToolResponse>;
	completeness: number;
	totalTimeMs: number;
	failures: FailureDetail[];
	/** True when the operation was stopped early by a CancellationToken. */
	cancelled?: boolean;
	/** True when the aggregate timeout fired before all requests completed. */
	timedOut?: boolean;
	/** True when some tools failed but the operation returned partial results. */
	degraded?: boolean;
	/** Present when degraded — describes what is missing and why. */
	degradationManifest?: DegradationManifest;
	/** True when failures exceeded the minSuccessRatio threshold. */
	overallFailure?: boolean;
}

/** Detail about a failed tool in a gathered response */
export interface FailureDetail {
	toolName: string;
	error: ErrorDetail;
	recoveryGuide?: RecoveryGuide;
}

/** Result of a composed bundle execution */
export interface BundleResponse {
	bundleName: string;
	results: Map<string, ToolResponse>;
	completeness: number;
	totalTimeMs: number;
	phases: PhaseResult[];
	overallSuccess: boolean;
	/** True when the operation was stopped early by a CancellationToken. */
	cancelled?: boolean;
	/** True when the aggregate timeout fired before all phases completed. */
	timedOut?: boolean;
	/** True when some steps failed but the bundle returned partial results. */
	degraded?: boolean;
	/** Present when degraded — describes what is missing and why. */
	degradationManifest?: DegradationManifest;
}

/** Result of a single execution phase within a bundle */
export interface PhaseResult {
	phase: number;
	tools: string[];
	completeness: number;
	timeMs: number;
	failures: FailureDetail[];
}

// ==========================================
// Cancellation (Arcade: Cancellation Token pattern)
// ==========================================

/**
 * Lightweight cancellation token.
 * Passed to execute / executeParallel / executeBundle to abort in-flight operations
 * between logical checkpoints (before execution, between chunks, between phases).
 * Operations that have already started are allowed to finish; the token stops the
 * next unit of work from starting.
 */
export class CancellationToken {
	private _cancelled = false;

	/** True once cancel() has been called. */
	get isCancelled(): boolean {
		return this._cancelled;
	}

	/** Signal cancellation. Idempotent — safe to call multiple times. */
	cancel(): void {
		this._cancelled = true;
	}

	/** Throw an error if this token has been cancelled. */
	throwIfCancelled(): void {
		if (this._cancelled) {
			throw new Error("Operation cancelled");
		}
	}
}

// ==========================================
// Kernel Configuration
// ==========================================

/** Runtime configuration for the kernel */
export interface KernelConfig {
	execution: {
		defaultDetailLevel: DetailLevel;
		maxParallel: number;
		toolTimeoutMs: number;
		idempotencyTtlMs: number;
	};
	security: {
		requireAuth: boolean;
		auditEnabled: boolean;
		auditPath: string;
	};
	/**
	 * Pre-loaded secrets for injection into tool handlers.
	 * Falls back to process.env for any key not listed here.
	 * Supports a .env file path for dev convenience (loaded at kernel init).
	 */
	secrets?: {
		/** Static or dynamic secret values to pre-load */
		values?: SecretsConfig;
		/** Path to a .env file to load for dev/local overrides (e.g. ".env.local") */
		envFile?: string;
	};
	resilience: {
		maxRetries: number;
		retryBackoffMs: number;
		gracefulDegradation: boolean;
		minCompleteness: number;
		circuitBreaker?: {
			/** Consecutive RETRYABLE failures before opening circuit (default: 3) */
			failureThreshold: number;
			/** Ms to wait in open state before half-open probe (default: 30000) */
			resetTimeoutMs: number;
			/** Max probe attempts in half-open before re-opening (default: 1) */
			halfOpenMaxAttempts: number;
		};
		healthCheck?: {
			/** Ms between probeAll() cycles (default: 60_000) */
			intervalMs: number;
			/** Ms before an individual probe is abandoned and counted as "down" (default: 5_000) */
			probeTimeoutMs: number;
		};
	};
	/** Session persistence configuration (optional) */
	sessionStorage?: {
		/** Directory for file-based session storage */
		path: string;
	};
}

/** Default kernel configuration */
export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
	execution: {
		defaultDetailLevel: "standard",
		maxParallel: 6,
		toolTimeoutMs: 30000,
		idempotencyTtlMs: 300000,
	},
	security: {
		requireAuth: false,
		auditEnabled: true,
		auditPath: "data/audit",
	},
	resilience: {
		maxRetries: 2,
		retryBackoffMs: 1000,
		gracefulDegradation: true,
		minCompleteness: 0.5,
		circuitBreaker: {
			failureThreshold: 3,
			resetTimeoutMs: 30000,
			halfOpenMaxAttempts: 1,
		},
	},
};
