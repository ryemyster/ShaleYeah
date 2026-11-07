import type {
	AgentDiscoverySummary,
	AgentExecutionRequest,
	AgentExecutionResult,
	AgentHealth,
	AgentManifest,
	AgentRuntime,
	AgentToolManifest,
	AgentToolSummary,
} from "./contracts.js";

export interface AgentEndpointContract {
	health(): Promise<AgentHealth>;
	manifest(): Promise<AgentManifest>;
	discoverySummary(): Promise<AgentDiscoverySummary>;
	discoveryTools(): Promise<AgentToolSummary[]>;
	discoveryToolSchema(toolName: string): Promise<AgentToolManifest | null>;
	execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}

/**
 * Transport-neutral endpoint facade for a standalone agent.
 *
 * Issue #358 defines the contract before locking HTTP, stdio, or gateway transport.
 * A future HTTP adapter can map these methods directly to routes without changing
 * the runtime boundary.
 */
export class LocalAgentEndpoint implements AgentEndpointContract {
	constructor(private readonly runtime: AgentRuntime) {}

	health(): Promise<AgentHealth> {
		return this.runtime.health();
	}

	async manifest(): Promise<AgentManifest> {
		return this.runtime.getManifest();
	}

	async discoverySummary(): Promise<AgentDiscoverySummary> {
		return this.runtime.discover("summary");
	}

	async discoveryTools(): Promise<AgentToolSummary[]> {
		return this.runtime.discover("tools");
	}

	async discoveryToolSchema(toolName: string): Promise<AgentToolManifest | null> {
		return this.runtime.discover("schema", toolName);
	}

	execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
		return this.runtime.execute(request);
	}
}
