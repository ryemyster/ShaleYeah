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
}

/** Result of scatter-gather parallel execution */
export interface GatheredResponse {
	results: Map<string, ToolResponse>;
	completeness: number;
	totalTimeMs: number;
	failures: FailureDetail[];
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
	resilience: {
		maxRetries: number;
		retryBackoffMs: number;
		gracefulDegradation: boolean;
		minCompleteness: number;
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
	},
};
