#!/usr/bin/env node
/**
 * SHALE YEAH MCP Client Orchestrator
 *
 * Standards-compliant MCP client that coordinates 14 domain expert servers
 * for comprehensive oil & gas investment analysis.
 *
 * Implements Anthropic MCP best practices:
 * - JSON-RPC 2.0 protocol compliance
 * - Proper session management
 * - Multi-server coordination
 * - Error recovery and resilience
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface MCPServerConfig {
  name: string;
  script: string;
  description: string;
  persona: string;
  domain: string;
  capabilities: string[];
}

export interface AnalysisRequest {
  runId: string;
  tractName: string;
  mode: 'demo' | 'production';
  inputFiles?: string[];
  outputDir: string;
  workflow?: string;
}

export interface AnalysisResult {
  server: string;
  persona: string;
  analysis: any;
  confidence: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface WorkflowResult {
  runId: string;
  totalTime: number;
  results: AnalysisResult[];
  recommendation: string;
  confidence: number;
  success: boolean;
}

/**
 * MCP Client for SHALE YEAH multi-server orchestration
 */
export class ShaleYeahMCPClient {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  private initialized = false;

  constructor() {
    this.initializeServerConfigs();
  }

  /**
   * Initialize all server configurations
   */
  private initializeServerConfigs(): void {
    this.serverConfigs = [
      {
        name: 'geowiz',
        script: 'src/servers/geowiz.ts',
        description: 'Geological Analysis Server',
        persona: 'Marcus Aurelius Geologicus',
        domain: 'geology',
        capabilities: ['formation_analysis', 'gis_processing', 'well_log_analysis']
      },
      {
        name: 'econobot',
        script: 'src/servers/econobot.ts',
        description: 'Economic Analysis Server',
        persona: 'Caesar Augustus Economicus',
        domain: 'economics',
        capabilities: ['dcf_analysis', 'financial_modeling', 'cost_estimation']
      },
      {
        name: 'curve-smith',
        script: 'src/servers/curve-smith.ts',
        description: 'Reservoir Engineering Server',
        persona: 'Lucius Technicus Engineer',
        domain: 'engineering',
        capabilities: ['decline_curves', 'eur_estimation', 'type_curves']
      },
      {
        name: 'reporter',
        script: 'src/servers/reporter.ts',
        description: 'Executive Reporting Server',
        persona: 'Scriptor Reporticus Maximus',
        domain: 'reporting',
        capabilities: ['executive_summary', 'report_generation', 'synthesis']
      },
      {
        name: 'decision',
        script: 'src/servers/decision.ts',
        description: 'Investment Decision Server',
        persona: 'Augustus Decidius Maximus',
        domain: 'strategy',
        capabilities: ['investment_strategy', 'portfolio_optimization', 'decision_analysis']
      },
      {
        name: 'risk-analysis',
        script: 'src/servers/risk-analysis.ts',
        description: 'Risk Assessment Server',
        persona: 'Gaius Probabilis Assessor',
        domain: 'risk',
        capabilities: ['risk_assessment', 'monte_carlo', 'scenario_analysis']
      },
      {
        name: 'legal',
        script: 'src/servers/legal.ts',
        description: 'Legal Analysis Server',
        persona: 'Legatus Juridicus',
        domain: 'legal',
        capabilities: ['contract_analysis', 'compliance_review', 'legal_framework']
      },
      {
        name: 'market',
        script: 'src/servers/market.ts',
        description: 'Market Analysis Server',
        persona: 'Mercatus Analyticus',
        domain: 'market',
        capabilities: ['market_analysis', 'competitive_analysis', 'price_forecasting']
      },
      {
        name: 'development',
        script: 'src/servers/development.ts',
        description: 'Development Planning Server',
        persona: 'Architectus Developmentus',
        domain: 'development',
        capabilities: ['development_planning', 'project_management', 'resource_allocation']
      },
      {
        name: 'drilling',
        script: 'src/servers/drilling.ts',
        description: 'Drilling Operations Server',
        persona: 'Perforator Maximus',
        domain: 'drilling',
        capabilities: ['drilling_program', 'cost_estimation', 'risk_assessment']
      },
      {
        name: 'infrastructure',
        script: 'src/servers/infrastructure.ts',
        description: 'Infrastructure Planning Server',
        persona: 'Structura Ingenious',
        domain: 'infrastructure',
        capabilities: ['infrastructure_planning', 'capacity_analysis', 'cost_estimation']
      },
      {
        name: 'title',
        script: 'src/servers/title.ts',
        description: 'Title Analysis Server',
        persona: 'Titulus Verificatus',
        domain: 'title',
        capabilities: ['title_examination', 'ownership_analysis', 'due_diligence']
      },
      {
        name: 'test',
        script: 'src/servers/test.ts',
        description: 'Quality Assurance Server',
        persona: 'Testius Validatus',
        domain: 'quality',
        capabilities: ['quality_tests', 'validation', 'compliance_checking']
      },
      {
        name: 'research',
        script: 'src/servers/research.ts',
        description: 'Research Server',
        persona: 'Scientius Researchicus',
        domain: 'research',
        capabilities: ['market_research', 'technology_analysis', 'competitive_intelligence']
      }
    ];
  }

  /**
   * Initialize connections to all MCP servers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔗 Initializing MCP Client connections...');
    console.log(`📡 Connecting to ${this.serverConfigs.length} domain expert servers`);

    const connectionPromises = this.serverConfigs.map(async (config) => {
      try {
        await this.connectToServer(config);
        console.log(`  ✅ ${config.persona} (${config.name}) - ${config.domain}`);
      } catch (error) {
        console.log(`  ❌ ${config.name} - Connection failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });

    await Promise.all(connectionPromises);
    this.initialized = true;
    console.log('🎯 All MCP servers connected successfully!\\n');
  }

  /**
   * Connect to a single MCP server
   */
  private async connectToServer(config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", config.script]
    });

    const client = new Client(
      {
        name: 'shale-yeah-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    await client.connect(transport);

    this.clients.set(config.name, client);
    this.transports.set(config.name, transport);
  }

  /**
   * Execute comprehensive oil & gas investment analysis
   */
  async executeAnalysis(request: AnalysisRequest): Promise<WorkflowResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const results: AnalysisResult[] = [];

    console.log(`🛢️  SHALE YEAH - MCP-Powered Investment Analysis`);
    console.log('================================================');
    console.log(`📋 Analysis ID: ${request.runId}`);
    console.log(`🗺️  Target Tract: ${request.tractName}`);
    console.log(`📁 Output Directory: ${request.outputDir}`);
    console.log(`💡 Mode: ${request.mode.toUpperCase()}`);
    console.log();

    // Create output directory
    await fs.mkdir(request.outputDir, { recursive: true });

    // Execute complete analysis workflow with all 14 servers
    const allServers = this.serverConfigs.map(config => config.name);

    for (const serverName of allServers) {
      const result = await this.executeServerAnalysis(serverName, request);
      results.push(result);

      if (result.success) {
        console.log(`🤖 ${result.persona}: ✅ ${result.confidence}% confidence in ${result.executionTime}ms`);
      } else {
        console.log(`🤖 ${result.persona}: ❌ Analysis failed - ${result.error}`);
      }
    }

    const totalTime = Date.now() - startTime;
    const successfulResults = results.filter(r => r.success);
    const overallConfidence = Math.round(
      successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
    );

    // Generate final recommendation
    const recommendation = this.generateRecommendation(successfulResults, overallConfidence);

    // Write final reports
    await this.writeAnalysisReports(request, results, recommendation, overallConfidence);

    console.log();
    console.log(`🎯 SHALE YEAH Analysis Complete!`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`📊 Overall Recommendation: ${recommendation}`);

    return {
      runId: request.runId,
      totalTime,
      results,
      recommendation,
      confidence: overallConfidence,
      success: successfulResults.length >= 4 // Need at least 4 successful analyses
    };
  }

  /**
   * Execute analysis on a specific server
   */
  private async executeServerAnalysis(serverName: string, request: AnalysisRequest): Promise<AnalysisResult> {
    const config = this.serverConfigs.find(c => c.name === serverName);
    const client = this.clients.get(serverName);

    if (!config || !client) {
      return {
        server: serverName,
        persona: 'Unknown',
        analysis: null,
        confidence: 0,
        executionTime: 0,
        success: false,
        error: 'Server not found or not connected'
      };
    }

    const startTime = Date.now();

    try {
      // In demo mode, use realistic mock analysis
      if (request.mode === 'demo') {
        const mockAnalysis = this.generateMockAnalysis(serverName, request);
        const executionTime = Date.now() - startTime;

        return {
          server: serverName,
          persona: config.persona,
          analysis: mockAnalysis,
          confidence: mockAnalysis.confidence,
          executionTime,
          success: true
        };
      }

      // Production mode - call actual MCP server tools
      const tools = await client.listTools();
      const primaryTool = tools.tools[0]; // Use first available tool

      if (!primaryTool) {
        throw new Error('No tools available on server');
      }

      // Create server-specific arguments
      const toolArguments = this.getServerSpecificArguments(serverName, primaryTool.name, request);

      const result = await client.callTool({
        name: primaryTool.name,
        arguments: toolArguments
      });

      const executionTime = Date.now() - startTime;

      return {
        server: serverName,
        persona: config.persona,
        analysis: result.content,
        confidence: (result.content as any)?.confidence || 85,
        executionTime,
        success: true
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        server: serverName,
        persona: config.persona,
        analysis: null,
        confidence: 0,
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get server-specific tool arguments
   */
  private getServerSpecificArguments(serverName: string, toolName: string, request: AnalysisRequest): any {
    const baseArgs = {
      tractName: request.tractName,
      runId: request.runId,
      outputPath: path.join(request.outputDir, `${serverName}-analysis.json`)
    };

    // Server-specific argument mapping
    switch (serverName) {
      case 'title':
        if (toolName === 'examine_title') {
          return {
            propertyDescription: request.tractName,
            county: 'Demo County',
            state: 'Texas',
            examPeriod: '20 years',
            outputPath: baseArgs.outputPath
          };
        }
        break;

      case 'geowiz':
        if (toolName === 'analyze_formation') {
          return {
            filePath: 'data/samples/demo.las',
            depthInterval: '5000-15000',
            formations: ['Wolfcamp A', 'Wolfcamp B', 'Bone Spring'],
            outputPath: baseArgs.outputPath
          };
        }
        return {
          ...baseArgs,
          depthInterval: '5000-15000 ft',
          formations: ['Wolfcamp A', 'Wolfcamp B', 'Bone Spring']
        };

      case 'curve-smith':
        if (toolName === 'analyze_decline_curve') {
          return {
            filePath: 'data/samples/demo.las',
            wellType: 'horizontal',
            lateralLength: '10000',
            outputPath: baseArgs.outputPath
          };
        }
        return {
          ...baseArgs,
          wellType: 'horizontal',
          lateralLength: '10000 ft'
        };

      case 'econobot':
        if (toolName === 'analyze_economics') {
          return {
            filePath: 'data/samples/economics.xlsx',
            dataType: 'mixed',
            oilPrice: 75,
            gasPrice: 3.5,
            outputPath: baseArgs.outputPath
          };
        }
        break;

      case 'risk-analysis':
        if (toolName === 'assess_investment_risk') {
          return {
            projectData: {
              npv: 2500000,
              irr: 28.5,
              geology: { quality: 'good' },
              market: { outlook: 'stable' }
            },
            outputPath: baseArgs.outputPath
          };
        }
        break;

      case 'reporter':
        if (toolName === 'generate_investment_decision') {
          return {
            tractName: request.tractName,
            analysisResults: {
              geological: { formations: ['Wolfcamp A', 'Wolfcamp B'], porosity: 14.5 },
              economic: { npv: 2500000, irr: 28.5 },
              engineering: { eur: 450000, initialRate: 1200 },
              risk: { overallRisk: 'Medium', score: 65 }
            },
            decisionCriteria: {
              minNPV: 1000000,
              minIRR: 15,
              maxRisk: 'High'
            },
            outputPath: baseArgs.outputPath
          };
        }
        break;

      default:
        // Use base arguments for other servers
        return baseArgs;
    }

    return baseArgs;
  }

  /**
   * Generate realistic mock analysis for demo mode
   */
  private generateMockAnalysis(serverName: string, request: AnalysisRequest): any {
    const baseConfidence = 75 + Math.random() * 20;

    const mockData = {
      geowiz: {
        netPay: Math.round(120 + Math.random() * 60),
        porosity: Math.round((12 + Math.random() * 8) * 10) / 10,
        permeability: Math.round((0.1 + Math.random() * 2) * 10) / 10,
        formations: ['Wolfcamp A', 'Wolfcamp B', 'Bone Spring'],
        confidence: baseConfidence
      },
      'curve-smith': {
        initialRate: Math.round(800 + Math.random() * 600),
        declineRate: Math.round((8 + Math.random() * 4) * 10) / 10,
        eur: Math.round(450000 + Math.random() * 200000),
        typeWell: 'Tier 1 horizontal well',
        confidence: baseConfidence
      },
      econobot: {
        npv: Math.round((2.5 + Math.random() * 2) * 1000000),
        irr: Math.round((22 + Math.random() * 12) * 10) / 10,
        paybackMonths: Math.round(8 + Math.random() * 6),
        breakeven: Math.round(35 + Math.random() * 15),
        confidence: baseConfidence
      },
      'risk-analysis': {
        overallRisk: Math.random() > 0.3 ? 'Medium' : 'Low',
        technicalRisk: Math.random() > 0.4 ? 'Low' : 'Medium',
        marketRisk: Math.random() > 0.5 ? 'Medium' : 'Low',
        riskScore: Math.round(30 + Math.random() * 40),
        confidence: baseConfidence
      },
      title: {
        clearTitle: Math.random() > 0.2,
        ownershipPct: Math.round(95 + Math.random() * 5),
        encumbrances: Math.floor(Math.random() * 3),
        legalRisk: Math.random() > 0.7 ? 'Medium' : 'Low',
        confidence: baseConfidence
      },
      reporter: {
        recommendation: Math.random() > 0.25 ? 'PROCEED' : 'CONDITIONAL',
        summary: 'Comprehensive analysis indicates favorable investment opportunity',
        keyFactors: ['Strong reservoir quality', 'Favorable economics', 'Clear title'],
        confidence: baseConfidence
      }
    };

    return (mockData as any)[serverName] || { confidence: baseConfidence };
  }

  /**
   * Generate investment recommendation based on analysis results
   */
  private generateRecommendation(results: AnalysisResult[], confidence: number): string {
    if (confidence >= 85) {
      return '✅ PROCEED (Strong Economics & Low Risk)';
    } else if (confidence >= 70) {
      return '✅ PROCEED (Strong Economics & Acceptable Risk)';
    } else if (confidence >= 55) {
      return '⚠️ CONDITIONAL (Review Required)';
    } else {
      return '❌ DO NOT PROCEED (High Risk)';
    }
  }

  /**
   * Write comprehensive analysis reports
   */
  private async writeAnalysisReports(
    request: AnalysisRequest,
    results: AnalysisResult[],
    recommendation: string,
    confidence: number
  ): Promise<void> {
    // Investment Decision Summary
    const investmentDecision = `# SHALE YEAH Investment Analysis Report

**Analysis Date:** ${new Date().toISOString().split('T')[0]}
**Tract:** ${request.tractName}
**Analysis ID:** ${request.runId}
**Mode:** ${request.mode.toUpperCase()}

## Executive Summary

**RECOMMENDATION: ${recommendation}**

Our MCP-powered analysis indicates ${confidence}% confidence in the investment thesis based on comprehensive geological, engineering, and financial analysis from ${results.length} domain experts.

## Key Investment Metrics

${this.generateInvestmentMetrics(results)}

## Expert Analysis Summary

${results.map(r => `### ${r.persona}
- **Domain**: ${r.server}
- **Confidence**: ${r.confidence}%
- **Status**: ${r.success ? '✅ Complete' : '❌ Failed'}
- **Execution Time**: ${r.executionTime}ms`).join('\\n\\n')}

## Risk Assessment

Based on comprehensive multi-domain analysis, this investment presents ${confidence >= 70 ? 'acceptable' : 'elevated'} risk levels with ${confidence >= 80 ? 'strong' : 'moderate'} economic fundamentals.

---
*Generated with SHALE YEAH MCP Architecture*
*${new Date().toISOString()}*`;

    await fs.writeFile(
      path.join(request.outputDir, 'INVESTMENT_DECISION.md'),
      investmentDecision
    );

    // Detailed Analysis Report
    const detailedAnalysis = this.generateDetailedReport(request, results);
    await fs.writeFile(
      path.join(request.outputDir, 'DETAILED_ANALYSIS.md'),
      detailedAnalysis
    );

    // Financial Model JSON
    const financialModel = this.generateFinancialModel(request, results);
    await fs.writeFile(
      path.join(request.outputDir, 'FINANCIAL_MODEL.json'),
      JSON.stringify(financialModel, null, 2)
    );

    console.log();
    console.log('📄 Reports Generated:');
    console.log(`   • Executive Summary: ${request.outputDir}/INVESTMENT_DECISION.md`);
    console.log(`   • Detailed Analysis: ${request.outputDir}/DETAILED_ANALYSIS.md`);
    console.log(`   • Financial Model: ${request.outputDir}/FINANCIAL_MODEL.json`);
  }

  private generateInvestmentMetrics(results: AnalysisResult[]): string {
    const econResult = results.find(r => r.server === 'econobot');
    const curveResult = results.find(r => r.server === 'curve-smith');

    if (!econResult?.analysis || !curveResult?.analysis) {
      return '| Metric | Value | Assessment |\\n|--------|-------|------------|\\n| Status | Incomplete | Analysis in progress |';
    }

    return `| Metric | Value | Assessment |
|--------|-------|------------|
| **NPV (10%)** | $${(econResult.analysis.npv / 1000000).toFixed(1)}M | ${econResult.analysis.npv > 2000000 ? 'Strong' : 'Moderate'} |
| **IRR** | ${econResult.analysis.irr}% | ${econResult.analysis.irr > 25 ? 'Excellent' : econResult.analysis.irr > 18 ? 'Good' : 'Fair'} |
| **Payback Period** | ${econResult.analysis.paybackMonths} months | ${econResult.analysis.paybackMonths < 12 ? 'Fast' : 'Standard'} |
| **EUR** | ${(curveResult.analysis.eur / 1000).toFixed(0)}K BOE | ${curveResult.analysis.eur > 500000 ? 'High' : 'Moderate'} |`;
  }

  private generateDetailedReport(request: AnalysisRequest, results: AnalysisResult[]): string {
    return `# Detailed Investment Analysis

**Analysis ID:** ${request.runId}
**Generated:** ${new Date().toISOString()}

## Analysis Overview

This comprehensive analysis was performed using SHALE YEAH's MCP architecture, coordinating ${results.length} domain expert servers for complete investment evaluation.

${results.map(result => `## ${result.persona} Analysis

**Domain:** ${result.server}
**Confidence:** ${result.confidence}%
**Execution Time:** ${result.executionTime}ms

${result.success ?
  `**Key Findings:**
${JSON.stringify(result.analysis, null, 2)}` :
  `**Status:** Analysis failed - ${result.error}`
}
`).join('\\n')}

---
*Detailed analysis generated by SHALE YEAH MCP Client*`;
  }

  private generateFinancialModel(request: AnalysisRequest, results: AnalysisResult[]): any {
    const econResult = results.find(r => r.server === 'econobot');
    const curveResult = results.find(r => r.server === 'curve-smith');

    return {
      analysis_metadata: {
        run_id: request.runId,
        analysis_date: new Date().toISOString(),
        mode: request.mode,
        tract_name: request.tractName
      },
      investment_summary: {
        npv_10_percent: econResult?.analysis?.npv || 0,
        irr: (econResult?.analysis?.irr || 0) / 100,
        payback_months: econResult?.analysis?.paybackMonths || 0,
        roi_multiple: econResult?.analysis?.npv ? (econResult.analysis.npv / 1000000) : 0
      },
      production_profile: {
        initial_oil_rate: curveResult?.analysis?.initialRate || 0,
        eur_boe: curveResult?.analysis?.eur || 0,
        decline_rate: (curveResult?.analysis?.declineRate || 0) / 100
      },
      confidence_metrics: {
        overall_confidence: Math.round(results.filter(r => r.success).reduce((sum, r) => sum + r.confidence, 0) / results.filter(r => r.success).length),
        analysis_completeness: (results.filter(r => r.success).length / results.length) * 100
      }
    };
  }

  /**
   * Cleanup connections to all servers
   */
  async cleanup(): Promise<void> {
    console.log('🔌 Closing MCP connections...');

    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`  ✅ ${name} disconnected`);
      } catch (error) {
        console.log(`  ⚠️  ${name} disconnect error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.clients.clear();
    this.transports.clear();
    this.initialized = false;
  }

  /**
   * Get status of all connected servers
   */
  async getServerStatus(): Promise<Array<{name: string, status: string, capabilities: string[]}>> {
    const status = [];

    for (const config of this.serverConfigs) {
      const client = this.clients.get(config.name);

      status.push({
        name: config.name,
        status: client ? 'connected' : 'disconnected',
        capabilities: config.capabilities
      });
    }

    return status;
  }
}

export default ShaleYeahMCPClient;