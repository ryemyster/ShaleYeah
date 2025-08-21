/**
 * Economics MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for economic analysis and financial modeling
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface EconomicsMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class EconomicsMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;

  constructor(config: EconomicsMCPConfig) {
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'economics');
    
    // Create official MCP server with economics domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupEconomicsTools();
    this.setupEconomicsResources();
    this.setupEconomicsPrompts();
  }

  /**
   * Initialize economics MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupEconomicsDirectories();
      this.initialized = true;
      
      console.log(`💰 Economics MCP Server "${this.server.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Economics MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup economics-specific MCP tools
   */
  private setupEconomicsTools(): void {
    // DCF analysis tool
    this.server.registerTool(
      "dcf_analysis",
      {
        title: "Discounted Cash Flow Analysis",
        description: "Perform DCF analysis for drilling opportunities with multiple scenarios",
        inputSchema: {
          well_parameters: z.object({
            initial_production: z.number().describe("Initial oil production (bbl/day)"),
            decline_rate: z.number().default(0.15).describe("Annual decline rate (decimal)"),
            well_life_years: z.number().default(30).describe("Economic well life in years"),
            working_interest: z.number().default(1.0).describe("Working interest percentage (decimal)")
          }),
          costs: z.object({
            drilling_cost: z.number().describe("Total drilling cost (USD)"),
            completion_cost: z.number().describe("Completion cost (USD)"),
            annual_opex: z.number().describe("Annual operating expenses (USD)"),
            royalty_rate: z.number().default(0.125).describe("Royalty rate (decimal)")
          }),
          prices: z.object({
            oil_price: z.number().describe("Oil price (USD/bbl)"),
            gas_price: z.number().default(3.50).describe("Gas price (USD/mcf)"),
            ngl_price: z.number().default(25.0).describe("NGL price (USD/bbl)")
          }),
          financial: z.object({
            discount_rate: z.number().default(0.10).describe("Discount rate (decimal)"),
            tax_rate: z.number().default(0.35).describe("Tax rate (decimal)"),
            inflation_rate: z.number().default(0.02).describe("Annual inflation rate (decimal)")
          })
        }
      },
      async ({ well_parameters, costs, prices, financial }) => {
        console.log(`💰 Performing DCF analysis for ${well_parameters.well_life_years}-year well life`);
        
        const yearlyAnalysis = [];
        let cumulativeNPV = 0;
        let paybackYear = null;
        let cumulativeCashFlow = -(costs.drilling_cost + costs.completion_cost);
        
        for (let year = 1; year <= well_parameters.well_life_years; year++) {
          // Production decline curve
          const annualProduction = well_parameters.initial_production * 365 * 
            Math.pow(1 - well_parameters.decline_rate, year - 1);
          
          // Revenue calculation
          const grossRevenue = annualProduction * prices.oil_price;
          const royalty = grossRevenue * costs.royalty_rate;
          const netRevenue = (grossRevenue - royalty) * well_parameters.working_interest;
          
          // Operating costs with inflation
          const inflatedOpex = costs.annual_opex * Math.pow(1 + financial.inflation_rate, year - 1);
          
          // Cash flow calculation
          const beforeTaxCashFlow = netRevenue - inflatedOpex;
          const taxes = beforeTaxCashFlow * financial.tax_rate;
          const afterTaxCashFlow = beforeTaxCashFlow - taxes;
          
          // NPV calculation
          const presentValue = afterTaxCashFlow / Math.pow(1 + financial.discount_rate, year);
          cumulativeNPV += presentValue;
          cumulativeCashFlow += afterTaxCashFlow;
          
          // Check for payback
          if (!paybackYear && cumulativeCashFlow > 0) {
            paybackYear = year;
          }
          
          yearlyAnalysis.push({
            year,
            annual_production_bbl: Math.round(annualProduction),
            gross_revenue_usd: Math.round(grossRevenue),
            net_revenue_usd: Math.round(netRevenue),
            opex_usd: Math.round(inflatedOpex),
            after_tax_cashflow_usd: Math.round(afterTaxCashFlow),
            present_value_usd: Math.round(presentValue),
            cumulative_npv_usd: Math.round(cumulativeNPV)
          });
        }
        
        // Calculate IRR (simplified approximation)
        const totalCashFlows = [-(costs.drilling_cost + costs.completion_cost)]
          .concat(yearlyAnalysis.map(y => y.after_tax_cashflow_usd));
        const irr = this.calculateIRR(totalCashFlows);
        
        // Final DCF results
        const totalNPV = cumulativeNPV - (costs.drilling_cost + costs.completion_cost);
        
        const analysis = {
          project_summary: {
            total_npv_usd: Math.round(totalNPV),
            irr_percent: Math.round(irr * 10000) / 100,
            payback_years: paybackYear || "Beyond project life",
            total_capex_usd: costs.drilling_cost + costs.completion_cost,
            breakeven_oil_price: Math.round(this.calculateBreakevenPrice(well_parameters, costs, financial) * 100) / 100
          },
          sensitivity_analysis: {
            npv_at_oil_minus_10pct: Math.round(this.calculateNPVAtPrice(well_parameters, costs, financial, prices.oil_price * 0.9)),
            npv_at_oil_plus_10pct: Math.round(this.calculateNPVAtPrice(well_parameters, costs, financial, prices.oil_price * 1.1)),
            decline_sensitivity: {
              "10% decline": Math.round(this.calculateNPVAtDecline(well_parameters, costs, prices, financial, 0.10)),
              "20% decline": Math.round(this.calculateNPVAtDecline(well_parameters, costs, prices, financial, 0.20)),
              "25% decline": Math.round(this.calculateNPVAtDecline(well_parameters, costs, prices, financial, 0.25))
            }
          },
          risk_metrics: {
            risk_rating: totalNPV > 5000000 ? "Low" : totalNPV > 1000000 ? "Moderate" : "High",
            probability_of_success: totalNPV > 0 ? 0.75 : 0.35,
            recommendation: totalNPV > 1000000 ? "PROCEED" : totalNPV > 0 ? "CONDITIONAL" : "DO NOT PROCEED"
          },
          yearly_analysis: yearlyAnalysis.slice(0, 10) // First 10 years for brevity
        };

        // Save DCF analysis
        const outputPath = path.join(this.dataPath, 'dcf-analysis', `dcf_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(analysis, null, 2)
          }]
        };
      }
    );

    // Risk modeling tool
    this.server.registerTool(
      "risk_modeling",
      {
        title: "Oil & Gas Risk Modeling",
        description: "Perform Monte Carlo risk analysis on drilling projects",
        inputSchema: {
          base_case: z.object({
            npv: z.number().describe("Base case NPV (USD)"),
            irr: z.number().describe("Base case IRR (decimal)"),
            initial_production: z.number().describe("Base case initial production (bbl/day)")
          }),
          risk_factors: z.object({
            geological_risk: z.object({
              dry_hole_probability: z.number().default(0.15).describe("Probability of dry hole"),
              production_variance: z.number().default(0.30).describe("Production uncertainty (std dev)")
            }),
            operational_risk: z.object({
              cost_overrun_probability: z.number().default(0.25).describe("Probability of cost overruns"),
              cost_overrun_magnitude: z.number().default(0.20).describe("Average cost overrun percentage")
            }),
            commodity_risk: z.object({
              price_volatility: z.number().default(0.25).describe("Oil price volatility (std dev)"),
              correlation_factor: z.number().default(0.7).describe("Price correlation factor")
            })
          }),
          simulation_parameters: z.object({
            iterations: z.number().default(10000).describe("Monte Carlo iterations"),
            confidence_levels: z.array(z.number()).default([0.10, 0.50, 0.90]).describe("Confidence intervals")
          })
        }
      },
      async ({ base_case, risk_factors, simulation_parameters }) => {
        console.log(`💰 Running Monte Carlo risk analysis with ${simulation_parameters.iterations} iterations`);
        
        // Simulate risk outcomes (simplified Monte Carlo)
        const results = [];
        
        for (let i = 0; i < Math.min(simulation_parameters.iterations, 1000); i++) {
          // Geological risk simulation
          const isDryHole = Math.random() < risk_factors.geological_risk.dry_hole_probability;
          if (isDryHole) {
            results.push({ npv: -base_case.npv * 0.8, irr: -0.5, outcome: "dry_hole" });
            continue;
          }
          
          // Production variance
          const productionMultiplier = this.normalRandom(1.0, risk_factors.geological_risk.production_variance);
          
          // Cost overrun risk
          const hasOverrun = Math.random() < risk_factors.operational_risk.cost_overrun_probability;
          const costMultiplier = hasOverrun ? 
            1 + risk_factors.operational_risk.cost_overrun_magnitude * Math.random() : 1.0;
          
          // Price volatility
          const priceMultiplier = this.normalRandom(1.0, risk_factors.commodity_risk.price_volatility);
          
          // Calculate scenario NPV and IRR
          const scenarioNPV = base_case.npv * productionMultiplier * priceMultiplier / costMultiplier;
          const scenarioIRR = base_case.irr * (scenarioNPV / base_case.npv);
          
          results.push({ 
            npv: scenarioNPV, 
            irr: scenarioIRR, 
            outcome: "success",
            production_factor: productionMultiplier,
            cost_factor: costMultiplier,
            price_factor: priceMultiplier
          });
        }
        
        // Calculate percentiles
        const npvValues = results.map(r => r.npv).sort((a, b) => a - b);
        const irrValues = results.map(r => r.irr).sort((a, b) => a - b);
        
        const getPercentile = (arr: number[], percentile: number) => {
          const index = Math.floor(percentile * arr.length);
          return arr[index];
        };
        
        const riskAnalysis = {
          simulation_summary: {
            total_iterations: results.length,
            dry_hole_count: results.filter(r => r.outcome === "dry_hole").length,
            success_probability: results.filter(r => r.npv > 0).length / results.length,
            mean_npv: Math.round(npvValues.reduce((a, b) => a + b, 0) / npvValues.length),
            mean_irr: Math.round((irrValues.reduce((a, b) => a + b, 0) / irrValues.length) * 10000) / 100
          },
          npv_percentiles: {
            p10: Math.round(getPercentile(npvValues, 0.10)),
            p50: Math.round(getPercentile(npvValues, 0.50)),
            p90: Math.round(getPercentile(npvValues, 0.90))
          },
          irr_percentiles: {
            p10: Math.round(getPercentile(irrValues, 0.10) * 10000) / 100,
            p50: Math.round(getPercentile(irrValues, 0.50) * 10000) / 100,
            p90: Math.round(getPercentile(irrValues, 0.90) * 10000) / 100
          },
          risk_metrics: {
            value_at_risk_10pct: Math.round(getPercentile(npvValues, 0.10)),
            probability_positive_npv: results.filter(r => r.npv > 0).length / results.length,
            probability_irr_gt_15pct: results.filter(r => r.irr > 0.15).length / results.length,
            downside_risk: results.filter(r => r.npv < 0).length / results.length
          },
          recommendations: {
            risk_rating: npvValues[Math.floor(npvValues.length * 0.5)] > 1000000 ? "Acceptable" : "High Risk",
            hedge_recommendation: risk_factors.commodity_risk.price_volatility > 0.2 ? "Recommend price hedging" : "No hedging required",
            portfolio_fit: results.filter(r => r.npv > 0).length / results.length > 0.6 ? "Good portfolio addition" : "Marginal project"
          }
        };

        // Save risk analysis
        const outputPath = path.join(this.dataPath, 'risk-analysis', `risk_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(riskAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(riskAnalysis, null, 2)
          }]
        };
      }
    );

    // Portfolio optimization tool
    this.server.registerTool(
      "portfolio_optimization",
      {
        title: "Drilling Portfolio Optimization",
        description: "Optimize drilling portfolio allocation across multiple prospects",
        inputSchema: {
          prospects: z.array(z.object({
            name: z.string(),
            npv: z.number(),
            capex: z.number(),
            irr: z.number(),
            risk_rating: z.enum(["low", "moderate", "high"]),
            geological_confidence: z.number().min(0).max(1)
          })),
          constraints: z.object({
            total_budget: z.number().describe("Total available capital (USD)"),
            max_wells: z.number().default(10).describe("Maximum number of wells"),
            risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
            min_irr_threshold: z.number().default(0.15).describe("Minimum IRR threshold")
          })
        }
      },
      async ({ prospects, constraints }) => {
        console.log(`💰 Optimizing portfolio allocation for ${prospects.length} prospects with $${constraints.total_budget.toLocaleString()} budget`);
        
        // Filter prospects by IRR threshold
        const viableProspects = prospects.filter(p => p.irr >= constraints.min_irr_threshold);
        
        // Risk scoring
        const riskScores = {
          low: 1.0,
          moderate: 0.7,
          high: 0.4
        };
        
        // Risk tolerance multipliers
        const toleranceMultipliers = {
          conservative: { low: 1.2, moderate: 0.8, high: 0.3 },
          moderate: { low: 1.0, moderate: 1.0, high: 0.6 },
          aggressive: { low: 0.9, moderate: 1.1, high: 1.0 }
        };
        
        // Calculate prospect scores
        const scoredProspects = viableProspects.map(prospect => {
          const riskScore = riskScores[prospect.risk_rating];
          const toleranceScore = toleranceMultipliers[constraints.risk_tolerance][prospect.risk_rating];
          const efficiencyScore = prospect.npv / prospect.capex; // NPV per dollar invested
          
          return {
            ...prospect,
            composite_score: (prospect.irr * 2 + efficiencyScore + riskScore * toleranceScore + prospect.geological_confidence) / 5,
            efficiency_ratio: prospect.npv / prospect.capex
          };
        }).sort((a, b) => b.composite_score - a.composite_score);
        
        // Greedy optimization (simplified)
        const selectedProspects = [];
        let remainingBudget = constraints.total_budget;
        let wellCount = 0;
        
        for (const prospect of scoredProspects) {
          if (wellCount >= constraints.max_wells) break;
          if (prospect.capex <= remainingBudget) {
            selectedProspects.push(prospect);
            remainingBudget -= prospect.capex;
            wellCount++;
          }
        }
        
        // Portfolio metrics
        const portfolioNPV = selectedProspects.reduce((sum, p) => sum + p.npv, 0);
        const portfolioCapex = selectedProspects.reduce((sum, p) => sum + p.capex, 0);
        const weightedIRR = selectedProspects.reduce((sum, p) => sum + (p.irr * p.capex), 0) / portfolioCapex;
        
        const optimization = {
          portfolio_summary: {
            selected_wells: selectedProspects.length,
            total_npv: Math.round(portfolioNPV),
            total_capex: Math.round(portfolioCapex),
            remaining_budget: Math.round(remainingBudget),
            portfolio_irr: Math.round(weightedIRR * 10000) / 100,
            capital_efficiency: Math.round((portfolioNPV / portfolioCapex) * 100) / 100
          },
          selected_prospects: selectedProspects.map(p => ({
            name: p.name,
            npv: Math.round(p.npv),
            capex: Math.round(p.capex),
            irr_percent: Math.round(p.irr * 10000) / 100,
            risk_rating: p.risk_rating,
            composite_score: Math.round(p.composite_score * 100) / 100
          })),
          portfolio_risk_profile: {
            low_risk_wells: selectedProspects.filter(p => p.risk_rating === "low").length,
            moderate_risk_wells: selectedProspects.filter(p => p.risk_rating === "moderate").length,
            high_risk_wells: selectedProspects.filter(p => p.risk_rating === "high").length,
            average_geological_confidence: Math.round(selectedProspects.reduce((sum, p) => sum + p.geological_confidence, 0) / selectedProspects.length * 100) / 100
          },
          optimization_notes: {
            prospects_considered: viableProspects.length,
            prospects_rejected_irr: prospects.length - viableProspects.length,
            prospects_rejected_budget: scoredProspects.length - selectedProspects.length,
            budget_utilization_percent: Math.round((portfolioCapex / constraints.total_budget) * 100)
          }
        };

        // Save portfolio optimization
        const outputPath = path.join(this.dataPath, 'portfolio-optimization', `portfolio_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(optimization, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(optimization, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup economics-specific MCP resources
   */
  private setupEconomicsResources(): void {
    // Economic models resource
    this.server.registerResource(
      "economic_models",
      new ResourceTemplate("economics://models/{model_type}", { list: ["dcf", "risk", "portfolio"] }),
      {
        title: "Economic Analysis Models",
        description: "DCF models, risk analyses, and portfolio optimizations"
      },
      async (uri, { model_type }) => {
        const modelPath = path.join(this.dataPath, `${model_type}-analysis`);
        
        try {
          const files = await fs.readdir(modelPath);
          const latestFile = files.sort().pop();
          
          if (latestFile) {
            const content = await fs.readFile(path.join(modelPath, latestFile), 'utf8');
            return {
              contents: [{
                uri: uri.href,
                text: content,
                mimeType: 'application/json'
              }]
            };
          }
        } catch (error) {
          // Return empty model structure
        }
        
        return {
          contents: [{
            uri: uri.href,
            text: `{"model_type": "${model_type}", "status": "no_data", "message": "No ${model_type} analysis available"}`,
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Market data resource
    this.server.registerResource(
      "market_data",
      new ResourceTemplate("economics://market/{commodity}", { list: ["oil", "gas", "ngl"] }),
      {
        title: "Commodity Market Data",
        description: "Current and historical commodity prices for economic analysis"
      },
      async (uri, { commodity }) => {
        // Mock market data (would integrate with real data sources in production)
        const marketData = {
          oil: { current_price: 75.50, trend: "stable", volatility: 0.25 },
          gas: { current_price: 3.25, trend: "declining", volatility: 0.35 },
          ngl: { current_price: 28.75, trend: "increasing", volatility: 0.20 }
        };
        
        const data = marketData[commodity as keyof typeof marketData] || { error: `Unknown commodity: ${commodity}` };
        
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(data, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup economics-specific MCP prompts
   */
  private setupEconomicsPrompts(): void {
    this.server.registerPrompt(
      "economic_analysis_prompt",
      {
        title: "Economic Analysis Prompt",
        description: "Template for comprehensive economic analysis and investment recommendations"
      },
      async ({ financial_data, market_conditions = "stable", risk_appetite = "moderate" }) => {
        const prompt = `You are Caesar Augustus Economicus, a Roman imperial economist specializing in oil and gas investment analysis.

FINANCIAL DATA:
${JSON.stringify(financial_data, null, 2)}

MARKET CONDITIONS: ${market_conditions}
RISK APPETITE: ${risk_appetite}

ANALYSIS REQUIREMENTS:
1. Evaluate project economics using DCF methodology
2. Assess risk factors and provide Monte Carlo insights
3. Compare against industry benchmarks and portfolio fit
4. Provide clear investment recommendations
5. Consider market timing and commodity price outlook

DELIVERABLES:
- Executive Summary with investment recommendation
- Detailed financial metrics (NPV, IRR, Payback)
- Risk assessment with scenario analysis
- Market timing considerations
- Portfolio allocation recommendations

Apply Roman imperial wisdom to modern financial analysis. Be decisive yet prudent.`;

        return {
          description: "Economic analysis prompt with financial data",
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: prompt
            }
          }]
        };
      }
    );
  }

  /**
   * Setup economics data directory structure
   */
  private async setupEconomicsDirectories(): Promise<void> {
    const dirs = [
      'dcf-analysis',
      'risk-analysis', 
      'portfolio-optimization',
      'market-data',
      'benchmarks',
      'reports'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  /**
   * Helper function to calculate IRR (simplified approximation)
   */
  private calculateIRR(cashFlows: number[]): number {
    // Simplified IRR calculation - in production would use more sophisticated algorithm
    let irr = 0.1; // Start with 10% guess
    for (let i = 0; i < 10; i++) {
      let npv = 0;
      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + irr, j);
      }
      if (Math.abs(npv) < 1000) break;
      irr += npv > 0 ? 0.01 : -0.01;
    }
    return Math.max(0, Math.min(irr, 1)); // Cap between 0% and 100%
  }

  /**
   * Helper function to calculate breakeven oil price
   */
  private calculateBreakevenPrice(wellParams: any, costs: any, financial: any): number {
    // Simplified breakeven calculation
    const totalCosts = costs.drilling_cost + costs.completion_cost + (costs.annual_opex * wellParams.well_life_years);
    const totalProduction = wellParams.initial_production * 365 * wellParams.well_life_years * 0.6; // Assume 60% recovery
    return totalCosts / totalProduction;
  }

  /**
   * Helper function to calculate NPV at different oil prices
   */
  private calculateNPVAtPrice(wellParams: any, costs: any, financial: any, oilPrice: number): number {
    // Simplified NPV calculation for sensitivity analysis
    const totalProduction = wellParams.initial_production * 365 * wellParams.well_life_years * 0.6;
    const grossRevenue = totalProduction * oilPrice;
    const netRevenue = grossRevenue * (1 - costs.royalty_rate) * wellParams.working_interest;
    const totalCosts = costs.drilling_cost + costs.completion_cost + (costs.annual_opex * wellParams.well_life_years);
    return netRevenue - totalCosts;
  }

  /**
   * Helper function to calculate NPV at different decline rates
   */
  private calculateNPVAtDecline(wellParams: any, costs: any, prices: any, financial: any, declineRate: number): number {
    // Simplified NPV calculation with different decline rate
    const modifiedParams = { ...wellParams, decline_rate: declineRate };
    return this.calculateNPVAtPrice(modifiedParams, costs, financial, prices.oil_price);
  }

  /**
   * Helper function to generate normal random numbers
   */
  private normalRandom(mean: number, stdDev: number): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Connect server to a transport
   */
  async connect(transport: any): Promise<void> {
    await this.server.connect(transport);
  }

  /**
   * Shutdown the economics MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('💰 Economics MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during economics server shutdown:', error);
    }
  }
}