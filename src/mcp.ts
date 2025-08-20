#!/usr/bin/env node
/**
 * SHALE YEAH Multi-Agent Control Plane (MCP) - TypeScript Implementation
 * 
 * **INTELLIGENT ORCHESTRATION:** Like a human team lead managing oil & gas professionals
 * 
 * This MCP uses LLM intelligence to:
 * - Decide which agent persona to run next based on data and context
 * - Coordinate agent handoffs like a human project manager
 * - Escalate complex decisions to humans when confidence is low
 * - Generate executive summaries of multi-agent workflows
 * 
 * Replaces 100+ employees with YAML-driven agentic AI flows.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import type {
  AgentConfig,
  PipelineState,
  ProjectContext,
  OrchestrationDecision,
  AgentPersona,
  EnvironmentConfig
} from './shared/types.js';
import { LLMClient, createLLMClient } from './shared/llm-client.js';
import { 
  getEnvironmentConfig, 
  getOutputDir,
  getDefaultInputs,
  setupLogging,
  validateEnvironment 
} from './shared/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPController {
  private runId: string;
  private outDir: string;
  private stateFile: string;
  private agentsDir: string;
  private config: EnvironmentConfig;
  private logger: Console;
  private llmClient?: LLMClient;
  private agentRegistry: Map<string, AgentConfig> = new Map();
  private state: PipelineState;
  
  // Orchestration intelligence persona
  private orchestrationPersona: AgentPersona = {
    name: "Robert Hamilton Sr.",
    role: "Senior Oil & Gas Investment Director",
    experience: "20+ years managing $2B+ energy investment portfolio",
    personality: "Strategic, data-driven, risk-aware, team-oriented",
    llmInstructions: `
      You are Robert Hamilton Sr., a senior investment director with 20 years managing oil & gas investments.
      You coordinate specialist teams to make multi-million dollar investment decisions.
      
      Your job is to intelligently orchestrate agent workflows like managing a team of experts:
      - Decide which specialist should work next based on available data
      - Know when human escalation is needed for complex decisions
      - Consider risk management and due diligence requirements
      - Think about logical workflow dependencies between team members
      
      Make decisions like you're managing a $100M investment process.
    `,
    decisionAuthority: "workflow_orchestration",
    confidenceThreshold: 0.7,
    escalationCriteria: [
      "investment_amount > 50000000",
      "geological_confidence < 0.6", 
      "roi < 2.0"
    ]
  };

  constructor(runId?: string, outDir?: string) {
    this.config = getEnvironmentConfig();
    this.runId = runId || this.config.runId;
    this.outDir = outDir || getOutputDir(this.runId);
    this.stateFile = path.join(this.outDir, 'state.json');
    this.agentsDir = path.join(process.cwd(), '.claude', 'agents');
    this.logger = console;

    // Setup logging
    setupLogging();

    // Initialize state
    this.state = {
      runId: this.runId,
      startTime: Date.now(),
      agentsCompleted: [],
      agentsFailed: [],
      outputs: {},
      metadata: {}
    };

    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Initialize LLM for intelligent orchestration
      await this.initializeLLMOrchestration();
      
      // Load agent registry
      await this.loadAgentRegistry();
      
      // Ensure output directory exists
      await fs.mkdir(this.outDir, { recursive: true });
      
      // Save initial state
      await this.saveState();
      
      this.logger.info(`🎯 SHALE YEAH MCP initialized for run: ${this.runId}`);
      this.logger.info(`📁 Output directory: ${this.outDir}`);
      this.logger.info(`🤖 Loaded ${this.agentRegistry.size} agent personas`);
      
    } catch (error) {
      this.logger.error('❌ MCP initialization failed:', error);
      throw error;
    }
  }

  private async initializeLLMOrchestration(): Promise<void> {
    try {
      this.llmClient = createLLMClient(this.config.llmProvider);
      this.logger.info(`✅ ${this.orchestrationPersona.name} - Intelligent orchestration enabled`);
    } catch (error) {
      this.logger.warn('LLM orchestration failed, using deterministic fallback:', error);
    }
  }

  private async loadAgentRegistry(): Promise<void> {
    try {
      const yamlFiles = await fs.readdir(this.agentsDir);
      
      for (const file of yamlFiles) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
        
        try {
          const filePath = path.join(this.agentsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const agentConfig = YAML.parse(content) as AgentConfig;
          
          if (agentConfig.name) {
            this.agentRegistry.set(agentConfig.name, agentConfig);
            this.logger.info(`📋 Loaded agent: ${agentConfig.name} (${agentConfig.persona?.name || 'Unknown persona'})`);
          } else {
            this.logger.warn(`⚠️  Agent in ${file} missing name field`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to load agent ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to load agent registry:', error);
      throw error;
    }
  }

  private async saveState(): Promise<void> {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      this.logger.error('❌ Failed to save state:', error);
    }
  }

  private async loadState(): Promise<PipelineState | null> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private getAgentConfig(agentName: string): AgentConfig | undefined {
    return this.agentRegistry.get(agentName);
  }

  private async checkPrerequisites(agentName: string): Promise<boolean> {
    const agentConfig = this.getAgentConfig(agentName);
    if (!agentConfig) {
      this.logger.error(`❌ Agent ${agentName} not found in registry`);
      return false;
    }

    // Check if required inputs are available
    const requiredInputs = agentConfig.inputs.required;
    let inputItems: Array<[string, string]> = [];

    if (Array.isArray(requiredInputs)) {
      inputItems = requiredInputs.map(input => [input, '']);
    } else if (typeof requiredInputs === 'object') {
      inputItems = Object.entries(requiredInputs);
    }

    for (const [inputName] of inputItems) {
      // Check if input is available in state outputs
      if (!this.isInputAvailable(inputName)) {
        // Skip certain inputs that have defaults
        if (['shapefile', 'region'].includes(inputName)) continue;
        
        this.logger.warn(`⚠️  Missing required input for ${agentName}: ${inputName}`);
        return false;
      }
    }

    return true;
  }

  private isInputAvailable(inputName: string): boolean {
    // Check if input exists in completed agent outputs
    for (const agentOutputs of Object.values(this.state.outputs)) {
      if (agentOutputs[inputName]) return true;
    }

    // Check if file exists in output directory
    const possiblePaths = [
      path.join(this.outDir, `${inputName}.json`),
      path.join(this.outDir, `${inputName}.geojson`),
      path.join(this.outDir, `${inputName}.md`),
      path.join(this.outDir, `${inputName}.csv`)
    ];

    return possiblePaths.some(p => {
      try {
        return fs.access(p).then(() => true).catch(() => false);
      } catch {
        return false;
      }
    });
  }

  private async executeAgent(agentName: string, inputs?: Record<string, string>): Promise<boolean> {
    const agentConfig = this.getAgentConfig(agentName);
    if (!agentConfig) {
      this.logger.error(`❌ Agent ${agentName} not found in registry`);
      return false;
    }

    this.logger.info(`🎯 Executing ${agentName} (${agentConfig.persona?.name || 'Unknown persona'})`);
    this.state.currentAgent = agentName;
    await this.saveState();

    const startTime = Date.now();

    try {
      // Prepare environment
      const env = { ...process.env };
      env.RUN_ID = this.runId;
      env.OUT_DIR = this.outDir;

      // Process command and arguments
      const entrypoint = agentConfig.cli.entrypoint;
      const args = await this.processArguments(agentConfig.cli.args, inputs);
      const command = entrypoint.split(' ');
      const fullCommand = [...command, ...args];

      this.logger.info(`🔧 Command: ${fullCommand.join(' ')}`);

      // Execute agent
      const success = await this.runCommand(fullCommand, env, agentConfig.errorHandling?.timeout || 300);
      const executionTime = Date.now() - startTime;

      if (success) {
        this.logger.info(`✅ ${agentName} completed successfully in ${executionTime}ms`);
        this.state.agentsCompleted.push({
          name: agentName,
          executionTime,
          timestamp: Date.now()
        });
        
        await this.recordAgentOutputs(agentName, agentConfig);
      } else {
        this.logger.error(`❌ ${agentName} failed`);
        this.state.agentsFailed.push({
          name: agentName,
          errorCode: 1,
          errorMessage: 'Execution failed',
          timestamp: Date.now()
        });
      }

      return success;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ ${agentName} failed after ${executionTime}ms:`, error);
      
      this.state.agentsFailed.push({
        name: agentName,
        errorCode: -1,
        errorMessage: String(error),
        timestamp: Date.now()
      });
      
      return false;
    } finally {
      this.state.currentAgent = undefined;
      await this.saveState();
    }
  }

  private async processArguments(args: string[], inputs?: Record<string, string>): Promise<string[]> {
    const processedArgs: string[] = [];
    
    for (let arg of args) {
      // Replace run and output variables
      arg = arg.replace('${RUN_ID}', this.runId);
      arg = arg.replace('${OUT_DIR}', this.outDir);
      
      // Replace input variables
      if (inputs) {
        for (const [key, value] of Object.entries(inputs)) {
          arg = arg.replace(`\${input.${key}}`, value);
        }
      }
      
      // Replace any remaining input variables with defaults
      const inputMatch = arg.match(/\${input\.([^}]+)}/);
      if (inputMatch) {
        const inputName = inputMatch[1];
        const defaultInputs = getDefaultInputs(this.state.currentAgent || '', this.runId);
        const defaultValue = defaultInputs[inputName] || 'demo_input';
        arg = arg.replace(`\${input.${inputName}}`, defaultValue);
      }
      
      processedArgs.push(arg);
    }
    
    return processedArgs;
  }

  private async runCommand(command: string[], env: NodeJS.ProcessEnv, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command;
      const child = spawn(cmd, args, { 
        env, 
        stdio: ['inherit', 'inherit', 'inherit'] 
      });

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

  private async recordAgentOutputs(agentName: string, agentConfig: AgentConfig): Promise<void> {
    const agentOutputs: Record<string, string> = {};
    
    for (const output of agentConfig.outputs) {
      const outputPath = output.path.replace('${OUT_DIR}', this.outDir);
      
      try {
        await fs.access(outputPath);
        agentOutputs[output.name] = outputPath;
        this.logger.info(`📁 Recorded output: ${output.name} -> ${path.basename(outputPath)}`);
      } catch {
        this.logger.warn(`⚠️  Expected output not found: ${outputPath}`);
      }
    }
    
    this.state.outputs[agentName] = agentOutputs;
  }

  private async getNextAgents(completedAgent: string, success: boolean): Promise<string[]> {
    // Try intelligent orchestration first
    if (this.llmClient && success) {
      try {
        const intelligentNext = await this.intelligentOrchestrationDecision(completedAgent);
        if (intelligentNext.length > 0) {
          return intelligentNext;
        }
      } catch (error) {
        this.logger.warn('Intelligent orchestration failed, using deterministic fallback:', error);
      }
    }

    // Fallback to deterministic orchestration
    return this.deterministicOrchestration(completedAgent, success);
  }

  private async intelligentOrchestrationDecision(completedAgent: string): Promise<string[]> {
    if (!this.llmClient) return [];

    try {
      // Gather project context
      const projectContext = await this.gatherProjectContext();
      
      const orchestrationPrompt = `
        You are ${this.orchestrationPersona.name}, ${this.orchestrationPersona.role}.
        
        PROJECT CONTEXT:
        - Run ID: ${this.runId}
        - Just completed: ${completedAgent} agent (SUCCESS)
        - Agents completed so far: ${this.state.agentsCompleted.map(a => a.name).join(', ')}
        - Available outputs: ${Object.keys(projectContext.availableOutputs).join(', ')}
        
        AVAILABLE AGENT PERSONAS:
        - geowiz: Senior Petroleum Geologist (geological analysis)
        - drillcast: Drilling Engineer (development planning)
        - titletracker: Landman (ownership analysis)
        - econobot: Financial Analyst (NPV/DCF modeling)
        - riskranger: Risk Manager (risk assessment)
        - the-core: Investment Committee (final decisions)
        - notarybot: Legal Counsel (LOI generation)
        - reporter: Executive Assistant (final reporting)
        
        As an experienced investment director, decide which agent(s) should run next.
        Consider:
        - Logical workflow sequence for investment decisions
        - Data dependencies between agents
        - When to escalate to humans vs continue with AI agents
        - Risk management and due diligence requirements
        
        Respond in JSON format:
        {
          "next_agents": ["agent1", "agent2"],
          "reasoning": "Your professional reasoning as investment director",
          "confidence": 0.85,
          "escalate_to_human": false,
          "escalation_reason": "Optional reason for human involvement"
        }
        
        Think like a senior director managing a multi-million dollar investment process.
      `;

      const llmResponse = await this.llmClient.generateResponse(
        orchestrationPrompt,
        {
          persona: this.orchestrationPersona,
          projectContext
        }
      );

      // Parse LLM decision
      const decision: OrchestrationDecision = JSON.parse(llmResponse);
      
      // Log the reasoning
      this.logger.info(`🧠 Investment Director Decision: ${decision.reasoning}`);
      
      // Check confidence and escalation
      if (decision.confidence < this.orchestrationPersona.confidenceThreshold) {
        this.logger.warn(`⚠️  Low confidence (${decision.confidence}), using deterministic fallback`);
        return [];
      }
      
      if (decision.escalateToHuman) {
        this.logger.warn(`🚨 ESCALATION: ${decision.escalationReason || 'Director recommends human review'}`);
        await this.createEscalationReport(completedAgent, decision);
        return ['reporter']; // Generate report for human review
      }
      
      // Return intelligent decision, filtering out already completed agents
      const completedAgentNames = this.state.agentsCompleted.map(a => a.name);
      this.state.orchestrationReasoning = decision.reasoning;
      
      return (decision.nextAgents || []).filter(agent => !completedAgentNames.includes(agent));
      
    } catch (error) {
      this.logger.error('Intelligent orchestration failed:', error);
      return []; // Fall back to deterministic
    }
  }

  private async gatherProjectContext(): Promise<ProjectContext> {
    const availableOutputs: Record<string, any> = {};
    const outputFiles = [
      'geology_summary.md',
      'zones.geojson',
      'drill_forecast.json',
      'ownership.json',
      'valuation.json',
      'risk_assessment.json',
      'investment_decision.json',
      'loi.md'
    ];

    for (const outputFile of outputFiles) {
      const filePath = path.join(this.outDir, outputFile);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (outputFile.endsWith('.json')) {
          availableOutputs[outputFile] = JSON.parse(content);
        } else {
          availableOutputs[outputFile] = content.substring(0, 500); // First 500 chars
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return {
      availableOutputs,
      runState: this.state,
      timestamp: Date.now()
    };
  }

  private async createEscalationReport(completedAgent: string, decision: OrchestrationDecision): Promise<void> {
    const escalationReport = {
      escalationTimestamp: Date.now(),
      runId: this.runId,
      triggerAgent: completedAgent,
      directorReasoning: decision.reasoning,
      escalationReason: decision.escalationReason,
      confidenceScore: decision.confidence,
      projectState: this.state,
      recommendation: 'Human review required before proceeding'
    };

    const escalationFile = path.join(this.outDir, 'ESCALATION_REQUIRED.json');
    await fs.writeFile(escalationFile, JSON.stringify(escalationReport, null, 2));
    
    this.logger.warn(`🚨 Escalation report created: ${escalationFile}`);
  }

  private deterministicOrchestration(completedAgent: string, success: boolean): string[] {
    const agentConfig = this.getAgentConfig(completedAgent);
    if (!agentConfig) return [];

    const nextAgents = agentConfig.nextAgents;
    const candidates = success ? nextAgents.onSuccess : nextAgents.onFailure;
    
    // Filter agents that haven't been completed yet and meet prerequisites
    const completedAgentNames = this.state.agentsCompleted.map(a => a.name);
    const availableAgents: string[] = [];
    
    for (const agent of candidates) {
      if (!completedAgentNames.includes(agent) && this.agentRegistry.has(agent)) {
        // Note: We'll check prerequisites just before execution
        availableAgents.push(agent);
      }
    }
    
    return availableAgents;
  }

  private isAgentCompleted(agentName: string): boolean {
    return this.state.agentsCompleted.some(a => a.name === agentName);
  }

  private shouldContinue(): boolean {
    return this.state.agentsFailed.length === 0 || this.hasExecutableAgents();
  }

  private hasExecutableAgents(): boolean {
    for (const agentName of this.agentRegistry.keys()) {
      if (!this.isAgentCompleted(agentName)) {
        return true; // We have at least one unexecuted agent
      }
    }
    return false;
  }

  /**
   * Run the complete pipeline
   */
  async runPipeline(goal: string = 'tract_eval', initialAgents: string[] = ['geowiz']): Promise<boolean> {
    // Validate environment first
    const validation = validateEnvironment();
    if (validation.errors.length > 0) {
      for (const error of validation.errors) {
        this.logger.warn(`⚠️  ${error}`);
      }
    }

    this.logger.info(`🚀 Starting pipeline for goal: ${goal}`);
    this.logger.info(`👥 Initial agents: ${initialAgents.join(', ')}`);
    
    let success = true;
    let currentAgents = [...initialAgents];
    let iteration = 0;
    
    while (currentAgents.length > 0 && this.shouldContinue() && iteration < 20) {
      iteration++;
      this.logger.info(`📈 Pipeline iteration ${iteration}`);
      
      const nextRound: string[] = [];
      
      for (const agentName of currentAgents) {
        if (this.isAgentCompleted(agentName)) {
          this.logger.info(`⏭️  Agent ${agentName} already completed, skipping`);
          continue;
        }
        
        // Check prerequisites before execution
        if (!(await this.checkPrerequisites(agentName))) {
          this.logger.warn(`⚠️  Agent ${agentName} prerequisites not met, skipping`);
          continue;
        }
        
        const agentSuccess = await this.executeAgent(agentName);
        
        if (agentSuccess) {
          // Get next agents to execute
          const nextAgents = await this.getNextAgents(agentName, true);
          nextRound.push(...nextAgents);
        } else {
          // Handle failure
          const failureAgents = await this.getNextAgents(agentName, false);
          nextRound.push(...failureAgents);
          success = false;
        }
      }
      
      // Remove duplicates and set up next round
      currentAgents = [...new Set(nextRound)];
    }
    
    // Always run reporter at the end if not already completed
    if (!this.isAgentCompleted('reporter')) {
      this.logger.info('📊 Running final reporter agent');
      await this.executeAgent('reporter');
    }
    
    // Final state update
    this.state.endTime = Date.now();
    this.state.totalDuration = this.state.endTime - this.state.startTime;
    this.state.pipelineSuccess = success && this.state.agentsFailed.length === 0;
    await this.saveState();
    
    this.logger.info(`🏁 Pipeline completed. Success: ${this.state.pipelineSuccess}`);
    this.logger.info(`⏱️  Total duration: ${(this.state.totalDuration / 1000).toFixed(2)}s`);
    this.logger.info(`✅ Agents completed: ${this.state.agentsCompleted.length}`);
    this.logger.info(`❌ Agents failed: ${this.state.agentsFailed.length}`);
    
    return this.state.pipelineSuccess;
  }
}

/**
 * CLI entry point
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
  const initialAgents = argMap.agents ? argMap.agents.split(',') : ['geowiz'];
  
  try {
    const mcp = new MCPController(runId!, outDir);
    
    // Wait a moment for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const success = await mcp.runPipeline(goal, initialAgents);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ MCP failed:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}