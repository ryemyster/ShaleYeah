import type { AgentManifest, AgentRuntimeConfig, HumanApproval, HumanApprovalChallenge } from "@shaleyeah/sdk";
import { callLLM, LocalAgentEndpoint, LocalAgentRuntime, type StandaloneToolHandler } from "@shaleyeah/sdk";
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
		{
			// Closes the Observe→Think→Act→Learn loop. Persists a key geological finding to
			// the geowiz findings store so it can be surfaced in future tasks (memory namespace:
			// "geologist"). Backed by local JSON for now; Supabase pgvector promoted when #405 ships.
			name: "geologist.save_finding",
			description: "Persist a key geological finding (formation, well-log, seismic, quality) to the agent memory store for recall in future tasks.",
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
					metadata: { type: "object", description: "Optional structured metadata (porosity, depth, formation name, etc.)" },
				},
				required: ["findingType", "title", "summary", "confidence", "dataSource"],
			},
			readOnly: false,
			destructive: false,
			requiresHumanApproval: true,
			requiredScopes: ["write:geology"],
			modelRequirement: "deterministic",
			mcpServer: "geowiz",
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
 * Deferred (#396): Async Job — polling pattern for long-running tools (seismic, ARIES).
 */
export async function runGeologistTask(
	goal: string,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		runtime?: LocalAgentRuntime;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
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
		return await executeLoop(goal, runtime, { ...options, config });
	} finally {
		if (ownedRuntime) await runtime.shutdown();
	}
}

function buildTranscript(history: Array<{ role: "user" | "assistant" | "tool"; content: string }>): string {
	return history
		.map((t) => {
			if (t.role === "user") return `User: ${t.content}`;
			if (t.role === "assistant") return `Assistant: ${t.content}`;
			return `Tool result: ${t.content}`;
		})
		.join("\n\n");
}

function parseJson(
	text: string,
): { action?: string; tool?: string; args?: Record<string, unknown>; answer?: string } | null {
	try {
		const cleaned = text
			.replace(/^```(?:json)?\s*/m, "")
			.replace(/\s*```\s*$/m, "")
			.trim();
		return JSON.parse(cleaned);
	} catch {
		return null;
	}
}

// Retry budgets — Arcade pattern #40: Error Classification.
// Retryable errors (network transients, server restarts) get up to MAX_TOOL_RETRIES attempts
// with exponential backoff before the error is surfaced to the LLM as a recoverable hint.
const MAX_TOOL_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

async function executeWithRetry(
	runtime: LocalAgentRuntime,
	request: Parameters<typeof runtime.execute>[0],
): Promise<ReturnType<LocalAgentRuntime["execute"]>> {
	let last: Awaited<ReturnType<LocalAgentRuntime["execute"]>> | null = null;
	for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
		if (attempt > 0) {
			// Exponential backoff: 500ms, 1000ms, 2000ms
			await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
		}
		const result = await runtime.execute(request);
		if (result.status !== "failed" || !result.retryable) return result;
		last = result;
	}
	return last!;
}

async function executeLoop(
	goal: string,
	runtime: LocalAgentRuntime,
	options: {
		config?: AgentRuntimeConfig;
		apiKey?: string;
		onApprovalRequired?: (challenge: HumanApprovalChallenge) => Promise<HumanApproval>;
	},
): Promise<string> {
	// TODO (#395): Context Injection — before building the system prompt, read from
	// memory.namespace = "geologist" to surface relevant prior task context.
	// Requires Supabase pgvector. Inject as an additional system prompt section.

	const config = options.config ?? geologistConfig;

	// Resolve the model that drives the reasoning loop from the operator's routing table.
	// The loop itself is always standard-analysis class — tool-level model requirements are
	// for the tool handlers (e.g. deterministic tools skip the LLM entirely).
	const reasoningModel = config.modelRouting["standard-analysis"]?.model;

	const toolDefs = geologistManifest.tools.map((t) => `  ${t.name}: ${t.description}`).join("\n");

	const system = `You are ${geologistManifest.persona.name}, ${geologistManifest.persona.role}.

Available tools:
${toolDefs}

Respond ONLY with valid JSON — no prose, no markdown. Two formats allowed:
1. Call a tool:  {"action":"tool","tool":"<full tool name>","args":{...}}
2. Final answer: {"action":"done","answer":"<synthesized answer>"}

Always use the full tool name (e.g. "geologist.analyze_formation").
If you cannot complete the task with the available tools, respond with {"action":"done","answer":"<explanation>"}.`;

	type Turn = { role: "user" | "assistant" | "tool"; content: string };
	const history: Turn[] = [{ role: "user", content: goal }];
	const MAX_STEPS = 8;

	for (let step = 0; step < MAX_STEPS; step++) {
		const response = await callLLM({
			system,
			prompt: `${buildTranscript(history)}\n\nAssistant:`,
			model: reasoningModel,
			apiKey: options.apiKey,
		});

		history.push({ role: "assistant", content: response });

		const parsed = parseJson(response);
		if (!parsed || parsed.action === "done" || !parsed.tool) {
			return parsed?.answer ?? response;
		}

		// TODO (#396): Async Job — if the tool manifest declares timeoutMs > threshold,
		// treat the result as a job ID and poll until completion before continuing the loop.

		// Permission Gate: route through runtime.execute() so HITL + scope checks fire.
		// executeWithRetry transparently retries transient (retryable) failures before
		// surfacing the error to the LLM as a recoverable hint.
		const execResult = await executeWithRetry(runtime, {
			toolName: parsed.tool,
			args: parsed.args ?? {},
			runId: `task:step:${step}`,
		});

		if (execResult.status === "completed") {
			history.push({ role: "tool", content: JSON.stringify(execResult.data) });
		} else if (execResult.status === "approval_required") {
			if (!options.onApprovalRequired) {
				throw new Error(
					`Tool ${parsed.tool} requires human approval. ` +
						"Provide an onApprovalRequired callback to runGeologistTask, or set autonomy to 'autonomous'.",
				);
			}
			const approval = await options.onApprovalRequired(execResult.challenge);
			// Re-execute the same call with the approval token — no retry on the approved path.
			const approved = await runtime.execute({
				toolName: parsed.tool,
				args: parsed.args ?? {},
				approval,
				runId: `task:step:${step}:approved`,
			});
			if (approved.status === "completed") {
				history.push({ role: "tool", content: JSON.stringify(approved.data) });
			} else {
				const err = approved.status === "failed" ? approved.error : "approval re-execution failed";
				history.push({ role: "tool", content: `Error after approval for ${parsed.tool}: ${err}` });
			}
		} else {
			// Failed — include retryability hint so the LLM can decide whether to reformulate.
			const hint = execResult.retryable ? " (retryable — server may be temporarily unavailable)" : " (permanent)";
			history.push({ role: "tool", content: `Error calling ${parsed.tool}: ${execResult.error}${hint}` });
		}
	}

	// TODO (#395): Context Injection — write key findings to memory.namespace before returning.

	// Max steps reached — force a synthesis pass.
	const finalResponse = await callLLM({
		system,
		prompt: `${buildTranscript(history)}\n\nUser: Maximum steps reached. Synthesize findings now.\n\nAssistant:`,
		model: reasoningModel,
		apiKey: options.apiKey,
	});

	return parseJson(finalResponse)?.answer ?? finalResponse;
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
