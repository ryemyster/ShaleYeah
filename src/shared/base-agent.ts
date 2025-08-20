/**
 * SHALE YEAH Base Agent Class
 * 
 * Abstract base class for all AI agent personas in the oil & gas investment platform
 * Each agent represents a human expert role with LLM-powered reasoning
 */

import fs from 'fs/promises';
import path from 'path';
import type { 
  AgentPersona, 
  AgentResult, 
  LLMAnalysisResult,
  EnvironmentConfig
} from './types.js';
import { LLMClient, createLLMClient } from './llm-client.js';
import { getEnvironmentConfig, createShaleYeahFooter } from './config.js';

export abstract class BaseAgent {
  protected runId: string;
  protected outputDir: string;
  protected agentName: string;
  protected persona: AgentPersona;
  protected llmClient?: LLMClient;
  protected config: EnvironmentConfig;
  protected logger: Console;
  protected confidence: number = 0.7;

  constructor(runId: string, outputDir: string, agentName: string, persona: AgentPersona) {
    this.runId = runId;
    this.outputDir = outputDir;
    this.agentName = agentName;
    this.persona = persona;
    this.config = getEnvironmentConfig();
    this.logger = console;
    
    this.initializeLLMClient();
  }

  /**
   * Initialize LLM client for this agent persona
   */
  private async initializeLLMClient(): Promise<void> {
    try {
      this.llmClient = createLLMClient(this.config.llmProvider);
      this.logger.info(`🧠 ${this.persona.name} (${this.agentName}) - LLM expertise enabled`);
    } catch (error) {
      this.logger.warn(`LLM integration failed for ${this.agentName}:`, error);
      this.logger.info(`📊 ${this.persona.name} falling back to deterministic analysis`);
    }
  }

  /**
   * Abstract method that each agent must implement for their specific analysis
   */
  abstract analyze(inputData: any): Promise<AgentResult>;

  /**
   * Generate LLM-powered response using agent's persona
   */
  protected async generatePersonaResponse(prompt: string, context?: any): Promise<string> {
    if (!this.llmClient) {
      throw new Error(`LLM client not available for ${this.agentName}`);
    }

    const enhancedContext = {
      persona: this.persona,
      agentName: this.agentName,
      runId: this.runId,
      ...context
    };

    return this.llmClient.generateResponse(prompt, enhancedContext);
  }

  /**
   * Perform LLM-enhanced data analysis with agent expertise
   */
  protected async enhanceWithLLM(data: any, analysisType: string): Promise<LLMAnalysisResult> {
    if (!this.llmClient) {
      return {
        analysis: "LLM analysis not available - using deterministic methods",
        confidence: 0.5
      };
    }

    try {
      const analysis = await this.llmClient.analyzeData(data, analysisType);
      return {
        ...analysis,
        confidence: Math.min(analysis.confidence, this.persona.confidenceThreshold)
      };
    } catch (error) {
      this.logger.error(`LLM enhancement failed for ${this.agentName}:`, error);
      return {
        analysis: "LLM enhancement failed - using deterministic analysis",
        confidence: 0.5,
        errors: [String(error)]
      };
    }
  }

  /**
   * Check if this agent should escalate to human based on confidence and criteria
   */
  protected shouldEscalateToHuman(confidence: number, context?: any): { escalate: boolean; reason?: string } {
    // Check confidence threshold
    if (confidence < this.persona.confidenceThreshold) {
      return {
        escalate: true,
        reason: `Confidence ${confidence.toFixed(2)} below threshold ${this.persona.confidenceThreshold}`
      };
    }

    // Check persona-specific escalation criteria
    if (this.persona.escalationCriteria) {
      for (const criterion of this.persona.escalationCriteria) {
        if (this.checkEscalationCriterion(criterion, context)) {
          return {
            escalate: true,
            reason: `Escalation criterion met: ${criterion}`
          };
        }
      }
    }

    return { escalate: false };
  }

  /**
   * Check specific escalation criteria (override in subclasses)
   */
  protected checkEscalationCriterion(criterion: string, context?: any): boolean {
    // Base implementation - subclasses can override
    return false;
  }

  /**
   * Create escalation report for human review
   */
  protected async createEscalationReport(reason: string, data: any): Promise<void> {
    const escalationReport = {
      agentName: this.agentName,
      agentPersona: this.persona.name,
      escalationReason: reason,
      timestamp: new Date().toISOString(),
      runId: this.runId,
      data: data,
      recommendation: `${this.persona.role} recommends human review before proceeding`
    };

    const escalationFile = path.join(this.outputDir, `${this.agentName}_escalation.json`);
    await this.saveOutputFile(escalationReport, escalationFile, 'json');
    
    this.logger.warn(`🚨 ${this.persona.name} ESCALATION: ${reason}`);
    this.logger.warn(`📄 Escalation report: ${escalationFile}`);
  }

  /**
   * Save output file with proper formatting and footer
   */
  protected async saveOutputFile(content: any, filePath: string, format: 'json' | 'md' | 'csv' | 'geojson'): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let outputContent: string;

    switch (format) {
      case 'json':
      case 'geojson':
        outputContent = JSON.stringify(content, null, 2);
        break;
      case 'md':
        outputContent = typeof content === 'string' ? content : String(content);
        if (!outputContent.includes('Generated with SHALE YEAH')) {
          outputContent += createShaleYeahFooter();
        }
        break;
      case 'csv':
        outputContent = typeof content === 'string' ? content : String(content);
        break;
      default:
        outputContent = String(content);
    }

    await fs.writeFile(filePath, outputContent, 'utf8');
    this.logger.info(`📁 ${this.persona.name} output: ${path.basename(filePath)}`);
  }

  /**
   * Validate that required outputs were created
   */
  protected async validateOutputs(expectedOutputs: string[]): Promise<boolean> {
    const missingOutputs: string[] = [];

    for (const output of expectedOutputs) {
      const outputPath = path.join(this.outputDir, output);
      try {
        await fs.access(outputPath);
      } catch {
        missingOutputs.push(output);
      }
    }

    if (missingOutputs.length > 0) {
      this.logger.error(`❌ ${this.persona.name} missing outputs: ${missingOutputs.join(', ')}`);
      return false;
    }

    this.logger.info(`✅ ${this.persona.name} all outputs validated`);
    return true;
  }

  /**
   * Load input data from file or return demo data
   */
  protected async loadInputData(filePath: string, demoData?: any): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      }
      return content;
    } catch (error) {
      if (demoData) {
        this.logger.info(`📊 ${this.persona.name} using demo data (input file not found: ${filePath})`);
        return demoData;
      }
      throw new Error(`Input file not found and no demo data provided: ${filePath}`);
    }
  }

  /**
   * Execute the agent with proper error handling and logging
   */
  async execute(inputData: any): Promise<AgentResult> {
    const startTime = Date.now();
    this.logger.info(`🎯 ${this.persona.name} starting analysis...`);

    try {
      const result = await this.analyze(inputData);
      
      const executionTime = Date.now() - startTime;
      this.logger.info(`✅ ${this.persona.name} completed in ${executionTime}ms`);

      return {
        ...result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ ${this.persona.name} failed after ${executionTime}ms:`, error);

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
   * Get agent information for orchestration
   */
  getAgentInfo(): { name: string; persona: AgentPersona } {
    return {
      name: this.agentName,
      persona: this.persona
    };
  }
}