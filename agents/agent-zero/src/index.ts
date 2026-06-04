import type { AgentManifest, AgentRuntimeConfig } from "@shaleyeah/sdk";
import { LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";

export const agentZeroManifest: AgentManifest = {
	id: "agent-zero",
	role: "reference-specialist",
	version: "0.1.0",
	description: "Minimal standalone agent used to prove the AgentRuntime contract before migrating Geowiz.",
	persona: {
		name: "Agent Zero",
		role: "Reference Junior Specialist",
		expertise: ["contract validation", "progressive discovery", "HITL challenges", "eval policy"],
	},
	capabilities: ["contract-validation", "model-routing", "hitl", "evals"],
	tools: [
		{
			name: "agent-zero.inspect",
			description: "Read-only inspection tool that proves model-agnostic routing and eval execution.",
			type: "query",
			capabilities: ["inspect", "summarize"],
			inputSchema: {
				type: "object",
				properties: {
					subject: { type: "string" },
				},
				required: ["subject"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:analysis"],
			modelRequirement: "small-fast",
			evalProfile: "agent-zero-standard",
		},
		{
			name: "agent-zero.promote_memory",
			description: "Approval-gated sample command that proves HITL before memory promotion.",
			type: "command",
			capabilities: ["memory-promotion"],
			inputSchema: {
				type: "object",
				properties: {
					lesson: { type: "string" },
				},
				required: ["lesson"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: true,
			requiredScopes: ["write:memory"],
			modelRequirement: "deterministic",
			evalProfile: "agent-zero-memory",
		},
	],
	requiredScopes: ["read:analysis", "write:memory"],
	providerRequirements: [
		{
			type: "llm",
			required: false,
			description: "Organization-selected model provider for tools that need language reasoning.",
		},
		{
			type: "memory-store",
			required: false,
			description: "Organization-selected reviewed-memory store.",
		},
	],
	compatibility: {
		agentRuntime: "0.1",
		remoteEndpoint: "0.1",
		mcp: "2025-06",
	},
	health: {
		readinessChecks: ["manifest", "runtime-config", "tool-handlers", "model-routing"],
	},
	memory: {
		namespace: "agent-zero",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "agent-zero-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const agentZeroConfig: AgentRuntimeConfig = {
	autonomy: "reviewed",
	modelRouting: {
		"small-fast": {
			provider: "organization-small-model",
			model: "configured-by-operator",
		},
		"standard-analysis": {
			provider: "organization-standard-model",
			model: "configured-by-operator",
		},
		"deep-reasoning": {
			provider: "organization-deep-model",
			model: "configured-by-operator",
		},
		"local-private": {
			provider: "organization-local-model",
			model: "configured-by-operator",
		},
		deterministic: {
			provider: "rule-based",
			model: "no-model",
		},
	},
	hitl: {
		approvalMode: "when-sensitive",
		requireForDestructive: true,
		requireForMemoryPromotion: true,
	},
	evals: {
		enabled: true,
		profile: "standard",
		checks: {
			schema: "blocking",
			domainCompleteness: "advisory",
			confidenceMinimum: 0.7,
			requireSources: false,
			redactSecrets: "blocking",
			memoryPromotion: "reviewed-only",
		},
	},
	memory: {
		enabled: true,
		namespace: "agent-zero",
		vectorStore: { enabled: false },
		retentionDays: 30,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	mcpServers: {},
	dataConnectors: {},
};

const handlers: Record<string, StandaloneToolHandler> = {
	"agent-zero.inspect": async ({ args, model }) => ({
		subject: args.subject,
		receivedArgs: args,
		modelProviderAlias: model.provider,
		modelAlias: model.model,
		summary: "Agent Zero inspected the subject using organization-configured model routing.",
	}),
	"agent-zero.promote_memory": async ({ args }) => ({
		candidateMemory: args.lesson,
		status: "proposed",
		reviewRequired: true,
	}),
};

export function createAgentZeroRuntime(config: AgentRuntimeConfig = agentZeroConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: agentZeroManifest,
		config,
		handlers,
	});
}

export function createAgentZeroEndpoint(config: AgentRuntimeConfig = agentZeroConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createAgentZeroRuntime(config));
}
