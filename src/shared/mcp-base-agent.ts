/**
 * MCP-Enabled Base Agent Class
 * Extends BaseAgent with proper MCP resource-based coordination
 */

import type { 
  AgentPersona, 
  AgentResult,
  MCPResourceClient,
  MCPResourceDependency,
  MCPAgentResourceConfig 
} from './types.js';
import { BaseAgent } from './base-agent.js';
import { MCPResourceClientImpl } from './mcp-resource-client.js';
import type { MCPResourceServer } from './mcp-types.js';

export abstract class MCPBaseAgent extends BaseAgent {
  protected mcpClient: MCPResourceClient;
  protected resourceConfig: MCPAgentResourceConfig;

  constructor(
    runId: string, 
    outputDir: string, 
    agentName: string, 
    persona: AgentPersona,
    mcpServer: MCPResourceServer,
    resourceConfig: MCPAgentResourceConfig,
    modeOverride?: string
  ) {
    super(runId, outputDir, agentName, persona, modeOverride);
    this.mcpClient = new MCPResourceClientImpl(mcpServer, agentName);
    this.resourceConfig = resourceConfig;
  }

  /**
   * MCP-aware agent execution with resource dependency management
   */
  async executeMCP(): Promise<AgentResult> {
    const startTime = Date.now();
    this.logger.info(`🎯 ${this.persona.name} starting MCP-based analysis...`);

    try {
      // Phase 1: Check and wait for dependencies
      await this.ensureDependencies();
      
      // Phase 2: Discover and load input resources
      const inputData = await this.loadMCPInputs();
      
      // Phase 3: Perform analysis
      const result = await this.analyze(inputData);
      
      // Phase 4: Publish outputs as MCP resources
      await this.publishMCPOutputs(result);
      
      const executionTime = Date.now() - startTime;
      this.logger.info(`✅ ${this.persona.name} MCP execution completed in ${executionTime}ms`);

      return {
        ...result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ ${this.persona.name} MCP execution failed after ${executionTime}ms:`, error);

      return {
        success: false,
        confidence: 0,
        outputs: {},
        errors: [String(error)],
        executionTime
      };
    }
  }

  /**
   * Check and wait for all required dependencies
   */
  private async ensureDependencies(): Promise<void> {
    this.logger.info(`🔍 ${this.persona.name} checking dependencies...`);
    
    // Check if dependencies are already satisfied
    const dependenciesMet = await this.mcpClient.checkDependencies(this.resourceConfig.inputs);
    
    if (!dependenciesMet) {
      this.logger.info(`⏳ ${this.persona.name} waiting for dependencies...`);
      await this.mcpClient.waitForDependencies(this.resourceConfig.inputs);
    }
    
    this.logger.info(`✅ ${this.persona.name} all dependencies satisfied`);
  }

  /**
   * Load inputs from MCP resources
   */
  private async loadMCPInputs(): Promise<any> {
    const inputData: Record<string, any> = {};
    
    for (const inputDep of this.resourceConfig.inputs) {
      try {
        if (inputDep.uri.includes('**')) {
          // Handle pattern-based inputs (multiple resources)
          const resources = await this.mcpClient.discoverResources(inputDep.uri);
          const resourceData = await Promise.all(
            resources.map(async (resource) => ({
              uri: resource.uri,
              data: await this.mcpClient.getResource(resource.uri)
            }))
          );
          inputData[this.getInputKeyFromUri(inputDep.uri)] = resourceData;
        } else {
          // Handle single resource
          const resource = await this.mcpClient.getResource(inputDep.uri);
          inputData[this.getInputKeyFromUri(inputDep.uri)] = resource;
        }
      } catch (error) {
        if (inputDep.required) {
          throw error;
        } else {
          this.logger.warn(`⚠️  Optional input not available: ${inputDep.uri}`);
        }
      }
    }
    
    return inputData;
  }

  /**
   * Publish analysis results as MCP resources
   */
  private async publishMCPOutputs(result: AgentResult): Promise<void> {
    if (!result.success) {
      this.logger.warn(`⚠️  ${this.persona.name} analysis failed, skipping output publishing`);
      return;
    }

    for (const outputConfig of this.resourceConfig.outputs) {
      const outputData = result.outputs[this.getOutputKeyFromUri(outputConfig.uri)];
      
      if (outputData !== undefined) {
        await this.mcpClient.putResource(outputConfig.uri, outputData);
        this.logger.info(`📤 ${this.persona.name} published: ${outputConfig.uri}`);
      } else {
        this.logger.warn(`⚠️  Expected output not found: ${outputConfig.uri}`);
      }
    }
  }

  /**
   * Extract key name from MCP URI for data mapping
   */
  private getInputKeyFromUri(uri: string): string {
    // Extract meaningful key from URI
    // e.g., "mcp://shale-data/inputs/las-files/**" -> "las-files"
    const parts = uri.replace('mcp://shale-data/', '').split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace('**', '').replace('*', '');
    }
    return uri.split('/').pop() || uri;
  }

  private getOutputKeyFromUri(uri: string): string {
    // e.g., "mcp://shale-data/outputs/geology-summary" -> "geology-summary"
    return uri.split('/').pop() || uri;
  }

  /**
   * MCP-aware resource-based input loading (replaces loadInputData)
   */
  protected async loadMCPResource<T = any>(uri: string, fallbackData?: T): Promise<T> {
    try {
      return await this.mcpClient.getResource<T>(uri);
    } catch (error) {
      if (fallbackData !== undefined) {
        this.logger.info(`📊 ${this.persona.name} using fallback data for: ${uri}`);
        return fallbackData;
      }
      throw new Error(`MCP resource not found and no fallback provided: ${uri}`);
    }
  }

  /**
   * Publish data to MCP resource
   */
  protected async publishMCPResource(uri: string, data: any): Promise<void> {
    await this.mcpClient.putResource(uri, data);
  }

  /**
   * Wait for a specific resource to become available
   */
  protected async waitForMCPResource<T = any>(uri: string, timeout?: number): Promise<T> {
    return await this.mcpClient.waitForResource<T>(uri, timeout);
  }

  /**
   * Check if resource is available without waiting
   */
  protected async isMCPResourceAvailable(uri: string): Promise<boolean> {
    try {
      await this.mcpClient.getResource(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abstract method for MCP-aware analysis
   * Agents should implement this instead of the base analyze method
   */
  abstract analyzeMCP(inputData: any): Promise<AgentResult>;

  /**
   * Default implementation routes to MCP analysis
   */
  async analyze(inputData: any): Promise<AgentResult> {
    return await this.analyzeMCP(inputData);
  }
}