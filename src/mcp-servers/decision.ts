/**
 * Decision-Engine MCP Server - Standards-Compliant Implementation
 * Final investment decision logic, bid recommendations, and portfolio optimization
 * Persona: Augustus Decidius Maximus - Supreme Investment Strategist
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface DecisionMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export interface InvestmentDecision {
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

export interface PortfolioFit {
  score: number; // 0-100
  strategic: boolean;
  diversification: number;
  synergies: string[];
  conflicts: string[];
  recommendation: string;
}

export class DecisionMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: DecisionMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'decisions');

    // Create official MCP server for investment decisions
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupDecisionTools();
    this.setupDecisionResources();
    this.setupDecisionPrompts();
  }

  /**
   * Initialize decision MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupDecisionDirectories();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Decision MCP Server: ${error}`);
    }
  }

  /**
   * Setup decision-specific directories
   */
  private async setupDecisionDirectories(): Promise<void> {
    const dirs = ['evaluations', 'recommendations', 'portfolio', 'theses'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  /**
   * Setup decision-making tools
   */
  private setupDecisionTools(): void {
    // Tool: Make Investment Decision
    this.server.tool(
      'make_investment_decision',
      'Analyze all available data and make final investment decision',
      {
        type: 'object',
        properties: {
          tractId: { type: 'string', description: 'Tract identifier' },
          geologicalData: { type: 'object', optional: true, description: 'Geological analysis results' },
          economicData: { type: 'object', optional: true, description: 'Economic analysis results' },
          riskData: { type: 'object', optional: true, description: 'Risk assessment results' },
          marketData: { type: 'object', optional: true, description: 'Market analysis results' },
          legalData: { type: 'object', optional: true, description: 'Legal due diligence results' },
          titleData: { type: 'object', optional: true, description: 'Title verification results' },
          budget: { type: 'number', optional: true, description: 'Available budget for investment' },
          strategy: { type: 'string', optional: true, description: 'Investment strategy context' }
        },
        required: ['tractId']
      },
      async (args, extra) => {
        const decision = await this.makeInvestmentDecision(
          args.tractId,
          {
            geological: args.geologicalData,
            economic: args.economicData,
            risk: args.riskData,
            market: args.marketData,
            legal: args.legalData,
            title: args.titleData,
            budget: args.budget,
            strategy: args.strategy
          }
        );

        // Save decision evaluation
        const evaluationPath = path.join(this.dataPath, 'evaluations', `${args.tractId}_evaluation.json`);
        await fs.writeFile(evaluationPath, JSON.stringify(decision, null, 2));

        return { content: [{ type: "text", text: JSON.stringify(decision) }] };
      }
    );

    // Tool: Calculate Bid Price
    this.server.tool(
      'calculate_bid_price',
      'Calculate optimal bid price based on valuation and competition',
      {
        type: 'object',
        properties: {
          tractId: { type: 'string', description: 'Tract identifier' },
          npv: { type: 'number', description: 'Net Present Value' },
          irr: { type: 'number', description: 'Internal Rate of Return' },
          payback: { type: 'number', description: 'Payback period in years' },
          competition: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Competition level' },
          riskAdjustment: { type: 'number', optional: true, description: 'Risk adjustment factor' },
          strategicPremium: { type: 'number', optional: true, description: 'Strategic premium percentage' }
        },
        required: ['tractId', 'npv', 'irr', 'payback', 'competition']
      },
      async (args, extra) => {
        const bidPrice = await this.calculateBidPrice(args);
        
        const recommendation = {
          tractId: args.tractId,
          recommendedBid: bidPrice.recommended,
          maxBid: bidPrice.maximum,
          minBid: bidPrice.minimum,
          rationale: bidPrice.rationale,
          competitionFactor: bidPrice.competitionFactor,
          riskFactor: bidPrice.riskFactor,
          timestamp: new Date().toISOString()
        };

        // Save bid recommendation
        const recPath = path.join(this.dataPath, 'recommendations', `${args.tractId}_bid.json`);
        await fs.writeFile(recPath, JSON.stringify(recommendation, null, 2));

        return { content: [{ type: "text", text: JSON.stringify(recommendation) }] };
      }
    );

    // Tool: Assess Portfolio Fit
    this.server.tool(
      'assess_portfolio_fit',
      'Evaluate how tract fits within overall portfolio strategy',
      {
        type: 'object',
        properties: {
          tractId: { type: 'string', description: 'Tract identifier' },
          currentPortfolio: { type: 'array', items: { type: 'object' }, optional: true, description: 'Current portfolio holdings' },
          strategicGoals: { type: 'array', items: { type: 'string' }, optional: true, description: 'Strategic objectives' },
          riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'], description: 'Risk tolerance' },
          geography: { type: 'string', optional: true, description: 'Geographic focus' },
          timeline: { type: 'string', optional: true, description: 'Investment timeline' }
        },
        required: ['tractId', 'riskTolerance']
      },
      async (args, extra) => {
        const fit = await this.assessPortfolioFit(args);
        
        // Save portfolio assessment
        const fitPath = path.join(this.dataPath, 'portfolio', `${args.tractId}_fit.json`);
        await fs.writeFile(fitPath, JSON.stringify(fit, null, 2));

        return { content: [{ type: "text", text: JSON.stringify(fit) }] };
      }
    );

    // Tool: Generate Investment Thesis
    this.server.tool(
      'generate_investment_thesis',
      'Generate comprehensive investment thesis document',
      {
        type: 'object',
        properties: {
          tractId: { type: 'string', description: 'Tract identifier' },
          analysisData: { type: 'object', description: 'Compiled analysis from all agents' },
          decision: { type: 'object', description: 'Investment decision' },
          template: { type: 'string', enum: ['executive', 'detailed', 'board'], optional: true, description: 'Thesis template' }
        },
        required: ['tractId', 'analysisData', 'decision']
      },
      async (args, extra) => {
        const thesis = await this.generateInvestmentThesis(args);
        
        // Save investment thesis
        const thesisPath = path.join(this.dataPath, 'theses', `${args.tractId}_thesis.md`);
        await fs.writeFile(thesisPath, thesis);

        const result = {
          tractId: args.tractId,
          thesisPath,
          executiveSummary: thesis.split('\n').slice(0, 10).join('\n'),
          timestamp: new Date().toISOString()
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  /**
   * Setup decision-specific resources
   */
  private setupDecisionResources(): void {
    // Resource: Decision Evaluations
    this.server.resource(
      'decision://evaluations/{tract_id}',
      'decision://evaluations/*',
      async (uri) => {
        const tractId = uri.pathname.split('/').pop()?.replace('.json', '');
        const evaluationPath = path.join(this.dataPath, 'evaluations', `${tractId}_evaluation.json`);
        
        try {
          const data = await fs.readFile(evaluationPath, 'utf-8');
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: data
            }]
          };
        } catch {
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Evaluation not found' })
            }]
          };
        }
      }
    );

    // Resource: Bid Recommendations
    this.server.resource(
      'decision://recommendations/{analysis_id}',
      'decision://recommendations/*',
      async (uri) => {
        const analysisId = uri.pathname.split('/').pop()?.replace('.json', '');
        const recPath = path.join(this.dataPath, 'recommendations', `${analysisId}_bid.json`);
        
        try {
          const data = await fs.readFile(recPath, 'utf-8');
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: data
            }]
          };
        } catch {
          return {
            contents: [{
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Recommendation not found' })
            }]
          };
        }
      }
    );
  }

  /**
   * Setup decision-making prompts
   */
  private setupDecisionPrompts(): void {
    this.server.prompt(
      'augustus-decision-maker',
      'Augustus Decidius Maximus persona for investment decisions',
      {
        context: z.string().describe('Investment context and data'),
        question: z.string().describe('Specific decision question')
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are Augustus Decidius Maximus, Supreme Investment Strategist for oil & gas acquisitions.

PERSONA:
- Roman-inspired commanding presence with modern financial acumen
- Decisive, analytical, strategic thinking
- Risk-aware but opportunity-focused
- Speaks with authority and conviction
- Balances boldness with prudence

EXPERTISE:
- 30+ years in energy investments
- Deep understanding of geology, economics, risk
- Portfolio optimization and strategic fit
- Market timing and competitive dynamics
- Regulatory and operational considerations

DECISION FRAMEWORK:
1. Data Integration - Synthesize all agent inputs
2. Risk Assessment - Quantify and qualify risks
3. Value Creation - Identify upside scenarios
4. Strategic Fit - Portfolio alignment
5. Competitive Position - Market advantages
6. Financial Metrics - ROI, IRR, payback
7. Final Judgment - Clear recommendation

Context: ${args.context}
Question: ${args.question}`
            }
          }
        ]
      })
    );
  }

  /**
   * Make comprehensive investment decision
   */
  private async makeInvestmentDecision(
    tractId: string,
    data: any
  ): Promise<InvestmentDecision> {
    // Augustus Decidius Maximus decision logic
    const reasoning: string[] = [];
    const riskFactors: string[] = [];
    const upside: string[] = [];
    
    // Analyze geological factors
    if (data.geological) {
      reasoning.push('Geological analysis indicates favorable formation characteristics');
      if (data.geological.risk > 0.7) {
        riskFactors.push('High geological uncertainty in reservoir quality');
      } else {
        upside.push('Strong geological fundamentals support production estimates');
      }
    }

    // Analyze economic factors
    if (data.economic) {
      reasoning.push(`Economic analysis shows NPV of $${data.economic.npv?.toLocaleString() || 'TBD'}`);
      if (data.economic.irr > 20) {
        upside.push('Exceptional returns exceed hurdle rate significantly');
      } else if (data.economic.irr < 12) {
        riskFactors.push('Below-threshold returns may not justify investment');
      }
    }

    // Assess risk factors
    if (data.risk) {
      if (data.risk.overallRisk > 0.6) {
        riskFactors.push('Elevated risk profile requires careful consideration');
      } else {
        upside.push('Manageable risk profile supports investment thesis');
      }
    }

    // Market considerations
    if (data.market) {
      reasoning.push('Market analysis incorporated into decision framework');
      if (data.market.outlook === 'positive') {
        upside.push('Favorable market conditions enhance investment attractiveness');
      }
    }

    // Legal and title verification
    if (data.legal?.cleared && data.title?.valid) {
      upside.push('Clean legal and title status removes execution risk');
    } else {
      riskFactors.push('Legal or title issues require resolution before proceeding');
    }

    // Decision logic
    let decision: 'INVEST' | 'PASS' | 'CONDITIONAL' = 'PASS';
    let confidence = 0.3;
    let recommendedBid = 0;
    let maxBid = 0;

    if (data.economic?.npv > 0 && riskFactors.length < 3) {
      if (riskFactors.length === 0 && upside.length >= 3) {
        decision = 'INVEST';
        confidence = 0.85;
      } else if (upside.length >= 2) {
        decision = 'CONDITIONAL';
        confidence = 0.65;
      }
    }

    // Bid calculations
    if (decision !== 'PASS' && data.economic?.npv) {
      recommendedBid = Math.round(data.economic.npv * 0.7); // 70% of NPV
      maxBid = Math.round(data.economic.npv * 0.85); // 85% of NPV
    }

    return {
      decision,
      confidence,
      recommendedBid,
      maxBid,
      reasoning,
      riskFactors,
      upside,
      conditions: decision === 'CONDITIONAL' ? [
        'Resolve identified risk factors',
        'Obtain additional technical data',
        'Confirm market conditions'
      ] : undefined,
      timeline: decision === 'INVEST' ? '30 days to close' : '60 days for due diligence'
    };
  }

  /**
   * Calculate optimal bid price
   */
  private async calculateBidPrice(args: any) {
    const baseValue = args.npv;
    let competitionFactor = 1.0;
    let riskFactor = args.riskAdjustment || 1.0;

    // Competition adjustments
    switch (args.competition) {
      case 'high':
        competitionFactor = 1.15;
        break;
      case 'medium':
        competitionFactor = 1.05;
        break;
      case 'low':
        competitionFactor = 0.95;
        break;
    }

    // Strategic premium
    const strategicPremium = (args.strategicPremium || 0) / 100;

    const recommended = Math.round(baseValue * 0.7 * competitionFactor * riskFactor * (1 + strategicPremium));
    const maximum = Math.round(baseValue * 0.85 * competitionFactor * riskFactor * (1 + strategicPremium));
    const minimum = Math.round(baseValue * 0.5 * competitionFactor * riskFactor);

    return {
      recommended,
      maximum,
      minimum,
      competitionFactor,
      riskFactor,
      rationale: [
        `Base NPV: $${baseValue.toLocaleString()}`,
        `Competition factor: ${competitionFactor}x (${args.competition} competition)`,
        `Risk adjustment: ${riskFactor}x`,
        `Strategic premium: ${(strategicPremium * 100).toFixed(1)}%`,
        `Recommended represents 70% of adjusted value`,
        `Maximum represents 85% of adjusted value`
      ]
    };
  }

  /**
   * Assess portfolio fit
   */
  private async assessPortfolioFit(args: any): Promise<PortfolioFit> {
    let score = 50; // Base score
    const synergies: string[] = [];
    const conflicts: string[] = [];

    // Geographic synergies
    if (args.geography) {
      score += 15;
      synergies.push(`Geographic focus on ${args.geography} aligns with strategy`);
    }

    // Risk tolerance alignment
    const riskBonus = args.riskTolerance === 'aggressive' ? 10 : 
                     args.riskTolerance === 'moderate' ? 5 : 0;
    score += riskBonus;

    // Strategic goals alignment
    if (args.strategicGoals?.length > 0) {
      score += 10;
      synergies.push('Aligned with stated strategic objectives');
    }

    // Timeline considerations
    if (args.timeline) {
      score += 5;
      synergies.push(`Investment timeline matches portfolio strategy`);
    }

    // Portfolio diversification
    const diversification = Math.min(100, score + 20);

    return {
      score: Math.min(100, score),
      strategic: score >= 70,
      diversification,
      synergies,
      conflicts,
      recommendation: score >= 80 ? 'STRONG FIT' : 
                     score >= 60 ? 'GOOD FIT' : 
                     score >= 40 ? 'ACCEPTABLE FIT' : 'POOR FIT'
    };
  }

  /**
   * Generate comprehensive investment thesis
   */
  private async generateInvestmentThesis(args: any): Promise<string> {
    const { tractId, analysisData, decision } = args;
    const timestamp = new Date().toISOString();

    return `# Investment Thesis - Tract ${tractId}

**Date:** ${timestamp}  
**Decision:** ${decision.decision || 'TBD'}  
**Confidence:** ${((decision.confidence || 0) * 100).toFixed(1)}%  
**Recommended Bid:** $${(decision.recommendedBid || 0).toLocaleString()}  

## Executive Summary

Augustus Decidius Maximus, Supreme Investment Strategist, presents this comprehensive investment thesis for Tract ${tractId}. Following rigorous multi-disciplinary analysis, we ${decision.decision === 'INVEST' ? 'RECOMMEND IMMEDIATE INVESTMENT' : decision.decision === 'CONDITIONAL' ? 'CONDITIONALLY RECOMMEND INVESTMENT' : 'RECOMMEND PASSING'} on this opportunity.

## Investment Rationale

${decision.reasoning?.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'Analysis pending completion.'}

## Upside Potential

${decision.upside?.map((u: string, i: number) => `• ${u}`).join('\n') || 'Upside analysis in progress.'}

## Risk Factors

${decision.riskFactors?.map((r: string, i: number) => `• ${r}`).join('\n') || 'Risk assessment pending.'}

${decision.conditions ? `
## Conditions for Investment

${decision.conditions.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}
` : ''}

## Financial Summary

- **Recommended Bid:** $${(decision.recommendedBid || 0).toLocaleString()}
- **Maximum Bid:** $${(decision.maxBid || 0).toLocaleString()}
- **Investment Timeline:** ${decision.timeline || 'TBD'}

## Conclusion

Based on comprehensive analysis across geological, economic, risk, market, legal, and title dimensions, this ${decision.decision?.toLowerCase() || 'pending'} recommendation reflects our commitment to disciplined capital allocation and strategic value creation.

**Augustus Decidius Maximus**  
*Supreme Investment Strategist*

---
*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*
`;
  }

  /**
   * Start the decision MCP server
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    console.log(`🏛️  Augustus Decidius Maximus (Decision Engine) MCP Server v${this.version} initialized`);
  }

  /**
   * Stop the decision MCP server
   */
  async stop(): Promise<void> {
    console.log('🏛️  Augustus Decidius Maximus MCP Server shutdown complete');
  }

  /**
   * Get server instance for integration
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Get server status and statistics
   */
  async getStatus() {
    return {
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      resourceRoot: this.resourceRoot,
      dataPath: this.dataPath,
      persona: 'Augustus Decidius Maximus - Supreme Investment Strategist',
      capabilities: {
        tools: ['make_investment_decision', 'calculate_bid_price', 'assess_portfolio_fit', 'generate_investment_thesis'],
        resources: ['decision://evaluations/{tract_id}', 'decision://recommendations/{analysis_id}'],
        prompts: ['augustus-decision-maker'],
        decision_framework: ['GO/NO GO/CONDITIONAL', 'Executive-focused output', 'Clear financial metrics', 'Risk-adjusted recommendations']
      }
    };
  }
}

export default DecisionMCPServer;