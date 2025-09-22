#!/usr/bin/env node
/**
 * Decision MCP Server - Investment Decision Expert
 *
 * Augustus Decidius Maximus - Supreme Investment Strategist
 * Provides final investment decision logic, bid recommendations,
 * and portfolio optimization for oil & gas opportunities.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface InvestmentDecision {
  decision: 'INVEST' | 'PASS' | 'CONDITIONAL';
  confidence: number;
  recommendedBid: number;
  maxBid: number;
  reasoning: string[];
  riskFactors: string[];
  upside: string[];
  conditions?: string[];
  timeline: string;
}

interface PortfolioFit {
  score: number; // 0-100
  strategic: boolean;
  diversification: number;
  synergies: string[];
  conflicts: string[];
  recommendation: string;
}

interface BidStrategy {
  recommendedBid: number;
  maxBid: number;
  bidIncrement: number;
  strategy: 'AGGRESSIVE' | 'CONSERVATIVE' | 'OPPORTUNISTIC';
  reasoning: string;
}

export class DecisionServer extends MCPServer {
  constructor() {
    super({
      name: 'decision',
      version: '1.0.0',
      description: 'Investment Decision MCP Server',
      persona: {
        name: 'Augustus Decidius Maximus',
        role: 'Supreme Investment Strategist',
        expertise: [
          'Final investment decision logic',
          'Strategic bid recommendations',
          'Portfolio optimization and fit analysis',
          'Risk-adjusted return evaluation',
          'Market timing and competitive positioning'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['decisions', 'bids', 'portfolio', 'strategies', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Tool: Make Investment Decision
    this.registerTool({
      name: 'make_investment_decision',
      description: 'Make final investment decision based on all analysis inputs',
      inputSchema: z.object({
        analysisInputs: z.object({
          geological: z.any().optional(),
          economic: z.any().optional(),
          engineering: z.any().optional(),
          risk: z.any().optional(),
          legal: z.any().optional()
        }),
        investmentCriteria: z.object({
          minNPV: z.number().default(1000000),
          minIRR: z.number().default(0.15),
          maxPayback: z.number().default(24),
          maxRisk: z.number().default(0.7)
        }).optional(),
        marketConditions: z.object({
          oilPrice: z.number().optional(),
          gasPrice: z.number().optional(),
          competitiveActivity: z.string().optional()
        }).optional(),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.makeInvestmentDecision(args)
    });

    // Tool: Calculate Bid Strategy
    this.registerTool({
      name: 'calculate_bid_strategy',
      description: 'Calculate optimal bidding strategy for lease acquisition',
      inputSchema: z.object({
        valuation: z.object({
          npv: z.number(),
          irr: z.number(),
          p10: z.number().optional(),
          p50: z.number().optional(),
          p90: z.number().optional()
        }),
        marketData: z.object({
          recentSales: z.array(z.number()).optional(),
          competitorActivity: z.string().optional(),
          acreageAvailability: z.string().optional()
        }).optional(),
        strategy: z.enum(['AGGRESSIVE', 'CONSERVATIVE', 'OPPORTUNISTIC']).default('CONSERVATIVE'),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.calculateBidStrategy(args)
    });

    // Tool: Analyze Portfolio Fit
    this.registerTool({
      name: 'analyze_portfolio_fit',
      description: 'Analyze how opportunity fits within existing portfolio',
      inputSchema: z.object({
        opportunity: z.object({
          location: z.string(),
          formation: z.string(),
          acreage: z.number(),
          expectedReturns: z.object({
            npv: z.number(),
            irr: z.number()
          })
        }),
        currentPortfolio: z.array(z.object({
          name: z.string(),
          location: z.string(),
          formation: z.string(),
          status: z.string()
        })).optional(),
        portfolioStrategy: z.object({
          diversificationTargets: z.array(z.string()).optional(),
          riskTolerance: z.number().optional(),
          growthTargets: z.object({
            production: z.number().optional(),
            reserves: z.number().optional()
          }).optional()
        }).optional()
      }),
      handler: async (args) => this.analyzePortfolioFit(args)
    });

    // Tool: Generate Decision Report
    this.registerTool({
      name: 'generate_decision_report',
      description: 'Generate comprehensive investment decision report',
      inputSchema: z.object({
        decisionId: z.string(),
        format: z.enum(['executive', 'detailed', 'board']).default('executive'),
        includeAppendices: z.boolean().default(true)
      }),
      handler: async (args) => this.generateDecisionReport(args)
    });

    // Resource: Investment Decision
    this.registerResource({
      name: 'investment_decision',
      uri: 'decision://decisions/{id}',
      description: 'Investment decision analysis and recommendation',
      handler: async (uri) => this.getInvestmentDecision(uri)
    });

    // Resource: Bid Strategy
    this.registerResource({
      name: 'bid_strategy',
      uri: 'decision://bids/{id}',
      description: 'Bid strategy and valuation analysis',
      handler: async (uri) => this.getBidStrategy(uri)
    });
  }

  /**
   * Make final investment decision
   */
  private async makeInvestmentDecision(args: any): Promise<InvestmentDecision> {
    console.log(`🎯 Making investment decision with ${Object.keys(args.analysisInputs).length} input analyses`);

    const decision = await this.evaluateInvestmentOpportunity(args);

    // Save decision
    const decisionId = `decision_${Date.now()}`;
    const result = {
      decisionId,
      decision,
      analysisInputs: args.analysisInputs,
      investmentCriteria: args.investmentCriteria,
      marketConditions: args.marketConditions,
      timestamp: new Date().toISOString(),
      strategist: this.config.persona.name
    };

    await this.saveResult(`decisions/${decisionId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return decision;
  }

  /**
   * Calculate optimal bid strategy
   */
  private async calculateBidStrategy(args: any): Promise<BidStrategy> {
    console.log(`💰 Calculating bid strategy for NPV: $${args.valuation.npv.toLocaleString()}`);

    const strategy = await this.developBidStrategy(args);

    // Save strategy
    const strategyId = `bid_${Date.now()}`;
    const result = {
      strategyId,
      strategy,
      valuation: args.valuation,
      marketData: args.marketData,
      timestamp: new Date().toISOString(),
      strategist: this.config.persona.name
    };

    await this.saveResult(`bids/${strategyId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return strategy;
  }

  /**
   * Analyze portfolio fit
   */
  private async analyzePortfolioFit(args: any): Promise<PortfolioFit> {
    console.log(`📊 Analyzing portfolio fit for ${args.opportunity.location} opportunity`);

    const fit = await this.assessPortfolioFit(args);

    // Save analysis
    const fitId = `portfolio_${Date.now()}`;
    const result = {
      fitId,
      fit,
      opportunity: args.opportunity,
      currentPortfolio: args.currentPortfolio,
      portfolioStrategy: args.portfolioStrategy,
      timestamp: new Date().toISOString(),
      strategist: this.config.persona.name
    };

    await this.saveResult(`portfolio/${fitId}.json`, result);

    return fit;
  }

  /**
   * Generate decision report
   */
  private async generateDecisionReport(args: any): Promise<string> {
    console.log(`📝 Generating ${args.format} decision report for ${args.decisionId}`);

    try {
      const decisionData = await this.loadResult(`decisions/${args.decisionId}.json`);
      const report = this.formatDecisionReport(decisionData, args);

      // Save report
      const reportId = `report_${Date.now()}`;
      await this.saveResult(`reports/${reportId}.md`, report);

      return report;
    } catch (error) {
      throw new Error(`Decision not found: ${args.decisionId}`);
    }
  }

  /**
   * Evaluate investment opportunity and make decision
   */
  private async evaluateInvestmentOpportunity(args: any): Promise<InvestmentDecision> {
    const inputs = args.analysisInputs;
    const criteria = args.investmentCriteria || {};

    // Extract key metrics
    const npv = inputs.economic?.npv || 0;
    const irr = inputs.economic?.irr || 0;
    const payback = inputs.economic?.paybackMonths || 999;
    const riskScore = inputs.risk?.overallRisk || 0.5;

    // Decision logic
    let decision: 'INVEST' | 'PASS' | 'CONDITIONAL' = 'PASS';
    let confidence = 75;
    const reasoning: string[] = [];
    const riskFactors: string[] = [];
    const upside: string[] = [];
    const conditions: string[] = [];

    // Evaluate against criteria
    if (npv >= criteria.minNPV && irr >= criteria.minIRR && payback <= criteria.maxPayback) {
      if (riskScore <= criteria.maxRisk) {
        decision = 'INVEST';
        confidence = 85;
        reasoning.push(`Strong economics: NPV $${(npv/1000000).toFixed(1)}M, IRR ${(irr*100).toFixed(1)}%`);
        reasoning.push(`Acceptable risk profile: ${(riskScore*100).toFixed(1)}% risk score`);
      } else {
        decision = 'CONDITIONAL';
        confidence = 70;
        reasoning.push('Economics meet thresholds but risk is elevated');
        conditions.push('Additional risk mitigation required');
        conditions.push('Enhanced monitoring and contingency planning');
      }
    } else {
      decision = 'PASS';
      confidence = 80;
      reasoning.push('Economics do not meet minimum investment criteria');
      if (npv < criteria.minNPV) reasoning.push(`NPV below threshold: $${(npv/1000000).toFixed(1)}M < $${(criteria.minNPV/1000000).toFixed(1)}M`);
      if (irr < criteria.minIRR) reasoning.push(`IRR below threshold: ${(irr*100).toFixed(1)}% < ${(criteria.minIRR*100).toFixed(1)}%`);
    }

    // Identify risk factors
    if (riskScore > 0.6) riskFactors.push('Elevated overall risk score');
    if (payback > 18) riskFactors.push('Extended payback period');
    if (!inputs.geological) riskFactors.push('Limited geological data available');

    // Identify upside potential
    if (irr > 0.25) upside.push('Strong IRR indicates significant upside potential');
    if (inputs.geological?.confidence > 85) upside.push('High geological confidence supports upside case');
    if (inputs.economic?.p10 && inputs.economic.p10 > npv * 1.5) upside.push('Significant upside in P10 scenario');

    return {
      decision,
      confidence,
      recommendedBid: this.calculateRecommendedBid(npv, decision),
      maxBid: this.calculateMaxBid(npv, decision),
      reasoning,
      riskFactors,
      upside,
      conditions: conditions.length > 0 ? conditions : undefined,
      timeline: this.determineTimeline(decision, riskScore)
    };
  }

  /**
   * Develop optimal bid strategy
   */
  private async developBidStrategy(args: any): Promise<BidStrategy> {
    const valuation = args.valuation;
    const strategy = args.strategy;

    let bidMultiplier = 0.7; // Conservative starting point
    let maxMultiplier = 0.85;

    switch (strategy) {
      case 'AGGRESSIVE':
        bidMultiplier = 0.85;
        maxMultiplier = 0.95;
        break;
      case 'OPPORTUNISTIC':
        bidMultiplier = 0.6;
        maxMultiplier = 0.8;
        break;
      case 'CONSERVATIVE':
      default:
        bidMultiplier = 0.7;
        maxMultiplier = 0.85;
        break;
    }

    const recommendedBid = valuation.npv * bidMultiplier;
    const maxBid = valuation.npv * maxMultiplier;

    return {
      recommendedBid: Math.round(recommendedBid),
      maxBid: Math.round(maxBid),
      bidIncrement: Math.round(recommendedBid * 0.05), // 5% increments
      strategy,
      reasoning: this.generateBidReasoning(valuation, strategy, bidMultiplier)
    };
  }

  /**
   * Assess portfolio fit
   */
  private async assessPortfolioFit(args: any): Promise<PortfolioFit> {
    const opportunity = args.opportunity;
    const portfolio = args.currentPortfolio || [];

    // Calculate diversification score
    const formations = portfolio.map((p: any) => p.formation);
    const locations = portfolio.map((p: any) => p.location);

    const formationDiversity = !formations.includes(opportunity.formation) ? 20 : 0;
    const locationDiversity = !locations.includes(opportunity.location) ? 20 : 0;

    // Calculate strategic value
    const strategic = opportunity.expectedReturns.irr > 0.2;
    const strategicScore = strategic ? 30 : 10;

    // Synergies and conflicts
    const synergies: string[] = [];
    const conflicts: string[] = [];

    portfolio.forEach((asset: any) => {
      if (asset.location === opportunity.location) {
        synergies.push(`Operational synergies with existing ${asset.name} operations`);
      }
      if (asset.formation === opportunity.formation) {
        synergies.push(`Technical expertise transfer from ${asset.formation} experience`);
      }
    });

    const totalScore = formationDiversity + locationDiversity + strategicScore + 30; // Base score

    return {
      score: Math.min(totalScore, 100),
      strategic,
      diversification: (formationDiversity + locationDiversity) / 40,
      synergies,
      conflicts,
      recommendation: this.generatePortfolioRecommendation(totalScore, strategic)
    };
  }

  /**
   * Helper methods
   */
  private calculateRecommendedBid(npv: number, decision: string): number {
    if (decision === 'PASS') return 0;
    return Math.round(npv * 0.7); // Conservative 70% of NPV
  }

  private calculateMaxBid(npv: number, decision: string): number {
    if (decision === 'PASS') return 0;
    return Math.round(npv * 0.85); // Maximum 85% of NPV
  }

  private determineTimeline(decision: string, riskScore: number): string {
    if (decision === 'PASS') return 'No timeline - opportunity declined';
    if (decision === 'CONDITIONAL') return '60-90 days pending risk mitigation';
    return riskScore > 0.6 ? '45-60 days with enhanced due diligence' : '30-45 days standard timeline';
  }

  private generateBidReasoning(valuation: any, strategy: string, multiplier: number): string {
    return `${strategy} strategy applies ${(multiplier*100).toFixed(0)}% of NPV ($${(valuation.npv/1000000).toFixed(1)}M) with IRR of ${(valuation.irr*100).toFixed(1)}%`;
  }

  private generatePortfolioRecommendation(score: number, strategic: boolean): string {
    if (score >= 80) return 'Strong fit - high recommendation for portfolio inclusion';
    if (score >= 60) return 'Good fit - recommend inclusion with standard evaluation';
    if (strategic) return 'Strategic value despite lower fit score - consider for inclusion';
    return 'Limited portfolio fit - requires exceptional economics to justify';
  }

  private formatDecisionReport(decisionData: any, args: any): string {
    const decision = decisionData.decision;
    return `# Investment Decision Report

## Executive Summary
**Decision**: ${decision.decision}
**Confidence**: ${decision.confidence}%
**Recommended Bid**: $${(decision.recommendedBid/1000000).toFixed(1)}M
**Timeline**: ${decision.timeline}

## Investment Reasoning
${decision.reasoning.map((r: string) => `- ${r}`).join('\\n')}

## Risk Factors
${decision.riskFactors.map((r: string) => `- ${r}`).join('\\n')}

## Upside Potential
${decision.upside.map((u: string) => `- ${u}`).join('\\n')}

${decision.conditions ? `## Conditions
${decision.conditions.map((c: string) => `- ${c}`).join('\\n')}` : ''}

---
*Generated by ${this.config.persona.name}*`;
  }

  /**
   * Resource handlers
   */
  private async getInvestmentDecision(uri: URL): Promise<any> {
    const decisionId = uri.pathname.split('/').pop();
    return await this.loadResult(`decisions/${decisionId}.json`);
  }

  private async getBidStrategy(uri: URL): Promise<any> {
    const strategyId = uri.pathname.split('/').pop();
    return await this.loadResult(`bids/${strategyId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DecisionServer();
  runMCPServer(server).catch(console.error);
}