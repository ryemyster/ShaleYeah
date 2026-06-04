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
});
export type AgentToolManifest = z.infer<typeof AgentToolManifestSchema>;

export const AgentManifestSchema = z.object({
	id: z.string().min(1),
	role: z.string().min(1),
	version: z.string().min(1),
	description: z.string().min(1),
	persona: AgentPersonaSchema,
	capabilities: z.array(z.string().min(1)).default([]),
	tools: z.array(AgentToolManifestSchema).default([]),
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
}).refine(
	(m) => m.tools.every((t) => t.requiredScopes.every((s) => m.requiredScopes.includes(s))),
	{ message: "manifest requiredScopes must be a superset of all tool requiredScopes" },
);
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
	vectorStoreEnabled: z.boolean().default(false),
	vectorStoreProvider: z.string().min(1).optional(),
	retentionDays: z.number().int().positive().default(30),
	promotion: z.object({
		requireHumanReview: z.boolean().default(true),
		allowSharedMemory: z.boolean().default(false),
	}),
});
export type MemoryPolicy = z.infer<typeof MemoryPolicySchema>;

export const AgentRuntimeConfigSchema = z.object({
	autonomy: AgentAutonomyLevelSchema.default("assistive"),
	modelRouting: z.record(ModelRequirementSchema, ModelBindingSchema),
	hitl: HitlPolicySchema,
	evals: EvalPolicySchema,
	memory: MemoryPolicySchema,
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

export interface AgentExecutionRequest {
	toolName: string;
	args: Record<string, unknown>;
	runId?: string;
	approval?: HumanApproval;
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
