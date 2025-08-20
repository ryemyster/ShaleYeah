/**
 * MCP Pipeline State Manager
 * Manages pipeline state and agent coordination through resources
 */

import type { 
  PipelineState, 
  PipelineStateManager,
  MCPResourceServer 
} from './mcp-types.js';

export class MCPPipelineStateManager implements PipelineStateManager {
  private server: MCPResourceServer;
  private stateUri = 'mcp://shale-data/state/pipeline-state';
  private agentStatusUri = 'mcp://shale-data/state/agent-status';
  private resourceStatusUri = 'mcp://shale-data/state/resource-status';
  private logger: Console;

  constructor(server: MCPResourceServer) {
    this.server = server;
    this.logger = console;
  }

  async getCurrentState(): Promise<PipelineState> {
    try {
      const state = await this.server.getResource(this.stateUri);
      return state.current as PipelineState;
    } catch {
      // Default state if not found
      return PipelineState.INITIALIZING;
    }
  }

  async setState(state: PipelineState): Promise<void> {
    const stateData = {
      current: state,
      timestamp: Date.now(),
      history: await this.getStateHistory()
    };

    await this.server.putResource(this.stateUri, stateData);
    this.logger.info(`🔄 Pipeline state changed to: ${state}`);
  }

  async getReadyAgents(): Promise<string[]> {
    try {
      const agentStatus = await this.server.getResource(this.agentStatusUri);
      return agentStatus.ready || [];
    } catch {
      return [];
    }
  }

  async markAgentReady(agentName: string): Promise<void> {
    const agentStatus = await this.getAgentStatus();
    
    if (!agentStatus.ready.includes(agentName)) {
      agentStatus.ready.push(agentName);
    }
    
    agentStatus.lastUpdated = Date.now();
    await this.server.putResource(this.agentStatusUri, agentStatus);
    
    this.logger.info(`✅ Agent marked ready: ${agentName}`);
  }

  async markAgentCompleted(agentName: string): Promise<void> {
    const agentStatus = await this.getAgentStatus();
    
    // Move from ready to completed
    agentStatus.ready = agentStatus.ready.filter(name => name !== agentName);
    
    if (!agentStatus.completed.includes(agentName)) {
      agentStatus.completed.push(agentName);
    }
    
    agentStatus.lastUpdated = Date.now();
    await this.server.putResource(this.agentStatusUri, agentStatus);
    
    this.logger.info(`🏁 Agent completed: ${agentName}`);
  }

  async getResourceState(uri: string): Promise<'missing' | 'available' | 'processing'> {
    try {
      const resourceStatus = await this.server.getResource(this.resourceStatusUri);
      return resourceStatus.resources[uri] || 'missing';
    } catch {
      return 'missing';
    }
  }

  async markResourceReady(uri: string): Promise<void> {
    const resourceStatus = await this.getResourceStatus();
    resourceStatus.resources[uri] = 'available';
    resourceStatus.lastUpdated = Date.now();
    
    await this.server.putResource(this.resourceStatusUri, resourceStatus);
    this.logger.info(`📁 Resource marked ready: ${uri}`);
  }

  async waitForPipelineState(state: PipelineState, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    // Check current state first
    const currentState = await this.getCurrentState();
    if (currentState === state) {
      return;
    }

    this.logger.info(`⏳ Waiting for pipeline state: ${state}`);

    return new Promise<void>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for pipeline state: ${state}`));
      }, timeout);

      try {
        // Watch for state changes
        for await (const event of this.server.watchResource(this.stateUri)) {
          if (event.type === 'updated') {
            const newState = await this.getCurrentState();
            if (newState === state) {
              clearTimeout(timeoutId);
              const waitTime = Date.now() - startTime;
              this.logger.info(`✅ Pipeline state reached after ${waitTime}ms: ${state}`);
              resolve();
              break;
            }
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private async getStateHistory(): Promise<Array<{ state: PipelineState; timestamp: number }>> {
    try {
      const currentData = await this.server.getResource(this.stateUri);
      return currentData.history || [];
    } catch {
      return [];
    }
  }

  private async getAgentStatus(): Promise<any> {
    try {
      return await this.server.getResource(this.agentStatusUri);
    } catch {
      return {
        ready: [],
        completed: [],
        failed: [],
        lastUpdated: Date.now()
      };
    }
  }

  private async getResourceStatus(): Promise<any> {
    try {
      return await this.server.getResource(this.resourceStatusUri);
    } catch {
      return {
        resources: {},
        lastUpdated: Date.now()
      };
    }
  }
}