/**
 * MCP Types - Shared type definitions
 */

export interface MCPAgentResourceConfig {
	name: string;
	version: string;
	description: string;
	capabilities: string[];
	resources: string[];
}

export interface MCPServerInfo {
	name: string;
	version: string;
	description: string;
	persona: {
		name: string;
		role: string;
		expertise: string[];
	};
	initialized: boolean;
	dataPath: string;
}

// Re-export kernel types for convenience
export type {
	AgentOSResponse,
	AuditEntry,
	BundleStep,
	DetailLevel,
	ErrorDetail,
	KernelConfig,
	Permission,
	RecoveryGuide,
	ServerFilter,
	ServerInfo,
	SessionInfo,
	TaskBundle,
	ToolDescriptor,
	ToolRequest,
	ToolResponse,
	ToolType,
	UserIdentity,
} from "../kernel/types.js";

export { DEFAULT_KERNEL_CONFIG, ErrorType } from "../kernel/types.js";
