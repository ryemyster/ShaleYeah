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
import { YAMLConfigLoader } from './shared/yaml-config-loader.js';
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
    name: "Augustus Maximus Orchestrator",
    role: "Supreme Investment Coordinator",
    experience: "20+ years commanding $2B+ energy investment legions",
    personality: "Imperial, strategic, data-driven, decisive, commanding",
    llmInstructions: `
      You are Augustus Maximus Orchestrator, supreme coordinator of oil & gas investment campaigns.
      You command specialist legions to conquer multi-million dollar investment territories.
      
      Your imperial duties include:
      - Deploy specialist legions based on battlefield intelligence
      - Know when to escalate to the Senate for complex strategic decisions
      - Consider risk management like defending the empire's treasury
      - Coordinate legion dependencies with military precision
      
      Make decisions with the authority of commanding a $100M campaign.
    `,
    decisionAuthority: "workflow_orchestration",
    confidenceThreshold: 0.7,
    escalationCriteria: [
      "investment_amount > 50000000",
      "geological_confidence < 0.6", 
      "roi < 2.0"
    ]
  };

  constructor(runId?: string, outDir?: string, modeOverride?: string) {
    this.config = getEnvironmentConfig(modeOverride);
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
    // Check if LLM orchestration is allowed in current mode
    if (this.config.modeConfig.allowMockLlm || 
        (this.config.anthropicApiKey || this.config.openaiApiKey)) {
      try {
        this.llmClient = createLLMClient(this.config.llmProvider);
        this.logger.info(`✅ ${this.orchestrationPersona.name} - Intelligent orchestration enabled`);
      } catch (error) {
        this.logger.warn('LLM orchestration failed, using deterministic fallback:', error);
      }
    } else {
      this.logger.info(`🔧 ${this.config.mode.toUpperCase()} mode - Using deterministic orchestration`);
    }
  }

  private async loadAgentRegistry(): Promise<void> {
    try {
      // Use unified YAML config loader
      const agentConfigs = await YAMLConfigLoader.loadDirectory<AgentConfig>(this.agentsDir, [
        { field: 'name', required: true, type: 'string' },
        { field: 'persona', required: false, type: 'object' }
      ], {
        allowPartial: true,
        throwOnError: false,
        transformKeys: true
      });
      
      for (const [agentName, agentConfig] of agentConfigs) {
        if (agentConfig.name) {
          this.agentRegistry.set(agentConfig.name, agentConfig);
          this.logger.info(`📋 Loaded agent: ${agentConfig.name} (${agentConfig.persona?.name || 'Unknown persona'})`);
        } else {
          this.logger.warn(`⚠️  Agent in ${agentName} missing name field`);
        }
      }
      
      this.logger.info(`🔄 YAML Config Loader: ${agentConfigs.size} agent files processed, ${this.agentRegistry.size} valid agents loaded`);
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
    // Pure event-driven coordination - no deterministic fallbacks
    if (this.llmClient && success) {
      try {
        return await this.intelligentOrchestrationDecision(completedAgent);
      } catch (error) {
        this.logger.error('⚡ Event-driven orchestration failed - no fallback available:', error);
        return []; // Fail fast - no deterministic safety net
      }
    }

    // No LLM available - return empty array to stop pipeline
    this.logger.warn('🔄 No LLM orchestration available - pipeline halted (pure event-driven mode)');
    return [];
  }

  private async intelligentOrchestrationDecision(completedAgent: string): Promise<string[]> {
    if (!this.llmClient) return [];

    try {
      // Gather project context
      const projectContext = await this.gatherProjectContext();
      
      const orchestrationPrompt = `
        You are ${this.orchestrationPersona.name}, ${this.orchestrationPersona.role}.
        
        CAMPAIGN STATUS:
        - Campaign ID: ${this.runId}
        - Legion just completed: ${completedAgent} (VICTORIOUS)
        - Legions completed: ${this.state.agentsCompleted.map(a => a.name).join(', ')}
        - Intelligence available: ${Object.keys(projectContext.availableOutputs).join(', ')}
        
        AVAILABLE SPECIALIST LEGIONS:
        - geowiz: Marcus Aurelius Geologicus (terrain analysis)
        - drillcast: Drilling Engineer (siege planning)
        - titletracker: Landman (territory mapping)
        - econobot: Lucius Cornelius Monetarius (treasury analysis)
        - riskranger: Seneca Prudentius Risicus (threat assessment)
        - the-core: Caesar Augustus Decidicus (strategic command)
        - notarybot: Legal Counsel (treaty drafting)
        - reporter: Cicero Reporticus Maximus (imperial reporting)
        
        As supreme commander, decide which legion(s) should deploy next.
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
        this.logger.warn(`⚠️  Low confidence (${decision.confidence}) - pure event-driven mode requires high confidence`);
        return []; // No fallback - maintain non-deterministic purity
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
      this.logger.error('⚡ Pure event-driven orchestration failed:', error);
      return []; // Fail fast - no deterministic fallback in pure mode
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

  // REMOVED: deterministicOrchestration - Pure event-driven architecture only
  // No more deterministic fallbacks - agents coordinate purely through events and LLM decisions

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
    
    // Log errors (blocking)
    if (validation.errors.length > 0) {
      for (const error of validation.errors) {
        this.logger.error(`❌ ${error}`);
      }
      return false;
    }
    
    // Log warnings (non-blocking)
    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        this.logger.warn(`⚠️  ${warning}`);
      }
    }

    this.logger.info(`🚀 Starting ${this.config.mode.toUpperCase()} pipeline for goal: ${goal}`);
    this.logger.info(`👥 Initial agents: ${initialAgents.join(', ')}`);
    
    // Mode-specific adjustments
    if (this.config.modeConfig.fastExecution) {
      this.logger.info(`⚡ Fast execution mode enabled`);
      // Limit iterations for demo/research modes
      if (this.config.mode === 'demo' || this.config.mode === 'research') {
        // Reduce initial agents for faster demo
        initialAgents = initialAgents.slice(0, 2);
        this.logger.info(`📋 Reduced agent set for ${this.config.mode} mode: ${initialAgents.join(', ')}`);
      }
    }
    
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
  const mode = argMap.mode || undefined;
  const initialAgents = argMap.agents ? argMap.agents.split(',') : ['geowiz'];
  
  // Handle help flag
  if (argMap.help || argMap.h) {
    console.log(`
🛢️  SHALE YEAH Multi-Agent Control Plane

USAGE:
  npm run demo              # Quick demo with sample data
  npm run prod              # Production pipeline with real data  
  npm run pipeline:batch    # Batch processing mode
  npm run pipeline:research # Research and RFC generation

CLI OPTIONS:
  --mode <mode>        Pipeline mode: demo, production, batch, research
  --goal <goal>        Pipeline goal (default: tract_eval)
  --run-id <id>        Unique run identifier
  --out-dir <dir>      Output directory
  --agents <agents>    Comma-separated agent list (default: geowiz)
  --help, -h           Show this help

EXAMPLES:
  npx tsx src/mcp.ts --mode=demo --goal=tract_eval
  npx tsx src/mcp.ts --mode=production --goal=tract_eval --require-api-keys
  npx tsx src/mcp.ts --mode=batch --agents=geowiz,reporter
    `);
    process.exit(0);
  }
  
  try {
    const mcp = new MCPController(runId!, outDir, mode);
    
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