/**
 * SHALE YEAH Agent OS - Tool Registry
 *
 * Central index of all tools across all MCP servers.
 * Implements Arcade patterns: Tool Registry, Capability Matching, Tool Gateway (routing).
 *
 * The registry is built at kernel initialization by scanning server configs
 * and classifying each server's tools by type (query/command/discovery).
 */

import type { DetailLevel, ServerFilter, ServerInfo, ToolDescriptor, ToolType } from "./types.js";

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
