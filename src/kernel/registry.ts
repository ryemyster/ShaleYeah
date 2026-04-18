/**
 * SHALE YEAH Agent OS - Tool Registry
 *
 * Central index of all tools across all MCP servers.
 * Implements Arcade patterns: Tool Registry, Capability Matching, Tool Gateway (routing).
 *
 * The registry is built at kernel initialization by scanning server configs
 * and classifying each server's tools by type (query/command/discovery).
 */

import type { CircuitBreaker } from "./middleware/circuit-breaker.js";
import type { CircuitBreakerState, DetailLevel, ServerFilter, ServerInfo, ToolDescriptor, ToolType } from "./types.js";

/** Minimal server config needed for registration (matches mcp-client.ts shape) */
export interface RegistrableServerConfig {
	name: string;
	description: string;
	persona: string;
	domain: string;
	capabilities: string[];
}

/** Server entry in the registry with full metadata */
interface RegisteredServer {
	config: RegistrableServerConfig;
	tools: ToolDescriptor[];
	status: "connected" | "disconnected" | "error";
}

/**
 * Command servers that produce side effects (file writes, decisions).
 * Everything else defaults to query (read-only).
 */
const COMMAND_SERVERS = new Set(["reporter", "decision"]);

/** Servers whose primary tool requires user confirmation before execution */
const CONFIRMATION_REQUIRED = new Set(["decision"]);

/**
 * Tool Registry — source of truth for all tools across all servers.
 *
 * Provides discovery (list, search, match) and routing (resolve server for tool).
 */
export class Registry {
	private servers: Map<string, RegisteredServer> = new Map();
	private toolIndex: Map<string, ToolDescriptor> = new Map();
	private capabilityIndex: Map<string, ToolDescriptor[]> = new Map();
	private circuitBreaker: CircuitBreaker | null = null;
	/**
	 * Opt-in fallback chains: primaryToolName → ordered list of fallback tool names.
	 * The executor tries each fallback in order and stops on first success.
	 * Only tools explicitly registered via registerFallback() have a fallback route.
	 */
	private fallbackMap: Map<string, string[]> = new Map();

	/**
	 * Register a server and auto-generate its tool descriptors.
	 *
	 * Each server gets one primary tool named `{serverName}.analyze` (or similar)
	 * plus its capabilities indexed for fuzzy matching.
	 */
	registerServer(config: RegistrableServerConfig): void {
		const toolType: ToolType = COMMAND_SERVERS.has(config.name) ? "command" : "query";

		const primaryToolName = `${config.name}.analyze`;

		const tool: ToolDescriptor = {
			name: primaryToolName,
			server: config.name,
			type: toolType,
			description: `${config.description} — powered by ${config.persona}`,
			capabilities: [...config.capabilities],
			inputSchema: {},
			readOnly: toolType === "query",
			destructive: false,
			requiresConfirmation: CONFIRMATION_REQUIRED.has(config.name),
			detailLevels: ["summary", "standard", "full"] as DetailLevel[],
			smartDefaults: {},
			dependsOn: [],
			providesFor: [],
		};

		const entry: RegisteredServer = {
			config,
			tools: [tool],
			status: "disconnected",
		};

		this.servers.set(config.name, entry);
		this.toolIndex.set(primaryToolName, tool);

		// Index each capability for fast lookup
		for (const cap of config.capabilities) {
			const existing = this.capabilityIndex.get(cap) ?? [];
			existing.push(tool);
			this.capabilityIndex.set(cap, existing);
		}
	}

	/**
	 * Attach a CircuitBreaker instance for health-aware server filtering.
	 */
	setCircuitBreaker(cb: CircuitBreaker): void {
		this.circuitBreaker = cb;
	}

	/**
	 * Get the circuit breaker state for a server (for observability).
	 * Returns undefined if no circuit breaker is attached.
	 */
	getCircuitState(serverName: string): CircuitBreakerState | undefined {
		return this.circuitBreaker?.getState(serverName);
	}

	/**
	 * Update a server's connection status.
	 */
	setServerStatus(name: string, status: "connected" | "disconnected" | "error"): void {
		const entry = this.servers.get(name);
		if (entry) {
			entry.status = status;
		}
	}

	/**
	 * List all registered servers, optionally filtered.
	 */
	listServers(filter?: ServerFilter): ServerInfo[] {
		const results: ServerInfo[] = [];

		for (const [, entry] of this.servers) {
			// Exclude servers with an open circuit (unhealthy)
			if (this.circuitBreaker?.isOpen(entry.config.name)) continue;

			// Apply domain filter
			if (filter?.domain && entry.config.domain !== filter.domain) continue;

			// Apply type filter
			if (filter?.type) {
				const hasType = entry.tools.some((t) => t.type === filter.type);
				if (!hasType) continue;
			}

			// Apply capability filter
			if (filter?.capability) {
				const hasCap = entry.config.capabilities.some((c) =>
					c.toLowerCase().includes(filter.capability!.toLowerCase()),
				);
				if (!hasCap) continue;
			}

			results.push({
				name: entry.config.name,
				description: entry.config.description,
				domain: entry.config.domain,
				persona: entry.config.persona,
				toolCount: entry.tools.length,
				capabilities: entry.config.capabilities,
				status: entry.status,
			});
		}

		return results;
	}

	/**
	 * List all tools, optionally scoped to a single server.
	 */
	listTools(serverName?: string): ToolDescriptor[] {
		if (serverName) {
			return this.servers.get(serverName)?.tools ?? [];
		}
		return Array.from(this.toolIndex.values());
	}

	/**
	 * Find tools by capability string (case-insensitive substring match).
	 */
	findByCapability(capability: string): ToolDescriptor[] {
		const matches: ToolDescriptor[] = [];
		const query = capability.toLowerCase();

		for (const [cap, tools] of this.capabilityIndex) {
			if (cap.toLowerCase().includes(query)) {
				for (const tool of tools) {
					// Avoid duplicates if a tool matches multiple capabilities
					if (!matches.some((m) => m.name === tool.name)) {
						matches.push(tool);
					}
				}
			}
		}

		return matches;
	}

	/**
	 * Resolve which server owns a given tool name.
	 * Accepts both fully qualified (server.analyze) and short (server) names.
	 */
	resolveServer(toolName: string): string | undefined {
		// Direct match on fully qualified name
		const direct = this.toolIndex.get(toolName);
		if (direct) return direct.server;

		// Try as server name shorthand (e.g., "geowiz" → "geowiz.analyze")
		if (this.servers.has(toolName)) return toolName;

		// Fuzzy: check if toolName is a prefix
		for (const [name, tool] of this.toolIndex) {
			if (name.startsWith(toolName)) return tool.server;
		}

		return undefined;
	}

	/**
	 * Get a specific tool descriptor by name.
	 */
	getTool(toolName: string): ToolDescriptor | undefined {
		return this.toolIndex.get(toolName);
	}

	/**
	 * Register an opt-in fallback chain for a primary tool.
	 * When the primary tool fails after all retries, the executor tries each
	 * fallback in order and stops on the first success.
	 *
	 * @param primaryTool   Fully-qualified primary tool name (e.g. "geowiz.analyze")
	 * @param fallbackTools Single fallback or ordered list of alternatives (preferred → last resort)
	 */
	registerFallback(primaryTool: string, fallbackTools: string | string[]): void {
		this.fallbackMap.set(primaryTool, Array.isArray(fallbackTools) ? [...fallbackTools] : [fallbackTools]);
	}

	/**
	 * Return the ordered fallback chain for a primary tool.
	 * Returns an empty array if no fallback has been registered for that tool.
	 */
	getFallbacks(primaryTool: string): string[] {
		return this.fallbackMap.get(primaryTool) ?? [];
	}

	/**
	 * Convenience alias — returns the first registered fallback, or undefined.
	 * Callers that only need a single fallback can use this instead of getFallbacks().
	 */
	getFallback(primaryTool: string): string | undefined {
		return this.getFallbacks(primaryTool)[0];
	}

	// ==========================================
	// Dependency Hint graph (Arcade: Dependency Hint pattern — Issue #198)
	// ==========================================

	/**
	 * Declare prerequisite and consumer relationships for a registered tool.
	 *
	 * Call this after all servers are registered to wire up the dependency graph.
	 * Unknown tool names are silently ignored so that partial registrations during
	 * startup do not crash the kernel.
	 *
	 * @param toolName  Fully-qualified tool name (e.g. "decision.analyze")
	 * @param hints     Object with optional dependsOn[] and/or providesFor[] arrays
	 */
	setToolDependencies(toolName: string, hints: { dependsOn?: string[]; providesFor?: string[] }): void {
		const tool = this.toolIndex.get(toolName);
		if (!tool) return; // Unknown tool — no-op

		if (hints.dependsOn !== undefined) {
			tool.dependsOn = [...hints.dependsOn];
		}
		if (hints.providesFor !== undefined) {
			tool.providesFor = [...hints.providesFor];
		}
	}

	/**
	 * Return the list of tools that must complete before the given tool can run.
	 * Returns [] for unknown tools (no prerequisites assumed for unregistered tools).
	 */
	getDependencies(toolName: string): string[] {
		return this.toolIndex.get(toolName)?.dependsOn ?? [];
	}

	/**
	 * Return all tools that list the given tool in their dependsOn.
	 *
	 * Computed on demand by scanning the tool index — the graph is small (≤ 14 tools)
	 * so a linear scan is cheaper than maintaining a separate reverse-edge index.
	 */
	getDependents(toolName: string): string[] {
		const dependents: string[] = [];
		for (const [name, tool] of this.toolIndex) {
			if (name !== toolName && tool.dependsOn.includes(toolName)) {
				dependents.push(name);
			}
		}
		return dependents;
	}

	/**
	 * Validate that all prerequisites for a tool have already completed.
	 *
	 * @param toolName   Fully-qualified tool name to check
	 * @param completed  Set of fully-qualified tool names that have finished successfully
	 * @returns          { valid: true, missing: [] } or { valid: false, missing: [...] }
	 */
	validateExecutionOrder(toolName: string, completed: Set<string>): { valid: boolean; missing: string[] } {
		const deps = this.getDependencies(toolName);
		const missing = deps.filter((dep) => !completed.has(dep));
		return { valid: missing.length === 0, missing };
	}

	/**
	 * Return the full dependency adjacency map for all registered tools.
	 *
	 * Keys are fully-qualified tool names; values are their dependsOn arrays.
	 * Useful for building execution plans, dry-run visualizations (#135), and
	 * explaining tool ordering to agents.
	 */
	getExecutionGraph(): Map<string, string[]> {
		const graph = new Map<string, string[]>();
		for (const [name, tool] of this.toolIndex) {
			graph.set(name, [...tool.dependsOn]);
		}
		return graph;
	}

	/**
	 * Get the total number of registered servers.
	 */
	get serverCount(): number {
		return this.servers.size;
	}

	/**
	 * Get the total number of registered tools.
	 */
	get toolCount(): number {
		return this.toolIndex.size;
	}
}
