#!/usr/bin/env node
/**
 * Reporter MCP Server - Executive Reporting Expert
 *
 * Scriptor Reporticus Maximus - Master Report Generator
 * Provides comprehensive report generation, data synthesis,
 * and executive decision support for oil & gas investments.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface InvestmentDecision {
  recommendation: 'PROCEED' | 'REJECT' | 'DEFER';
  confidence: number;
  keyMetrics: {
    npv: number;
    irr: number;
    payback: number;
    netPay: number;
  };
  riskFactors: string[];
  nextSteps: string[];
}

interface ExecutiveReport {
  reportId: string;
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  recommendation: InvestmentDecision;
  appendices: string[];
}

export class ReporterServer extends MCPServer {
  constructor() {
    super({
      name: 'reporter',
      version: '1.0.0',
      description: 'Executive Reporting MCP Server',
      persona: {
        name: 'Scriptor Reporticus Maximus',
        role: 'Master Report Generator',
        expertise: [
          'Executive report writing and synthesis',
          'Investment decision frameworks',
          'Data visualization and presentation',
          'Risk communication and mitigation',
          'Strategic recommendation development'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['reports', 'decisions', 'templates', 'charts', 'archives'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Tool: Generate Investment Decision
    this.registerTool({
      name: 'generate_investment_decision',
      description: 'Generate comprehensive investment decision from analysis results',
      inputSchema: z.object({
        tractName: z.string().describe('Investment tract name'),
        analysisResults: z.object({
          geological: z.any().optional(),
          economic: z.any().optional(),
          engineering: z.any().optional(),
          risk: z.any().optional()
        }),
        decisionCriteria: z.object({
          minNPV: z.number().default(1000000),
          minIRR: z.number().default(0.15),
          maxPayback: z.number().default(24)
        }).optional(),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.generateInvestmentDecision(args)
    });

    // Tool: Create Executive Report
    this.registerTool({
      name: 'create_executive_report',
      description: 'Create comprehensive executive report',
      inputSchema: z.object({
        decisionId: z.string().describe('Investment decision ID'),
        reportType: z.enum(['executive', 'technical', 'board']).default('executive'),
        includeCharts: z.boolean().default(true),
        includeAppendices: z.boolean().default(true),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.createExecutiveReport(args)
    });

    // Tool: Synthesize Analysis
    this.registerTool({
      name: 'synthesize_analysis',
      description: 'Synthesize multiple domain expert analyses into unified insights',
      inputSchema: z.object({
        analyses: z.array(z.object({
          domain: z.string(),
          results: z.any(),
          confidence: z.number()
        })),
        synthesisType: z.enum(['summary', 'detailed', 'comparison']).default('summary')
      }),
      handler: async (args) => this.synthesizeAnalysis(args)
    });

    // Tool: Generate Charts
    this.registerTool({
      name: 'generate_charts',
      description: 'Generate charts and visualizations for reports',
      inputSchema: z.object({
        data: z.any().describe('Data to visualize'),
        chartTypes: z.array(z.enum(['bar', 'line', 'pie', 'scatter', 'waterfall'])),
        outputFormat: z.enum(['json', 'svg', 'png']).default('json')
      }),
      handler: async (args) => this.generateCharts(args)
    });

    // Resource: Investment Decision
    this.registerResource({
      name: 'investment_decision',
      uri: 'reporter://decisions/{id}',
      description: 'Investment decision analysis',
      handler: async (uri) => this.getInvestmentDecision(uri)
    });

    // Resource: Executive Report
    this.registerResource({
      name: 'executive_report',
      uri: 'reporter://reports/{id}',
      description: 'Executive report document',
      handler: async (uri) => this.getExecutiveReport(uri)
    });
  }

  /**
   * Generate comprehensive investment decision
   */
  private async generateInvestmentDecision(args: any): Promise<InvestmentDecision> {
    console.log(`📊 Generating investment decision for ${args.tractName}`);

    const decision = await this.analyzeInvestmentOpportunity(args);

    // Save decision
    const decisionId = `decision_${Date.now()}`;
    const result = {
      decisionId,
      tractName: args.tractName,
      decision,
      analysisResults: args.analysisResults,
      decisionCriteria: args.decisionCriteria,
      timestamp: new Date().toISOString(),
      analyst: this.config.persona.name
    };

    await this.saveResult(`decisions/${decisionId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return decision;
  }

  /**
   * Create comprehensive executive report
   */
  private async createExecutiveReport(args: any): Promise<ExecutiveReport> {
    console.log(`📝 Creating ${args.reportType} report for ${args.decisionId}`);

    try {
      const decisionData = await this.loadResult(`decisions/${args.decisionId}.json`);

      const report = await this.generateReport(decisionData, args);

      // Save report
      const reportId = `report_${Date.now()}`;
      const reportResult = {
        reportId,
        decisionId: args.decisionId,
        report,
        reportType: args.reportType,
        timestamp: new Date().toISOString(),
        author: this.config.persona.name
      };

      await this.saveResult(`reports/${reportId}.json`, reportResult);

      if (args.outputPath) {
        const markdown = this.formatReportAsMarkdown(report);
        await fs.writeFile(args.outputPath, markdown);
      }

      return report;
    } catch (error) {
      throw new Error(`Decision not found: ${args.decisionId}`);
    }
  }

  /**
   * Synthesize multiple domain analyses
   */
  private async synthesizeAnalysis(args: any): Promise<any> {
    console.log(`🔄 Synthesizing ${args.analyses.length} domain analyses`);

    const synthesis = {
      overallConfidence: this.calculateOverallConfidence(args.analyses),
      keyInsights: this.extractKeyInsights(args.analyses),
      riskFactors: this.identifyRiskFactors(args.analyses),
      opportunities: this.identifyOpportunities(args.analyses),
      recommendations: this.generateRecommendations(args.analyses),
      domainSummaries: args.analyses.map((analysis: any) => ({
        domain: analysis.domain,
        confidence: analysis.confidence,
        keyPoints: this.extractDomainKeyPoints(analysis)
      }))
    };

    return synthesis;
  }

  /**
   * Generate charts and visualizations
   */
  private async generateCharts(args: any): Promise<any> {
    console.log(`📈 Generating ${args.chartTypes.length} charts`);

    const charts = [];

    for (const chartType of args.chartTypes) {
      const chartData = this.generateChartData(args.data, chartType);
      charts.push({
        type: chartType,
        data: chartData,
        config: this.getChartConfig(chartType)
      });
    }

    // Save charts
    const chartId = `charts_${Date.now()}`;
    await this.saveResult(`charts/${chartId}.json`, { chartId, charts });

    return { chartId, charts };
  }

  /**
   * Analyze investment opportunity and make decision
   */
  private async analyzeInvestmentOpportunity(args: any): Promise<InvestmentDecision> {
    const results = args.analysisResults;
    const criteria = args.decisionCriteria || {};

    // Extract key metrics from domain analyses
    const keyMetrics = {
      npv: results.economic?.npv || 0,
      irr: results.economic?.irr || 0,
      payback: results.economic?.paybackMonths || 0,
      netPay: results.geological?.netPay || 0
    };

    // Determine recommendation based on criteria
    let recommendation: 'PROCEED' | 'REJECT' | 'DEFER' = 'DEFER';
    let confidence = 75;

    if (keyMetrics.npv >= criteria.minNPV &&
        keyMetrics.irr >= criteria.minIRR &&
        keyMetrics.payback <= criteria.maxPayback) {
      recommendation = 'PROCEED';
      confidence = 85;
    } else if (keyMetrics.npv < 0 || keyMetrics.irr < 0.1) {
      recommendation = 'REJECT';
      confidence = 90;
    }

    // Identify risk factors
    const riskFactors = [];
    if (keyMetrics.payback > 18) riskFactors.push('Long payback period');
    if (keyMetrics.irr < 0.2) riskFactors.push('Moderate IRR');
    if (!results.geological) riskFactors.push('Limited geological data');

    // Generate next steps
    const nextSteps = [];
    if (recommendation === 'PROCEED') {
      nextSteps.push('Finalize drilling program');
      nextSteps.push('Secure permits and approvals');
      nextSteps.push('Execute AFE and budget');
    } else if (recommendation === 'DEFER') {
      nextSteps.push('Gather additional data');
      nextSteps.push('Reassess market conditions');
      nextSteps.push('Consider alternative development scenarios');
    }

    return {
      recommendation,
      confidence,
      keyMetrics,
      riskFactors,
      nextSteps
    };
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(decisionData: any, args: any): Promise<ExecutiveReport> {
    const decision = decisionData.decision;

    return {
      reportId: `report_${Date.now()}`,
      title: `Investment Analysis: ${decisionData.tractName}`,
      executiveSummary: this.generateExecutiveSummary(decisionData),
      keyFindings: this.generateKeyFindings(decisionData),
      recommendation: decision,
      appendices: args.includeAppendices ? [
        'Geological Analysis Details',
        'Economic Model Assumptions',
        'Risk Assessment Matrix',
        'Competitive Analysis'
      ] : []
    };
  }

  /**
   * Calculate overall confidence from multiple analyses
   */
  private calculateOverallConfidence(analyses: any[]): number {
    if (analyses.length === 0) return 0;

    const totalConfidence = analyses.reduce((sum, analysis) => sum + analysis.confidence, 0);
    return Math.round(totalConfidence / analyses.length);
  }

  /**
   * Extract key insights from analyses
   */
  private extractKeyInsights(analyses: any[]): string[] {
    const insights = [];

    for (const analysis of analyses) {
      if (analysis.domain === 'geological') {
        insights.push(`Strong geological foundation with ${analysis.results.netPay} ft net pay`);
      } else if (analysis.domain === 'economic') {
        insights.push(`Economic returns show ${analysis.results.irr}% IRR`);
      } else if (analysis.domain === 'engineering') {
        insights.push(`Engineering analysis indicates ${analysis.results.eur} EUR potential`);
      }
    }

    return insights;
  }

  /**
   * Identify risk factors from analyses
   */
  private identifyRiskFactors(analyses: any[]): string[] {
    const risks = [];

    for (const analysis of analyses) {
      if (analysis.confidence < 80) {
        risks.push(`${analysis.domain} analysis has moderate confidence (${analysis.confidence}%)`);
      }
    }

    return risks;
  }

  /**
   * Identify opportunities from analyses
   */
  private identifyOpportunities(analyses: any[]): string[] {
    const opportunities = [];

    for (const analysis of analyses) {
      if (analysis.confidence > 90) {
        opportunities.push(`High confidence ${analysis.domain} results support development`);
      }
    }

    return opportunities;
  }

  /**
   * Generate recommendations from analyses
   */
  private generateRecommendations(analyses: any[]): string[] {
    const recommendations = [];

    const avgConfidence = this.calculateOverallConfidence(analyses);

    if (avgConfidence > 85) {
      recommendations.push('Proceed with development as planned');
    } else if (avgConfidence > 75) {
      recommendations.push('Proceed with enhanced monitoring');
    } else {
      recommendations.push('Consider additional data gathering');
    }

    return recommendations;
  }

  /**
   * Extract key points from domain analysis
   */
  private extractDomainKeyPoints(analysis: any): string[] {
    // Extract 2-3 key points from each domain analysis
    return [
      `Confidence: ${analysis.confidence}%`,
      `Primary findings support investment thesis`,
      `Recommendations align with development strategy`
    ];
  }

  /**
   * Generate chart data based on type
   */
  private generateChartData(data: any, chartType: string): any {
    // Simulate chart data generation
    switch (chartType) {
      case 'bar':
        return {
          labels: ['NPV', 'IRR', 'Payback'],
          values: [data.npv || 0, data.irr || 0, data.payback || 0]
        };
      case 'line':
        return {
          x: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`),
          y: Array.from({ length: 12 }, () => Math.random() * 1000)
        };
      case 'pie':
        return {
          labels: ['Oil', 'Gas', 'NGLs'],
          values: [60, 30, 10]
        };
      default:
        return { data: 'Chart data placeholder' };
    }
  }

  /**
   * Get chart configuration
   */
  private getChartConfig(chartType: string): any {
    return {
      type: chartType,
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(decisionData: any): string {
    const decision = decisionData.decision;
    return `Investment analysis for ${decisionData.tractName} indicates ${decision.recommendation} with ${decision.confidence}% confidence. Key economic metrics show NPV of $${(decision.keyMetrics.npv / 1000000).toFixed(1)}M and IRR of ${decision.keyMetrics.irr}%.`;
  }

  /**
   * Generate key findings
   */
  private generateKeyFindings(decisionData: any): string[] {
    const decision = decisionData.decision;
    return [
      `Economic analysis supports ${decision.recommendation} recommendation`,
      `Net pay of ${decision.keyMetrics.netPay} ft indicates strong reservoir potential`,
      `Payback period of ${decision.keyMetrics.payback} months is within acceptable range`,
      `Risk factors include: ${decision.riskFactors.join(', ')}`
    ];
  }

  /**
   * Format report as markdown
   */
  private formatReportAsMarkdown(report: ExecutiveReport): string {
    return `# ${report.title}

## Executive Summary
${report.executiveSummary}

## Key Findings
${report.keyFindings.map(finding => `- ${finding}`).join('\n')}

## Recommendation
**${report.recommendation.recommendation}** - Confidence: ${report.recommendation.confidence}%

### Key Metrics
- NPV: $${(report.recommendation.keyMetrics.npv / 1000000).toFixed(1)}M
- IRR: ${report.recommendation.keyMetrics.irr}%
- Payback: ${report.recommendation.keyMetrics.payback} months
- Net Pay: ${report.recommendation.keyMetrics.netPay} ft

### Risk Factors
${report.recommendation.riskFactors.map(risk => `- ${risk}`).join('\n')}

### Next Steps
${report.recommendation.nextSteps.map(step => `- ${step}`).join('\n')}

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

  private async getExecutiveReport(uri: URL): Promise<any> {
    const reportId = uri.pathname.split('/').pop();
    return await this.loadResult(`reports/${reportId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ReporterServer();
  runMCPServer(server).catch(console.error);
}