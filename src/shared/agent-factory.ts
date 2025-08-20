/**
 * Shared Agent Factory Pattern
 * DRY principle: Consolidates agent initialization and instantiation logic
 */

import type { AgentPersona, AgentConfig, MCPAgentResourceConfig } from './types.js';
import { BaseAgent } from './base-agent.js';
import { AgentErrorHandler } from './agent-error-handler.js';
import { MCPResourceUtils } from './mcp-resource-utils.js';
import { getEnvironmentConfig } from './config.js';

export interface AgentFactoryConfig {
  runId: string;
  outputDir: string;
  modeOverride?: string;
  errorHandling?: {
    maxRetries?: number;
    retryDelay?: number;
    escalationThreshold?: 'low' | 'medium' | 'high';
  };
}

export interface AgentInitializationOptions {
  validateOutputs?: boolean;
  setupMCPResources?: boolean;
  enableErrorHandling?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export class AgentFactory {
  private static instances = new Map<string, BaseAgent>();
  private config: AgentFactoryConfig;
  
  constructor(config: AgentFactoryConfig) {
    this.config = config;
  }

  /**
   * Create or get existing agent instance
   */
  static create<T extends BaseAgent>(
    AgentClass: new (runId: string, outputDir: string, modeOverride?: string) => T,
    config: AgentFactoryConfig,
    options: AgentInitializationOptions = {}
  ): T {
    const instanceKey = `${AgentClass.name}-${config.runId}`;
    
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey) as T;
    }

    // Create new instance
    const agent = new AgentClass(config.runId, config.outputDir, config.modeOverride);
    
    // Apply factory initialization
    this.initializeAgent(agent, config, options);
    
    this.instances.set(instanceKey, agent);
    return agent;
  }

  /**
   * Common agent initialization logic
   */
  private static initializeAgent(
    agent: BaseAgent, 
    config: AgentFactoryConfig, 
    options: AgentInitializationOptions
  ): void {
    // Setup error handling if enabled
    if (options.enableErrorHandling !== false) {
      const errorHandler = new AgentErrorHandler(
        agent.persona.name,
        console, // Logger
        config.errorHandling || {}
      );
      
      // Inject error handler into agent (if base agent supports it)
      if ('setErrorHandler' in agent) {
        (agent as any).setErrorHandler(errorHandler);
      }
    }

    // Validate environment
    const envConfig = getEnvironmentConfig(config.modeOverride);
    if (!envConfig.runId) {
      throw new Error(`Agent factory requires valid runId, got: ${config.runId}`);
    }

    // Setup MCP resources if enabled
    if (options.setupMCPResources) {
      this.setupMCPResourceIntegration(agent);
    }

    // Log initialization
    console.info(`🏭 Agent factory initialized: ${agent.persona.name} (${config.runId})`);
  }

  /**
   * Setup MCP resource integration for agent
   */
  private static setupMCPResourceIntegration(agent: BaseAgent): void {
    // Add MCP resource helpers to agent instance
    if ('mcpResources' in agent) {
      (agent as any).mcpResources = {
        inputs: MCPResourceUtils.inputs,
        outputs: MCPResourceUtils.outputs,
        state: MCPResourceUtils.state,
        buildUri: MCPResourceUtils.buildUri.bind(MCPResourceUtils),
        matchesPattern: MCPResourceUtils.matchesPattern.bind(MCPResourceUtils),
        extractKey: MCPResourceUtils.extractKey.bind(MCPResourceUtils)
      };
    }
  }

  /**
   * Create agent from YAML configuration
   */
  static createFromConfig(
    yamlConfig: AgentConfig & MCPAgentResourceConfig,
    config: AgentFactoryConfig,
    options: AgentInitializationOptions = {}
  ): BaseAgent {
    // Create persona from YAML config
    const persona: AgentPersona = {
      name: yamlConfig.persona?.name || yamlConfig.name,
      role: yamlConfig.persona?.role || yamlConfig.description || 'Agent',
      experience: yamlConfig.persona?.experience || 'Experienced professional',
      personality: yamlConfig.persona?.personality || 'Professional and analytical',
      llmInstructions: yamlConfig.persona?.llmInstructions || yamlConfig.description || '',
      decisionAuthority: yamlConfig.persona?.decisionAuthority || 'operational',
      confidenceThreshold: yamlConfig.persona?.confidenceThreshold || 0.75,
      escalationCriteria: yamlConfig.persona?.escalationCriteria || []
    };

    // Create base agent with YAML-derived persona
    const agent = new BaseAgent(config.runId, config.outputDir, yamlConfig.name, persona, config.modeOverride);
    
    // Apply factory initialization
    this.initializeAgent(agent, config, options);
    
    // Set MCP resource configuration
    if (yamlConfig.resources) {
      (agent as any).mcpResourceConfig = yamlConfig.resources;
    }

    const instanceKey = `${yamlConfig.name}-${config.runId}`;
    this.instances.set(instanceKey, agent);
    
    return agent;
  }

  /**
   * Bulk create agents from registry
   */
  static createAgentsFromRegistry(
    agentRegistry: Map<string, AgentConfig & MCPAgentResourceConfig>,
    config: AgentFactoryConfig,
    options: AgentInitializationOptions = {}
  ): Map<string, BaseAgent> {
    const agents = new Map<string, BaseAgent>();
    
    for (const [agentName, agentConfig] of agentRegistry) {
      try {
        const agent = this.createFromConfig(agentConfig, config, options);
        agents.set(agentName, agent);
        console.info(`✅ Factory created agent: ${agentName}`);
      } catch (error) {
        console.error(`❌ Factory failed to create agent ${agentName}:`, error);
      }
    }
    
    return agents;
  }

  /**
   * Validate agent against expected outputs
   */
  static validateAgentOutputs(agent: BaseAgent, expectedOutputs: string[]): boolean {
    // This would validate that the agent has the capability to produce expected outputs
    // Implementation depends on agent interface
    return expectedOutputs.length > 0;
  }

  /**
   * Clean up agent instances
   */
  static cleanup(runId?: string): void {
    if (runId) {
      // Clean up specific run
      for (const [key, agent] of this.instances) {
        if (key.includes(runId)) {
          this.instances.delete(key);
          console.info(`🧹 Cleaned up agent: ${key}`);
        }
      }
    } else {
      // Clean up all instances
      this.instances.clear();
      console.info(`🧹 Cleaned up all agent instances`);
    }
  }

  /**
   * Get agent registry statistics
   */
  static getStats(): {
    totalAgents: number;
    agentsByRun: Record<string, number>;
    agentTypes: string[];
  } {
    const stats = {
      totalAgents: this.instances.size,
      agentsByRun: {} as Record<string, number>,
      agentTypes: [] as string[]
    };

    for (const [key] of this.instances) {
      const [agentType, runId] = key.split('-');
      
      if (!stats.agentTypes.includes(agentType)) {
        stats.agentTypes.push(agentType);
      }
      
      stats.agentsByRun[runId] = (stats.agentsByRun[runId] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Convenience functions for common agent types
 */
export class AgentFactoryHelpers {
  /**
   * Create geological analysis agent
   */
  static createGeowizAgent(config: AgentFactoryConfig): BaseAgent {
    // Import GeoWizAgent dynamically to avoid circular imports
    return AgentFactory.createFromConfig({
      name: 'geowiz',
      description: 'Geological analysis and zone identification',
      persona: {
        name: 'Marcus Aurelius Geologicus',
        role: 'Senior Petroleum Geologist',
        experience: '15+ years commanding geological surveys',
        personality: 'Stoic, detail-oriented, analytically disciplined',
        llmInstructions: 'Analyze geological data with stoic wisdom',
        decisionAuthority: 'geological_assessment',
        confidenceThreshold: 0.75,
        escalationCriteria: ['geological_confidence < 0.6']
      },
      resources: {
        inputs: [
          { uri: MCPResourceUtils.inputs.lasFiles(), required: true, condition: 'not-empty' }
        ],
        outputs: [
          { uri: MCPResourceUtils.outputs.geology.summary(), format: 'markdown' },
          { uri: MCPResourceUtils.outputs.geology.zones(), format: 'geojson' }
        ]
      },
      cli: {
        entrypoint: 'npx tsx src/agents/geowiz.ts',
        args: ['--run-id', '${RUN_ID}', '--output', '${OUT_DIR}']
      },
      errorHandling: {
        retryAttempts: 3,
        timeout: 300,
        escalationLevel: 'medium'
      }
    } as AgentConfig & MCPAgentResourceConfig, config, {
      enableErrorHandling: true,
      setupMCPResources: true
    });
  }

  /**
   * Create investment reporting agent
   */
  static createReporterAgent(config: AgentFactoryConfig): BaseAgent {
    return AgentFactory.createFromConfig({
      name: 'reporter',
      description: 'Executive investment report generation',
      persona: {
        name: 'Cicero Reporticus Maximus',
        role: 'Supreme Executive Scribe & Investment Herald',
        experience: '8+ years serving the imperial council',
        personality: 'Eloquently detailed, clear herald, synthesis master',
        llmInstructions: 'Synthesize investment intelligence for senatorial review',
        decisionAuthority: 'executive_reporting',
        confidenceThreshold: 0.8,
        escalationCriteria: ['conflicting_agent_recommendations']
      },
      resources: {
        inputs: [
          { uri: MCPResourceUtils.buildUri('outputs', '**'), required: false, condition: 'exists' }
        ],
        outputs: [
          { uri: MCPResourceUtils.outputs.report.final(), format: 'markdown' }
        ]
      },
      cli: {
        entrypoint: 'npx tsx src/agents/reporter.ts',
        args: ['--run-id', '${RUN_ID}', '--output', '${OUT_DIR}']
      },
      errorHandling: {
        retryAttempts: 2,
        timeout: 180,
        escalationLevel: 'low'
      }
    } as AgentConfig & MCPAgentResourceConfig, config, {
      enableErrorHandling: true,
      setupMCPResources: true
    });
  }
}