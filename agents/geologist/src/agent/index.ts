import type {
	AgentManifest,
	AgentRuntimeConfig,
	AsyncJobPoller,
	HumanApproval,
	HumanApprovalChallenge,
	LLMCallOptions,
	SessionIdentity,
} from "@shaleyeah/sdk";
import {
	CompensationRegistry,
	callLLM,
	LocalAgentEndpoint,
	LocalAgentRuntime,
	runAgentTask,
	type StandaloneToolHandler,
} from "@shaleyeah/sdk";
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
			provides: ["geological-analysis"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
			provides: ["gis-data"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
			provides: ["well-log-data"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
			dependsOn: ["geologist.analyze_formation"],
			provides: ["quality-assessment"],
			estimatedLatencyMs: { p50: 200, p95: 800 },
			complexity: "fast",
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
			provides: ["access-db-data"],
			// Arcade #44: if Access DB processing fails permanently, fall back to a quality
			// metadata-only check so the geologist can still report data quality findings.
			fallbackTo: "geologist.assess_quality",
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
			provides: ["document-data"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
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
			dependsOn: ["geologist.analyze_formation"],
			provides: ["seismic-data"],
			// Seismic inversion can take minutes — server may return { jobId, status: "pending" }
			// and the agent layer polls get_job_status until complete (Arcade #24: Async Job).
			timeoutMs: 120_000,
			// Arcade #44: if seismic processing permanently fails, fall back to simpler formation
			// analysis so the geologist can still deliver structural findings.
			fallbackTo: "geologist.analyze_formation",
			estimatedLatencyMs: { p50: 8000, p95: 30000 },
			complexity: "slow",
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
			provides: ["reserves-data"],
			estimatedLatencyMs: { p50: 2000, p95: 8000 },
			complexity: "moderate",
		},
		{
			// Closes the Observe→Think→Act→Learn loop. Persists a key geological finding to
			// the geowiz findings store so it can be surfaced in future tasks (memory namespace:
			// "geologist"). Backed by local JSON for now; Supabase pgvector promoted when #405 ships.
			name: "geologist.save_finding",
			description:
				"Persist a key geological finding (formation, well-log, seismic, quality) to the agent memory store for recall in future tasks.",
			type: "command",
			capabilities: ["memory-write"],
			inputSchema: {
				type: "object",
				properties: {
					findingType: {
						type: "string",
						enum: ["formation", "well-log", "quality-assessment", "seismic", "document", "general"],
						description: "Category of geological finding",
					},
					title: { type: "string", description: "Short human-readable title for this finding" },
					summary: { type: "string", description: "Detailed summary of the geological finding" },
					confidence: { type: "number", description: "Confidence score 0–1", minimum: 0, maximum: 1 },
					dataSource: { type: "string", description: "File path or external reference that produced this finding" },
					metadata: {
						type: "object",
						description: "Optional structured metadata (porosity, depth, formation name, etc.)",
					},
				},
				required: ["findingType", "title", "summary", "confidence", "dataSource"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: true,
			requiredScopes: ["write:geology"],
			modelRequirement: "deterministic",
			mcpServer: "geowiz",
			dependsOn: ["geologist.analyze_formation"],
			estimatedLatencyMs: { p50: 200, p95: 800 },
			complexity: "fast",
			// Permanent write failure should surface rollback state to the user, not silently exit.
			// Implements Arcade pattern #26: Transactional Boundary.
			transactional: true,
		},
	],
	// Arcade #21: Tool Chain — recommended step sequences for known workflows.
	toolChains: [
		{
			id: "geological-due-diligence",
			description: "Full formation evaluation: seismic → well logs → quality → save",
			steps: [
				"geologist.analyze_formation",
				"geologist.process_well_logs",
				"geologist.assess_quality",
				"geologist.save_finding",
			],
			trigger: "evaluating a new formation prospect or conducting geological due diligence",
		},
	],
	requiredScopes: ["read:geology", "write:geology"],
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
	// Dev defaults — operators override these bindings at deploy time via env-driven config.
	// provider: "anthropic" here means the standard Anthropic API path through callLLM().
	// provider: "rule-based" means the tool handler is deterministic; callLLM() is not invoked.
	modelRouting: {
		"small-fast": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		"standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
		"deep-reasoning": { provider: "anthropic", model: "claude-opus-4-8" },
		"local-private": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
		// rule-based: no LLM invoked — handler returns deterministic output from domain constants.
		deterministic: { provider: "rule-based", model: "no-model" },
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

// The server tool name is the agent tool name without the "geologist." prefix.
const handlers: Record<string, StandaloneToolHandler> = {
	"geologist.analyze_formation": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "analyze_formation", args as Record<string, unknown>),

	"geologist.process_gis": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_gis", args as Record<string, unknown>),

	"geologist.process_well_logs": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_well_logs", args as Record<string, unknown>),

	"geologist.assess_quality": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "assess_quality", args as Record<string, unknown>),

	"geologist.process_access_database": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_access_database", args as Record<string, unknown>),

	"geologist.process_document": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_document", args as Record<string, unknown>),

	"geologist.process_seismic_data": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_seismic_data", args as Record<string, unknown>),

	"geologist.process_aries_database": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "process_aries_database", args as Record<string, unknown>),

	"geologist.save_finding": ({ args, config }) =>
		callGeowizTool(geowizUrl(config), "save_finding", args as Record<string, unknown>),
};

// Arcade #27 — register compensation handler for the only write tool in this agent.
// If save_finding fails partway (e.g. record written but indexing failed), geowiz exposes
// a delete_finding endpoint so the orphaned record can be removed before the LLM is told
// to ask the user what to do. The handler is a best-effort no-op until #405 (pgvector)
// ships a real delete_finding tool — this wires the pattern so adding that tool is trivial.
CompensationRegistry.register("geologist.save_finding", async (_args) => {
	// TODO (#405): call delete_finding with the partially-written record ID once geowiz
	// exposes that endpoint. For now the compensation path fires (tested) but is inert.
});

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

/**
 * Run a multi-step geological task driven by the LLM (Layer 2 execution loop).
 *
 * Accepts a natural language goal, reasons about which geowiz tools to call,
 * executes them through the governed runtime (HITL + scope checks fire on every
 * tool call — Arcade pattern #46: Permission Gate), and returns a synthesized answer.
 *
 * options.runtime    — use an already-initialized runtime (e.g. in tests or when the
 *                      caller manages lifecycle). If omitted, one is created internally.
 * options.onApprovalRequired — called when the runtime returns approval_required.
 *                      If omitted and approval is required, the loop throws rather than
 *                      silently bypassing the HITL gate.
 *
 * Deferred (#395): Context Injection — read/write agent memory namespace around the loop.
 */
export async function runGeologistTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
		/** Inject a custom LLM function — used in tests to capture model routing without real API calls. */
		callLLM?: (opts: LLMCallOptions) => Promise<string>;
		/** Override the async-job poller — used in tests to avoid real HTTP polling. */
		asyncJobPoller?: AsyncJobPoller;
		/** Override poll interval in ms — set to 0 in tests for instant polling. */
		pollIntervalMs?: number;
		/** Caller identity — propagated to audit log and ContextStore namespace (Arcade #35). */
		identity?: SessionIdentity;
	} = {},
): Promise<string> {
	const config = options.config ?? geologistConfig;

	// Create and initialize a runtime for this task if the caller didn't supply one.
	let runtime = options.runtime;
	let ownedRuntime = false;
	if (!runtime) {
		runtime = createGeologistRuntime(config);
		await runtime.initialize();
		ownedRuntime = true;
	}

	try {
		return await runAgentTask(goal, runtime, {
			...options,
			config,
			callLLM: options.callLLM ?? callLLM,
			taskLabel: "geologist",
		});
	} finally {
		if (ownedRuntime) await runtime.shutdown();
	}
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
// Run a geological task from the command line:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/agent/index.ts "Analyze test.las"
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const goal = process.argv.slice(2).join(" ").trim();
	if (!goal) {
		console.error("Usage: npx tsx src/agent/index.ts <goal>");
		console.error('  Example: npx tsx src/agent/index.ts "Analyze the Permian Basin well log at data/test.las"');
		process.exit(1);
	}
	const answer = await runGeologistTask(goal, {
		onApprovalRequired: async (challenge) => {
			console.log(`\n⏸  Approval required for: ${challenge.toolName}`);
			console.log(`   Reason: ${challenge.reason ?? "tool requires human review"}`);
			console.log("   Auto-approving in CLI mode...\n");
			return { approved: true, reviewerId: "cli", reason: "CLI auto-approve" };
		},
	}).catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
	console.log(answer);
}
