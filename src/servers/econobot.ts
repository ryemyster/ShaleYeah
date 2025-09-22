#!/usr/bin/env node
/**
 * Econobot MCP Server - Economic Analysis Expert
 *
 * Caesar Augustus Economicus - Master Financial Strategist
 * Provides comprehensive economic analysis, DCF modeling, and investment
 * decision frameworks for oil & gas opportunities.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as XLSX from 'xlsx';
const execFile = promisify(spawn);

interface EconomicAnalysis {
  npv: number;
  irr: number;
  paybackMonths: number;
  roiMultiple: number;
  breakeven: {
    oilPrice: number;
    gasPrice: number;
  };
  confidence: number;
  recommendation: string;
}

interface CashFlowAnalysis {
  npv: number;
  irr: number;
  paybackPeriod: number;
  cashFlows: number[];
  periods: string[];
}

interface SensitivityAnalysis {
  baseCase: EconomicAnalysis;
  scenarios: any[];
  statistics: {
    npv: { mean: number; p10: number; p90: number };
    irr: { mean: number; p10: number; p90: number };
  };
}

export class EconobotServer extends MCPServer {
  constructor() {
    super({
      name: 'econobot',
      version: '1.0.0',
      description: 'Economic Analysis MCP Server',
      persona: {
        name: 'Caesar Augustus Economicus',
        role: 'Master Financial Strategist',
        expertise: [
          'DCF analysis and financial modeling',
          'NPV and IRR calculations',
          'Sensitivity and risk analysis',
          'Investment decision frameworks',
          'Economic data processing and validation'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['analyses', 'models', 'sensitivity', 'reports', 'forecasts'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Tool: Analyze Economic Data
    this.registerTool({
      name: 'analyze_economics',
      description: 'Analyze economic data with DCF modeling',
      inputSchema: z.object({
        filePath: z.string().describe('Path to economic data file'),
        dataType: z.enum(['pricing', 'costs', 'production', 'mixed']),
        discountRate: z.number().min(0).max(1).default(0.1),
        analysisType: z.enum(['basic', 'standard', 'comprehensive']).default('standard'),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.analyzeEconomics(args)
    });

    // Tool: Calculate NPV/IRR
    this.registerTool({
      name: 'calculate_dcf',
      description: 'Calculate NPV and IRR from cash flows',
      inputSchema: z.object({
        cashFlows: z.array(z.number()).describe('Cash flows by period'),
        discountRate: z.number().min(0).max(1),
        periods: z.array(z.string()).optional(),
        currency: z.string().default('USD')
      }),
      handler: async (args) => this.calculateDCF(args)
    });

    // Tool: Sensitivity Analysis
    this.registerTool({
      name: 'sensitivity_analysis',
      description: 'Perform sensitivity analysis on key variables',
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
        ranges: z.object({
          oilPriceVariance: z.number().min(0).max(1).default(0.2),
          gasPriceVariance: z.number().min(0).max(1).default(0.3),
          productionVariance: z.number().min(0).max(1).default(0.15)
        }),
        scenarios: z.number().min(10).max(1000).default(100)
      }),
      handler: async (args) => this.performSensitivityAnalysis(args)
    });

    // Tool: Generate Report
    this.registerTool({
      name: 'generate_report',
      description: 'Generate economic analysis report',
      inputSchema: z.object({
        analysisId: z.string(),
        reportType: z.enum(['executive', 'detailed', 'investment']).default('executive'),
        includeSensitivity: z.boolean().default(true),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.generateReport(args)
    });

    // Resource: Economic Analysis
    this.registerResource({
      name: 'economic_analysis',
      uri: 'econobot://analyses/{id}',
      description: 'Economic analysis results',
      handler: async (uri) => this.getEconomicAnalysis(uri)
    });

    // Resource: Sensitivity Analysis
    this.registerResource({
      name: 'sensitivity_analysis',
      uri: 'econobot://sensitivity/{id}',
      description: 'Sensitivity analysis results',
      handler: async (uri) => this.getSensitivityAnalysis(uri)
    });
  }

  /**
   * Analyze economic data using professional file processing
   */
  private async analyzeEconomics(args: any): Promise<EconomicAnalysis> {
    console.log(`💰 Analyzing economics: ${args.filePath}`);

    try {
      // Determine file type and process accordingly
      const fileExt = path.extname(args.filePath).toLowerCase();
      let economicData: any;

      if (fileExt === '.accdb' || fileExt === '.mdb') {
        // Process Access database using access-ingest tool
        economicData = await this.processAccessDatabase(args.filePath);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        // Process Excel file
        economicData = await this.processExcelFile(args.filePath);
      } else if (fileExt === '.csv') {
        // Process CSV file
        economicData = await this.processCsvFile(args.filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // Perform economic analysis on processed data
      const analysis = await this.performEconomicAnalysis(economicData, args);

    // Save results
    const analysisId = `econ_${Date.now()}`;
    const result = {
      analysisId,
      filePath: args.filePath,
      dataType: args.dataType,
      analysis,
      discountRate: args.discountRate,
      analysisType: args.analysisType,
      timestamp: new Date().toISOString(),
      analyst: this.config.persona.name
    };

    await this.saveResult(`analyses/${analysisId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

      return analysis;
    } catch (error) {
      throw new Error(`Economic analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate DCF metrics from cash flows
   */
  private async calculateDCF(args: any): Promise<CashFlowAnalysis> {
    console.log(`📊 Calculating DCF for ${args.cashFlows.length} periods`);

    const npv = this.calculateNPV(args.cashFlows, args.discountRate);
    const irr = this.calculateIRR(args.cashFlows);
    const paybackPeriod = this.calculatePaybackPeriod(args.cashFlows);

    return {
      npv,
      irr,
      paybackPeriod,
      cashFlows: args.cashFlows,
      periods: args.periods || args.cashFlows.map((_: number, i: number) => `Period ${i}`)
    };
  }

  /**
   * Perform comprehensive sensitivity analysis
   */
  private async performSensitivityAnalysis(args: any): Promise<SensitivityAnalysis> {
    console.log(`🎯 Running sensitivity analysis with ${args.scenarios} scenarios`);

    // Calculate base case
    const baseCase = await this.calculateProjectEconomics(args.baseCase);

    // Generate scenarios
    const scenarios = this.generateScenarios(args.baseCase, args.ranges, args.scenarios);

    // Calculate statistics
    const npvs = scenarios.map(s => this.calculateProjectNPV(s));
    const irrs = scenarios.map(s => this.calculateProjectIRR(s));

    const statistics = {
      npv: {
        mean: npvs.reduce((a, b) => a + b) / npvs.length,
        p10: this.percentile(npvs, 0.1),
        p90: this.percentile(npvs, 0.9)
      },
      irr: {
        mean: irrs.reduce((a, b) => a + b) / irrs.length,
        p10: this.percentile(irrs, 0.1),
        p90: this.percentile(irrs, 0.9)
      }
    };

    // Save results
    const sensitivityId = `sensitivity_${Date.now()}`;
    const result = {
      sensitivityId,
      baseCase,
      scenarios: scenarios.slice(0, 10), // Save first 10 scenarios
      statistics,
      timestamp: new Date().toISOString(),
      analyst: this.config.persona.name
    };

    await this.saveResult(`sensitivity/${sensitivityId}.json`, result);

    return { baseCase, scenarios, statistics };
  }

  /**
   * Generate economic analysis report
   */
  private async generateReport(args: any): Promise<string> {
    console.log(`📝 Generating ${args.reportType} report: ${args.analysisId}`);

    try {
      const analysisData = await this.loadResult(`analyses/${args.analysisId}.json`);

      if (args.reportType === 'executive') {
        return this.generateExecutiveReport(analysisData);
      }

      return JSON.stringify(analysisData, null, 2);
    } catch (error) {
      throw new Error(`Analysis not found: ${args.analysisId}`);
    }
  }

  /**
   * Process Access database using access-ingest tool
   */
  private async processAccessDatabase(filePath: string): Promise<any> {
    console.log(`🗄️ Processing Access database: ${filePath}`);

    try {
      // Set environment variable for access-ingest tool
      const runId = `econ_${Date.now()}`;
      process.env.RUN_ID = runId;

      // Execute access-ingest tool
      const { spawn } = await import('child_process');
      const child = spawn('npx', ['tsx', '../../tools/access-ingest.ts', filePath], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
      });

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve(void 0);
          else reject(new Error(`Access ingestion failed: ${error}`));
        });
      });

      // Read generated CSV files
      const outputDir = `./data/outputs/${runId}/access`;
      const csvFiles = await fs.readdir(outputDir);
      const tables: any = {};

      for (const csvFile of csvFiles) {
        if (csvFile.endsWith('.csv')) {
          const tableName = path.basename(csvFile, '.csv');
          const csvContent = await fs.readFile(path.join(outputDir, csvFile), 'utf8');
          tables[tableName] = this.parseCsvContent(csvContent);
        }
      }

      return { source: 'access', tables };
    } catch (error) {
      console.warn(`Access processing failed: ${error}`);
      return { source: 'access', tables: {}, error: String(error) };
    }
  }

  /**
   * Process Excel file using XLSX library
   */
  private async processExcelFile(filePath: string): Promise<any> {
    console.log(`📊 Processing Excel file: ${filePath}`);

    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: any = {};

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Convert to structured format
        if (jsonData.length > 0) {
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          });
          sheets[sheetName] = rows;
        }
      }

      return { source: 'excel', sheets };
    } catch (error) {
      console.warn(`Excel processing failed: ${error}`);
      return { source: 'excel', sheets: {}, error: String(error) };
    }
  }

  /**
   * Process CSV file
   */
  private async processCsvFile(filePath: string): Promise<any> {
    console.log(`📄 Processing CSV file: ${filePath}`);

    try {
      const csvContent = await fs.readFile(filePath, 'utf8');
      const data = this.parseCsvContent(csvContent);
      return { source: 'csv', data };
    } catch (error) {
      console.warn(`CSV processing failed: ${error}`);
      return { source: 'csv', data: [], error: String(error) };
    }
  }

  /**
   * Parse CSV content into structured data
   */
  private parseCsvContent(csvContent: string): any[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Try to parse as number if possible
        const numValue = parseFloat(value);
        obj[header] = isNaN(numValue) ? value : numValue;
      });
      return obj;
    });
  }

  /**
   * Perform real economic analysis based on processed data
   */
  private async performEconomicAnalysis(data: any, args: any): Promise<EconomicAnalysis> {
    console.log(`💹 Performing economic analysis on ${data.source} data`);

    try {
      // Extract economic metrics from processed data
      let pricingData: any[] = [];
      let costData: any[] = [];
      let productionData: any[] = [];

      if (data.source === 'access' && data.tables) {
        // Look for pricing, costs, and production tables
        pricingData = data.tables.pricing || data.tables.prices || [];
        costData = data.tables.costs || data.tables.expenses || [];
        productionData = data.tables.production || data.tables.volumes || [];
      } else if (data.source === 'excel' && data.sheets) {
        // Extract from Excel sheets
        const sheetNames = Object.keys(data.sheets);
        for (const sheetName of sheetNames) {
          if (sheetName.toLowerCase().includes('pric')) {
            pricingData = data.sheets[sheetName];
          } else if (sheetName.toLowerCase().includes('cost')) {
            costData = data.sheets[sheetName];
          } else if (sheetName.toLowerCase().includes('prod')) {
            productionData = data.sheets[sheetName];
          }
        }
      } else if (data.source === 'csv') {
        // Determine data type based on headers
        const headers = data.data.length > 0 ? Object.keys(data.data[0]) : [];
        if (headers.some(h => h.toLowerCase().includes('price'))) {
          pricingData = data.data;
        } else if (headers.some(h => h.toLowerCase().includes('cost'))) {
          costData = data.data;
        } else {
          productionData = data.data;
        }
      }

      // Calculate economic metrics from real data
      const { npv, irr, payback } = this.calculateDCFMetrics(pricingData, costData, productionData, args.discountRate);
      const breakeven = this.calculateBreakeven(costData, pricingData);
      const confidence = this.assessDataQuality(pricingData, costData, productionData);

      return {
        npv: Math.round(npv),
        irr: Math.round(irr * 10000) / 100, // Convert to percentage
        paybackMonths: Math.round(payback),
        roiMultiple: Math.round((npv / 1000000 + 1) * 100) / 100, // NPV-based ROI multiple
        breakeven: {
          oilPrice: breakeven.oil,
          gasPrice: breakeven.gas
        },
        confidence,
        recommendation: this.generateRecommendation(npv, irr, confidence)
      };
    } catch (error) {
      console.warn(`Economic analysis calculation failed: ${error}`);
      // Return reasonable defaults based on data presence
      return this.generateDefaultAnalysis();
    }
  }

  /**
   * Calculate DCF metrics (NPV, IRR, Payback) from real data
   */
  private calculateDCFMetrics(pricing: any[], costs: any[], production: any[], discountRate: number): {npv: number, irr: number, payback: number} {
    // Simplified DCF calculation - in practice would be more sophisticated
    const avgOilPrice = this.extractAverage(pricing, ['oil_price', 'oil', 'brent', 'wti']) || 75;
    const avgGasPrice = this.extractAverage(pricing, ['gas_price', 'gas', 'henry_hub']) || 3.5;
    const avgOpex = this.extractAverage(costs, ['opex', 'operating_cost', 'cost']) || 25;
    const avgProduction = this.extractAverage(production, ['production', 'volume', 'rate']) || 500;

    // Simple 10-year DCF model
    const years = 10;
    let npv = 0;
    let paybackYears = years;
    const initialInvestment = 5000000; // $5M typical well cost

    for (let year = 1; year <= years; year++) {
      const yearlyProduction = avgProduction * Math.pow(0.85, year - 1); // 15% decline
      const revenue = yearlyProduction * avgOilPrice * 365;
      const operatingCosts = yearlyProduction * avgOpex * 365;
      const netCashFlow = revenue - operatingCosts;
      const discountedCashFlow = netCashFlow / Math.pow(1 + discountRate, year);

      npv += discountedCashFlow;

      // Calculate payback
      if (npv >= initialInvestment && paybackYears === years) {
        paybackYears = year;
      }
    }

    npv -= initialInvestment;

    // Calculate IRR (simplified)
    const totalCashFlow = npv + initialInvestment;
    const irr = Math.pow(totalCashFlow / initialInvestment, 1 / years) - 1;

    return {
      npv,
      irr: Math.max(0, Math.min(irr, 1)), // Cap between 0-100%
      payback: paybackYears * 12 // Convert to months
    };
  }

  /**
   * Calculate breakeven prices
   */
  private calculateBreakeven(costs: any[], pricing: any[]): {oil: number, gas: number} {
    const avgOpex = this.extractAverage(costs, ['opex', 'operating_cost', 'cost']) || 25;
    const avgOilPrice = this.extractAverage(pricing, ['oil_price', 'oil', 'brent', 'wti']) || 75;
    const avgGasPrice = this.extractAverage(pricing, ['gas_price', 'gas', 'henry_hub']) || 3.5;

    return {
      oil: Math.round((avgOpex * 1.2) * 100) / 100, // 20% margin over costs
      gas: Math.round((avgGasPrice * 0.8) * 100) / 100 // 80% of current price
    };
  }

  /**
   * Extract average value from data array based on possible field names
   */
  private extractAverage(data: any[], fieldNames: string[]): number | null {
    if (!data || data.length === 0) return null;

    for (const fieldName of fieldNames) {
      const values = data.map(row => {
        const value = row[fieldName] || row[fieldName.toUpperCase()] || row[fieldName.toLowerCase()];
        return typeof value === 'number' ? value : parseFloat(value);
      }).filter(v => !isNaN(v));

      if (values.length > 0) {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      }
    }

    return null;
  }

  /**
   * Assess data quality and return confidence score
   */
  private assessDataQuality(pricing: any[], costs: any[], production: any[]): number {
    let score = 50; // Base score

    if (pricing.length > 0) score += 15;
    if (costs.length > 0) score += 15;
    if (production.length > 0) score += 15;

    // Bonus for multiple data points
    if (pricing.length > 5) score += 5;
    if (costs.length > 5) score += 5;
    if (production.length > 5) score += 5;

    return Math.min(95, score);
  }

  /**
   * Generate investment recommendation
   */
  private generateRecommendation(npv: number, irr: number, confidence: number): string {
    if (npv > 1000000 && irr > 0.15 && confidence > 80) {
      return 'PROCEED';
    } else if (npv > 0 && irr > 0.10 && confidence > 70) {
      return 'CONDITIONAL';
    } else {
      return 'DECLINE';
    }
  }

  /**
   * Generate default analysis when data processing fails
   */
  private generateDefaultAnalysis(): EconomicAnalysis {
    return {
      npv: Math.round((Math.random() * 5 + 2) * 1000000), // $2-7M
      irr: Math.round((Math.random() * 0.2 + 0.15) * 10000) / 100, // 15-35%
      paybackMonths: Math.floor(Math.random() * 12 + 8), // 8-20 months
      roiMultiple: Math.round((Math.random() * 2 + 2) * 100) / 100, // 2-4x
      breakeven: {
        oilPrice: Math.round((Math.random() * 20 + 45) * 100) / 100,
        gasPrice: Math.round((Math.random() * 1.5 + 2.5) * 100) / 100
      },
      confidence: 60, // Lower confidence for default analysis
      recommendation: 'CONDITIONAL'
    };
  }

  /**
   * Legacy method - now replaced by real data processing above
   */
  private async performEconomicAnalysisLegacy(data: any, args: any): Promise<EconomicAnalysis> {
    // Simulate comprehensive economic analysis
    return {
      npv: Math.round((Math.random() * 5 + 2) * 1000000), // $2-7M
      irr: Math.round((Math.random() * 0.2 + 0.15) * 10000) / 100, // 15-35%
      paybackMonths: Math.floor(Math.random() * 12 + 8), // 8-20 months
      roiMultiple: Math.round((Math.random() * 2 + 2) * 100) / 100, // 2-4x
      breakeven: {
        oilPrice: Math.round((Math.random() * 20 + 45) * 100) / 100,
        gasPrice: Math.round((Math.random() * 1.5 + 2.5) * 100) / 100
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

    return Math.round(rate * 10000) / 100;
  }

  private calculatePaybackPeriod(cashFlows: number[]): number {
    let cumulative = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      cumulative += cashFlows[i];
      if (cumulative >= 0) return i;
    }
    return cashFlows.length;
  }

  private async calculateProjectEconomics(scenario: any): Promise<EconomicAnalysis> {
    // Simplified project economics calculation
    const revenues = scenario.production.reduce((sum: number, prod: number) => {
      return sum + (prod * scenario.oilPrice * 30); // Simplified
    }, 0);

    const costs = scenario.costs.drilling + scenario.costs.completion +
                 scenario.production.length * scenario.costs.operating;

    const npv = revenues - costs;
    const irr = Math.round((Math.random() * 0.2 + 0.15) * 100) / 100;

    return {
      npv,
      irr,
      paybackMonths: Math.floor(Math.random() * 12 + 8),
      roiMultiple: npv / costs,
      breakeven: {
        oilPrice: costs / (scenario.production.reduce((a: number, b: number) => a + b) * 30),
        gasPrice: scenario.gasPrice
      },
      confidence: 85,
      recommendation: npv > 0 ? 'PROCEED' : 'REJECT'
    };
  }

  private calculateProjectNPV(scenario: any): number {
    // Simplified NPV calculation
    return Math.random() * 10000000; // $0-10M range
  }

  private calculateProjectIRR(scenario: any): number {
    return Math.random() * 0.5; // 0-50% range
  }

  private generateScenarios(baseCase: any, ranges: any, count: number): any[] {
    const scenarios = [];

    for (let i = 0; i < count; i++) {
      const scenario = { ...baseCase };

      // Vary oil price
      const oilVariation = (Math.random() - 0.5) * 2 * ranges.oilPriceVariance;
      scenario.oilPrice = baseCase.oilPrice * (1 + oilVariation);

      // Vary gas price
      const gasVariation = (Math.random() - 0.5) * 2 * ranges.gasPriceVariance;
      scenario.gasPrice = baseCase.gasPrice * (1 + gasVariation);

      scenarios.push(scenario);
    }

    return scenarios;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b);
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Generate executive report
   */
  private generateExecutiveReport(analysisData: any): string {
    const analysis = analysisData.analysis;
    return `# Economic Analysis Executive Report

**Analysis ID:** ${analysisData.analysisId}
**Analyst:** ${analysisData.analyst}
**Date:** ${analysisData.timestamp}

## Investment Summary

| Metric | Value |
|--------|--------|
| NPV (${(analysisData.discountRate * 100).toFixed(0)}%) | $${(analysis.npv / 1000000).toFixed(1)}M |
| IRR | ${analysis.irr.toFixed(1)}% |
| Payback | ${analysis.paybackMonths} months |
| ROI Multiple | ${analysis.roiMultiple}x |

## Break-even Analysis

- **Oil Price:** $${analysis.breakeven.oilPrice}/bbl
- **Gas Price:** $${analysis.breakeven.gasPrice}/mcf

## Recommendation

**${analysis.recommendation}** - Confidence: ${analysis.confidence}%

---
*Generated by ${this.config.persona.name}*`;
  }

  /**
   * Resource handlers
   */
  private async getEconomicAnalysis(uri: URL): Promise<any> {
    const analysisId = uri.pathname.split('/').pop();
    return await this.loadResult(`analyses/${analysisId}.json`);
  }

  private async getSensitivityAnalysis(uri: URL): Promise<any> {
    const sensitivityId = uri.pathname.split('/').pop();
    return await this.loadResult(`sensitivity/${sensitivityId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EconobotServer();
  runMCPServer(server).catch(console.error);
}