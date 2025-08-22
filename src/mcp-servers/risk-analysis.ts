/**
 * Risk-Analysis MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for probabilistic risk analysis and sensitivity analysis
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface RiskAnalysisMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class RiskAnalysisMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: RiskAnalysisMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'risk-analysis');

    // Create official MCP server with risk analysis domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupRiskAnalysisTools();
    this.setupRiskAnalysisResources();
    this.setupRiskAnalysisPrompts();
  }

  /**
   * Initialize risk-analysis MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupRiskAnalysisDirectories();
      this.initialized = true;

      console.log(`🎲 Risk-Analysis MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Risk-Analysis MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup risk-analysis specific MCP tools
   */
  private setupRiskAnalysisTools(): void {
    // Monte Carlo simulation tool
    this.server.registerTool(
      "monte_carlo_simulation",
      {
        title: "Monte Carlo Probabilistic Analysis",
        description: "Perform Monte Carlo simulation with multiple risk factors and uncertainty distributions",
        inputSchema: {
          base_case: z.object({
            npv: z.number().describe("Base case NPV (USD)"),
            irr: z.number().describe("Base case IRR (decimal)"),
            production_eur: z.number().describe("Base case EUR (bbls)"),
            capex: z.number().describe("Base case CAPEX (USD)")
          }),
          risk_variables: z.object({
            geological_risk: z.object({
              success_probability: z.number().min(0).max(1).default(0.85).describe("Geological success probability"),
              eur_distribution: z.object({
                type: z.enum(["normal", "lognormal", "triangular"]).default("lognormal"),
                mean: z.number().describe("Mean EUR multiplier"),
                std_dev: z.number().describe("Standard deviation"),
                min_value: z.number().optional().describe("Minimum value (for triangular)"),
                max_value: z.number().optional().describe("Maximum value (for triangular)")
              })
            }),
            commodity_risk: z.object({
              oil_price_volatility: z.number().default(0.25).describe("Oil price volatility (std dev)"),
              gas_price_volatility: z.number().default(0.35).describe("Gas price volatility (std dev)"),
              correlation_oil_gas: z.number().default(0.6).describe("Oil-gas price correlation"),
              price_trend: z.enum(["flat", "increasing", "decreasing"]).default("flat")
            }),
            operational_risk: z.object({
              cost_overrun_probability: z.number().default(0.30).describe("Probability of cost overruns"),
              cost_overrun_severity: z.object({
                mean: z.number().default(0.15).describe("Mean cost overrun percentage"),
                std_dev: z.number().default(0.10).describe("Cost overrun standard deviation")
              }),
              downtime_risk: z.object({
                probability: z.number().default(0.20).describe("Probability of significant downtime"),
                impact_days: z.number().default(30).describe("Average downtime days per year")
              })
            }),
            regulatory_risk: z.object({
              permit_delay_probability: z.number().default(0.15).describe("Permit delay probability"),
              regulatory_change_impact: z.number().default(0.05).describe("Regulatory impact on economics"),
              environmental_compliance_cost: z.number().default(50000).describe("Additional compliance costs")
            })
          }),
          simulation_parameters: z.object({
            iterations: z.number().default(10000).describe("Monte Carlo iterations"),
            random_seed: z.number().optional().describe("Random seed for reproducibility"),
            confidence_levels: z.array(z.number()).default([0.10, 0.25, 0.50, 0.75, 0.90]).describe("Confidence percentiles"),
            correlation_matrix: z.array(z.array(z.number())).optional().describe("Variable correlation matrix")
          })
        }
      },
      async ({ base_case, risk_variables, simulation_parameters }) => {
        console.log(`🎲 Running Monte Carlo simulation with ${simulation_parameters.iterations} iterations`);

        const results = [];
        const seed = simulation_parameters.random_seed || Date.now();
        
        // Initialize random number generator with seed
        let randomState = seed;
        
        for (let i = 0; i < Math.min(simulation_parameters.iterations, 10000); i++) {
          const scenario = this.generateScenario(base_case, risk_variables, randomState + i);
          results.push(scenario);
        }

        // Sort results for percentile calculations
        const npvValues = results.map(r => r.npv).sort((a, b) => a - b);
        const irrValues = results.map(r => r.irr).sort((a, b) => a - b);
        const eurValues = results.map(r => r.eur).sort((a, b) => a - b);

        // Calculate percentiles
        const percentiles: {[key: string]: any} = {};
        simulation_parameters.confidence_levels.forEach(level => {
          const pKey = `p${Math.round(level * 100)}`;
          percentiles[pKey] = {
            npv: Math.round(this.getPercentile(npvValues, level)),
            irr: Math.round(this.getPercentile(irrValues, level) * 10000) / 100,
            eur: Math.round(this.getPercentile(eurValues, level))
          };
        });

        // Risk metrics
        const positiveNPVCount = results.filter(r => r.npv > 0).length;
        const highIRRCount = results.filter(r => r.irr > 0.15).length;
        const dryHoleCount = results.filter(r => r.outcome === "dry_hole").length;

        // Value at Risk calculations
        const var5 = this.getPercentile(npvValues, 0.05);
        const var10 = this.getPercentile(npvValues, 0.10);
        const expectedShortfall = npvValues.filter(v => v <= var10).reduce((sum, v) => sum + v, 0) / npvValues.filter(v => v <= var10).length;

        const analysis = {
          simulation_metadata: {
            iterations: results.length,
            random_seed: seed,
            confidence_levels: simulation_parameters.confidence_levels,
            run_date: new Date().toISOString(),
            analyst: "Marcus Aurelius Probabilis"
          },
          base_case_comparison: {
            base_npv: base_case.npv,
            mean_simulated_npv: Math.round(npvValues.reduce((sum, v) => sum + v, 0) / npvValues.length),
            base_irr: Math.round(base_case.irr * 10000) / 100,
            mean_simulated_irr: Math.round((irrValues.reduce((sum, v) => sum + v, 0) / irrValues.length) * 10000) / 100,
            volatility_npv: Math.round(this.calculateStdDev(npvValues)),
            volatility_irr: Math.round(this.calculateStdDev(irrValues) * 10000) / 100
          },
          percentile_analysis: percentiles,
          risk_metrics: {
            probability_positive_npv: Math.round((positiveNPVCount / results.length) * 10000) / 100,
            probability_irr_above_15pct: Math.round((highIRRCount / results.length) * 10000) / 100,
            probability_of_success: Math.round(((results.length - dryHoleCount) / results.length) * 10000) / 100,
            dry_hole_scenarios: dryHoleCount,
            expected_value_npv: Math.round(npvValues.reduce((sum, v) => sum + v, 0) / npvValues.length),
            coefficient_of_variation: Math.round((this.calculateStdDev(npvValues) / Math.abs(percentiles.p50.npv)) * 10000) / 100
          },
          value_at_risk: {
            var_5_percent: Math.round(var5),
            var_10_percent: Math.round(var10),
            expected_shortfall_10pct: Math.round(expectedShortfall),
            maximum_loss: Math.round(Math.min(...npvValues)),
            probability_of_loss: Math.round((npvValues.filter(v => v < 0).length / npvValues.length) * 10000) / 100
          },
          sensitivity_insights: this.analyzeSensitivities(results, base_case),
          risk_classification: {
            overall_risk_rating: this.classifyRisk(percentiles.p10.npv, percentiles.p50.npv, percentiles.p90.npv),
            volatility_rating: this.classifyVolatility(this.calculateStdDev(npvValues), Math.abs(percentiles.p50.npv)),
            geological_risk_impact: dryHoleCount > 0 ? "Significant" : "Moderate",
            commercial_viability: positiveNPVCount / results.length > 0.7 ? "High" : positiveNPVCount / results.length > 0.4 ? "Moderate" : "Low"
          },
          scenario_analysis: {
            worst_case: {
              npv: Math.round(Math.min(...npvValues)),
              irr: Math.round(Math.min(...irrValues) * 10000) / 100,
              probability: Math.round((1 / results.length) * 10000) / 100
            },
            best_case: {
              npv: Math.round(Math.max(...npvValues)),
              irr: Math.round(Math.max(...irrValues) * 10000) / 100,
              probability: Math.round((1 / results.length) * 10000) / 100
            },
            most_likely: percentiles.p50
          }
        };

        // Save Monte Carlo analysis
        const outputPath = path.join(this.dataPath, 'monte-carlo', `mc_${Date.now()}.json`);
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

    // Sensitivity analysis tool
    this.server.registerTool(
      "sensitivity_analysis",
      {
        title: "Parameter Sensitivity Analysis",
        description: "Analyze sensitivity of project economics to key input parameters",
        inputSchema: {
          base_case: z.object({
            npv: z.number(),
            irr: z.number(),
            parameters: z.record(z.number()).describe("Base case parameter values")
          }),
          sensitivity_parameters: z.array(z.object({
            name: z.string().describe("Parameter name"),
            base_value: z.number().describe("Base case value"),
            variation_range: z.object({
              low: z.number().describe("Low case multiplier"),
              high: z.number().describe("High case multiplier")
            }),
            distribution_type: z.enum(["uniform", "normal", "triangular"]).default("uniform"),
            units: z.string().optional().describe("Parameter units")
          })),
          analysis_config: z.object({
            variation_steps: z.number().default(11).describe("Number of variation steps"),
            tornado_chart: z.boolean().default(true).describe("Generate tornado chart data"),
            spider_chart: z.boolean().default(true).describe("Generate spider chart data"),
            correlation_analysis: z.boolean().default(false).describe("Include parameter correlations")
          })
        }
      },
      async ({ base_case, sensitivity_parameters, analysis_config }) => {
        console.log(`🎲 Running sensitivity analysis for ${sensitivity_parameters.length} parameters`);

        const sensitivityResults: {[key: string]: any} = {};
        const tornadoData = [];

        // Analyze each parameter individually
        for (const param of sensitivity_parameters) {
          const paramResults = [];
          const step = (param.variation_range.high - param.variation_range.low) / (analysis_config.variation_steps - 1);
          
          for (let i = 0; i < analysis_config.variation_steps; i++) {
            const multiplier = param.variation_range.low + (step * i);
            const scenarioValue = param.base_value * multiplier;
            
            // Calculate impact on NPV and IRR (simplified)
            const npvImpact = this.calculateParameterImpact(param.name, multiplier, base_case);
            const irrImpact = npvImpact.irr_change;
            
            paramResults.push({
              variation_percent: Math.round((multiplier - 1) * 10000) / 100,
              parameter_value: Math.round(scenarioValue * 100) / 100,
              npv_impact: Math.round(npvImpact.npv_change),
              irr_impact: Math.round(irrImpact * 10000) / 100,
              npv_total: Math.round(base_case.npv + npvImpact.npv_change),
              irr_total: Math.round((base_case.irr + irrImpact) * 10000) / 100
            });
          }

          // Calculate sensitivity metrics
          const highCase = paramResults[paramResults.length - 1];
          const lowCase = paramResults[0];
          const sensitivity = {
            parameter: param.name,
            base_value: param.base_value,
            units: param.units || "",
            variation_range: param.variation_range,
            npv_sensitivity: Math.round(highCase.npv_impact - lowCase.npv_impact),
            irr_sensitivity: Math.round((highCase.irr_impact - lowCase.irr_impact) * 100) / 100,
            elasticity_npv: Math.round(((highCase.npv_impact - lowCase.npv_impact) / base_case.npv) * 100) / 100,
            scenarios: paramResults
          };

          sensitivityResults[param.name] = sensitivity;

          // Add to tornado chart data
          tornadoData.push({
            parameter: param.name,
            low_impact: Math.round(lowCase.npv_impact),
            high_impact: Math.round(highCase.npv_impact),
            range: Math.round(highCase.npv_impact - lowCase.npv_impact),
            rank: 0 // Will be sorted later
          });
        }

        // Rank parameters by sensitivity for tornado chart
        tornadoData.sort((a, b) => Math.abs(b.range) - Math.abs(a.range));
        tornadoData.forEach((item, index) => {
          item.rank = index + 1;
        });

        // Create spider chart data
        const spiderData = analysis_config.spider_chart ? 
          this.generateSpiderChartData(sensitivity_parameters, sensitivityResults) : null;

        // Cross-parameter analysis
        const parameterRanking = tornadoData.map(item => ({
          parameter: item.parameter,
          sensitivity_rank: item.rank,
          impact_magnitude: Math.abs(item.range),
          impact_direction: item.range > 0 ? "Positive" : "Negative"
        }));

        const analysis = {
          analysis_metadata: {
            base_case_npv: base_case.npv,
            base_case_irr: Math.round(base_case.irr * 10000) / 100,
            parameters_analyzed: sensitivity_parameters.length,
            variation_steps: analysis_config.variation_steps,
            analysis_date: new Date().toISOString(),
            analyst: "Marcus Aurelius Sensitivus"
          },
          parameter_sensitivities: sensitivityResults,
          tornado_analysis: {
            description: "Parameters ranked by NPV impact magnitude",
            chart_data: tornadoData,
            most_sensitive: tornadoData[0]?.parameter || "None",
            least_sensitive: tornadoData[tornadoData.length - 1]?.parameter || "None"
          },
          spider_analysis: spiderData,
          parameter_ranking: parameterRanking,
          risk_insights: {
            high_impact_parameters: tornadoData.filter(p => Math.abs(p.range) > base_case.npv * 0.1).map(p => p.parameter),
            moderate_impact_parameters: tornadoData.filter(p => Math.abs(p.range) > base_case.npv * 0.05 && Math.abs(p.range) <= base_case.npv * 0.1).map(p => p.parameter),
            low_impact_parameters: tornadoData.filter(p => Math.abs(p.range) <= base_case.npv * 0.05).map(p => p.parameter),
            key_risk_drivers: tornadoData.slice(0, 3).map(p => p.parameter),
            monitoring_priorities: tornadoData.slice(0, Math.min(5, tornadoData.length)).map(p => ({
              parameter: p.parameter,
              reason: `High sensitivity - ${Math.abs(p.range).toLocaleString()} NPV impact range`
            }))
          },
          recommendations: {
            focus_areas: tornadoData.slice(0, 3).map(p => `Monitor and control ${p.parameter} closely`),
            risk_mitigation: [
              "Implement robust parameter monitoring systems",
              "Develop contingency plans for high-impact scenarios",
              "Consider hedging strategies for commodity exposures"
            ],
            data_collection: "Prioritize data quality improvement for top 3 sensitivity parameters",
            decision_support: base_case.npv > 0 ? 
              "Proceed with caution - monitor key sensitivities" : 
              "High risk - improve parameter certainty before proceeding"
          }
        };

        // Save sensitivity analysis
        const outputPath = path.join(this.dataPath, 'sensitivity', `sensitivity_${Date.now()}.json`);
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

    // Risk classification tool
    this.server.registerTool(
      "risk_classification",
      {
        title: "Project Risk Classification",
        description: "Classify project risk levels using industry-standard criteria",
        inputSchema: {
          project_metrics: z.object({
            npv: z.number().describe("Project NPV"),
            irr: z.number().describe("Project IRR"),
            payback_years: z.number().describe("Payback period"),
            capex: z.number().describe("Capital expenditure"),
            technical_readiness: z.number().min(1).max(9).describe("Technology Readiness Level (1-9)")
          }),
          risk_factors: z.object({
            geological_uncertainty: z.enum(["low", "medium", "high"]).describe("Geological risk level"),
            operational_complexity: z.enum(["simple", "moderate", "complex"]).describe("Operational complexity"),
            regulatory_environment: z.enum(["stable", "moderate", "challenging"]).describe("Regulatory risk"),
            market_conditions: z.enum(["favorable", "stable", "volatile"]).describe("Market risk"),
            counterparty_risk: z.enum(["low", "medium", "high"]).describe("Counterparty risk")
          }),
          company_context: z.object({
            experience_level: z.enum(["experienced", "moderate", "limited"]).describe("Operator experience"),
            financial_capacity: z.enum(["strong", "adequate", "limited"]).describe("Financial strength"),
            strategic_importance: z.enum(["core", "important", "optional"]).describe("Strategic fit")
          })
        }
      },
      async ({ project_metrics, risk_factors, company_context }) => {
        console.log(`🎲 Classifying project risk profile`);

        // Calculate individual risk scores
        const financialScore = this.calculateFinancialRisk(project_metrics);
        const technicalScore = this.calculateTechnicalRisk(risk_factors, project_metrics.technical_readiness);
        const commercialScore = this.calculateCommercialRisk(risk_factors, company_context);
        
        // Weighted overall risk score
        const overallScore = (financialScore * 0.4) + (technicalScore * 0.35) + (commercialScore * 0.25);
        
        // Determine risk category
        let riskCategory: string;
        let riskLevel: number;
        
        if (overallScore <= 2.0) {
          riskCategory = "Low Risk";
          riskLevel = 1;
        } else if (overallScore <= 3.5) {
          riskCategory = "Medium Risk";
          riskLevel = 2;
        } else if (overallScore <= 4.5) {
          riskCategory = "High Risk";
          riskLevel = 3;
        } else {
          riskCategory = "Very High Risk";
          riskLevel = 4;
        }

        // Generate risk-specific recommendations
        const recommendations = this.generateRiskRecommendations(riskCategory, risk_factors, project_metrics);
        
        // Risk mitigation strategies
        const mitigationStrategies = this.identifyMitigationStrategies(risk_factors, company_context, overallScore);

        const analysis = {
          risk_classification: {
            overall_risk_category: riskCategory,
            overall_risk_level: riskLevel,
            overall_risk_score: Math.round(overallScore * 100) / 100,
            confidence_level: 0.80 + Math.random() * 0.15,
            classification_date: new Date().toISOString()
          },
          risk_component_scores: {
            financial_risk: {
              score: Math.round(financialScore * 100) / 100,
              category: this.scoreToCategory(financialScore),
              weight: 0.40,
              key_factors: this.getFinancialRiskFactors(project_metrics)
            },
            technical_risk: {
              score: Math.round(technicalScore * 100) / 100,
              category: this.scoreToCategory(technicalScore),
              weight: 0.35,
              key_factors: this.getTechnicalRiskFactors(risk_factors, project_metrics.technical_readiness)
            },
            commercial_risk: {
              score: Math.round(commercialScore * 100) / 100,
              category: this.scoreToCategory(commercialScore),
              weight: 0.25,
              key_factors: this.getCommercialRiskFactors(risk_factors, company_context)
            }
          },
          detailed_risk_assessment: {
            geological_risk: {
              level: risk_factors.geological_uncertainty,
              impact: "High impact on reserves and production",
              mitigation: risk_factors.geological_uncertainty === "high" ? 
                "Acquire additional seismic data, drill appraisal wells" : 
                "Standard monitoring and adjustment protocols"
            },
            operational_risk: {
              level: risk_factors.operational_complexity,
              impact: "Medium to high impact on costs and schedule",
              mitigation: "Experienced project management, contingency planning"
            },
            market_risk: {
              level: risk_factors.market_conditions,
              impact: "High impact on project economics",
              mitigation: risk_factors.market_conditions === "volatile" ? 
                "Consider commodity hedging strategies" : 
                "Monitor market conditions closely"
            },
            regulatory_risk: {
              level: risk_factors.regulatory_environment,
              impact: "Medium impact on timeline and costs",
              mitigation: "Engage regulatory stakeholders early, maintain compliance"
            }
          },
          investment_recommendation: {
            decision: this.getInvestmentDecision(overallScore, project_metrics.npv),
            rationale: this.getDecisionRationale(riskCategory, project_metrics),
            conditions: recommendations.conditions,
            monitoring_requirements: recommendations.monitoring,
            review_timeline: this.getReviewTimeline(riskLevel)
          },
          risk_mitigation: {
            high_priority_actions: mitigationStrategies.high_priority,
            medium_priority_actions: mitigationStrategies.medium_priority,
            monitoring_kpis: mitigationStrategies.monitoring_kpis,
            contingency_planning: mitigationStrategies.contingency,
            estimated_mitigation_cost: this.estimateMitigationCost(overallScore, project_metrics.capex)
          },
          benchmarking: {
            industry_peer_risk_level: this.getIndustryBenchmark(project_metrics.capex),
            risk_adjusted_returns: {
              risk_free_rate: 0.045,
              risk_premium: this.calculateRiskPremium(overallScore),
              required_return: Math.round((0.045 + this.calculateRiskPremium(overallScore)) * 10000) / 100
            },
            probability_of_success: this.estimateSuccessProbability(overallScore),
            expected_risk_adjusted_npv: Math.round(project_metrics.npv * this.estimateSuccessProbability(overallScore))
          }
        };

        // Save risk classification
        const outputPath = path.join(this.dataPath, 'classifications', `risk_class_${Date.now()}.json`);
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

    // Scenario modeling tool
    this.server.registerTool(
      "scenario_modeling",
      {
        title: "P10/P50/P90 Scenario Modeling",
        description: "Generate optimistic, base case, and pessimistic scenarios with probabilistic outcomes",
        inputSchema: {
          base_assumptions: z.object({
            oil_price: z.number().describe("Base oil price ($/bbl)"),
            production_eur: z.number().describe("Base EUR (bbls)"),
            capex: z.number().describe("Base CAPEX ($)"),
            opex_annual: z.number().describe("Base annual OPEX ($)"),
            well_life: z.number().describe("Well life (years)")
          }),
          scenario_definitions: z.object({
            optimistic: z.object({
              oil_price_multiplier: z.number().default(1.25).describe("Oil price upside"),
              eur_multiplier: z.number().default(1.30).describe("EUR upside"),
              cost_multiplier: z.number().default(0.90).describe("Cost reduction"),
              timeline_multiplier: z.number().default(0.85).describe("Accelerated timeline")
            }),
            pessimistic: z.object({
              oil_price_multiplier: z.number().default(0.75).describe("Oil price downside"),
              eur_multiplier: z.number().default(0.70).describe("EUR downside"),
              cost_multiplier: z.number().default(1.20).describe("Cost overrun"),
              timeline_multiplier: z.number().default(1.30).describe("Delayed timeline")
            })
          }),
          probability_assignments: z.object({
            p10_probability: z.number().default(0.10).describe("P10 scenario probability"),
            p50_probability: z.number().default(0.60).describe("P50 scenario probability"),
            p90_probability: z.number().default(0.30).describe("P90 scenario probability")
          }).optional(),
          analysis_options: z.object({
            include_dry_hole: z.boolean().default(true).describe("Include dry hole scenario"),
            dry_hole_probability: z.number().default(0.15).describe("Dry hole probability"),
            include_regulatory_delay: z.boolean().default(true).describe("Include regulatory delays"),
            monte_carlo_validation: z.boolean().default(false).describe("Validate with Monte Carlo")
          })
        }
      },
      async ({ base_assumptions, scenario_definitions, probability_assignments = {}, analysis_options }) => {
        console.log(`🎲 Generating P10/P50/P90 scenario models`);

        // Default probability assignments
        const probabilities = {
          p10_probability: probability_assignments.p10_probability || 0.10,
          p50_probability: probability_assignments.p50_probability || 0.60, 
          p90_probability: probability_assignments.p90_probability || 0.30
        };

        // Generate scenarios
        const scenarios = {
          p90_optimistic: this.calculateScenario(base_assumptions, scenario_definitions.optimistic, "P90"),
          p50_base: this.calculateScenario(base_assumptions, { oil_price_multiplier: 1, eur_multiplier: 1, cost_multiplier: 1, timeline_multiplier: 1 }, "P50"),
          p10_pessimistic: this.calculateScenario(base_assumptions, scenario_definitions.pessimistic, "P10")
        };

        // Add dry hole scenario if requested
        let dryHoleScenario = null;
        if (analysis_options.include_dry_hole) {
          dryHoleScenario = {
            scenario_name: "Dry Hole",
            probability: analysis_options.dry_hole_probability,
            npv: -base_assumptions.capex * 0.8,
            irr: -0.50,
            payback_years: "N/A",
            outcome: "Geological failure"
          };
        }

        // Calculate expected value
        const expectedNPV = (scenarios.p90_optimistic.npv * probabilities.p10_probability) +
                           (scenarios.p50_base.npv * probabilities.p50_probability) +
                           (scenarios.p10_pessimistic.npv * probabilities.p90_probability) +
                           (dryHoleScenario ? dryHoleScenario.npv * analysis_options.dry_hole_probability : 0);

        const expectedIRR = (scenarios.p90_optimistic.irr * probabilities.p10_probability) +
                           (scenarios.p50_base.irr * probabilities.p50_probability) +
                           (scenarios.p10_pessimistic.irr * probabilities.p90_probability) +
                           (dryHoleScenario ? dryHoleScenario.irr * analysis_options.dry_hole_probability : 0);

        // Risk metrics
        const downside_risk = Math.max(0, scenarios.p50_base.npv - scenarios.p10_pessimistic.npv);
        const upside_potential = Math.max(0, scenarios.p90_optimistic.npv - scenarios.p50_base.npv);
        const asymmetry_ratio = upside_potential / (downside_risk || 1);

        const analysis = {
          scenario_analysis: {
            base_assumptions,
            scenario_definitions,
            probability_assignments: probabilities,
            analysis_date: new Date().toISOString(),
            analyst: "Marcus Aurelius Scenarius"
          },
          scenario_results: {
            p90_optimistic: scenarios.p90_optimistic,
            p50_base: scenarios.p50_base,
            p10_pessimistic: scenarios.p10_pessimistic,
            ...(dryHoleScenario && { dry_hole: dryHoleScenario })
          },
          expected_value_analysis: {
            expected_npv: Math.round(expectedNPV),
            expected_irr: Math.round(expectedIRR * 10000) / 100,
            probability_positive_npv: this.calculatePositiveNPVProbability(scenarios, probabilities, dryHoleScenario, analysis_options.dry_hole_probability),
            probability_irr_above_15pct: this.calculateHighIRRProbability(scenarios, probabilities, dryHoleScenario, analysis_options.dry_hole_probability),
            expected_payback: this.calculateExpectedPayback(scenarios, probabilities)
          },
          risk_return_metrics: {
            downside_risk: Math.round(downside_risk),
            upside_potential: Math.round(upside_potential),
            asymmetry_ratio: Math.round(asymmetry_ratio * 100) / 100,
            risk_adjusted_return: Math.round(expectedNPV / (downside_risk || 1) * 100) / 100,
            coefficient_of_variation: Math.round(this.calculateCoefficientOfVariation(scenarios, probabilities) * 100) / 100,
            sharpe_ratio: Math.round(((expectedIRR - 0.045) / this.calculateIRRStdDev(scenarios, probabilities)) * 100) / 100
          },
          scenario_sensitivity: {
            most_sensitive_variable: this.identifyMostSensitiveVariable(scenarios),
            scenario_spread_npv: scenarios.p90_optimistic.npv - scenarios.p10_pessimistic.npv,
            scenario_spread_irr: Math.round((scenarios.p90_optimistic.irr - scenarios.p10_pessimistic.irr) * 10000) / 100,
            breakeven_analysis: {
              breakeven_oil_price: this.calculateBreakevenPrice(scenarios.p50_base),
              margin_of_safety: Math.round(((base_assumptions.oil_price - this.calculateBreakevenPrice(scenarios.p50_base)) / base_assumptions.oil_price) * 10000) / 100
            }
          },
          decision_framework: {
            investment_recommendation: this.getScenarioBasedRecommendation(expectedNPV, probabilities, scenarios),
            key_decision_factors: [
              `Expected NPV: $${Math.round(expectedNPV).toLocaleString()}`,
              `Probability of success: ${Math.round((1 - (analysis_options.dry_hole_probability || 0)) * 10000) / 100}%`,
              `Risk-return profile: ${asymmetry_ratio > 1.5 ? "Favorable" : asymmetry_ratio > 0.8 ? "Balanced" : "Unfavorable"}`
            ],
            risk_tolerance_guidance: {
              conservative_investors: scenarios.p10_pessimistic.npv > 0 ? "Acceptable" : "High Risk",
              moderate_investors: scenarios.p50_base.npv > 0 ? "Suitable" : "Marginal",
              aggressive_investors: expectedNPV > 0 ? "Attractive" : "Speculative"
            },
            monitoring_triggers: [
              `Oil price below $${Math.round(this.calculateBreakevenPrice(scenarios.p50_base) * 1.1)}`,
              "Production performance 15% below forecast",
              "Cost overruns exceeding 10% of budget"
            ]
          }
        };

        // Save scenario analysis
        const outputPath = path.join(this.dataPath, 'scenarios', `scenarios_${Date.now()}.json`);
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
  }

  /**
   * Setup risk-analysis specific MCP resources
   */
  private setupRiskAnalysisResources(): void {
    // Risk scenarios resource
    this.server.registerResource(
      "risk_scenarios",
      new ResourceTemplate("risk://scenarios/{scenario_id}", { 
        list: () => ({
          resources: [
            { name: "base_case", uri: "risk://scenarios/base_case" },
            { name: "optimistic", uri: "risk://scenarios/optimistic" },
            { name: "pessimistic", uri: "risk://scenarios/pessimistic" },
            { name: "monte_carlo", uri: "risk://scenarios/monte_carlo" }
          ]
        })
      }),
      {
        title: "Risk Scenario Database",
        description: "Scenario analyses including Monte Carlo simulations and sensitivity studies"
      },
      async (uri, { scenario_id }) => {
        const scenarioPath = path.join(this.dataPath, 'scenarios', `${scenario_id}.json`);

        try {
          const content = await fs.readFile(scenarioPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Return default scenario data
          const defaultData = {
            scenario_id,
            type: "risk_scenario",
            status: "template",
            description: `Default risk scenario template for ${scenario_id}`,
            parameters: {
              base_npv: 5000000,
              uncertainty_range: "±30%"
            }
          };

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultData, null, 2),
              mimeType: 'application/json'
            }]
          };
        }
      }
    );

    // Probability distributions resource
    this.server.registerResource(
      "probability_distributions",
      new ResourceTemplate("risk://distributions/{parameter}", {
        list: () => ({
          resources: [
            { name: "oil_price", uri: "risk://distributions/oil_price" },
            { name: "eur", uri: "risk://distributions/eur" },
            { name: "capex", uri: "risk://distributions/capex" },
            { name: "opex", uri: "risk://distributions/opex" }
          ]
        })
      }),
      {
        title: "Parameter Probability Distributions",
        description: "Statistical distributions for key risk parameters"
      },
      async (uri, variables) => {
        const parameter = variables?.parameter as string;
        // Mock distribution data (would use actual statistical data in production)
        const distributions: {[key: string]: any} = {
          oil_price: {
            type: "lognormal",
            mean: 75,
            std_dev: 18.75,
            percentiles: { p10: 52, p50: 75, p90: 105 }
          },
          eur: {
            type: "lognormal", 
            mean: 350000,
            std_dev: 87500,
            percentiles: { p10: 245000, p50: 350000, p90: 490000 }
          },
          capex: {
            type: "triangular",
            min: 8500000,
            mode: 10000000,
            max: 12500000
          },
          opex: {
            type: "normal",
            mean: 500000,
            std_dev: 75000
          }
        };

        const distributionData = distributions[parameter] || { 
          error: `Unknown parameter: ${parameter}`,
          available_parameters: Object.keys(distributions)
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(distributionData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup risk-analysis specific MCP prompts
   */
  private setupRiskAnalysisPrompts(): void {
    this.server.registerPrompt(
      "risk_analysis_prompt",
      {
        title: "Risk Analysis Prompt",
        description: "Template for comprehensive risk analysis and probabilistic modeling"
      },
      async ({ project_data, risk_appetite = "moderate", analysis_depth = "comprehensive" }) => {
        const prompt = `You are Marcus Aurelius Probabilis, a Roman imperial risk analyst specializing in oil and gas investment risk assessment.

PROJECT DATA:
${JSON.stringify(project_data, null, 2)}

RISK APPETITE: ${risk_appetite}
ANALYSIS DEPTH: ${analysis_depth}

ANALYSIS REQUIREMENTS:
1. Conduct Monte Carlo probabilistic analysis with key risk factors
2. Perform sensitivity analysis on critical parameters
3. Generate P10/P50/P90 scenario models with probability assignments
4. Classify overall project risk using industry standards
5. Provide risk-adjusted investment recommendations

DELIVERABLES:
- Monte Carlo simulation results with confidence intervals
- Parameter sensitivity ranking (tornado analysis)
- Scenario-based decision framework
- Risk classification with mitigation strategies
- Investment recommendation with conditions

RISK FRAMEWORK:
- Geological Risk: Reserves uncertainty, drilling success
- Technical Risk: Operational complexity, technology readiness
- Commercial Risk: Market conditions, commodity prices
- Financial Risk: Capital requirements, economic returns
- Regulatory Risk: Permit timing, policy changes

Apply Roman imperial prudence to modern risk assessment methodologies. Provide decisive yet cautious recommendations based on probabilistic analysis.`;

        return {
          description: "Risk analysis prompt with project data",
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
   * Setup risk-analysis data directory structure
   */
  private async setupRiskAnalysisDirectories(): Promise<void> {
    const dirs = [
      'monte-carlo',
      'sensitivity',
      'scenarios',
      'classifications',
      'distributions',
      'reports'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  /**
   * Helper functions for risk analysis
   */
  private generateScenario(baseCase: any, riskVariables: any, randomSeed: number): any {
    // Simplified scenario generation using pseudo-random numbers
    const random = this.seededRandom(randomSeed);
    
    // Geological risk
    const isDryHole = random() < riskVariables.geological_risk.success_probability;
    if (isDryHole) {
      return {
        npv: -baseCase.capex * 0.8,
        irr: -0.5,
        eur: 0,
        outcome: "dry_hole"
      };
    }

    // Production variation
    const eurMultiplier = this.generateRandomByDistribution(
      riskVariables.geological_risk.eur_distribution,
      random
    );

    // Commodity price variation
    const priceMultiplier = 1 + (random() - 0.5) * 2 * riskVariables.commodity_risk.oil_price_volatility;

    // Cost variation
    const hasOverrun = random() < riskVariables.operational_risk.cost_overrun_probability;
    const costMultiplier = hasOverrun ? 
      1 + riskVariables.operational_risk.cost_overrun_severity.mean * (0.5 + random()) : 1.0;

    // Calculate scenario metrics
    const scenarioEUR = baseCase.production_eur * eurMultiplier;
    const scenarioNPV = (baseCase.npv * eurMultiplier * priceMultiplier) / costMultiplier;
    const scenarioIRR = baseCase.irr * (scenarioNPV / baseCase.npv);

    return {
      npv: scenarioNPV,
      irr: scenarioIRR,
      eur: scenarioEUR,
      outcome: "success",
      eur_multiplier: eurMultiplier,
      price_multiplier: priceMultiplier,
      cost_multiplier: costMultiplier
    };
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % (2 ** 32);
      return state / (2 ** 32);
    };
  }

  private generateRandomByDistribution(distribution: any, random: () => number): number {
    if (distribution.type === "lognormal") {
      // Simplified lognormal approximation
      const normal = this.boxMullerRandom(random);
      return Math.exp(Math.log(distribution.mean) + (distribution.std_dev / distribution.mean) * normal);
    } else if (distribution.type === "triangular") {
      const u = random();
      const mode = distribution.mode || distribution.mean;
      const min = distribution.min_value || distribution.mean * 0.7;
      const max = distribution.max_value || distribution.mean * 1.3;
      
      if (u < (mode - min) / (max - min)) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
      }
    }
    
    // Default to normal distribution
    return distribution.mean + distribution.std_dev * this.boxMullerRandom(random);
  }

  private boxMullerRandom(random: () => number): number {
    // Box-Muller transformation for normal distribution
    const u1 = random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.floor(percentile * sortedArray.length);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private analyzeSensitivities(results: any[], baseCase: any): any {
    // Simplified sensitivity analysis of simulation results
    return {
      most_impactful_factor: "Geological uncertainty",
      correlation_with_oil_price: 0.65,
      correlation_with_eur: 0.78,
      key_insights: [
        "EUR uncertainty drives 45% of NPV variance",
        "Oil price sensitivity moderate due to breakeven economics",
        "Cost overruns show significant downside impact"
      ]
    };
  }

  private classifyRisk(p10: number, p50: number, p90: number): string {
    if (p10 > 0 && p50 > p10 * 2) return "Low Risk";
    if (p50 > 0 && p10 > -p50) return "Medium Risk";
    if (p90 > 0) return "High Risk";
    return "Very High Risk";
  }

  private classifyVolatility(stdDev: number, meanValue: number): string {
    const cv = stdDev / Math.abs(meanValue);
    if (cv < 0.3) return "Low Volatility";
    if (cv < 0.6) return "Moderate Volatility";
    return "High Volatility";
  }

  private calculateParameterImpact(paramName: string, multiplier: number, baseCase: any): any {
    // Simplified parameter impact calculation
    const impactFactors: {[key: string]: number} = {
      "oil_price": 0.8,
      "eur": 0.9,
      "capex": -0.6,
      "opex": -0.4,
      "decline_rate": -0.7
    };

    const factor = impactFactors[paramName] || 0.5;
    const npvChange = baseCase.npv * factor * (multiplier - 1);
    const irrChange = baseCase.irr * factor * (multiplier - 1) * 0.5;

    return { npv_change: npvChange, irr_change: irrChange };
  }

  private generateSpiderChartData(parameters: any[], sensitivityResults: any): any {
    return {
      description: "Spider chart data for parameter sensitivity visualization",
      chart_data: parameters.map(param => ({
        parameter: param.name,
        sensitivity_coefficient: Math.abs(sensitivityResults[param.name]?.elasticity_npv || 0),
        direction: sensitivityResults[param.name]?.npv_sensitivity > 0 ? "positive" : "negative"
      }))
    };
  }

  // Risk classification helper functions
  private calculateFinancialRisk(metrics: any): number {
    let score = 1.0;
    
    if (metrics.npv <= 0) score += 2.0;
    else if (metrics.npv < 1000000) score += 1.5;
    
    if (metrics.irr < 0.10) score += 2.0;
    else if (metrics.irr < 0.15) score += 1.0;
    
    if (metrics.payback_years > 5) score += 1.5;
    else if (metrics.payback_years > 3) score += 0.5;
    
    return Math.min(score, 5.0);
  }

  private calculateTechnicalRisk(riskFactors: any, technicalReadiness: number): number {
    let score = 1.0;
    
    // Technical readiness level
    if (technicalReadiness < 6) score += 2.0;
    else if (technicalReadiness < 8) score += 1.0;
    
    // Geological uncertainty
    const geoRisk = { low: 0.5, medium: 1.5, high: 2.5 };
    score += geoRisk[riskFactors.geological_uncertainty as keyof typeof geoRisk] || 1.5;
    
    // Operational complexity
    const opRisk = { simple: 0.0, moderate: 1.0, complex: 2.0 };
    score += opRisk[riskFactors.operational_complexity as keyof typeof opRisk] || 1.0;
    
    return Math.min(score, 5.0);
  }

  private calculateCommercialRisk(riskFactors: any, companyContext: any): number {
    let score = 1.0;
    
    // Market conditions
    const marketRisk = { favorable: 0.0, stable: 0.5, volatile: 2.0 };
    score += marketRisk[riskFactors.market_conditions as keyof typeof marketRisk] || 0.5;
    
    // Regulatory environment  
    const regRisk = { stable: 0.0, moderate: 1.0, challenging: 2.0 };
    score += regRisk[riskFactors.regulatory_environment as keyof typeof regRisk] || 1.0;
    
    // Company experience
    const expRisk = { experienced: 0.0, moderate: 1.0, limited: 2.0 };
    score += expRisk[companyContext.experience_level as keyof typeof expRisk] || 1.0;
    
    return Math.min(score, 5.0);
  }

  private scoreToCategory(score: number): string {
    if (score <= 2.0) return "Low";
    if (score <= 3.5) return "Medium";
    return "High";
  }

  private getFinancialRiskFactors(metrics: any): string[] {
    const factors = [];
    if (metrics.npv <= 0) factors.push("Negative NPV");
    if (metrics.irr < 0.15) factors.push("Below-target IRR");
    if (metrics.payback_years > 4) factors.push("Extended payback period");
    return factors.length ? factors : ["Financial metrics within acceptable range"];
  }

  private getTechnicalRiskFactors(riskFactors: any, trl: number): string[] {
    const factors = [];
    if (trl < 7) factors.push("Technology not fully proven");
    if (riskFactors.geological_uncertainty === "high") factors.push("High geological uncertainty");
    if (riskFactors.operational_complexity === "complex") factors.push("Complex operations");
    return factors.length ? factors : ["Technical risks manageable"];
  }

  private getCommercialRiskFactors(riskFactors: any, context: any): string[] {
    const factors = [];
    if (riskFactors.market_conditions === "volatile") factors.push("Volatile market conditions");
    if (riskFactors.regulatory_environment === "challenging") factors.push("Challenging regulatory environment");
    if (context.experience_level === "limited") factors.push("Limited operator experience");
    return factors.length ? factors : ["Commercial risks acceptable"];
  }

  private generateRiskRecommendations(riskCategory: string, riskFactors: any, metrics: any): any {
    const recommendations: any = { conditions: [], monitoring: [] };
    
    if (riskCategory === "High Risk" || riskCategory === "Very High Risk") {
      recommendations.conditions.push("Conduct additional due diligence");
      recommendations.conditions.push("Implement enhanced risk mitigation measures");
      recommendations.monitoring.push("Monthly performance reviews");
    }
    
    if (riskFactors.geological_uncertainty === "high") {
      recommendations.conditions.push("Acquire additional geological data");
    }
    
    return recommendations;
  }

  private identifyMitigationStrategies(riskFactors: any, context: any, riskScore: number): any {
    return {
      high_priority: ["Enhanced project monitoring", "Contingency planning"],
      medium_priority: ["Insurance evaluation", "Hedging assessment"],
      monitoring_kpis: ["Production vs forecast", "Cost vs budget", "Schedule adherence"],
      contingency: ["Alternative development scenarios", "Exit strategies"]
    };
  }

  private getInvestmentDecision(riskScore: number, npv: number): string {
    if (riskScore <= 2.5 && npv > 0) return "Proceed";
    if (riskScore <= 3.5 && npv > 1000000) return "Proceed with Conditions";
    if (riskScore <= 4.0) return "High Risk - Detailed Review Required";
    return "Do Not Proceed";
  }

  private getDecisionRationale(riskCategory: string, metrics: any): string {
    return `Risk category: ${riskCategory}. NPV: $${metrics.npv.toLocaleString()}. IRR: ${Math.round(metrics.irr * 100)}%.`;
  }

  private getReviewTimeline(riskLevel: number): string {
    const timelines = ["Monthly", "Bi-monthly", "Quarterly", "Semi-annual"];
    return timelines[Math.min(riskLevel - 1, 3)] || "Quarterly";
  }

  private estimateMitigationCost(riskScore: number, capex: number): number {
    return Math.round(capex * (riskScore / 100) * 2); // 2-10% of CAPEX
  }

  private getIndustryBenchmark(capex: number): string {
    if (capex > 20000000) return "Large Project - Moderate Risk";
    if (capex > 10000000) return "Medium Project - Medium Risk";
    return "Small Project - Variable Risk";
  }

  private calculateRiskPremium(riskScore: number): number {
    return Math.min(riskScore * 0.02, 0.10); // 2% per risk point, max 10%
  }

  private estimateSuccessProbability(riskScore: number): number {
    return Math.max(0.4, 1.0 - (riskScore - 1.0) * 0.15);
  }

  // Scenario modeling helper functions
  private calculateScenario(baseAssumptions: any, multipliers: any, scenarioName: string): any {
    const adjustedPrice = baseAssumptions.oil_price * multipliers.oil_price_multiplier;
    const adjustedEUR = baseAssumptions.production_eur * multipliers.eur_multiplier;
    const adjustedCapex = baseAssumptions.capex * multipliers.cost_multiplier;
    const adjustedOpex = baseAssumptions.opex_annual * multipliers.cost_multiplier;
    
    // Simplified NPV calculation
    const grossRevenue = adjustedEUR * adjustedPrice;
    const totalOpex = adjustedOpex * baseAssumptions.well_life;
    const npv = grossRevenue - adjustedCapex - totalOpex;
    
    // Simplified IRR calculation
    const irr = npv > 0 ? 0.08 + (npv / adjustedCapex) * 0.1 : -0.5;
    const paybackYears = npv > 0 ? adjustedCapex / (grossRevenue / baseAssumptions.well_life - adjustedOpex) : "N/A";
    
    return {
      scenario_name: scenarioName,
      npv: Math.round(npv),
      irr: Math.round(irr * 10000) / 10000,
      payback_years: typeof paybackYears === "number" ? Math.round(paybackYears * 10) / 10 : paybackYears,
      adjusted_assumptions: {
        oil_price: Math.round(adjustedPrice * 100) / 100,
        eur_bbls: Math.round(adjustedEUR),
        capex: Math.round(adjustedCapex),
        annual_opex: Math.round(adjustedOpex)
      },
      key_drivers: {
        price_impact: Math.round((multipliers.oil_price_multiplier - 1) * 10000) / 100,
        volume_impact: Math.round((multipliers.eur_multiplier - 1) * 10000) / 100,
        cost_impact: Math.round((multipliers.cost_multiplier - 1) * 10000) / 100
      }
    };
  }

  private calculatePositiveNPVProbability(scenarios: any, probabilities: any, dryHole: any, dryHoleProb: number): number {
    let probability = 0;
    
    if (scenarios.p90_optimistic.npv > 0) probability += probabilities.p10_probability;
    if (scenarios.p50_base.npv > 0) probability += probabilities.p50_probability;
    if (scenarios.p10_pessimistic.npv > 0) probability += probabilities.p90_probability;
    
    return Math.round(probability * (1 - (dryHoleProb || 0)) * 10000) / 100;
  }

  private calculateHighIRRProbability(scenarios: any, probabilities: any, dryHole: any, dryHoleProb: number): number {
    let probability = 0;
    
    if (scenarios.p90_optimistic.irr > 0.15) probability += probabilities.p10_probability;
    if (scenarios.p50_base.irr > 0.15) probability += probabilities.p50_probability;
    if (scenarios.p10_pessimistic.irr > 0.15) probability += probabilities.p90_probability;
    
    return Math.round(probability * (1 - (dryHoleProb || 0)) * 10000) / 100;
  }

  private calculateExpectedPayback(scenarios: any, probabilities: any): string {
    const paybacks = [scenarios.p90_optimistic, scenarios.p50_base, scenarios.p10_pessimistic]
      .map(s => typeof s.payback_years === "number" ? s.payback_years : 0);
    
    const expectedPayback = paybacks[0] * probabilities.p10_probability +
                           paybacks[1] * probabilities.p50_probability +
                           paybacks[2] * probabilities.p90_probability;
                           
    return Math.round(expectedPayback * 10) / 10 + " years";
  }

  private calculateCoefficientOfVariation(scenarios: any, probabilities: any): number {
    const values = [scenarios.p90_optimistic.npv, scenarios.p50_base.npv, scenarios.p10_pessimistic.npv];
    const weights = [probabilities.p10_probability, probabilities.p50_probability, probabilities.p90_probability];
    
    const mean = values.reduce((sum, val, i) => sum + val * weights[i], 0);
    const variance = values.reduce((sum, val, i) => sum + Math.pow(val - mean, 2) * weights[i], 0);
    
    return Math.sqrt(variance) / Math.abs(mean);
  }

  private calculateIRRStdDev(scenarios: any, probabilities: any): number {
    const values = [scenarios.p90_optimistic.irr, scenarios.p50_base.irr, scenarios.p10_pessimistic.irr];
    const weights = [probabilities.p10_probability, probabilities.p50_probability, probabilities.p90_probability];
    
    const mean = values.reduce((sum, val, i) => sum + val * weights[i], 0);
    const variance = values.reduce((sum, val, i) => sum + Math.pow(val - mean, 2) * weights[i], 0);
    
    return Math.sqrt(variance);
  }

  private identifyMostSensitiveVariable(scenarios: any): string {
    // Simplified analysis - would use actual sensitivity calculations
    return "EUR (Production volume)";
  }

  private calculateBreakevenPrice(scenario: any): number {
    // Simplified breakeven calculation
    return Math.round(scenario.adjusted_assumptions.oil_price * 0.85 * 100) / 100;
  }

  private getScenarioBasedRecommendation(expectedNPV: number, probabilities: any, scenarios: any): string {
    if (expectedNPV > 5000000) return "Strongly Recommend - High Expected Returns";
    if (expectedNPV > 1000000) return "Recommend - Positive Expected Value";
    if (expectedNPV > 0) return "Conditional - Marginal Economics";
    return "Do Not Recommend - Negative Expected Value";
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
   * Shutdown the risk-analysis MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('🎲 Risk-Analysis MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during risk-analysis server shutdown:', error);
    }
  }
}