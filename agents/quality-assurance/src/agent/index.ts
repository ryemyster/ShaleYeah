import type { AgentManifest, AgentRuntimeConfig } from "@shaleyeah/sdk";
import { LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callQAServerTool } from "./qa-server-client.js";

export { callQAServerTool };

export const qaAssuranceManifest: AgentManifest = {
	id: "quality-assurance",
	role: "qa-analyst",
	version: "0.1.0",
	description:
		"Testius Validatus — standalone quality assurance agent migrated from the qa-server MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Testius Validatus",
		role: "Master Quality Engineer",
		expertise: [
			"Quality assurance and validation",
			"Testing methodology and automation",
			"Performance monitoring and analysis",
			"Compliance verification and auditing",
			"Continuous improvement processes",
		],
	},
	capabilities: [
		"qa-testing",
		"quality-reporting",
		"compliance-verification",
		"performance-monitoring",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "quality-assurance.run_quality_tests",
			description:
				"Execute comprehensive quality assurance tests across functional, performance, integration, and compliance dimensions.",
			type: "query",
			capabilities: ["qa-testing", "compliance-verification"],
			inputSchema: {
				type: "object",
				properties: {
					testSuite: {
						type: "string",
						enum: ["functional", "performance", "integration", "compliance", "all"],
						default: "all",
						description: "Test suite to run",
					},
					targets: {
						type: "array",
						items: { type: "string" },
						description: "Components or modules to test",
					},
					criteria: {
						type: "object",
						properties: {
							accuracy: { type: "number", minimum: 0, maximum: 1, default: 0.95 },
							performance: { type: "string", default: "standard" },
							compliance: { type: "array", items: { type: "string" }, default: [] },
						},
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["targets"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:qa"],
			modelRequirement: "standard-analysis",
			evalProfile: "qa-run-tests",
			mcpServer: "qa-server",
		},
		{
			name: "quality-assurance.generate_quality_report",
			description:
				"Generate a comprehensive quality assurance report covering accuracy, performance, and reliability metrics.",
			type: "query",
			capabilities: ["quality-reporting", "compliance-verification"],
			inputSchema: {
				type: "object",
				properties: {
					reportType: {
						type: "string",
						enum: ["summary", "detailed", "executive", "compliance"],
						default: "summary",
						description: "Report format",
					},
					period: { type: "string", default: "current", description: "Reporting period" },
					metrics: {
						type: "array",
						items: { type: "string" },
						default: ["accuracy", "performance", "reliability"],
						description: "Metrics to include",
					},
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: [],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:qa"],
			modelRequirement: "deterministic",
			evalProfile: "qa-generate-report",
			mcpServer: "qa-server",
		},
	],
	requiredScopes: ["read:qa"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for QA synthesis — test validation and compliance assessment call the model.",
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
		namespace: "quality-assurance",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "qa-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const qaAssuranceConfig: AgentRuntimeConfig = {
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
		profile: "qa-standard",
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
		namespace: "quality-assurance",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	// Tier 1 tool server — operator configures the actual URL at deployment time.
	mcpServers: {
		"qa-server": {
			url: "http://localhost:3004",
			transport: "http",
			authType: "none",
		},
	},
	dataConnectors: {},
};

// Each handler resolves the qa-server URL from the runtime config and delegates via MCP over HTTP.
// The server name "qa-server" matches AgentToolManifest.mcpServer and AgentRuntimeConfig.mcpServers key.
function qaServerUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.["qa-server"]?.url ?? "http://localhost:3004";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"quality-assurance.run_quality_tests": ({ args, config }) =>
		callQAServerTool(qaServerUrl(config), "run_quality_tests", args),

	"quality-assurance.generate_quality_report": ({ args, config }) =>
		callQAServerTool(qaServerUrl(config), "generate_quality_report", args),
};

export function createQAAssuranceRuntime(config: AgentRuntimeConfig = qaAssuranceConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: qaAssuranceManifest,
		config,
		handlers,
	});
}

export function createQAAssuranceEndpoint(config: AgentRuntimeConfig = qaAssuranceConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createQAAssuranceRuntime(config));
}
