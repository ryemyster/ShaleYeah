import type { AgentManifest, AgentRuntimeConfig } from "@shaleyeah/sdk";
import { LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
import { callGeowizTool } from "./geowiz-client.js";

export { callGeowizTool };

export const geologistManifest: AgentManifest = {
	id: "geologist",
	role: "geological-analyst",
	version: "0.1.0",
	description:
		"Marcus Aurelius Geologicus — standalone geologist agent migrated from the geowiz MCP server onto the AgentRuntime contract.",
	persona: {
		name: "Marcus Aurelius Geologicus",
		role: "Master Geological Analyst",
		expertise: [
			"Formation analysis and characterization",
			"Well log interpretation",
			"GIS data processing and spatial analysis",
			"Geological quality assessment",
			"Petroleum geology and reservoir characterization",
		],
	},
	capabilities: [
		"formation-analysis",
		"well-log-interpretation",
		"gis-processing",
		"quality-assessment",
		"document-extraction",
		"seismic-interpretation",
		"reserves-analysis",
		"model-routing",
		"evals",
	],
	tools: [
		{
			name: "geologist.analyze_formation",
			description: "Analyze geological formations from well log data (LAS, DLIS, WITSML).",
			type: "query",
			capabilities: ["formation-analysis", "petrophysics", "reservoir-characterization"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to well log file (.las, .dlis, .xml)" },
					formations: { type: "array", items: { type: "string" }, description: "Target formations" },
					analysisType: { type: "string", enum: ["basic", "standard", "comprehensive"], default: "standard" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "standard-analysis",
			evalProfile: "geologist-formation",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_gis",
			description: "Process GIS files with oil & gas spatial analysis (.shp, .geojson, .kml).",
			type: "query",
			capabilities: ["gis-processing", "spatial-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to GIS file (.shp, .geojson, .kml)" },
					analysisType: {
						type: "string",
						enum: ["basic", "standard", "comprehensive", "oilgas"],
						default: "standard",
					},
					qualityAssessment: { type: "boolean", default: true },
					oilGasAnalysis: { type: "boolean", default: true },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "deterministic",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_well_logs",
			description: "Process multi-format well logs (LAS/DLIS/WITSML) with unified interface.",
			type: "query",
			capabilities: ["well-log-interpretation", "petrophysics"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to well log file (.las, .dlis, .xml)" },
					format: { type: "string", enum: ["auto", "las", "dlis", "witsml"], default: "auto" },
					qualityAssessment: { type: "boolean", default: true },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "standard-analysis",
			evalProfile: "geologist-well-log",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.assess_quality",
			description: "Assess geological data quality against configurable completeness and accuracy thresholds.",
			type: "query",
			capabilities: ["quality-assessment"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string" },
					dataType: { type: "string", enum: ["las", "gis", "seismic"] },
					thresholds: {
						type: "object",
						properties: {
							completeness: { type: "number", minimum: 0, maximum: 1 },
							accuracy: { type: "number", minimum: 0, maximum: 1 },
						},
					},
				},
				required: ["filePath", "dataType"],
			},
			readOnly: true,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "deterministic",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_access_database",
			description: "Process Microsoft Access database files (.accdb, .mdb) for production data.",
			type: "query",
			capabilities: ["data-extraction", "production-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to Access database file (.accdb or .mdb)" },
					extractTables: { type: "array", items: { type: "string" }, description: "Tables to extract (default: all)" },
					outputFormat: { type: "string", enum: ["json", "csv", "summary"], default: "summary" },
					outputPath: { type: "string", description: "Optional path to write output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "deterministic",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_document",
			description: "Process PDF, DOCX, and PPTX documents for oil & gas data extraction.",
			type: "query",
			capabilities: ["document-extraction", "data-extraction"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to document file (.pdf, .docx, .pptx)" },
					extractionType: { type: "string", enum: ["summary", "technical", "financial", "all"], default: "all" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "standard-analysis",
			evalProfile: "geologist-document",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_seismic_data",
			description: "Process seismic data files (SEGY, SGY, seismic3d) for structural interpretation.",
			type: "query",
			capabilities: ["seismic-interpretation", "structural-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to seismic file (.segy, .sgy, .seismic3d)" },
					analysisType: { type: "string", enum: ["structural", "amplitude", "reservoir", "all"], default: "all" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "standard-analysis",
			evalProfile: "geologist-seismic",
			mcpServer: "geowiz",
		},
		{
			name: "geologist.process_aries_database",
			description: "Process ARIES petroleum economics and reserves database (.adb).",
			type: "query",
			capabilities: ["reserves-analysis", "economics-analysis"],
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "Path to ARIES database file (.adb)" },
					analysisType: { type: "string", enum: ["reserves", "economics", "forecasting", "all"], default: "all" },
					outputPath: { type: "string", description: "Optional path to write JSON output" },
				},
				required: ["filePath"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: false,
			requiredScopes: ["read:geology"],
			modelRequirement: "standard-analysis",
			evalProfile: "geologist-aries",
			mcpServer: "geowiz",
		},
	],
	requiredScopes: ["read:geology"],
	providerRequirements: [
		{
			type: "llm",
			required: true,
			description:
				"Organization-selected LLM for geological synthesis — formation analysis, document extraction, and seismic insights call the model.",
		},
		{
			type: "data-connector",
			required: false,
			description: "Optional connector to well data sources (LAS repositories, production databases).",
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
		namespace: "geologist",
		reviewRequired: true,
		sharedMemoryOptIn: false,
	},
	evals: {
		defaultProfile: "geologist-standard",
		requiredChecks: ["schema", "redactSecrets"],
	},
	autonomy: {
		defaultLevel: "reviewed",
		allowedLevels: ["assistive", "reviewed", "autonomous"],
	},
};

export const geologistConfig: AgentRuntimeConfig = {
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
		profile: "geologist-standard",
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
		namespace: "geologist",
		vectorStore: { enabled: false },
		retentionDays: 90,
		promotion: {
			requireHumanReview: true,
			allowSharedMemory: false,
		},
	},
	// Tier 1 tool server — operator configures the actual URL at deployment time.
	mcpServers: {
		geowiz: {
			url: "http://localhost:3001",
			transport: "http",
			authType: "none",
		},
	},
	// Data integrations available to geology tool handlers.
	dataConnectors: {
		"las-repository": {
			type: "ftp",
			description: "FTP source for LAS well log files — operator-configured.",
		},
		"well-data-api": {
			type: "rest-api",
			description: "3rd-party well data API (e.g. IHS, Enverus) — operator-configured.",
		},
	},
};

// Each handler resolves the geowiz URL from the runtime config and delegates via MCP over HTTP.
// The server name "geowiz" matches AgentToolManifest.mcpServer and AgentRuntimeConfig.mcpServers key.
function geowizUrl(config: AgentRuntimeConfig): string {
	return config.mcpServers?.geowiz?.url ?? "http://localhost:3001";
}

const handlers: Record<string, StandaloneToolHandler> = {
	"geologist.analyze_formation": ({ args, config }) => callGeowizTool(geowizUrl(config), "analyze_formation", args),

	"geologist.process_gis": ({ args, config }) => callGeowizTool(geowizUrl(config), "process_gis", args),

	"geologist.process_well_logs": ({ args, config }) => callGeowizTool(geowizUrl(config), "process_well_logs", args),

	"geologist.assess_quality": ({ args, config }) => callGeowizTool(geowizUrl(config), "assess_data_quality", args),

	"geologist.process_access_database": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_access_database", args),

	"geologist.process_document": ({ args, config }) => callGeowizTool(geowizUrl(config), "process_document", args),

	"geologist.process_seismic_data": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_seismic_data", args),

	"geologist.process_aries_database": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_aries_database", args),
};

export function createGeologistRuntime(config: AgentRuntimeConfig = geologistConfig): LocalAgentRuntime {
	return new LocalAgentRuntime({
		manifest: geologistManifest,
		config,
		handlers,
	});
}

export function createGeologistEndpoint(config: AgentRuntimeConfig = geologistConfig): LocalAgentEndpoint {
	return new LocalAgentEndpoint(createGeologistRuntime(config));
}
