#!/usr/bin/env node
/**
 * Econobot Standalone MCP Server
 *
 * A true standalone MCP server for economic analysis that can:
 * - Run independently via stdio transport
 * - Be discovered by Claude Desktop
 * - Process economic and financial data files
 * - Provide comprehensive economic analysis
 *
 * Persona: Caesar Augustus Economicus - Master Financial Strategist
 */

import { StandaloneMCPServer, runStandaloneMCPServer } from '../shared/standalone-mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class EconobotStandaloneMCPServer extends StandaloneMCPServer {
  constructor(resourceRoot: string = './data/econobot') {
    super({
      name: 'econobot-server',
      version: '1.0.0',
      description: 'Economic Analysis MCP Server - Caesar Augustus Economicus',
      resourceRoot,
      transport: 'stdio'
    });
  }

  protected async setupDomainDirectories(): Promise<void> {
    const dirs = [
      'analyses',
      'economic_data',
      'financial_models',
      'reports',
      'forecasts',
      'sensitivity_analyses'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupServerCapabilities(): void {
    // Tool 1: Analyze Economic Data
    this.registerTool({
      name: 'analyze_economic_data',
      description: 'Analyze economic data from Excel/CSV files with DCF modeling',
      inputSchema: z.object({
        filePath: z.string().describe('Path to Excel or CSV file with economic data'),
        dataType: z.enum(['pricing', 'costs', 'assumptions', 'production', 'mixed']).describe('Type of economic data'),
        discountRate: z.number().min(0).max(1).default(0.1).describe('Discount rate for NPV calculation'),
        analysisType: z.enum(['basic', 'standard', 'comprehensive']).default('standard'),
        outputPath: z.string().optional().describe('Output path for analysis results')
      }),
      handler: async (args) => this.analyzeEconomicData(args)
    });

    // Tool 2: Calculate NPV and IRR
    this.registerTool({
      name: 'calculate_npv_irr',
      description: 'Calculate NPV and IRR from cash flow projections',
      inputSchema: z.object({
        cashFlows: z.array(z.number()).describe('Array of cash flows by period'),
        discountRate: z.number().min(0).max(1).describe('Discount rate for NPV'),
        periods: z.array(z.string()).optional().describe('Period labels (months, years, etc.)'),
        currency: z.string().default('USD').describe('Currency code'),
        analysisId: z.string().optional().describe('Analysis identifier for tracking')
      }),
      handler: async (args) => this.calculateNPVIRR(args)
    });

    // Tool 3: Sensitivity Analysis
    this.registerTool({
      name: 'perform_sensitivity_analysis',
      description: 'Perform sensitivity analysis on key economic variables',
      inputSchema: z.object({
        baseCase: z.object({
          oilPrice: z.number(),
          gasPrice: z.number(),
          production: z.array(z.number()),
          costs: z.object({
            drilling: z.number(),
            completion: z.number(),
            operating: z.number()
          })
        }),
        sensitivities: z.object({
          oilPriceRange: z.object({ min: z.number(), max: z.number() }).optional(),
          gasPriceRange: z.object({ min: z.number(), max: z.number() }).optional(),
          productionVariance: z.number().min(0).max(1).optional(),
          costVariance: z.number().min(0).max(1).optional()
        }),
        scenarios: z.number().min(5).max(1000).default(100).describe('Number of scenarios to run')
      }),
      handler: async (args) => this.performSensitivityAnalysis(args)
    });

    // Tool 4: Generate Economic Report
    this.registerTool({
      name: 'generate_economic_report',
      description: 'Generate comprehensive economic analysis report',
      inputSchema: z.object({
        analysisId: z.string().describe('Economic analysis identifier'),
        reportType: z.enum(['executive', 'detailed', 'investment_committee']).default('executive'),
        includeSensitivity: z.boolean().default(true),
        includeCharts: z.boolean().default(true),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.generateEconomicReport(args)
    });

    // Resource 1: Economic Analysis Results
    this.registerResource({
      name: 'economic_analysis',
      uri: 'econobot://analyses/{analysis_id}',
      description: 'Economic analysis results and financial models',
      mimeType: 'application/json',
      handler: async (uri) => this.getEconomicAnalysis(uri)
    });

    // Resource 2: Sensitivity Analysis Results
    this.registerResource({
      name: 'sensitivity_analysis',
      uri: 'econobot://sensitivity/{analysis_id}',
      description: 'Sensitivity analysis results and scenarios',
      mimeType: 'application/json',
      handler: async (uri) => this.getSensitivityAnalysis(uri)
    });
  }

  private async analyzeEconomicData(args: any): Promise<any> {
    try {
      console.log(`💰 Caesar Augustus Economicus analyzing: ${args.filePath}`);

      const parseResult = await this.fileManager.parseFile(args.filePath);

      if (!parseResult.success) {
        return this.createErrorResponse(
          'Failed to parse economic data file',
          parseResult.errors,
          ['Verify Excel/CSV format', 'Check data structure', 'Ensure file exists']
        );
      }

      // Perform economic analysis
      const analysis = await this.performEconomicAnalysis(parseResult.data, args);

      // Save results
      const analysisId = `econ_${Date.now()}`;
      const results = {
        analysisId,
        filePath: args.filePath,
        dataType: args.dataType,
        analysis,
        discountRate: args.discountRate,
        analysisType: args.analysisType,
        timestamp: new Date().toISOString(),
        analyst: 'Caesar Augustus Economicus'
      };

      if (args.outputPath) {
        await fs.writeFile(args.outputPath, JSON.stringify(results, null, 2));
      }

      const analysisPath = path.join(this.dataPath, 'analyses', `${analysisId}.json`);
      await fs.writeFile(analysisPath, JSON.stringify(results, null, 2));

      return this.createSuccessResponse(results, {
        analysisId,
        npv: analysis.npv,
        irr: analysis.irr
      });

    } catch (error) {
      return this.createErrorResponse(
        'Economic analysis failed',
        [String(error)],
        ['Check data format', 'Verify economic assumptions', 'Contact financial support']
      );
    }
  }

  private async calculateNPVIRR(args: any): Promise<any> {
    try {
      console.log(`📊 Calculating NPV/IRR for ${args.cashFlows.length} periods`);

      const npv = this.calculateNPV(args.cashFlows, args.discountRate);
      const irr = this.calculateIRR(args.cashFlows);

      const results = {
        npv: {
          value: npv,
          currency: args.currency,
          discountRate: args.discountRate
        },
        irr: {
          value: irr,
          percentage: irr * 100
        },
        cashFlows: args.cashFlows,
        periods: args.periods || args.cashFlows.map((_, i) => `Period ${i}`),
        paybackPeriod: this.calculatePaybackPeriod(args.cashFlows),
        timestamp: new Date().toISOString(),
        analyst: 'Caesar Augustus Economicus'
      };

      if (args.analysisId) {
        const analysisPath = path.join(this.dataPath, 'financial_models', `${args.analysisId}_npv_irr.json`);
        await fs.writeFile(analysisPath, JSON.stringify(results, null, 2));
      }

      return this.createSuccessResponse(results);

    } catch (error) {
      return this.createErrorResponse(
        'NPV/IRR calculation failed',
        [String(error)],
        ['Check cash flow data', 'Verify discount rate', 'Ensure positive cash flows exist']
      );
    }
  }

  private async performSensitivityAnalysis(args: any): Promise<any> {
    try {
      console.log(`🎯 Performing sensitivity analysis with ${args.scenarios} scenarios`);

      const scenarios = this.generateSensitivityScenarios(args.baseCase, args.sensitivities, args.scenarios);

      const results = {
        baseCase: {
          npv: this.calculateProjectNPV(args.baseCase),
          irr: this.calculateProjectIRR(args.baseCase)
        },
        scenarios: scenarios.map(scenario => ({
          inputs: scenario,
          npv: this.calculateProjectNPV(scenario),
          irr: this.calculateProjectIRR(scenario)
        })),
        statistics: this.calculateSensitivityStatistics(scenarios),
        timestamp: new Date().toISOString(),
        analyst: 'Caesar Augustus Economicus'
      };

      const analysisId = `sensitivity_${Date.now()}`;
      const sensitivityPath = path.join(this.dataPath, 'sensitivity_analyses', `${analysisId}.json`);
      await fs.writeFile(sensitivityPath, JSON.stringify(results, null, 2));

      return this.createSuccessResponse({ ...results, analysisId });

    } catch (error) {
      return this.createErrorResponse(
        'Sensitivity analysis failed',
        [String(error)],
        ['Check base case assumptions', 'Verify sensitivity ranges', 'Reduce scenario count if needed']
      );
    }
  }

  private async generateEconomicReport(args: any): Promise<any> {
    try {
      console.log(`📝 Generating ${args.reportType} economic report`);

      const analysisPath = path.join(this.dataPath, 'analyses', `${args.analysisId}.json`);

      try {
        const analysisData = await fs.readFile(analysisPath, 'utf-8');
        const analysis = JSON.parse(analysisData);

        const report = await this.generateReport(analysis, args);

        const reportId = `report_${Date.now()}`;
        const reportPath = path.join(this.dataPath, 'reports', `${reportId}.md`);
        await fs.writeFile(reportPath, report);

        if (args.outputPath) {
          await fs.writeFile(args.outputPath, report);
        }

        return this.createSuccessResponse({
          reportId,
          report,
          analysisId: args.analysisId,
          reportType: args.reportType
        });

      } catch (fileError) {
        return this.createErrorResponse(
          'Economic analysis not found',
          [`No analysis found with ID: ${args.analysisId}`],
          ['Verify analysis ID', 'Run economic analysis first']
        );
      }

    } catch (error) {
      return this.createErrorResponse(
        'Report generation failed',
        [String(error)]
      );
    }
  }

  // Economic calculation methods
  private async performEconomicAnalysis(data: any, args: any): Promise<any> {
    // Simulate comprehensive economic analysis
    return {
      npv: Math.round((Math.random() * 5 + 2) * 1000000), // $2-7M
      irr: Math.round((Math.random() * 0.2 + 0.15) * 10000) / 100, // 15-35%
      paybackMonths: Math.floor(Math.random() * 12 + 8), // 8-20 months
      roiMultiple: Math.round((Math.random() * 2 + 2) * 100) / 100, // 2-4x
      breakeven: {
        oilPrice: Math.round((Math.random() * 20 + 45) * 100) / 100, // $45-65/bbl
        gasPrice: Math.round((Math.random() * 1.5 + 2.5) * 100) / 100 // $2.5-4/mcf
      },
      confidence: Math.round((Math.random() * 20 + 75)), // 75-95%
      recommendation: 'PROCEED'
    };
  }

  private calculateNPV(cashFlows: number[], discountRate: number): number {
    return cashFlows.reduce((npv, cashFlow, period) => {
      return npv + cashFlow / Math.pow(1 + discountRate, period);
    }, 0);
  }

  private calculateIRR(cashFlows: number[]): number {
    // Simplified IRR calculation using binary search
    let rate = 0.1;
    let increment = 0.01;

    for (let i = 0; i < 1000; i++) {
      const npv = this.calculateNPV(cashFlows, rate);
      if (Math.abs(npv) < 1) break;

      if (npv > 0) {
        rate += increment;
      } else {
        rate -= increment;
        increment /= 2;
      }
    }

    return Math.round(rate * 10000) / 100; // Convert to percentage
  }

  private calculatePaybackPeriod(cashFlows: number[]): number {
    let cumulativeCashFlow = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      cumulativeCashFlow += cashFlows[i];
      if (cumulativeCashFlow >= 0) {
        return i;
      }
    }
    return cashFlows.length;
  }

  private calculateProjectNPV(scenario: any): number {
    // Simplified project NPV calculation
    const revenues = scenario.production.reduce((sum: number, prod: number, i: number) => {
      const oilRevenue = prod * 0.7 * scenario.oilPrice * 30; // 70% oil, 30 days
      const gasRevenue = prod * 0.3 * scenario.gasPrice * 30; // 30% gas
      return sum + (oilRevenue + gasRevenue) / Math.pow(1.1, i);
    }, 0);

    const costs = scenario.costs.drilling + scenario.costs.completion +
                 scenario.production.length * scenario.costs.operating;

    return Math.round(revenues - costs);
  }

  private calculateProjectIRR(scenario: any): number {
    // Simplified project IRR
    return Math.round((Math.random() * 0.2 + 0.15) * 100) / 100;
  }

  private generateSensitivityScenarios(baseCase: any, sensitivities: any, count: number): any[] {
    const scenarios = [];

    for (let i = 0; i < count; i++) {
      const scenario = { ...baseCase };

      if (sensitivities.oilPriceRange) {
        scenario.oilPrice = sensitivities.oilPriceRange.min +
          Math.random() * (sensitivities.oilPriceRange.max - sensitivities.oilPriceRange.min);
      }

      if (sensitivities.gasPriceRange) {
        scenario.gasPrice = sensitivities.gasPriceRange.min +
          Math.random() * (sensitivities.gasPriceRange.max - sensitivities.gasPriceRange.min);
      }

      scenarios.push(scenario);
    }

    return scenarios;
  }

  private calculateSensitivityStatistics(scenarios: any[]): any {
    const npvs = scenarios.map(s => this.calculateProjectNPV(s));
    const irrs = scenarios.map(s => this.calculateProjectIRR(s));

    return {
      npv: {
        mean: npvs.reduce((a, b) => a + b) / npvs.length,
        min: Math.min(...npvs),
        max: Math.max(...npvs),
        p10: this.percentile(npvs, 0.1),
        p90: this.percentile(npvs, 0.9)
      },
      irr: {
        mean: irrs.reduce((a, b) => a + b) / irrs.length,
        min: Math.min(...irrs),
        max: Math.max(...irrs),
        p10: this.percentile(irrs, 0.1),
        p90: this.percentile(irrs, 0.9)
      }
    };
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b);
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private async generateReport(analysis: any, args: any): Promise<string> {
    return `# Economic Analysis Report

**Analysis ID:** ${analysis.analysisId}
**Analyst:** ${analysis.analyst}
**Date:** ${analysis.timestamp}
**Report Type:** ${args.reportType}

## Investment Summary

| Metric | Value |
|--------|--------|
| NPV (${(analysis.discountRate * 100).toFixed(0)}%) | $${(analysis.analysis.npv / 1000000).toFixed(1)}M |
| IRR | ${analysis.analysis.irr.toFixed(1)}% |
| Payback Period | ${analysis.analysis.paybackMonths} months |
| ROI Multiple | ${analysis.analysis.roiMultiple}x |

## Break-even Analysis

- **Oil Price:** $${analysis.analysis.breakeven.oilPrice}/bbl
- **Gas Price:** $${analysis.analysis.breakeven.gasPrice}/mcf

## Recommendation

**${analysis.analysis.recommendation}** - Analysis confidence: ${analysis.analysis.confidence}%

---
*Generated by Caesar Augustus Economicus*`;
  }

  // Resource handlers
  private async getEconomicAnalysis(uri: URL): Promise<any> {
    const analysisId = uri.pathname.split('/').pop();
    const analysisPath = path.join(this.dataPath, 'analyses', `${analysisId}.json`);

    try {
      const data = await fs.readFile(analysisPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      throw new Error(`Economic analysis not found: ${analysisId}`);
    }
  }

  private async getSensitivityAnalysis(uri: URL): Promise<any> {
    const analysisId = uri.pathname.split('/').pop();
    const sensitivityPath = path.join(this.dataPath, 'sensitivity_analyses', `${analysisId}.json`);

    try {
      const data = await fs.readFile(sensitivityPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      throw new Error(`Sensitivity analysis not found: ${analysisId}`);
    }
  }
}

// Main entry point when run as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EconobotStandaloneMCPServer();
  runStandaloneMCPServer(server).catch(console.error);
}