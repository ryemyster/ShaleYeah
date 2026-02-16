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

import { BUNDLES, FINANCIAL_REVIEW_BUNDLE, GEOLOGICAL_DEEP_DIVE_BUNDLE } from "./bundles.js";
import type { Session } from "./context.js";
import { DEMO_IDENTITY, SessionManager } from "./context.js";
import type { ToolExecutorFn } from "./executor.js";
import { Executor, FULL_DUE_DILIGENCE_BUNDLE, QUICK_SCREEN_BUNDLE } from "./executor.js";
import { AuditMiddleware } from "./middleware/audit.js";
import { AuthMiddleware } from "./middleware/auth.js";
import { Registry } from "./registry.js";
import type {
	AuthResult,
	BundleResponse,
	GatheredResponse,
	InjectedContext,
	KernelConfig,
	ServerFilter,
	ServerInfo,
	SessionInfo,
	ToolDescriptor,
	ToolRequest,
	ToolResponse,
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
	private _initialized = false;

	constructor(config?: Partial<KernelConfig>) {
		this.config = { ...DEFAULT_KERNEL_CONFIG, ...config };
		this.registry = new Registry();
		this.executor = new Executor({
			maxParallel: this.config.execution.maxParallel,
			toolTimeoutMs: this.config.execution.toolTimeoutMs,
			maxRetries: this.config.resilience.maxRetries,
			retryBackoffMs: this.config.resilience.retryBackoffMs,
		});
		this.sessions = new SessionManager();
		this.auth = new AuthMiddleware(this.config.security.requireAuth);
		this.audit = new AuditMiddleware({
			enabled: this.config.security.auditEnabled,
			auditPath: this.config.security.auditPath,
		});
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
	async quickScreen(tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		return this.executor.executeBundle(QUICK_SCREEN_BUNDLE, tractArgs);
	}

	/**
	 * Full Due Diligence — comprehensive 14-server analysis in 4 phases.
	 * Respects dependency ordering between phases.
	 */
	async fullAnalysis(tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		return this.executor.executeBundle(FULL_DUE_DILIGENCE_BUNDLE, tractArgs);
	}

	/**
	 * Generate a deterministic idempotency key for deduplication.
	 */
	generateIdempotencyKey(toolName: string, args: Record<string, unknown>, sessionId?: string): string {
		return this.executor.generateIdempotencyKey(toolName, args, sessionId);
	}

	// ==========================================
	// Composition — High-Level Tools (Arcade: Abstraction Ladder + Confirmation Request)
	// ==========================================

	/**
	 * Geological Deep Dive — focused geological analysis.
	 * geowiz(full) + curve-smith(standard) + research(summary).
	 */
	async geologicalDeepDive(tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		return this.executor.executeBundle(GEOLOGICAL_DEEP_DIVE_BUNDLE, tractArgs);
	}

	/**
	 * Financial Review — focused financial and risk analysis.
	 * econobot(full) + risk-analysis(standard) + market(summary).
	 */
	async financialReview(tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		return this.executor.executeBundle(FINANCIAL_REVIEW_BUNDLE, tractArgs);
	}

	/**
	 * Should We Invest — full due diligence pipeline ending with a decision.
	 * Runs all 14 servers, then returns the decision with confirmation gate.
	 * The decision step returns `requires_confirmation: true` — the agent must
	 * call `confirmAction(actionId)` to finalize the recommendation.
	 */
	async shouldWeInvest(tractArgs?: Record<string, unknown>): Promise<BundleResponse> {
		// Execute full analysis (phases 1-3, reporter)
		const result = await this.executor.executeBundle(FULL_DUE_DILIGENCE_BUNDLE, tractArgs);

		// The decision step within the bundle is the last step.
		// Check if it produced a result — if so, wrap it with confirmation gate.
		const decisionResult = result.results.get("decision.analyze");
		if (decisionResult?.success) {
			// Replace the decision result with a confirmation-gated version
			const confirmResult = await this.executor.executeWithConfirmation({
				toolName: "decision.analyze",
				args: { ...tractArgs, analysisResults: "from_bundle" },
			});
			result.results.set("decision.analyze", confirmResult);
		}

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
}

export { BUNDLES, FINANCIAL_REVIEW_BUNDLE, GEOLOGICAL_DEEP_DIVE_BUNDLE } from "./bundles.js";
export { DEMO_IDENTITY, Session, SessionManager } from "./context.js";
export type { PendingAction, ToolExecutorFn } from "./executor.js";
export { Executor, FULL_DUE_DILIGENCE_BUNDLE, QUICK_SCREEN_BUNDLE } from "./executor.js";
export { AuditMiddleware } from "./middleware/audit.js";
export { AuthMiddleware, ROLE_PERMISSIONS } from "./middleware/auth.js";
export { ResilienceMiddleware } from "./middleware/resilience.js";
// Re-export for convenience
export { Registry } from "./registry.js";
export * from "./types.js";
