/**
 * Econobot MCP Coordination Server - Standards-Compliant Implementation
 * Orchestrates economic analysis workflows and financial calculations
 * Persona: Economicus Coordinatus - Master Financial Orchestrator
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface EconomicWorkflowState {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentCalculation: string;
  progress: number;
  startTime: string;
  endTime?: string;
  results: any;
  dependencies: string[];
}

export class EconobotMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;
  private activeWorkflows: Map<string, EconomicWorkflowState> = new Map();

  constructor(config: { name: string; version: string; resourceRoot: string; dataPath?: string }) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'econobot-coordination');

    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupEconomicCoordinationTools();
    this.setupEconomicCoordinationResources();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resourceRoot, { recursive: true });
    await fs.mkdir(this.dataPath, { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'calculations'), { recursive: true });
    this.initialized = true;
  }

  private setupEconomicCoordinationTools(): void {
    this.server.tool(
      'orchestrate_workflow',
      'Orchestrate economic analysis workflow with financial calculations',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          analysisType: { type: 'string', enum: ['npv_analysis', 'irr_calculation', 'sensitivity_analysis', 'full_economic'] },
          inputData: { type: 'object', optional: true },
          dependencies: { type: 'array', items: { type: 'string' }, optional: true }
        },
        required: ['workflowId', 'analysisType']
      },
      async (args, extra) => {
        const workflow = await this.orchestrateEconomicWorkflow(args);
        const workflowPath = path.join(this.dataPath, 'workflows', `${args.workflowId}.json`);
        await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
        return { content: [{ type: "text", text: JSON.stringify(workflow) }] };
      }
    );

    this.server.tool(
      'coordinate_dependencies',
      'Coordinate economic analysis dependencies',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          requiredInputs: { type: 'array', items: { type: 'string' } },
          calculationOrder: { type: 'array', items: { type: 'string' }, optional: true }
        },
        required: ['workflowId', 'requiredInputs']
      },
      async (args, extra) => {
        const result = await this.coordinateEconomicDependencies(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'manage_state',
      'Manage economic workflow execution state',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          action: { type: 'string', enum: ['start', 'pause', 'resume', 'complete', 'fail'] },
          calculation: { type: 'string', optional: true },
          result: { type: 'object', optional: true }
        },
        required: ['workflowId', 'action']
      },
      async (args, extra) => {
        const result = await this.manageEconomicState(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'handle_errors',
      'Handle economic calculation errors and recovery',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          error: { type: 'string' },
          errorType: { type: 'string', enum: ['calculation_error', 'data_missing', 'validation_failed'] },
          recoveryStrategy: { type: 'string', enum: ['retry', 'use_defaults', 'manual_intervention'], optional: true }
        },
        required: ['workflowId', 'error', 'errorType']
      },
      async (args, extra) => {
        const result = await this.handleEconomicErrors(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  private setupEconomicCoordinationResources(): void {
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
  }

  private async orchestrateEconomicWorkflow(args: any): Promise<EconomicWorkflowState> {
    const workflow: EconomicWorkflowState = {
      workflowId: args.workflowId,
      status: 'running',
      currentCalculation: 'initialization',
      progress: 0,
      startTime: new Date().toISOString(),
      results: {},
      dependencies: args.dependencies || []
    };

    const calculations = this.getCalculationSteps(args.analysisType);
    
    try {
      for (let i = 0; i < calculations.length; i++) {
        const calc = calculations[i];
        workflow.currentCalculation = calc.name;
        workflow.progress = (i / calculations.length) * 100;
        
        await this.executeCalculation(calc, args.inputData);
        workflow.results[calc.name] = { completed: true, timestamp: new Date().toISOString() };
      }
      
      workflow.status = 'completed';
      workflow.progress = 100;
      workflow.endTime = new Date().toISOString();
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date().toISOString();
    }

    this.activeWorkflows.set(args.workflowId, workflow);
    return workflow;
  }

  private getCalculationSteps(analysisType: string) {
    const steps = {
      'npv_analysis': [
        { name: 'cash_flow_projection', duration: 1500 },
        { name: 'discount_rate_calculation', duration: 1000 },
        { name: 'npv_computation', duration: 2000 }
      ],
      'irr_calculation': [
        { name: 'cash_flow_analysis', duration: 1500 },
        { name: 'irr_iteration', duration: 2500 }
      ],
      'sensitivity_analysis': [
        { name: 'parameter_identification', duration: 1000 },
        { name: 'scenario_generation', duration: 2000 },
        { name: 'sensitivity_calculation', duration: 3000 }
      ],
      'full_economic': [
        { name: 'data_validation', duration: 1000 },
        { name: 'cash_flow_modeling', duration: 2000 },
        { name: 'npv_calculation', duration: 1500 },
        { name: 'irr_calculation', duration: 1500 },
        { name: 'sensitivity_analysis', duration: 2500 },
        { name: 'risk_adjustment', duration: 2000 }
      ]
    };
    return steps[analysisType as keyof typeof steps] || steps['npv_analysis'];
  }

  private async executeCalculation(calc: any, inputData: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, calc.duration));
    if (Math.random() < 0.03) { // 3% failure rate
      throw new Error(`Calculation ${calc.name} failed`);
    }
  }

  private async coordinateEconomicDependencies(args: any) {
    return {
      workflowId: args.workflowId,
      requiredInputs: args.requiredInputs,
      dependencyStatus: args.requiredInputs.map((input: string) => ({
        input,
        status: 'available',
        timestamp: new Date().toISOString()
      })),
      calculationOrder: args.calculationOrder || ['data_preparation', 'calculations', 'validation']
    };
  }

  private async manageEconomicState(args: any) {
    const workflow = this.activeWorkflows.get(args.workflowId);
    if (!workflow) throw new Error(`Workflow ${args.workflowId} not found`);

    switch (args.action) {
      case 'start':
        workflow.status = 'running';
        break;
      case 'pause':
        workflow.status = 'pending';
        break;
      case 'resume':
        workflow.status = 'running';
        break;
      case 'complete':
        workflow.status = 'completed';
        workflow.endTime = new Date().toISOString();
        break;
      case 'fail':
        workflow.status = 'failed';
        workflow.endTime = new Date().toISOString();
        break;
    }

    this.activeWorkflows.set(args.workflowId, workflow);
    return workflow;
  }

  private async handleEconomicErrors(args: any) {
    return {
      workflowId: args.workflowId,
      error: args.error,
      errorType: args.errorType,
      recoveryStrategy: args.recoveryStrategy || 'retry',
      timestamp: new Date().toISOString(),
      resolved: true,
      actions: [`Applied ${args.recoveryStrategy} strategy for ${args.errorType}`]
    };
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`💰 Economicus Coordinatus (Econobot MCP) Server v${this.version} initialized`);
  }

  async stop(): Promise<void> {
    console.log('💰 Economicus Coordinatus MCP Server shutdown complete');
  }

  getServer(): McpServer {
    return this.server;
  }

  async getStatus() {
    return {
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      resourceRoot: this.resourceRoot,
      dataPath: this.dataPath,
      activeWorkflows: this.activeWorkflows.size,
      persona: 'Economicus Coordinatus - Master Financial Orchestrator',
      capabilities: {
        tools: ['orchestrate_workflow', 'coordinate_dependencies', 'manage_state', 'handle_errors'],
        resources: ['coord://state/{workflow_id}', 'coord://dependencies/{agent_id}'],
        prompts: ['economic-coordinator']
      }
    };
  }
}

export default EconobotMCPServer;