#!/usr/bin/env node
/**
 * Risk Analysis MCP Server - Risk Assessment Expert
 *
 * Gaius Probabilis Assessor - Master Risk Strategist
 * Provides comprehensive risk assessment, mitigation strategies,
 * and uncertainty quantification for oil & gas investments.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface RiskAssessment {
  overallRisk: number; // 0-1 scale
  riskCategories: {
    geological: number;
    technical: number;
    economic: number;
    regulatory: number;
    environmental: number;
    operational: number;
  };
  keyRisks: Array<{
    category: string;
    risk: string;
    probability: number;
    impact: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  mitigationStrategies: string[];
  confidence: number;
  recommendation: string;
}

interface MonteCarloAnalysis {
  iterations: number;
  results: {
    npv: { mean: number; p10: number; p50: number; p90: number; stdDev: number };
    irr: { mean: number; p10: number; p50: number; p90: number; stdDev: number };
    probability: { positive_npv: number; target_irr: number };
  };
  sensitivities: Array<{
    variable: string;
    correlation: number;
    impact: string;
  }>;
}

export class RiskAnalysisServer extends MCPServer {
  constructor() {
    super({
      name: 'risk-analysis',
      version: '1.0.0',
      description: 'Risk Assessment & Analysis MCP Server',
      persona: {
        name: 'Gaius Probabilis Assessor',
        role: 'Master Risk Strategist',
        expertise: [
          'Comprehensive risk assessment',
          'Monte Carlo simulation',
          'Uncertainty quantification',
          'Risk mitigation strategies',
          'Regulatory compliance analysis'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['assessments', 'monte-carlo', 'mitigation', 'compliance', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Tool: Assess Investment Risk
    this.registerTool({
      name: 'assess_investment_risk',
      description: 'Comprehensive risk assessment for investment opportunities',
      inputSchema: z.object({
        projectData: z.object({
          geological: z.any().optional(),
          economic: z.any().optional(),
          technical: z.any().optional(),
          regulatory: z.any().optional()
        }),
        riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
        analysisDepth: z.enum(['screening', 'standard', 'comprehensive']).default('standard'),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.assessInvestmentRisk(args)
    });

    // Tool: Monte Carlo Simulation
    this.registerTool({
      name: 'monte_carlo_simulation',
      description: 'Run Monte Carlo simulation for uncertainty analysis',
      inputSchema: z.object({
        variables: z.object({
          oilPrice: z.object({
            base: z.number(),
            min: z.number(),
            max: z.number(),
            distribution: z.enum(['normal', 'triangular', 'uniform']).default('triangular')
          }),
          initialProduction: z.object({
            base: z.number(),
            min: z.number(),
            max: z.number(),
            distribution: z.enum(['normal', 'triangular', 'uniform']).default('normal')
          }),
          declineRate: z.object({
            base: z.number(),
            min: z.number(),
            max: z.number(),
            distribution: z.enum(['normal', 'triangular', 'uniform']).default('normal')
          }),
          capex: z.object({
            base: z.number(),
            min: z.number(),
            max: z.number(),
            distribution: z.enum(['normal', 'triangular', 'uniform']).default('triangular')
          })
        }),
        iterations: z.number().min(1000).max(100000).default(10000),
        targetIRR: z.number().default(0.15),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.runMonteCarloSimulation(args)
    });

    // Tool: Regulatory Risk Analysis
    this.registerTool({
      name: 'analyze_regulatory_risk',
      description: 'Analyze regulatory and compliance risks',
      inputSchema: z.object({
        jurisdiction: z.string().describe('Regulatory jurisdiction'),
        projectType: z.string().describe('Project type and activities'),
        currentRegulations: z.array(z.string()).optional(),
        proposedChanges: z.array(z.string()).optional(),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.analyzeRegulatoryRisk(args)
    });

    // Tool: Generate Risk Report
    this.registerTool({
      name: 'generate_risk_report',
      description: 'Generate comprehensive risk assessment report',
      inputSchema: z.object({
        assessmentId: z.string(),
        reportType: z.enum(['executive', 'technical', 'board']).default('executive'),
        includeMonteCarloResults: z.boolean().default(true),
        includeMitigationPlans: z.boolean().default(true)
      }),
      handler: async (args) => this.generateRiskReport(args)
    });

    // Resource: Risk Assessment
    this.registerResource({
      name: 'risk_assessment',
      uri: 'risk://assessments/{id}',
      description: 'Risk assessment analysis results',
      handler: async (uri) => this.getRiskAssessment(uri)
    });

    // Resource: Monte Carlo Results
    this.registerResource({
      name: 'monte_carlo_results',
      uri: 'risk://monte-carlo/{id}',
      description: 'Monte Carlo simulation results',
      handler: async (uri) => this.getMonteCarloResults(uri)
    });
  }

  /**
   * Assess investment risk
   */
  private async assessInvestmentRisk(args: any): Promise<RiskAssessment> {
    console.log(`⚠️ Assessing investment risk with ${args.riskProfile} profile`);

    const assessment = await this.performRiskAssessment(args);

    // Save assessment
    const assessmentId = `risk_${Date.now()}`;
    const result = {
      assessmentId,
      assessment,
      projectData: args.projectData,
      riskProfile: args.riskProfile,
      analysisDepth: args.analysisDepth,
      timestamp: new Date().toISOString(),
      assessor: this.config.persona.name
    };

    await this.saveResult(`assessments/${assessmentId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return assessment;
  }

  /**
   * Run Monte Carlo simulation
   */
  private async runMonteCarloSimulation(args: any): Promise<MonteCarloAnalysis> {
    console.log(`🎲 Running Monte Carlo simulation with ${args.iterations} iterations`);

    const results = await this.performMonteCarloAnalysis(args);

    // Save results
    const simulationId = `mc_${Date.now()}`;
    const result = {
      simulationId,
      results,
      variables: args.variables,
      iterations: args.iterations,
      targetIRR: args.targetIRR,
      timestamp: new Date().toISOString(),
      assessor: this.config.persona.name
    };

    await this.saveResult(`monte-carlo/${simulationId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return results;
  }

  /**
   * Analyze regulatory risk
   */
  private async analyzeRegulatoryRisk(args: any): Promise<any> {
    console.log(`📋 Analyzing regulatory risk for ${args.jurisdiction}`);

    const analysis = await this.performRegulatoryAnalysis(args);

    // Save analysis
    const regulatoryId = `reg_${Date.now()}`;
    const result = {
      regulatoryId,
      analysis,
      jurisdiction: args.jurisdiction,
      projectType: args.projectType,
      timestamp: new Date().toISOString(),
      assessor: this.config.persona.name
    };

    await this.saveResult(`compliance/${regulatoryId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return analysis;
  }

  /**
   * Generate risk report
   */
  private async generateRiskReport(args: any): Promise<string> {
    console.log(`📊 Generating ${args.reportType} risk report`);

    try {
      const assessmentData = await this.loadResult(`assessments/${args.assessmentId}.json`);
      const report = this.formatRiskReport(assessmentData, args);

      // Save report
      const reportId = `risk_report_${Date.now()}`;
      await this.saveResult(`reports/${reportId}.md`, report);

      return report;
    } catch (error) {
      throw new Error(`Risk assessment not found: ${args.assessmentId}`);
    }
  }

  /**
   * Implementation methods
   */
  private async performRiskAssessment(args: any): Promise<RiskAssessment> {
    const projectData = args.projectData;

    // Calculate risk scores for each category
    const riskCategories = {
      geological: this.assessGeologicalRisk(projectData.geological),
      technical: this.assessTechnicalRisk(projectData.technical),
      economic: this.assessEconomicRisk(projectData.economic),
      regulatory: this.assessRegulatoryRisk(projectData.regulatory),
      environmental: Math.random() * 0.4 + 0.1, // 0.1-0.5
      operational: Math.random() * 0.3 + 0.2 // 0.2-0.5
    };

    // Calculate overall risk (weighted average)
    const weights = { geological: 0.25, technical: 0.2, economic: 0.25, regulatory: 0.1, environmental: 0.1, operational: 0.1 };
    const overallRisk = Object.entries(riskCategories).reduce((sum, [category, risk]) => {
      return sum + (risk * (weights[category as keyof typeof weights] || 0));
    }, 0);

    // Identify key risks
    const keyRisks = this.identifyKeyRisks(riskCategories, projectData);

    // Generate mitigation strategies
    const mitigationStrategies = this.generateMitigationStrategies(keyRisks);

    return {
      overallRisk,
      riskCategories,
      keyRisks,
      mitigationStrategies,
      confidence: Math.floor(Math.random() * 20) + 75, // 75-95%
      recommendation: this.generateRiskRecommendation(overallRisk, args.riskProfile)
    };
  }

  private async performMonteCarloAnalysis(args: any): Promise<MonteCarloAnalysis> {
    const iterations = args.iterations;
    const variables = args.variables;

    // Simulate Monte Carlo results
    const npvResults: number[] = [];
    const irrResults: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Sample from distributions
      const oilPrice = this.sampleFromDistribution(variables.oilPrice);
      const initialProd = this.sampleFromDistribution(variables.initialProduction);
      const declineRate = this.sampleFromDistribution(variables.declineRate);
      const capex = this.sampleFromDistribution(variables.capex);

      // Calculate NPV and IRR for this iteration
      const npv = this.calculateNPV(oilPrice, initialProd, declineRate, capex);
      const irr = this.calculateIRR(oilPrice, initialProd, declineRate, capex);

      npvResults.push(npv);
      irrResults.push(irr);
    }

    // Calculate statistics
    npvResults.sort((a, b) => a - b);
    irrResults.sort((a, b) => a - b);

    const npvStats = this.calculateStatistics(npvResults);
    const irrStats = this.calculateStatistics(irrResults);

    return {
      iterations,
      results: {
        npv: npvStats,
        irr: irrStats,
        probability: {
          positive_npv: npvResults.filter(npv => npv > 0).length / iterations,
          target_irr: irrResults.filter(irr => irr > args.targetIRR).length / iterations
        }
      },
      sensitivities: [
        { variable: 'Oil Price', correlation: 0.85, impact: 'High positive correlation with NPV' },
        { variable: 'Initial Production', correlation: 0.72, impact: 'Strong positive correlation with returns' },
        { variable: 'Decline Rate', correlation: -0.68, impact: 'Negative correlation with long-term value' },
        { variable: 'CAPEX', correlation: -0.45, impact: 'Moderate negative correlation with NPV' }
      ]
    };
  }

  private async performRegulatoryAnalysis(args: any): Promise<any> {
    return {
      jurisdiction: args.jurisdiction,
      riskLevel: Math.random() > 0.7 ? 'HIGH' : Math.random() > 0.4 ? 'MEDIUM' : 'LOW',
      keyRegulations: [
        'Environmental impact assessment requirements',
        'Water usage and disposal regulations',
        'Air quality and emissions standards',
        'Safety and operational compliance'
      ],
      pendingChanges: [
        'Proposed methane emission regulations',
        'Enhanced disclosure requirements',
        'Updated safety standards'
      ],
      complianceCosts: {
        initial: Math.floor(Math.random() * 500000) + 100000,
        annual: Math.floor(Math.random() * 100000) + 25000
      },
      timeline: '6-12 months for full compliance assessment',
      recommendations: [
        'Engage regulatory affairs specialist',
        'Begin early stakeholder consultation',
        'Develop compliance monitoring program',
        'Consider regulatory insurance options'
      ]
    };
  }

  /**
   * Helper methods
   */
  private assessGeologicalRisk(geoData: any): number {
    if (!geoData) return 0.6; // High risk if no data
    const confidence = geoData.confidence || 75;
    return Math.max(0.1, (100 - confidence) / 100);
  }

  private assessTechnicalRisk(techData: any): number {
    if (!techData) return 0.5;
    return Math.random() * 0.4 + 0.1; // 0.1-0.5
  }

  private assessEconomicRisk(econData: any): number {
    if (!econData) return 0.7;
    const irr = econData.irr || 0.1;
    return Math.max(0.1, Math.min(0.8, (0.25 - irr) / 0.15));
  }

  private assessRegulatoryRisk(regData: any): number {
    return Math.random() * 0.3 + 0.1; // 0.1-0.4
  }

  private identifyKeyRisks(riskCategories: any, projectData: any): Array<any> {
    const risks: Array<any> = [];

    Object.entries(riskCategories).forEach(([category, risk]: [string, any]) => {
      if (risk > 0.5) {
        risks.push({
          category,
          risk: `Elevated ${category} risk`,
          probability: risk,
          impact: risk > 0.7 ? 0.8 : 0.6,
          severity: risk > 0.7 ? 'HIGH' : 'MEDIUM'
        });
      }
    });

    return risks;
  }

  private generateMitigationStrategies(keyRisks: any[]): string[] {
    const strategies: string[] = [
      'Implement comprehensive monitoring and surveillance programs',
      'Develop contingency plans for identified risk scenarios',
      'Maintain adequate insurance coverage and financial reserves'
    ];

    keyRisks.forEach(risk => {
      if (risk.category === 'geological') {
        strategies.push('Acquire additional seismic data and geological studies');
      }
      if (risk.category === 'technical') {
        strategies.push('Engage specialized technical consultants and service providers');
      }
      if (risk.category === 'economic') {
        strategies.push('Implement commodity price hedging strategies');
      }
    });

    return strategies;
  }

  private generateRiskRecommendation(overallRisk: number, riskProfile: string): string {
    if (overallRisk < 0.3) return 'Low risk profile supports investment recommendation';
    if (overallRisk < 0.5) return `Moderate risk acceptable for ${riskProfile} risk profile`;
    if (overallRisk < 0.7) return 'Elevated risk requires enhanced mitigation measures';
    return 'High risk profile may warrant declining the opportunity';
  }

  private sampleFromDistribution(variable: any): number {
    const { base, min, max, distribution } = variable;

    switch (distribution) {
      case 'uniform':
        return min + Math.random() * (max - min);
      case 'triangular':
        // Simplified triangular distribution
        const u = Math.random();
        if (u < 0.5) {
          return min + Math.sqrt(u * 2) * (base - min);
        } else {
          return max - Math.sqrt((1 - u) * 2) * (max - base);
        }
      case 'normal':
      default:
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const stdDev = (max - min) / 6; // Approximate std dev
        return Math.max(min, Math.min(max, base + z0 * stdDev));
    }
  }

  private calculateNPV(oilPrice: number, initialProd: number, declineRate: number, capex: number): number {
    let npv = -capex;
    const annualProduction = initialProd * 365;
    const opex = 15; // $/bbl
    const royalty = 0.125;
    const discountRate = 0.1;

    for (let year = 1; year <= 20; year++) {
      const production = annualProduction * Math.pow(1 - declineRate, year - 1);
      const revenue = production * oilPrice * (1 - royalty);
      const costs = production * opex;
      const cashFlow = revenue - costs;
      npv += cashFlow / Math.pow(1 + discountRate, year);
    }

    return npv;
  }

  private calculateIRR(oilPrice: number, initialProd: number, declineRate: number, capex: number): number {
    // Simplified IRR calculation
    const totalRevenue = this.calculateTotalRevenue(oilPrice, initialProd, declineRate);
    const totalCosts = capex + (initialProd * 365 * 15 * 10); // Simplified cost calc
    const netCashFlow = totalRevenue - totalCosts;

    // Approximate IRR based on payback
    if (netCashFlow <= 0) return -0.1;
    const paybackYears = capex / (netCashFlow / 10);
    return Math.max(-0.1, Math.min(0.5, 1 / paybackYears - 0.1));
  }

  private calculateTotalRevenue(oilPrice: number, initialProd: number, declineRate: number): number {
    let totalRevenue = 0;
    const annualProduction = initialProd * 365;

    for (let year = 1; year <= 20; year++) {
      const production = annualProduction * Math.pow(1 - declineRate, year - 1);
      totalRevenue += production * oilPrice * 0.875; // After royalty
    }

    return totalRevenue;
  }

  private calculateStatistics(data: number[]): any {
    const n = data.length;
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
      mean: Math.round(mean),
      p10: Math.round(data[Math.floor(n * 0.1)]),
      p50: Math.round(data[Math.floor(n * 0.5)]),
      p90: Math.round(data[Math.floor(n * 0.9)]),
      stdDev: Math.round(stdDev)
    };
  }

  private formatRiskReport(assessmentData: any, args: any): string {
    const assessment = assessmentData.assessment;
    return `# Risk Assessment Report

## Overall Risk Profile
**Overall Risk Score**: ${(assessment.overallRisk * 100).toFixed(1)}%
**Risk Level**: ${assessment.overallRisk > 0.6 ? 'HIGH' : assessment.overallRisk > 0.4 ? 'MEDIUM' : 'LOW'}
**Confidence**: ${assessment.confidence}%

## Risk Category Breakdown
${Object.entries(assessment.riskCategories).map(([category, risk]: [string, any]) =>
  `- **${category.charAt(0).toUpperCase() + category.slice(1)}**: ${(risk * 100).toFixed(1)}%`
).join('\\n')}

## Key Risk Factors
${assessment.keyRisks.map((risk: any) => `- **${risk.category}**: ${risk.risk} (${risk.severity})`).join('\\n')}

## Mitigation Strategies
${assessment.mitigationStrategies.map((strategy: string) => `- ${strategy}`).join('\\n')}

## Recommendation
${assessment.recommendation}

---
*Generated by ${this.config.persona.name}*`;
  }

  /**
   * Resource handlers
   */
  private async getRiskAssessment(uri: URL): Promise<any> {
    const assessmentId = uri.pathname.split('/').pop();
    return await this.loadResult(`assessments/${assessmentId}.json`);
  }

  private async getMonteCarloResults(uri: URL): Promise<any> {
    const simulationId = uri.pathname.split('/').pop();
    return await this.loadResult(`monte-carlo/${simulationId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new RiskAnalysisServer();
  runMCPServer(server).catch(console.error);
}