/**
 * SHALE YEAH Agent OS - Kernel
 *
 * The kernel is the single entry point between agents and the 14 MCP domain servers.
 * It provides discovery, routing, execution, and (in later waves) context,
 * middleware, and composition.
 *
 * Based on Arcade.dev's agentic tool patterns:
 * - Tool Registry + Capability Matching (discovery)
 * - Tool Gateway (routing)
 * - Discovery Tool (list_servers, describe_tools, find_capability)
 * - Scatter-Gather (parallel execution)
 * - Task Bundle (multi-step workflows)
 * - Idempotent Operation (deterministic keys)
 * - Identity Anchor + Context Injection (sessions)
 */

import {
	BUNDLES,
	FINANCIAL_REVIEW_BUNDLE,
	FULL_DUE_DILIGENCE_BUNDLE,
	GEOLOGICAL_DEEP_DIVE_BUNDLE,
	QUICK_SCREEN_BUNDLE,
} from "./bundles.js";
import type { Session } from "./context.js";
import { DEMO_IDENTITY, FileSessionStorage, SessionManager } from "./context.js";
import type { ToolExecutorFn } from "./executor.js";
import { Executor } from "./executor.js";
import { HealthMonitor, type HealthStatus, type ProbeFn } from "./health-monitor.js";
import { AuditMiddleware } from "./middleware/audit.js";
import { AuthMiddleware } from "./middleware/auth.js";
import { CircuitBreaker } from "./middleware/circuit-breaker.js";
import { Registry } from "./registry.js";
import { SecretsStore } from "./secrets.js";
import type {
	AuthResult,
	BundleResponse,
	CircuitBreakerState,
	GatheredResponse,
	InjectedContext,
	KernelConfig,
	SchemaExplorerLevel,
	ServerFilter,
	ServerInfo,
	SessionInfo,
	TaskBundle,
	ToolDescriptor,
	ToolRequest,
	ToolResponse,
	ToolType,
	UserIdentity,
	UserPreferences,
} from "./types.js";
import { DEFAULT_KERNEL_CONFIG, ErrorType } from "./types.js";

/** Server config shape from mcp-client.ts */
interface ClientServerConfig {
	name: string;
	script: string;
	description: string;
	persona: string;
	domain: string;
	capabilities: string[];
}

/**
 * Agent OS Kernel — unified runtime for tool discovery, routing, and execution.
 *
 * Waves 0-1: Discovery (registry + query methods).
 * Wave 2: Output shaping middleware.
 * Wave 3: Execution engine (single, parallel, bundled).
 * Wave 4: Context + sessions (identity anchor, context injection).
 * Wave 5: Resilience (error classification, recovery guides, graceful degradation).
 * Wave 6: Security (permission gates, audit trail).
 * Wave 7: Composition (high-level tools, confirmation gate, abstraction ladder).
 */
export class Kernel {
	public readonly registry: Registry;
	public readonly executor: Executor;
	public readonly sessions: SessionManager;
	public readonly auth: AuthMiddleware;
	public readonly audit: AuditMiddleware;
	public readonly config: KernelConfig;
	public readonly healthMonitor: HealthMonitor;
	/** Secrets store — inject API keys without exposing them in args or logs */
	public readonly secrets: SecretsStore;
	private _initialized = false;

	constructor(config?: Partial<KernelConfig>) {
		this.config = { ...DEFAULT_KERNEL_CONFIG, ...config };

		// Initialize secrets store and load any pre-configured values
		this.secrets = new SecretsStore();
		if (this.config.secrets?.values) {
			this.secrets.load(this.config.secrets.values);
		}
		// Dev bypass: load from .env file if configured (silently skips if file absent)
		if (this.config.secrets?.envFile) {
			this.secrets.loadEnvFile(this.config.secrets.envFile);
		}

		const cbConfig = this.config.resilience.circuitBreaker;
		const circuitBreaker = new CircuitBreaker(cbConfig);

		this.registry = new Registry();
		this.registry.setCircuitBreaker(circuitBreaker);

		this.executor = new Executor({
			maxParallel: this.config.execution.maxParallel,
			toolTimeoutMs: this.config.execution.toolTimeoutMs,
			maxRetries: this.config.resilience.maxRetries,
			retryBackoffMs: this.config.resilience.retryBackoffMs,
			cacheTtlMs: this.config.execution.idempotencyTtlMs,
		});
		this.executor.setCircuitBreaker(circuitBreaker);

		// Wire the registry for fallback routing — must come after registry is created.
		this.executor.setRegistry(this.registry);

		const storageBackend = this.config.sessionStorage
			? new FileSessionStorage(this.config.sessionStorage.path)
			: undefined;
		this.sessions = new SessionManager(storageBackend);

		// Wire the session manager so the executor can resolve ResourceRef values
		// in tool args before dispatch (Issue #204 — Resource Reference pattern).
		this.executor.setSessionManager(this.sessions);
		this.auth = new AuthMiddleware(this.config.security.requireAuth);
		this.audit = new AuditMiddleware({
			enabled: this.config.security.auditEnabled,
			auditPath: this.config.security.auditPath,
		});

		// Health monitor — probe function defaults to a no-op stub;
		// callers supply a real probe via startHealthMonitor().
		const hcConfig = this.config.resilience.healthCheck;
		this.healthMonitor = new HealthMonitor(this.registry, async () => "up", hcConfig);
	}

	/**
	 * Initialize the kernel by populating the registry from server configs.
	 */
	initialize(serverConfigs: ClientServerConfig[]): void {
		if (this._initialized) return;

		for (const config of serverConfigs) {
			this.registry.registerServer({
				name: config.name,
				description: config.description,
				persona: config.persona,
				domain: config.domain,
				capabilities: config.capabilities,
			});
		}

		// Register opt-in fallback chains — when a primary server is unavailable, the kernel
		// routes to the next server in the chain that can handle the same domain question.
		// These are representative defaults; callers can add more via registry.registerFallback().
		this.registry.registerFallback("risk-analysis.analyze", ["decision.analyze", "econobot.analyze"]);
		this.registry.registerFallback("geowiz.analyze", ["curve-smith.analyze"]);
		this.registry.registerFallback("econobot.analyze", ["risk-analysis.analyze"]);

		this._initialized = true;
	}

	get initialized(): boolean {
		return this._initialized;
	}

	// ==========================================
	// Discovery Tools (Arcade: Discovery Tool pattern)
	// ==========================================

	/**
	 * List all available servers with optional filtering.
	 * Discovery tool: kernel.list_servers
	 */
	listServers(filter?: ServerFilter): ServerInfo[] {
		return this.registry.listServers(filter);
	}

	/**
	 * Get detailed tool descriptors for a specific server (or all servers).
	 * Discovery tool: kernel.describe_tools
	 */
	describeTools(serverName?: string): ToolDescriptor[] {
		return this.registry.listTools(serverName);
	}

	/**
	 * Find tools that match a capability string (fuzzy, case-insensitive).
	 * Discovery tool: kernel.find_capability
	 */
	findCapability(capability: string): ToolDescriptor[] {
		return this.registry.findByCapability(capability);
	}

	/**
	 * Resolve which server handles a given tool name.
	 * Accepts fully qualified names (geowiz.analyze) or short names (geowiz).
	 */
	resolveServer(toolName: string): string | undefined {
		return this.registry.resolveServer(toolName);
	}

	// ==========================================
	// Schema Explorer (Arcade: Schema Explorer pattern)
	// Layered discovery — agents drill down only as far as needed,
	// avoiding the token cost of fetching all 14 servers' full schemas upfront.
	// ==========================================

	/**
	 * Level 1 — server names and one-line descriptions.
	 * Cheap: ~14 items regardless of how many tools each server has.
	 * Discovery tool: kernel.schema_explorer / level: "servers"
	 */
	schemaExplorerListServers(): Array<{ name: string; description: string; toolCount: number }> {
		return this.registry.listServers().map((s) => ({
			name: s.name,
			description: s.description,
			toolCount: s.toolCount,
		}));
	}

	/**
	 * Level 2 — tool names and types for a specific server, no input schema.
	 * Returns [] for unknown server names (does not throw).
	 * Discovery tool: kernel.schema_explorer / level: "tools"
	 */
	schemaExplorerListTools(serverName: string): Array<{ name: string; description: string; type: ToolType }> {
		return this.registry.listTools(serverName).map((t) => ({
			name: t.name,
			description: t.description,
			type: t.type,
		}));
	}

	/**
	 * Level 3 — full ToolDescriptor for a single tool including inputSchema.
	 * Returns null for unknown server or tool (does not throw).
	 * Discovery tool: kernel.schema_explorer / level: "schema"
	 */
	schemaExplorerDescribe(serverName: string, toolName: string): ToolDescriptor | null {
		const fullyQualified = toolName.includes(".") ? toolName : `${serverName}.${toolName}`;
		const tools = this.registry.listTools(serverName);
		return tools.find((t) => t.name === fullyQualified) ?? null;
	}

	/**
	 * Unified Schema Explorer entry point — dispatch by level.
	 * Lets callers parameterize the drill-down level rather than picking a method.
	 */
	schemaExplorer(
		level: SchemaExplorerLevel,
		serverName?: string,
		toolName?: string,
	):
		| Array<{ name: string; description: string; toolCount: number }>
		| Array<{ name: string; description: string; type: ToolType }>
		| ToolDescriptor
		| null {
		if (level === "servers") return this.schemaExplorerListServers();
		if (level === "tools") return this.schemaExplorerListTools(serverName ?? "");
		return this.schemaExplorerDescribe(serverName ?? "", toolName ?? "");
	}

	// ==========================================
	// Execution (Arcade: Scatter-Gather, Task Bundle, Idempotent Operation)
	// ==========================================

	/**
	 * Connect the executor to the underlying MCP transport.
	 * Must be called before execute/quickScreen/fullAnalysis.
	 */
	setExecutorFn(fn: ToolExecutorFn): void {
		this.executor.setExecutorFn(fn);
	}

	/**
	 * Execute a single tool request (no auth/audit — use callTool for full pipeline).
	 */
	async execute(request: ToolRequest): Promise<ToolResponse> {
		return this.executor.execute(request);
	}

	/**
	 * Full middleware pipeline: auth → audit(request) → execute → audit(response).
	 * On auth deny: audit(denial) → return error response.
	 */
	async callTool(request: ToolRequest, sessionId?: string): Promise<ToolResponse> {
		const session = sessionId ? this.sessions.getSession(sessionId) : undefined;
		const identity = session?.identity ?? DEMO_IDENTITY;
		const sid = sessionId ?? "anonymous";

		// 1. Auth check
		const authResult = this.auth.check(request.toolName, identity);
		if (!authResult.allowed) {
			const denial = this.audit.buildEntry(
				request.toolName,
				"denied",
				request.args,
				identity.userId,
				sid,
				identity.role,
				{ success: false },
			);
			this.audit.logDenial(denial);

			return {
				success: false,
				summary: authResult.reason ?? "Access denied",
				confidence: 0,
				data: null,
				detailLevel: "standard",
				completeness: 0,
				metadata: {
					server: request.toolName.split(".")[0],
					persona: "kernel",
					executionTimeMs: 0,
					timestamp: new Date().toISOString(),
				},
				error: {
					type: ErrorType.AUTH_REQUIRED,
					message: authResult.reason ?? "Access denied",
					reason: `Required permissions: ${authResult.requiredPermissions?.join(", ")}`,
					recoverySteps: [
						`Request '${authResult.requiredRole}' role or higher.`,
						"Contact an administrator to grant the required permissions.",
					],
				},
			};
		}

		// 2. Audit request
		const reqEntry = this.audit.buildEntry(
			request.toolName,
			"request",
			request.args,
			identity.userId,
			sid,
			identity.role,
		);
		this.audit.logRequest(reqEntry);

		// 3. Execute
		const startMs = Date.now();
		const result = await this.executor.execute(request);
		const durationMs = Date.now() - startMs;

		// 4. Audit response
		const respEntry = this.audit.buildEntry(
			request.toolName,
			result.success ? "response" : "error",
			request.args,
			identity.userId,
			sid,
			identity.role,
			{ success: result.success, durationMs, errorType: result.error?.type },
		);
		if (result.success) {
			this.audit.logResponse(respEntry);
		} else {
			this.audit.logError(respEntry);
		}

		// 5. Audit fallback — if the executor routed to a fallback, emit a dedicated audit event
		// so operators can see substitutions separately from normal responses.
		if (result.metadata.usedFallback && result.metadata.originalTool && result.metadata.fallbackTool) {
			const failureReason = `${result.metadata.originalTool} failed — routed to fallback`;
			this.audit.logFallback(
				result.metadata.originalTool,
				result.metadata.fallbackTool,
				failureReason,
				identity.userId,
				sid,
				identity.role,
			);
		}

		return result;
	}

	/**
	 * Check if a tool call would be authorized without executing it.
	 */
	authCheck(toolName: string, sessionId?: string): AuthResult {
		const session = sessionId ? this.sessions.getSession(sessionId) : undefined;
		const identity = session?.identity ?? DEMO_IDENTITY;
		return this.auth.check(toolName, identity);
	}

	/**
	 * Execute multiple tool requests in parallel (scatter-gather).
	 */
	async executeParallel(requests: ToolRequest[]): Promise<GatheredResponse> {
		return this.executor.executeParallel(requests);
	}

	/**
	 * Quick Screen — fast parallel assessment using 4 core servers.
	 * Returns geology, economics, engineering, and risk in one pass.
	 */
	async quickScreen(tractArgs?: Record<string, unknown>, session?: Session): Promise<BundleResponse> {
		return this.executor.executeBundle(QUICK_SCREEN_BUNDLE, tractArgs, session);
	}

	/**
	 * Full Due Diligence — comprehensive 14-server analysis in 4 phases.
	 * Respects dependency ordering between phases.
	 */
	async fullAnalysis(tractArgs?: Record<string, unknown>, session?: Session): Promise<BundleResponse> {
		return this.executor.executeBundle(FULL_DUE_DILIGENCE_BUNDLE, tractArgs, session);
	}

	/**
	 * Generate a deterministic idempotency key for deduplication.
	 */
	generateIdempotencyKey(toolName: string, args: Record<string, unknown>, sessionId?: string): string {
		return this.executor.generateIdempotencyKey(toolName, args, sessionId);
	}

	/**
	 * Get the circuit breaker state for a server (for observability/debugging).
	 * Returns undefined if the server is unknown.
	 */
	getCircuitState(serverName: string): CircuitBreakerState | undefined {
		return this.registry.getCircuitState(serverName);
	}

	/**
	 * Get the current health monitor status for a server.
	 * Returns "unknown" until the first probe has run.
	 */
	getServerHealth(serverName: string): HealthStatus {
		return this.healthMonitor.getStatus(serverName);
	}

	/**
	 * Start periodic health probing with a real probe function.
	 * The probeFn receives a server name and should return "up" | "down".
	 * Call stop() on the returned HealthMonitor (or kernel.healthMonitor.stop())
	 * to halt probing.
	 */
	startHealthMonitor(probeFn: ProbeFn): void {
		this.healthMonitor.stop(); // stop default no-op monitor if running
		const hcConfig = this.config.resilience.healthCheck;
		const fresh = new HealthMonitor(this.registry, probeFn, hcConfig);
		// Replace the instance backing getServerHealth — assign via cast to bypass readonly
		(this as { healthMonitor: HealthMonitor }).healthMonitor = fresh;
		fresh.start();
	}

	/**
	 * Direct access to the result cache for observability (metrics, manual invalidation).
	 */
	get resultCache() {
		return this.executor.resultCache;
	}

	/**
	 * Invalidate a specific cache entry by idempotency key, or clear all entries.
	 * Pass no argument (or undefined) to invalidate everything.
	 */
	invalidateCache(key?: string): void {
		if (key !== undefined) {
			this.executor.resultCache.invalidate(key);
		} else {
			this.executor.resultCache.invalidateAll();
		}
	}

	// ==========================================
	// Composition — High-Level Tools (Arcade: Abstraction Ladder + Confirmation Request)
	// ==========================================

	/**
	 * Geological Deep Dive — focused geological analysis.
	 * geowiz(full) + curve-smith(standard) + research(summary).
	 */
	async geologicalDeepDive(tractArgs?: Record<string, unknown>, session?: Session): Promise<BundleResponse> {
		return this.executor.executeBundle(GEOLOGICAL_DEEP_DIVE_BUNDLE, tractArgs, session);
	}

	/**
	 * Financial Review — focused financial and risk analysis.
	 * econobot(full) + risk-analysis(standard) + market(summary).
	 */
	async financialReview(tractArgs?: Record<string, unknown>, session?: Session): Promise<BundleResponse> {
		return this.executor.executeBundle(FINANCIAL_REVIEW_BUNDLE, tractArgs, session);
	}

	/**
	 * Should We Invest — full due diligence pipeline ending with a decision.
	 * Runs the 13 pre-decision servers, then runs decision ONCE via the
	 * confirmation gate with actual prior results injected. This avoids the
	 * previous double-execution of decision.analyze.
	 * The agent must call `confirmAction(actionId)` to finalize the recommendation.
	 */
	async shouldWeInvest(tractArgs?: Record<string, unknown>, session?: Session): Promise<BundleResponse> {
		// Run all steps except decision so we collect prior results first
		const bundleWithoutDecision: TaskBundle = {
			...FULL_DUE_DILIGENCE_BUNDLE,
			steps: FULL_DUE_DILIGENCE_BUNDLE.steps.filter((s) => s.toolName !== "decision.analyze"),
		};

		const result = await this.executor.executeBundle(bundleWithoutDecision, tractArgs, session);

		// Run decision once via confirmation gate with actual reporter output injected
		const reporterResult = result.results.get("reporter.analyze");
		const confirmResult = await this.executor.executeWithConfirmation({
			toolName: "decision.analyze",
			args: {
				...tractArgs,
				analysisResults: reporterResult?.data ?? null,
				priorResultKeys: session?.getInjectedContext().availableResults ?? [],
			},
		});

		result.results.set("decision.analyze", confirmResult);
		return result;
	}

	/**
	 * Confirm a pending action (e.g., investment decision).
	 */
	async confirmAction(actionId: string): Promise<ToolResponse> {
		return this.executor.confirmAction(actionId);
	}

	/**
	 * Cancel a pending action.
	 */
	cancelAction(actionId: string): boolean {
		return this.executor.cancelAction(actionId);
	}

	/**
	 * Get all available pre-built bundles.
	 */
	listBundles(): Record<string, { name: string; description: string; stepCount: number }> {
		const all: Record<string, { name: string; description: string; stepCount: number }> = {};
		// Include executor bundles
		for (const bundle of [QUICK_SCREEN_BUNDLE, FULL_DUE_DILIGENCE_BUNDLE]) {
			all[bundle.name] = {
				name: bundle.name,
				description: bundle.description,
				stepCount: bundle.steps.length,
			};
		}
		// Include bundles from bundles.ts
		for (const [key, bundle] of Object.entries(BUNDLES)) {
			all[key] = {
				name: bundle.name,
				description: bundle.description,
				stepCount: bundle.steps.length,
			};
		}
		return all;
	}

	// ==========================================
	// Context & Sessions (Arcade: Identity Anchor + Context Injection)
	// ==========================================

	/**
	 * Create a new session. Defaults to demo identity if none provided.
	 * Discovery tool: kernel.create_session
	 */
	createSession(identity?: UserIdentity, preferences?: UserPreferences): Session {
		return this.sessions.createSession(identity, preferences);
	}

	/**
	 * Get session info by ID.
	 * Discovery tool: kernel.get_session
	 */
	getSession(sessionId: string): SessionInfo | undefined {
		return this.sessions.getSession(sessionId)?.toSessionInfo();
	}

	/**
	 * Get the raw Session object (for internal use / result storage).
	 */
	getSessionRaw(sessionId: string): Session | undefined {
		return this.sessions.getSession(sessionId);
	}

	/**
	 * Return the identity and context for a session.
	 * Discovery tool: kernel.who_am_i
	 */
	whoAmI(sessionId: string): { identity: UserIdentity; context: InjectedContext } | undefined {
		const session = this.sessions.getSession(sessionId);
		if (!session) return undefined;
		return {
			identity: session.identity,
			context: session.getInjectedContext(),
		};
	}

	/**
	 * Destroy a session and release its resources.
	 */
	destroySession(sessionId: string): boolean {
		return this.sessions.destroySession(sessionId);
	}

	/**
	 * Recover all sessions from the configured storage backend.
	 * Call once at startup after initialize() when session persistence is enabled.
	 * No-op if no storage backend is configured.
	 */
	async recoverSessions(): Promise<void> {
		await this.sessions.recoverSessions();
	}
}

export {
	BUNDLES,
	FINANCIAL_REVIEW_BUNDLE,
	FULL_DUE_DILIGENCE_BUNDLE,
	GEOLOGICAL_DEEP_DIVE_BUNDLE,
	QUICK_SCREEN_BUNDLE,
} from "./bundles.js";
export type { SerializedSession, SessionStorageBackend } from "./context.js";
export { DEMO_IDENTITY, FileSessionStorage, Session, SessionManager } from "./context.js";
export type { PendingAction, ToolExecutorFn } from "./executor.js";
export { Executor, toBundlePartialSuccessResult, toPartialSuccessResult } from "./executor.js";
export type { HealthMonitorConfig, HealthStatus, ProbeFn } from "./health-monitor.js";
export { HealthMonitor } from "./health-monitor.js";
export { AuditMiddleware } from "./middleware/audit.js";
export { AuthMiddleware, ROLE_PERMISSIONS } from "./middleware/auth.js";
export { CircuitBreaker } from "./middleware/circuit-breaker.js";
export { OutputShaper } from "./middleware/output.js";
export { ResilienceMiddleware } from "./middleware/resilience.js";
// Re-export for convenience
export { Registry } from "./registry.js";
export type { CacheMetrics, ResultCacheConfig } from "./result-cache.js";
export { ResultCache } from "./result-cache.js";
export * from "./types.js";
