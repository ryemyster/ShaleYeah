#!/usr/bin/env node
/**
 * SHALE YEAH MCP Controller v2 - Proper Resource-Based Architecture
 * 
 * **RESOURCE-BASED COORDINATION:** Agents pull from MCP resources, not push orchestration
 * 
 * This MCP implementation follows proper Model Context Protocol patterns:
 * - Agents discover and pull resources they need
 * - Loose coupling through resource URIs
 * - Event-driven coordination via resource state changes
 * - Parallel execution when dependencies are satisfied
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import type {
  AgentConfig,
  PipelineState,
  MCPAgentResourceConfig,
  EnvironmentConfig
} from './shared/types.js';
import { FileSystemMCPResourceServer } from './shared/mcp-resource-server.js';
import { MCPPipelineStateManager } from './shared/mcp-pipeline-state.js';
import { 
  getEnvironmentConfig, 
  getOutputDir,
  setupLogging,
  validateEnvironment 
} from './shared/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPControllerV2 {
  private runId: string;
  private outDir: string;
  private mcpServer: FileSystemMCPResourceServer;
  private stateManager: MCPPipelineStateManager;
  private agentsDir: string;
  private config: EnvironmentConfig;
  private logger: Console;
  private agentRegistry: Map<string, AgentConfig & MCPAgentResourceConfig> = new Map();
  
  constructor(runId?: string, outDir?: string, modeOverride?: string) {
    this.config = getEnvironmentConfig(modeOverride);
    this.runId = runId || this.config.runId;
    this.outDir = outDir || getOutputDir(this.runId);
    this.agentsDir = path.join(process.cwd(), '.claude', 'agents');
    this.logger = console;

    // Initialize MCP resource server
    const resourceRoot = path.join(this.outDir, 'mcp-resources');
    this.mcpServer = new FileSystemMCPResourceServer(resourceRoot);
    this.stateManager = new MCPPipelineStateManager(this.mcpServer);

    setupLogging();
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Initialize MCP resource server
      await this.mcpServer.initialize();
      
      // Load agent registry with MCP configs
      await this.loadMCPAgentRegistry();
      
      // Ensure output directory exists
      await fs.mkdir(this.outDir, { recursive: true });
      
      // Initialize pipeline state
      await this.stateManager.setState(PipelineState.INITIALIZING);
      
      this.logger.info(`🎯 SHALE YEAH MCP v2 initialized for run: ${this.runId}`);
      this.logger.info(`📁 Resource root: ${this.mcpServer['resourceRoot']}`);
      this.logger.info(`🤖 Loaded ${this.agentRegistry.size} MCP-enabled agents`);
      
    } catch (error) {
      this.logger.error('❌ MCP v2 initialization failed:', error);
      throw error;
    }
  }

  private async loadMCPAgentRegistry(): Promise<void> {
    try {
      const yamlFiles = await fs.readdir(this.agentsDir);
      
      for (const file of yamlFiles) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
        
        try {
          const filePath = path.join(this.agentsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const agentConfig = YAML.parse(content) as AgentConfig & MCPAgentResourceConfig;
          
          if (agentConfig.name && agentConfig.resources) {
            this.agentRegistry.set(agentConfig.name, agentConfig);
            this.logger.info(`📋 Loaded MCP agent: ${agentConfig.name} (${agentConfig.resources.inputs.length} inputs, ${agentConfig.resources.outputs.length} outputs)`);
          } else if (agentConfig.name) {
            this.logger.warn(`⚠️  Agent ${agentConfig.name} missing MCP resource configuration`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to load agent ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to load MCP agent registry:', error);
      throw error;
    }
  }

  /**
   * Setup initial resources from input data
   */
  async setupInitialResources(inputDataDir: string = './data/samples'): Promise<void> {
    this.logger.info('📂 Setting up initial MCP resources...');
    
    try {
      // Copy sample data to MCP resources
      const inputsDir = path.resolve(inputDataDir);
      const stats = await fs.stat(inputsDir);
      
      if (stats.isDirectory()) {
        await this.copyDirectoryToMCPResources(inputsDir, 'inputs');
      }
      
      // Mark input resources as ready
      await this.stateManager.setState(PipelineState.WAITING_FOR_INPUTS);
      
      this.logger.info('✅ Initial resources setup complete');
    } catch (error) {
      this.logger.error('❌ Failed to setup initial resources:', error);
      throw error;
    }
  }

  private async copyDirectoryToMCPResources(sourceDir: string, targetPath: string): Promise<void> {
    const files = await fs.readdir(sourceDir, { withFileTypes: true });
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file.name);
      const targetUri = `mcp://shale-data/${targetPath}/${file.name}`;
      
      if (file.isFile()) {
        try {
          const content = await fs.readFile(sourcePath, 'utf8');
          await this.mcpServer.putResource(targetUri, content);
          this.logger.info(`📁 Copied to MCP: ${targetUri}`);
        } catch (error) {
          this.logger.warn(`⚠️  Failed to copy ${sourcePath}:`, error);
        }
      } else if (file.isDirectory()) {
        await this.copyDirectoryToMCPResources(sourcePath, `${targetPath}/${file.name}`);
      }
    }
  }

  /**
   * Get agents that are ready to execute (all dependencies satisfied)
   */
  async getReadyAgents(): Promise<string[]> {
    const readyAgents: string[] = [];
    
    for (const [agentName, agentConfig] of this.agentRegistry) {
      const isReady = await this.checkAgentReadiness(agentName, agentConfig);
      if (isReady) {
        readyAgents.push(agentName);
      }
    }
    
    return readyAgents;
  }

  private async checkAgentReadiness(agentName: string, agentConfig: AgentConfig & MCPAgentResourceConfig): Promise<boolean> {
    // Check if agent is already completed
    const completedAgents = await this.getCompletedAgents();
    if (completedAgents.includes(agentName)) {
      return false;
    }

    // Check if all required dependencies are available
    for (const inputDep of agentConfig.resources.inputs) {
      if (inputDep.required) {
        if (inputDep.uri.includes('**')) {
          // Pattern-based dependency - check if any resources match
          const resources = await this.mcpServer.listResourcesByPattern(inputDep.uri);
          if (resources.length === 0) {
            return false;
          }
        } else {
          // Single resource dependency
          const exists = await this.mcpServer.resourceExists(inputDep.uri);
          if (!exists) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private async getCompletedAgents(): Promise<string[]> {
    try {
      const agentStatus = await this.mcpServer.getResource('mcp://shale-data/state/agent-status');
      return agentStatus.completed || [];
    } catch {
      return [];
    }
  }

  /**
   * Execute a specific agent using MCP resources
   */
  async executeAgent(agentName: string): Promise<boolean> {
    const agentConfig = this.agentRegistry.get(agentName);
    if (!agentConfig) {
      this.logger.error(`❌ Agent ${agentName} not found in MCP registry`);
      return false;
    }

    this.logger.info(`🎯 Executing MCP agent: ${agentName}`);
    const startTime = Date.now();

    try {
      // Mark agent as ready in state
      await this.stateManager.markAgentReady(agentName);
      
      // Execute agent CLI with MCP environment
      const env = { ...process.env };
      env.RUN_ID = this.runId;
      env.OUT_DIR = this.outDir;
      env.MCP_RESOURCE_ROOT = path.join(this.outDir, 'mcp-resources');
      env.MCP_MODE = 'true';

      const success = await this.runAgentCommand(agentConfig, env);
      const executionTime = Date.now() - startTime;

      if (success) {
        this.logger.info(`✅ MCP agent ${agentName} completed in ${executionTime}ms`);
        await this.stateManager.markAgentCompleted(agentName);
        
        // Mark output resources as ready
        for (const output of agentConfig.resources.outputs) {
          await this.stateManager.markResourceReady(output.uri);
        }
      } else {
        this.logger.error(`❌ MCP agent ${agentName} failed`);
      }

      return success;
    } catch (error) {
      this.logger.error(`❌ MCP agent ${agentName} execution failed:`, error);
      return false;
    }
  }

  private async runAgentCommand(agentConfig: AgentConfig, env: NodeJS.ProcessEnv): Promise<boolean> {
    // For now, use the existing CLI execution
    // In a full implementation, this would instantiate the MCP-aware agent classes
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const [cmd, ...args] = agentConfig.cli.entrypoint.split(' ');
      const processedArgs = agentConfig.cli.args.map(arg => 
        arg.replace('${RUN_ID}', this.runId).replace('${OUT_DIR}', this.outDir)
      );
      
      const child = spawn(cmd, [...args, ...processedArgs], { 
        env, 
        stdio: ['inherit', 'inherit', 'inherit'] 
      });

      const timeout = agentConfig.errorHandling?.timeout || 300;
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve(false);
      }, timeout * 1000);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code === 0);
      });

      child.on('error', () => {
        clearTimeout(timeoutId);
        resolve(false);
      });
    });
  }

  /**
   * Run the MCP-based pipeline with proper resource coordination
   */
  async runMCPPipeline(goal: string = 'tract_eval', inputDataDir?: string): Promise<boolean> {
    // Validate environment
    const validation = validateEnvironment();
    if (validation.errors.length > 0) {
      for (const error of validation.errors) {
        this.logger.error(`❌ ${error}`);
      }
      return false;
    }

    this.logger.info(`🚀 Starting MCP v2 pipeline for goal: ${goal}`);
    
    // Setup initial resources
    if (inputDataDir) {
      await this.setupInitialResources(inputDataDir);
    }

    await this.stateManager.setState(PipelineState.AGENTS_READY);

    let iteration = 0;
    const maxIterations = 20;
    let hasProgress = true;

    while (hasProgress && iteration < maxIterations) {
      iteration++;
      this.logger.info(`📈 MCP Pipeline iteration ${iteration}`);
      
      // Get agents that are ready to execute
      const readyAgents = await this.getReadyAgents();
      
      if (readyAgents.length === 0) {
        // Check if we're done or stuck
        const completedAgents = await this.getCompletedAgents();
        if (completedAgents.length === this.agentRegistry.size) {
          this.logger.info('🏁 All agents completed');
          break;
        } else {
          this.logger.warn('⚠️  No agents ready and not all completed - pipeline may be stuck');
          hasProgress = false;
          break;
        }
      }

      await this.stateManager.setState(PipelineState.PROCESSING);

      // Execute ready agents in parallel
      const agentPromises = readyAgents.map(agentName => this.executeAgent(agentName));
      const results = await Promise.allSettled(agentPromises);
      
      // Check if any agent succeeded (indicating progress)
      const successes = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      );

      if (successes.length === 0) {
        this.logger.warn('⚠️  No agents succeeded in this iteration');
        hasProgress = false;
      }

      // Small delay between iterations to allow resource propagation
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final state
    const completedAgents = await this.getCompletedAgents();
    const success = completedAgents.length > 0;
    
    await this.stateManager.setState(success ? PipelineState.COMPLETED : PipelineState.FAILED);
    
    this.logger.info(`🏁 MCP Pipeline completed. Success: ${success}`);
    this.logger.info(`✅ Agents completed: ${completedAgents.length}/${this.agentRegistry.size}`);
    
    return success;
  }

  /**
   * Shutdown the MCP controller
   */
  async shutdown(): Promise<void> {
    await this.mcpServer.shutdown();
    this.logger.info('🔄 MCP Controller v2 shutdown complete');
  }
}

/**
 * CLI entry point for MCP v2
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      argMap[args[i].slice(2)] = args[i + 1] || 'true';
    }
  }
  
  const goal = argMap.goal || 'tract_eval';
  const runId = argMap['run-id'] || undefined;
  const outDir = argMap['out-dir'] || undefined;
  const mode = argMap.mode || undefined;
  const inputDir = argMap['input-dir'] || './data/samples';
  
  if (argMap.help || argMap.h) {
    console.log(`
🛢️  SHALE YEAH MCP Controller v2 - Resource-Based Architecture

USAGE:
  npx tsx src/mcp-controller-v2.ts --mode=demo --goal=tract_eval
  
OPTIONS:
  --mode <mode>        Pipeline mode: demo, production, batch, research
  --goal <goal>        Pipeline goal (default: tract_eval)
  --run-id <id>        Unique run identifier
  --out-dir <dir>      Output directory
  --input-dir <dir>    Input data directory (default: ./data/samples)
  --help, -h           Show this help

FEATURES:
  ✅ Proper MCP resource-based architecture
  ✅ Agents pull resources on-demand
  ✅ Parallel execution when dependencies met
  ✅ Event-driven coordination
  ✅ Loose coupling between agents
    `);
    process.exit(0);
  }
  
  try {
    const mcp = new MCPControllerV2(runId, outDir, mode);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const success = await mcp.runMCPPipeline(goal, inputDir);
    
    await mcp.shutdown();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ MCP v2 failed:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}