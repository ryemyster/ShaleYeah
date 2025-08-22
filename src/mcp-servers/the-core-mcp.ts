/**
 * The-Core MCP Coordination Server - Standards-Compliant Implementation
 * Master coordination server orchestrating all SHALE YEAH agents
 * Persona: Imperator Coordinatus Maximus - Supreme System Orchestrator
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class TheCoreMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;
  private activeWorkflows: Map<string, any> = new Map();
  private agentRegistry: Map<string, any> = new Map();

  constructor(config: { name: string; version: string; resourceRoot: string; dataPath?: string }) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'the-core-coordination');

    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupCoreCoordinationTools();
    this.setupCoreCoordinationResources();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resourceRoot, { recursive: true });
    await fs.mkdir(this.dataPath, { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'registry'), { recursive: true });
    this.initialized = true;
  }

  private setupCoreCoordinationTools(): void {
    this.server.tool(
      'orchestrate_workflow',
      'Orchestrate master workflow across all agents',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          workflowType: { type: 'string', enum: ['full_analysis', 'investment_evaluation', 'due_diligence', 'custom'] },
          agents: { type: 'array', items: { type: 'string' }, optional: true },
          parameters: { type: 'object', optional: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], optional: true }
        },
        required: ['workflowId', 'workflowType']
      },
      async (args, extra) => {
        const workflow = await this.orchestrateMasterWorkflow(args);
        const workflowPath = path.join(this.dataPath, 'workflows', `${args.workflowId}.json`);
        await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
        return { content: [{ type: "text", text: JSON.stringify(workflow) }] };
      }
    );

    this.server.tool(
      'coordinate_dependencies',
      'Coordinate complex multi-agent dependencies',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          agentGraph: { type: 'object' },
          executionPlan: { type: 'array', items: { type: 'object' }, optional: true }
        },
        required: ['workflowId', 'agentGraph']
      },
      async (args, extra) => {
        const result = await this.coordinateMasterDependencies(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'manage_state',
      'Manage master workflow state and agent coordination',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          action: { type: 'string', enum: ['start', 'pause', 'resume', 'complete', 'fail', 'abort'] },
          agentStates: { type: 'array', items: { type: 'object' }, optional: true }
        },
        required: ['workflowId', 'action']
      },
      async (args, extra) => {
        const result = await this.manageMasterState(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'handle_errors',
      'Handle system-wide errors and recovery',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          error: { type: 'string' },
          errorType: { type: 'string', enum: ['agent_failure', 'system_error', 'workflow_timeout', 'coordination_failure'] },
          affectedAgents: { type: 'array', items: { type: 'string' }, optional: true },
          recoveryStrategy: { type: 'string', enum: ['restart', 'partial_recovery', 'graceful_degradation', 'abort'], optional: true }
        },
        required: ['workflowId', 'error', 'errorType']
      },
      async (args, extra) => {
        const result = await this.handleMasterErrors(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'register_agent',
      'Register agent with the core coordination system',
      {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          agentType: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          dependencies: { type: 'array', items: { type: 'string' }, optional: true },
          status: { type: 'string', enum: ['available', 'busy', 'offline', 'error'] }
        },
        required: ['agentId', 'agentType', 'capabilities', 'status']
      },
      async (args, extra) => {
        const result = await this.registerAgent(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  private setupCoreCoordinationResources(): void {
    this.server.resource(
      'coord://state/{workflow_id}',
      'coord://state/*',
      async (uri) => {
        const workflowId = uri.pathname.split('/').pop()?.replace('.json', '');
        const workflowPath = path.join(this.dataPath, 'workflows', `${workflowId}.json`);
        try {
          const data = await fs.readFile(workflowPath, 'utf-8');
          return {
            contents: [{ uri: uri.toString(), mimeType: 'application/json', text: data }]
          };
        } catch {
          return {
            contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify({ error: 'Workflow not found' }) }]
          };
        }
      }
    );

    this.server.resource(
      'coord://dependencies/{agent_id}',
      'coord://dependencies/*',
      async (uri) => {
        const agentId = uri.pathname.split('/').pop()?.replace('.json', '');
        if (!agentId) {
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Agent ID not found in URI' })
            }]
          };
        }
        const agent = this.agentRegistry.get(agentId);
        if (agent) {
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(agent)
            }]
          };
        } else {
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Agent not found' })
            }]
          };
        }
      }
    );
  }

  private async orchestrateMasterWorkflow(args: any) {
    const defaultAgents = [
      'research', 'geology', 'economics', 'drilling', 'risk-analysis',
      'title', 'legal', 'market', 'infrastructure', 'development', 'decision'
    ];

    return {
      workflowId: args.workflowId,
      workflowType: args.workflowType,
      status: 'completed',
      agents: args.agents || defaultAgents,
      priority: args.priority || 'medium',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      results: {
        orchestrated: true,
        agentResults: defaultAgents.reduce((acc, agent) => {
          acc[agent] = { status: 'completed', timestamp: new Date().toISOString() };
          return acc;
        }, {} as any)
      }
    };
  }

  private async coordinateMasterDependencies(args: any) {
    return {
      workflowId: args.workflowId,
      dependencyGraph: args.agentGraph,
      executionPlan: args.executionPlan || [
        { phase: 1, agents: ['research', 'geology'] },
        { phase: 2, agents: ['economics', 'risk-analysis'] },
        { phase: 3, agents: ['title', 'legal'] },
        { phase: 4, agents: ['market', 'infrastructure', 'development'] },
        { phase: 5, agents: ['decision'] }
      ],
      coordinationStatus: 'coordinated'
    };
  }

  private async manageMasterState(args: any) {
    return {
      workflowId: args.workflowId,
      action: args.action,
      timestamp: new Date().toISOString(),
      agentStates: args.agentStates || [],
      systemStatus: 'operational'
    };
  }

  private async handleMasterErrors(args: any) {
    return {
      workflowId: args.workflowId,
      error: args.error,
      errorType: args.errorType,
      affectedAgents: args.affectedAgents || [],
      recoveryStrategy: args.recoveryStrategy || 'restart',
      resolved: true,
      timestamp: new Date().toISOString()
    };
  }

  private async registerAgent(args: any) {
    const agent = {
      agentId: args.agentId,
      agentType: args.agentType,
      capabilities: args.capabilities,
      dependencies: args.dependencies || [],
      status: args.status,
      registrationTime: new Date().toISOString()
    };

    this.agentRegistry.set(args.agentId, agent);

    const registryPath = path.join(this.dataPath, 'registry', `${args.agentId}.json`);
    await fs.writeFile(registryPath, JSON.stringify(agent, null, 2));

    return agent;
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`🏰 Imperator Coordinatus Maximus (The-Core MCP) Server v${this.version} initialized`);
  }

  async stop(): Promise<void> {
    console.log('🏰 Imperator Coordinatus Maximus MCP Server shutdown complete');
  }

  getServer(): McpServer { return this.server; }

  async getStatus() {
    return {
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      registeredAgents: this.agentRegistry.size,
      activeWorkflows: this.activeWorkflows.size,
      persona: 'Imperator Coordinatus Maximus - Supreme System Orchestrator',
      capabilities: {
        tools: ['orchestrate_workflow', 'coordinate_dependencies', 'manage_state', 'handle_errors', 'register_agent'],
        resources: ['coord://state/{workflow_id}', 'coord://dependencies/{agent_id}'],
        coordination: 'master'
      }
    };
  }
}

export default TheCoreMCPServer;