import { z } from "zod";

export const AgentAutonomyLevelSchema = z.enum(["assistive", "reviewed", "autonomous"]);
export type AgentAutonomyLevel = z.infer<typeof AgentAutonomyLevelSchema>;

export const ToolTypeSchema = z.enum(["query", "command", "discovery"]);
export type StandaloneToolType = z.infer<typeof ToolTypeSchema>;

export const ModelRequirementSchema = z.enum([
	"small-fast",
	"standard-analysis",
	"deep-reasoning",
	"local-private",
	"deterministic",
]);
export type ModelRequirement = z.infer<typeof ModelRequirementSchema>;

export const ApprovalModeSchema = z.enum(["never", "when-sensitive", "always"]);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

export const AgentPersonaSchema = z.object({
	name: z.string().min(1),
	role: z.string().min(1),
	expertise: z.array(z.string().min(1)).default([]),
});
export type AgentPersona = z.infer<typeof AgentPersonaSchema>;

export const AgentProviderRequirementSchema = z.object({
	type: z.enum(["llm", "slm", "embedding", "vector-store", "memory-store", "data-connector"]),
	required: z.boolean().default(false),
	description: z.string().min(1),
});
export type AgentProviderRequirement = z.infer<typeof AgentProviderRequirementSchema>;

export const AgentToolManifestSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1),
	type: ToolTypeSchema,
	capabilities: z.array(z.string().min(1)).default([]),
	inputSchema: z.record(z.string(), z.unknown()).default({}),
	outputSchema: z.record(z.string(), z.unknown()).optional(),
	readOnly: z.boolean().default(false),
	destructive: z.boolean().default(false),
	requiresHumanApproval: z.boolean().default(false),
	requiredScopes: z.array(z.string().min(1)).default([]),
	modelRequirement: ModelRequirementSchema,
	evalProfile: z.string().min(1).optional(),
	// Which mcpServers key in AgentRuntimeConfig this tool delegates to.
	// Undefined means the tool is handled locally by the agent (e.g. memory ops).
	mcpServer: z.string().min(1).optional(),
	// Maximum milliseconds to wait for the tool call to complete.
	// Implements Arcade pattern #28: Timeout Boundary.
	timeoutMs: z.number().int().positive().optional(),
	// Groups of parameter names where exactly one must be provided (XOR constraint).
	// Example: [["formationName", "formationId"]] means these two cannot coexist.
	// Implements Arcade pattern #9: Mutual Exclusivity.
	mutuallyExclusive: z.array(z.array(z.string().min(1))).optional(),
	// Name of an alternative tool to invoke when this tool permanently fails (retryable: false).
	// The fallback receives the same args and its result is tagged usedFallback: true.
	// Implements Arcade pattern #44: Fallback Tool.
	fallbackTo: z.string().min(1).optional(),
	// Tool names whose output this tool consumes — used to guide LLM call ordering.
	// Implements Arcade pattern #14: Dependency Hint.
	dependsOn: z.array(z.string().min(1)).optional(),
	// Capability slugs that this tool's output enables downstream.
	// Implements Arcade pattern #14: Dependency Hint.
	provides: z.array(z.string().min(1)).optional(),
	// Expected wall-clock latency percentiles for this tool call.
	// p50 = typical case, p95 = near-worst-case. Units: milliseconds.
	// Implements Arcade pattern #10: Performance Hint.
	estimatedLatencyMs: z
		.object({
			p50: z.number().int().positive(),
			p95: z.number().int().positive(),
		})
		.optional(),
	// Rough complexity bucket — guides the reasoning loop to prefer cheap tools when possible.
	// fast <1s | moderate 1-10s | slow >10s
	// Implements Arcade pattern #10: Performance Hint.
	complexity: z.enum(["fast", "moderate", "slow"]).optional(),
});
export type AgentToolManifest = z.infer<typeof AgentToolManifestSchema>;

// Ordered sequence of tool calls for a known workflow.
// Implements Arcade pattern #21: Tool Chain.
export const ToolChainSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(1),
	// Ordered list of full tool names (e.g. "geologist.analyze_formation").
	steps: z.array(z.string().min(1)).min(2),
	// Natural language hint for when the LLM should use this chain.
	trigger: z.string().min(1).optional(),
});
export type ToolChain = z.infer<typeof ToolChainSchema>;

export const AgentManifestSchema = z
	.object({
		id: z.string().min(1),
		role: z.string().min(1),
		version: z.string().min(1),
		description: z.string().min(1),
		persona: AgentPersonaSchema,
		capabilities: z.array(z.string().min(1)).default([]),
		tools: z.array(AgentToolManifestSchema).default([]),
		// Pre-defined step sequences injected into the system prompt as advisory workflows.
		// Implements Arcade pattern #21: Tool Chain.
		toolChains: z.array(ToolChainSchema).optional(),
		requiredScopes: z.array(z.string().min(1)).default([]),
		providerRequirements: z.array(AgentProviderRequirementSchema).default([]),
		compatibility: z.object({
			agentRuntime: z.string().min(1),
			remoteEndpoint: z.string().min(1),
			mcp: z.string().regex(/^\d{4}-\d{2}$/, "mcp version must be YYYY-MM format"),
		}),
		health: z.object({
			readinessChecks: z.array(z.string().min(1)).default([]),
		}),
		memory: z.object({
			namespace: z.string().min(1),
			reviewRequired: z.boolean().default(true),
			sharedMemoryOptIn: z.boolean().default(false),
		}),
		evals: z.object({
			defaultProfile: z.string().min(1),
			requiredChecks: z.array(z.string().min(1)).default([]),
		}),
		autonomy: z.object({
			defaultLevel: AgentAutonomyLevelSchema,
			allowedLevels: z.array(AgentAutonomyLevelSchema).min(1),
		}),
	})
	.refine((m) => m.tools.every((t) => t.requiredScopes.every((s) => m.requiredScopes.includes(s))), {
		message: "manifest requiredScopes must be a superset of all tool requiredScopes",
	});
export type AgentManifest = z.infer<typeof AgentManifestSchema>;

export const ModelBindingSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	maxTokens: z.number().int().positive().optional(),
});
export type ModelBinding = z.infer<typeof ModelBindingSchema>;

export const EvalPolicySchema = z.object({
	enabled: z.boolean().default(true),
	profile: z.string().min(1),
	checks: z.object({
		schema: z.enum(["off", "advisory", "blocking"]).default("blocking"),
		domainCompleteness: z.enum(["off", "advisory", "blocking"]).default("advisory"),
		confidenceMinimum: z.number().min(0).max(1).default(0.7),
		requireSources: z.boolean().default(false),
		redactSecrets: z.enum(["off", "advisory", "blocking"]).default("blocking"),
		memoryPromotion: z.enum(["disabled", "reviewed-only", "autonomous"]).default("reviewed-only"),
	}),
});
export type EvalPolicy = z.infer<typeof EvalPolicySchema>;

export const HitlPolicySchema = z.object({
	approvalMode: ApprovalModeSchema.default("when-sensitive"),
	requireForDestructive: z.boolean().default(true),
	requireForMemoryPromotion: z.boolean().default(true),
});
export type HitlPolicy = z.infer<typeof HitlPolicySchema>;

export const MemoryPolicySchema = z.object({
	enabled: z.boolean().default(true),
	namespace: z.string().min(1),
	// Agent working memory — prior analysis context, cross-run learning.
	// Separate from the MCP server's domain knowledge vector store.
	vectorStore: z
		.object({
			enabled: z.boolean().default(false),
			provider: z.string().min(1).optional(), // e.g. "pgvector", "pinecone", "weaviate"
			url: z.string().optional(),
			embeddingModel: z.string().min(1).optional(),
		})
		.default({ enabled: false }),
	retentionDays: z.number().int().positive().default(30),
	promotion: z.object({
		requireHumanReview: z.boolean().default(true),
		allowSharedMemory: z.boolean().default(false),
	}),
});
export type MemoryPolicy = z.infer<typeof MemoryPolicySchema>;

// MCP server connection — Tier 1 tool server this agent calls into.
export const McpServerConnectionSchema = z.object({
	url: z.string().url(),
	transport: z.enum(["stdio", "sse", "http"]).default("http"),
	// Auth type only — credentials are injected at runtime, never stored in config.
	authType: z.enum(["none", "bearer", "oauth2"]).default("none"),
});
export type McpServerConnection = z.infer<typeof McpServerConnectionSchema>;

// Data connector — BYO integration (FTP, REST API, database, etc.)
export const DataConnectorSchema = z.object({
	type: z.string().min(1), // "ftp", "rest-api", "postgres", "s3", etc.
	url: z.string().optional(),
	description: z.string().min(1),
	// Credentials injected at runtime via execution context, never stored here.
});
export type DataConnector = z.infer<typeof DataConnectorSchema>;

export const AgentRuntimeConfigSchema = z.object({
	autonomy: AgentAutonomyLevelSchema.default("assistive"),
	modelRouting: z.record(ModelRequirementSchema, ModelBindingSchema),
	hitl: HitlPolicySchema,
	evals: EvalPolicySchema,
	memory: MemoryPolicySchema,
	// Tier 1 tool servers this agent delegates to. Keys match AgentToolManifest.mcpServer.
	mcpServers: z.record(z.string(), McpServerConnectionSchema).default({}),
	// BYO data integrations available to this agent's tool handlers.
	dataConnectors: z.record(z.string(), DataConnectorSchema).default({}),
});
export type AgentRuntimeConfig = z.infer<typeof AgentRuntimeConfigSchema>;

export type DiscoveryLevel = "summary" | "tools" | "schema";

export interface AgentHealth {
	status: "ready" | "degraded" | "not_ready";
	agentId: string;
	checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message?: string }>;
}

export interface HumanApproval {
	approved: boolean;
	reviewerId: string;
	reason?: string;
}

export interface HumanApprovalChallenge {
	type: "human_approval_required";
	challengeId: string;
	agentId: string;
	toolName: string;
	reason: string;
	requiredScopes: string[];
}

export interface EvalResult {
	check: string;
	status: "pass" | "warn" | "fail";
	message: string;
	blocking: boolean;
}

/**
 * Per-session user identity — established at session start and propagated through
 * every tool call, audit log entry, HITL challenge, and ContextStore namespace.
 * Implements Arcade pattern #35: Identity Anchor.
 */
export interface SessionIdentity {
	/** Stable user identifier (e.g. Supabase auth UID). */
	userId: string;
	/** Logical organisation the user belongs to. */
	orgId?: string;
	/** Opaque session token — generated by the MCP server transport layer. */
	sessionId: string;
	/** Role claims for scope-based authorization. */
	roles?: string[];
}

export interface AgentExecutionRequest {
	toolName: string;
	args: Record<string, unknown>;
	runId?: string;
	approval?: HumanApproval;
	/**
	 * Scopes granted by the caller for this execution context.
	 * When present, runtime enforces tool.requiredScopes ⊆ grantedScopes.
	 * When absent, scope enforcement is skipped (backward-compatible with callers
	 * that predate scope-aware routing). Implements Arcade #46: Permission Gate.
	 */
	grantedScopes?: string[];
	/** Caller identity — when present, propagated to audit log and ContextStore namespace. */
	identity?: SessionIdentity;
}

export interface AgentExecutionMetadata {
	agentId: string;
	toolName: string;
	modelRequirement: ModelRequirement;
	modelBinding: ModelBinding;
	autonomy: AgentAutonomyLevel;
	timestamp: string;
}

export type AgentExecutionResult =
	| {
			status: "completed";
			data: unknown;
			evals: EvalResult[];
			metadata: AgentExecutionMetadata;
	  }
	| {
			status: "approval_required";
			challenge: HumanApprovalChallenge;
			metadata: Omit<AgentExecutionMetadata, "modelBinding">;
	  }
	| {
			status: "failed";
			error: string;
			// true when the failure is transient and the caller may retry the same operation.
			// Implements Arcade pattern #40: Error Classification.
			retryable?: boolean;
			evals: EvalResult[];
			metadata: Omit<AgentExecutionMetadata, "modelBinding"> & { modelBinding?: ModelBinding };
	  };

export interface AgentRuntime {
	initialize(): Promise<void>;
	health(): Promise<AgentHealth>;
	getManifest(): AgentManifest;
	discover(level: "summary"): AgentDiscoverySummary;
	discover(level: "tools"): Array<Omit<AgentToolManifest, "inputSchema" | "outputSchema">>;
	discover(level: "schema", toolName: string): AgentToolManifest | null;
	execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
	shutdown(): Promise<void>;
}

export type AgentDiscoverySummary = Pick<AgentManifest, "id" | "role" | "version" | "description" | "capabilities">;
export type AgentToolSummary = Omit<AgentToolManifest, "inputSchema" | "outputSchema">;

/**
 * One record written per tool invocation — timestamp, outcome, duration.
 * Sensitive args are already redacted before this is populated.
 * Implements Arcade pattern #48: Audit Trail.
 */
export interface AuditLogEntry {
	timestamp: string;
	agentId: string;
	toolName: string;
	args: Record<string, unknown>;
	status: AgentExecutionResult["status"];
	durationMs: number;
	error?: string;
	retryable?: boolean;
	/** Populated when an identity was supplied on the originating AgentExecutionRequest. */
	userId?: string;
}

/**
 * Operator-supplied sink for audit entries.
 * Default behaviour (when omitted from LocalAgentRuntimeOptions) is to write
 * JSON lines to stderr. Swap in a Supabase / CloudWatch writer at the deployment layer.
 */
export type AuditLogger = (entry: AuditLogEntry) => void;
