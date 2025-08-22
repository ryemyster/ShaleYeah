/**
 * MCP (Model Context Protocol) Resource Types
 * Defines proper resource-based architecture for agent coordination
 */

export interface MCPResource {
  uri: string;
  type: 'file' | 'data' | 'stream' | 'config';
  format: 'json' | 'geojson' | 'markdown' | 'csv' | 'las' | 'binary';
  metadata: MCPResourceMeta;
  available: boolean;
  lastModified: number;
}

export interface MCPResourceMeta {
  description: string;
  schema?: any;
  size?: number;
  checksum?: string;
  dependencies?: string[];
  tags?: string[];
  version?: string;
}

export interface MCPResourceServer {
  // Resource discovery
  listResources(): Promise<MCPResource[]>;
  listResourcesByPattern(pattern: string): Promise<MCPResource[]>;
  
  // Resource access
  getResource(uri: string): Promise<any>;
  putResource(uri: string, data: any, meta?: Partial<MCPResourceMeta>): Promise<void>;
  deleteResource(uri: string): Promise<void>;
  
  // Resource watching
  watchResource(uri: string): AsyncIterable<MCPResourceEvent>;
  watchPattern(pattern: string): AsyncIterable<MCPResourceEvent>;
  
  // Resource metadata
  getResourceMeta(uri: string): Promise<MCPResourceMeta>;
  resourceExists(uri: string): Promise<boolean>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface MCPResourceEvent {
  type: 'created' | 'updated' | 'deleted';
  uri: string;
  timestamp: number;
  resource?: MCPResource;
}

export interface MCPResourceClient {
  // Client interface for agents to use
  getResource<T = any>(uri: string): Promise<T>;
  putResource(uri: string, data: any): Promise<void>;
  waitForResource<T = any>(uri: string, timeout?: number): Promise<T>;
  
  // Dependency management
  checkDependencies(dependencies: MCPResourceDependency[]): Promise<boolean>;
  waitForDependencies(dependencies: MCPResourceDependency[]): Promise<void>;
  
  // Discovery
  discoverResources(pattern: string): Promise<MCPResource[]>;
}

export interface MCPResourceDependency {
  uri: string;
  condition: 'exists' | 'not-empty' | 'valid-schema';
  required: boolean;
  timeout?: number;
}

export interface MCPAgentResourceConfig {
  inputs: MCPResourceDependency[];
  outputs: {
    uri: string;
    format: string;
    description: string;
  }[];
}

export enum PipelineState {
  INITIALIZING = "initializing",
  WAITING_FOR_INPUTS = "waiting_for_inputs", 
  AGENTS_READY = "agents_ready",
  PROCESSING = "processing",
  OUTPUTS_AVAILABLE = "outputs_available",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface PipelineStateManager {
  getCurrentState(): Promise<PipelineState>;
  setState(state: PipelineState): Promise<void>;
  
  getReadyAgents(): Promise<string[]>;
  markAgentReady(agentName: string): Promise<void>;
  markAgentCompleted(agentName: string): Promise<void>;
  
  getResourceState(uri: string): Promise<'missing' | 'available' | 'processing'>;
  markResourceReady(uri: string): Promise<void>;
  
  waitForPipelineState(state: PipelineState, timeout?: number): Promise<void>;
}