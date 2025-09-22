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