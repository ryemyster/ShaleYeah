/**
 * Market-Intelligence MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for commodity pricing, market analysis, and economic intelligence
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface MarketMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class MarketMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: MarketMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'market');

    // Create official MCP server with market intelligence domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupMarketTools();
    this.setupMarketResources();
    this.setupMarketPrompts();
  }

  /**
   * Initialize market MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupMarketDirectories();
      this.initialized = true;

      console.log(`📊 Market MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Market MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup market-specific MCP tools
   */
  private setupMarketTools(): void {
    // Analyze commodity prices tool
    this.server.registerTool(
      "analyze_commodity_prices",
      {
        title: "Analyze Commodity Prices",
        description: "Oil/gas/NGL price analysis and forecasting for market intelligence",
        inputSchema: {
          price_analysis_scope: z.object({
            commodities: z.array(z.enum(["wti_crude", "brent_crude", "natural_gas", "ngl_composite", "refined_products"])),
            time_period: z.object({
              start_date: z.string().optional(),
              end_date: z.string().optional(),
              analysis_window_days: z.number().default(365)
            }).optional(),
            analysis_depth: z.enum(["overview", "detailed", "comprehensive"]).default("detailed")
          }),
          market_factors: z.object({
            supply_demand_analysis: z.boolean().default(true),
            geopolitical_impact: z.boolean().default(true),
            seasonal_patterns: z.boolean().default(true),
            correlation_analysis: z.boolean().default(false)
          }).optional(),
          forecasting_options: z.object({
            forecast_horizon_days: z.number().min(30).max(1095).default(180),
            confidence_intervals: z.array(z.number()).default([0.68, 0.95]),
            scenario_modeling: z.boolean().default(true)
          }).optional()
        }
      },
      async ({ price_analysis_scope, market_factors = {}, forecasting_options = {} }) => {
        console.log(`📊 Analyzing commodity prices for ${price_analysis_scope.commodities.join(", ")}`);

        const priceAnalysis = {
          analysis_metadata: {
            analysis_date: new Date().toISOString(),
            analyst: "Gaius Mercatus Analyst",
            scope: price_analysis_scope,
            market_factors,
            forecasting_options
          },
          market_overview: {
            market_sentiment: "Mixed with cautious optimism",
            volatility_environment: "Moderate",
            key_themes: [
              "Supply discipline from major producers",
              "Steady demand growth in emerging markets", 
              "Energy transition creating long-term uncertainty"
            ],
            macro_factors: ["Fed monetary policy", "Global economic growth", "Geopolitical tensions"]
          },
          commodity_analysis: price_analysis_scope.commodities.map(commodity => ({
            commodity,
            current_market_data: {
              current_price: this.getCurrentPrice(commodity),
              price_change_24h: this.getPriceChange(commodity, "24h"),
              price_change_7d: this.getPriceChange(commodity, "7d"),
              price_change_30d: this.getPriceChange(commodity, "30d"),
              volatility_30d: 0.15 + Math.random() * 0.10
            },
            historical_analysis: {
              price_range_52w: {
                high: this.getCurrentPrice(commodity) * (1.25 + Math.random() * 0.15),
                low: this.getCurrentPrice(commodity) * (0.75 - Math.random() * 0.15),
                current_vs_range: "Mid-range"
              },
              average_prices: {
                ytd_average: this.getCurrentPrice(commodity) * (0.95 + Math.random() * 0.10),
                three_year_average: this.getCurrentPrice(commodity) * (0.90 + Math.random() * 0.20),
                five_year_average: this.getCurrentPrice(commodity) * (0.85 + Math.random() * 0.30)
              },
              trend_analysis: {
                short_term_trend: Math.random() > 0.5 ? "UPWARD" : "SIDEWAYS",
                medium_term_trend: "SIDEWAYS_WITH_UPWARD_BIAS",
                long_term_trend: "STRUCTURAL_SHIFT"
              }
            },
            fundamental_analysis: market_factors.supply_demand_analysis ? {
              supply_factors: this.getSupplyFactors(commodity),
              demand_factors: this.getDemandFactors(commodity),
              supply_demand_balance: "BALANCED_TO_TIGHT",
              inventory_levels: this.getInventoryStatus(commodity),
              production_outlook: "DISCIPLINED_GROWTH"
            } : undefined,
            seasonal_patterns: market_factors.seasonal_patterns ? {
              seasonal_strength: this.getSeasonalStrength(commodity),
              historical_seasonal_pattern: "Q4/Q1 strength typical",
              current_vs_seasonal: "ABOVE_SEASONAL_NORM"
            } : undefined,
            technical_indicators: {
              support_levels: [
                this.getCurrentPrice(commodity) * 0.95,
                this.getCurrentPrice(commodity) * 0.90
              ],
              resistance_levels: [
                this.getCurrentPrice(commodity) * 1.05,
                this.getCurrentPrice(commodity) * 1.12
              ],
              momentum_indicators: "NEUTRAL_TO_POSITIVE",
              chart_pattern: "CONSOLIDATION"
            }
          })),
          price_forecasting: forecasting_options.forecast_horizon_days ? {
            forecast_methodology: "Fundamental + Technical + Scenario Analysis",
            base_case_forecast: price_analysis_scope.commodities.map(commodity => ({
              commodity,
              forecast_horizon_days: forecasting_options.forecast_horizon_days,
              price_trajectory: this.generatePriceForecast(commodity, forecasting_options.forecast_horizon_days!),
              forecast_confidence: 0.68 + Math.random() * 0.20,
              key_assumptions: [
                "Stable geopolitical environment",
                "Continued economic growth",
                "Normal weather patterns"
              ]
            })),
            scenario_analysis: forecasting_options.scenario_modeling ? {
              bull_case: {
                probability: 0.25,
                price_upside: "15-25%",
                key_drivers: ["Supply disruptions", "Stronger demand growth", "Inventory draws"]
              },
              bear_case: {
                probability: 0.25,
                price_downside: "10-20%",
                key_drivers: ["Demand weakness", "Supply increases", "Economic slowdown"]
              },
              base_case: {
                probability: 0.50,
                price_range: "+/- 10%",
                key_drivers: ["Balanced supply/demand", "Stable macro conditions"]
              }
            } : undefined
          } : undefined,
          correlation_analysis: market_factors.correlation_analysis ? {
            commodity_correlations: this.generateCorrelationMatrix(price_analysis_scope.commodities),
            macro_correlations: {
              usd_correlation: -0.65,
              equity_correlation: 0.45,
              bond_correlation: -0.25,
              inflation_correlation: 0.78
            },
            regional_price_spreads: {
              wti_brent_spread: 2.50,
              henry_hub_ttf_spread: 8.50,
              regional_differential_stability: "STABLE"
            }
          } : undefined,
          investment_implications: {
            overall_attractiveness: "MODERATE_TO_ATTRACTIVE",
            risk_reward_profile: "BALANCED",
            key_opportunities: [
              "Selective positioning in high-quality assets",
              "Hedging strategies for price volatility",
              "Integration plays for margin enhancement"
            ],
            primary_risks: [
              "Commodity price volatility",
              "Regulatory environment changes",
              "Energy transition uncertainty"
            ],
            recommended_strategies: [
              "Maintain flexible operational footprint",
              "Focus on low-cost, high-return projects",
              "Implement robust risk management"
            ]
          }
        };

        // Save price analysis
        const outputPath = path.join(this.dataPath, 'price-analysis', `analysis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(priceAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(priceAnalysis, null, 2)
          }]
        };
      }
    );

    // Assess market conditions tool
    this.server.registerTool(
      "assess_market_conditions",
      {
        title: "Assess Market Conditions",
        description: "Market sentiment and trend analysis for strategic decision making",
        inputSchema: {
          assessment_scope: z.object({
            geographic_regions: z.array(z.string()).describe("Geographic regions to analyze"),
            market_segments: z.array(z.enum(["upstream", "midstream", "downstream", "oilfield_services", "renewables"])),
            assessment_timeframe: z.enum(["current", "short_term", "medium_term", "long_term"]).default("medium_term")
          }),
          analysis_dimensions: z.object({
            supply_chain_analysis: z.boolean().default(true),
            competitive_dynamics: z.boolean().default(true),
            regulatory_environment: z.boolean().default(true),
            technology_trends: z.boolean().default(false),
            esg_considerations: z.boolean().default(true)
          }).optional(),
          market_intelligence_depth: z.enum(["high_level", "detailed", "comprehensive"]).default("detailed")
        }
      },
      async ({ assessment_scope, analysis_dimensions = {}, market_intelligence_depth }) => {
        console.log(`📊 Assessing market conditions for ${assessment_scope.market_segments.join(", ")} in ${assessment_scope.geographic_regions.join(", ")}`);

        const marketAssessment = {
          assessment_metadata: {
            assessment_date: new Date().toISOString(),
            analyst: "Gaius Mercatus Analyst",
            scope: assessment_scope,
            analysis_dimensions,
            intelligence_depth: market_intelligence_depth
          },
          executive_summary: {
            overall_market_sentiment: "CAUTIOUSLY_OPTIMISTIC",
            market_cycle_position: "MID_CYCLE",
            key_investment_themes: [
              "Capital allocation discipline",
              "Operational efficiency focus",
              "ESG integration",
              "Technology adoption"
            ],
            primary_market_drivers: [
              "Commodity price stability",
              "Regulatory clarity",
              "Energy security concerns",
              "Climate transition policies"
            ]
          },
          regional_analysis: assessment_scope.geographic_regions.map(region => ({
            region,
            market_attractiveness: this.getRegionalAttractiveness(region),
            regulatory_environment: {
              stability_rating: "STABLE",
              recent_policy_changes: region.includes("Europe") ? "Green Deal implementation" : 
                                   region.includes("North America") ? "Infrastructure investment" :
                                   "Market liberalization",
              business_friendliness: this.getBusinessFriendliness(region),
              permitting_environment: region.includes("US") ? "STREAMLINED" : "MODERATE_COMPLEXITY"
            },
            market_dynamics: {
              competition_level: "MODERATE_TO_HIGH",
              market_concentration: this.getMarketConcentration(region),
              entry_barriers: region.includes("Offshore") ? "HIGH" : "MODERATE",
              technology_adoption_rate: "ACCELERATING"
            },
            investment_climate: {
              capital_availability: "ADEQUATE",
              cost_of_capital: "MODERATE",
              project_sanctioning_pace: "SELECTIVE",
              merger_acquisition_activity: "ACTIVE"
            }
          })),
          segment_analysis: assessment_scope.market_segments.map(segment => ({
            segment,
            market_health: {
              growth_trajectory: this.getSegmentGrowth(segment),
              profitability_trends: segment === "upstream" ? "IMPROVING" :
                                   segment === "midstream" ? "STABLE" :
                                   segment === "downstream" ? "PRESSURED" :
                                   segment === "oilfield_services" ? "RECOVERING" : "GROWING",
              capital_allocation: "DISCIPLINED",
              operational_efficiency: "IMPROVING"
            },
            competitive_landscape: analysis_dimensions.competitive_dynamics ? {
              market_structure: "CONSOLIDATED_WITH_COMPETITION",
              competitive_intensity: segment === "downstream" ? "HIGH" : "MODERATE",
              differentiation_factors: this.getCompetitiveDifferentiators(segment),
              disruption_threats: segment === "renewables" ? "OPPORTUNITY" : "MODERATE"
            } : undefined,
            technology_trends: analysis_dimensions.technology_trends ? {
              digitalization_impact: "SIGNIFICANT",
              automation_adoption: "ACCELERATING",
              innovation_focus_areas: this.getTechnologyTrends(segment),
              investment_in_rd: "INCREASING"
            } : undefined,
            esg_considerations: analysis_dimensions.esg_considerations ? {
              environmental_compliance_pressure: "HIGH",
              social_license_importance: "INCREASING",
              governance_standards: "STRENGTHENING",
              transition_risk_exposure: this.getTransitionRisk(segment)
            } : undefined
          })),
          supply_chain_analysis: analysis_dimensions.supply_chain_analysis ? {
            supply_chain_health: "STABLE_WITH_PRESSURES",
            key_bottlenecks: [
              "Specialized equipment lead times",
              "Skilled labor availability",
              "Critical materials supply"
            ],
            cost_inflation_factors: [
              "Labor cost increases",
              "Materials price volatility",
              "Transportation costs"
            ],
            supply_chain_resilience: "MODERATE",
            geographic_concentration_risks: "MANAGEABLE"
          } : undefined,
          market_outlook: {
            near_term_outlook: {
              timeframe: "6-12 months",
              market_direction: "STABLE_TO_POSITIVE",
              key_catalysts: [
                "Commodity price stabilization",
                "Regulatory clarity",
                "Economic growth momentum"
              ],
              primary_risks: [
                "Geopolitical tensions",
                "Policy uncertainty",
                "Economic slowdown"
              ]
            },
            medium_term_outlook: {
              timeframe: "1-3 years",
              market_direction: "SELECTIVELY_POSITIVE",
              structural_changes: [
                "Energy transition acceleration",
                "Technology integration",
                "ESG integration deepening"
              ],
              investment_themes: [
                "Lower carbon intensity operations",
                "Digital transformation",
                "Operational excellence"
              ]
            }
          },
          strategic_implications: {
            market_positioning_recommendations: [
              "Focus on high-return, low-cost assets",
              "Invest in operational efficiency and technology",
              "Strengthen ESG credentials"
            ],
            timing_considerations: [
              "Selective market entry in attractive regions",
              "Opportunistic M&A during market dislocations",
              "Gradual capacity expansion aligned with demand"
            ],
            risk_mitigation_strategies: [
              "Diversified geographic and operational portfolio",
              "Flexible cost structure and operational footprint",
              "Strong balance sheet and liquidity management"
            ]
          }
        };

        // Save market assessment
        const outputPath = path.join(this.dataPath, 'market-conditions', `assessment_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(marketAssessment, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(marketAssessment, null, 2)
          }]
        };
      }
    );

    // Benchmark transactions tool
    this.server.registerTool(
      "benchmark_transactions",
      {
        title: "Benchmark Transactions",
        description: "Transaction comps and valuation benchmarks for M&A and investment decisions",
        inputSchema: {
          transaction_scope: z.object({
            transaction_types: z.array(z.enum(["asset_acquisition", "corporate_merger", "joint_venture", "farm_in", "ipo"])),
            asset_types: z.array(z.string()).describe("Types of assets (e.g., 'unconventional_oil', 'midstream_infrastructure')"),
            geographic_focus: z.array(z.string()).describe("Geographic regions for transaction analysis"),
            time_period: z.object({
              lookback_months: z.number().default(24),
              include_announced: z.boolean().default(true),
              include_pending: z.boolean().default(false)
            }).optional()
          }),
          valuation_metrics: z.object({
            include_enterprise_value: z.boolean().default(true),
            include_per_unit_metrics: z.boolean().default(true),
            include_financial_multiples: z.boolean().default(true),
            include_premium_analysis: z.boolean().default(false)
          }).optional(),
          benchmark_analysis: z.object({
            peer_group_definition: z.string().optional(),
            size_stratification: z.boolean().default(true),
            quality_adjustments: z.boolean().default(true)
          }).optional()
        }
      },
      async ({ transaction_scope, valuation_metrics = {}, benchmark_analysis = {} }) => {
        console.log(`📊 Benchmarking transactions: ${transaction_scope.transaction_types.join(", ")} for ${transaction_scope.asset_types.join(", ")}`);

        const transactionBenchmark = {
          benchmark_metadata: {
            analysis_date: new Date().toISOString(),
            analyst: "Gaius Mercatus Analyst",
            transaction_scope,
            valuation_metrics,
            benchmark_analysis
          },
          market_overview: {
            transaction_volume: {
              total_transactions: 85 + Math.floor(Math.random() * 40),
              total_value_usd_bn: 125 + Math.floor(Math.random() * 75),
              average_transaction_size_usd_mm: 850 + Math.floor(Math.random() * 500),
              transaction_activity_trend: "MODERATE_ACTIVITY"
            },
            market_sentiment: {
              buyer_appetite: "SELECTIVE",
              seller_motivation: "OPPORTUNISTIC",
              financing_availability: "ADEQUATE",
              valuation_environment: "FAIR_VALUE_FOCUSED"
            }
          },
          transaction_analysis: transaction_scope.transaction_types.map(transactionType => ({
            transaction_type: transactionType,
            transaction_count: Math.floor(Math.random() * 20) + 5,
            size_distribution: {
              small_transactions_pct: 45,
              medium_transactions_pct: 35,
              large_transactions_pct: 20,
              mega_transactions_count: transactionType === "corporate_merger" ? 2 : 0
            },
            geographic_distribution: transaction_scope.geographic_focus.map(region => ({
              region,
              transaction_share_pct: Math.floor(Math.random() * 40) + 10,
              average_size_usd_mm: 500 + Math.floor(Math.random() * 800)
            })),
            key_transactions: this.generateKeyTransactions(transactionType, 3)
          })),
          valuation_benchmarks: {
            enterprise_value_metrics: valuation_metrics.include_enterprise_value ? {
              ev_reserves_median: 15.50 + Math.random() * 8,
              ev_production_median: 45000 + Math.random() * 25000,
              ev_ebitda_median: 8.5 + Math.random() * 4,
              ev_dcf_nav_median: 0.85 + Math.random() * 0.25,
              valuation_range_analysis: {
                p25: "Lower quartile valuations reflect quality/location discounts",
                p50: "Median valuations align with current commodity environment",
                p75: "Upper quartile reflects premium assets and competitive processes"
              }
            } : undefined,
            per_unit_metrics: valuation_metrics.include_per_unit_metrics ? transaction_scope.asset_types.map(assetType => ({
              asset_type: assetType,
              price_per_flowing_barrel: assetType.includes("oil") ? 35000 + Math.random() * 20000 : null,
              price_per_proved_reserve: 12.50 + Math.random() * 8,
              price_per_acre: assetType.includes("unconventional") ? 8500 + Math.random() * 6000 : 
                             assetType.includes("conventional") ? 2500 + Math.random() * 2000 : null,
              price_per_mile_pipeline: assetType.includes("midstream") ? 2500000 + Math.random() * 1500000 : null
            })) : undefined,
            financial_multiples: valuation_metrics.include_financial_multiples ? {
              ev_ebitda_range: "6.5x - 12.5x",
              price_earnings_range: "12x - 18x",
              price_book_range: "0.8x - 1.4x",
              price_cash_flow_range: "4.5x - 8.5x",
              multiple_drivers: [
                "Asset quality and location",
                "Production growth profile",
                "Cost structure competitiveness",
                "ESG and sustainability profile"
              ]
            } : undefined
          },
          premium_analysis: valuation_metrics.include_premium_analysis ? {
            control_premiums: {
              average_premium_pct: 25 + Math.random() * 15,
              premium_range: "15% - 45%",
              premium_drivers: [
                "Strategic value and synergies",
                "Market competition and process",
                "Target company size and liquidity"
              ]
            },
            synergy_analysis: {
              typical_synergy_range_pct: "8% - 18% of transaction value",
              synergy_categories: [
                "Operational synergies (cost reduction)",
                "Revenue synergies (optimization)",
                "Financial synergies (cost of capital)"
              ],
              synergy_realization_timeline: "2-4 years"
            }
          } : undefined,
          market_trends: {
            valuation_trends: {
              trend_direction: "STABLE_TO_IMPROVING",
              key_valuation_drivers: [
                "Commodity price environment",
                "Capital allocation discipline",
                "ESG considerations",
                "Technology and digitalization"
              ],
              emerging_themes: [
                "Premium for low-carbon assets",
                "Technology-enabled operational excellence",
                "Scale and integration advantages"
              ]
            },
            transaction_structure_trends: {
              cash_vs_stock_preference: "Cash preferred in current environment",
              earnout_usage: "Selective use for growth assets",
              contingent_value_rights: "Limited usage",
              regulatory_approval_considerations: "Standard competition review"
            }
          },
          strategic_implications: {
            buy_side_considerations: [
              "Focus on high-quality, low-cost assets",
              "Emphasize operational synergies and integration",
              "Consider ESG and transition risk factors"
            ],
            sell_side_considerations: [
              "Optimize asset portfolio before sale",
              "Emphasize operational excellence and ESG credentials",
              "Time market access with commodity price cycles"
            ],
            valuation_guidance: [
              "Use multiple valuation methodologies",
              "Apply appropriate size and quality adjustments",
              "Consider current market sentiment and timing"
            ]
          }
        };

        // Save transaction benchmark
        const outputPath = path.join(this.dataPath, 'transactions', `benchmark_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(transactionBenchmark, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(transactionBenchmark, null, 2)
          }]
        };
      }
    );

    // Forecast demand supply tool
    this.server.registerTool(
      "forecast_demand_supply",
      {
        title: "Forecast Demand Supply",
        description: "Supply/demand modeling and forecasting for strategic planning",
        inputSchema: {
          forecast_scope: z.object({
            commodities: z.array(z.enum(["crude_oil", "natural_gas", "ngl", "refined_products"])),
            geographic_regions: z.array(z.string()),
            forecast_horizon: z.object({
              short_term_months: z.number().default(12),
              medium_term_years: z.number().default(3),
              long_term_years: z.number().default(10)
            })
          }),
          modeling_parameters: z.object({
            include_base_case: z.boolean().default(true),
            include_scenarios: z.boolean().default(true),
            granularity: z.enum(["annual", "quarterly", "monthly"]).default("quarterly"),
            confidence_intervals: z.boolean().default(true)
          }).optional(),
          analysis_factors: z.object({
            economic_growth_assumptions: z.boolean().default(true),
            technology_impact: z.boolean().default(true),
            policy_regulatory_impact: z.boolean().default(true),
            substitution_effects: z.boolean().default(false)
          }).optional()
        }
      },
      async ({ forecast_scope, modeling_parameters = {}, analysis_factors = {} }) => {
        console.log(`📊 Forecasting demand/supply for ${forecast_scope.commodities.join(", ")} across ${forecast_scope.geographic_regions.join(", ")}`);

        const demandSupplyForecast = {
          forecast_metadata: {
            forecast_date: new Date().toISOString(),
            analyst: "Gaius Mercatus Analyst",
            forecast_scope,
            modeling_parameters,
            analysis_factors
          },
          executive_summary: {
            overall_balance_outlook: "BALANCED_WITH_PERIODIC_TIGHTNESS",
            key_demand_drivers: [
              "Economic growth in emerging markets",
              "Transportation sector demand",
              "Industrial and petrochemical demand"
            ],
            key_supply_drivers: [
              "Unconventional production growth",
              "Conventional field development",
              "Technology-driven efficiency gains"
            ],
            primary_uncertainties: [
              "Energy transition pace",
              "Geopolitical supply disruptions",
              "Economic growth trajectory"
            ]
          },
          demand_analysis: forecast_scope.commodities.map(commodity => ({
            commodity,
            current_demand: {
              global_demand_mbpd: this.getGlobalDemand(commodity),
              regional_breakdown: forecast_scope.geographic_regions.map(region => ({
                region,
                demand_mbpd: this.getRegionalDemand(commodity, region),
                growth_rate_yoy: this.getDemandGrowthRate(commodity, region)
              }))
            },
            demand_forecast: {
              short_term: {
                growth_rate_cagr: this.getDemandGrowthRate(commodity, "global"),
                demand_drivers: this.getDemandDrivers(commodity),
                key_risks: ["Economic slowdown", "Substitution", "Efficiency gains"]
              },
              medium_term: {
                growth_rate_cagr: this.getDemandGrowthRate(commodity, "global") * 0.8,
                structural_changes: this.getStructuralChanges(commodity),
                emerging_demand_centers: this.getEmergingDemandCenters(commodity)
              },
              long_term: {
                growth_rate_cagr: this.getDemandGrowthRate(commodity, "global") * 0.5,
                transition_impact: this.getTransitionImpact(commodity),
                peak_demand_timing: this.getPeakDemandTiming(commodity)
              }
            },
            sectoral_breakdown: analysis_factors.economic_growth_assumptions ? {
              transportation_demand_pct: this.getSectoralBreakdown(commodity, "transportation"),
              industrial_demand_pct: this.getSectoralBreakdown(commodity, "industrial"),
              residential_commercial_pct: this.getSectoralBreakdown(commodity, "residential"),
              petrochemical_demand_pct: this.getSectoralBreakdown(commodity, "petrochemical")
            } : undefined
          })),
          supply_analysis: forecast_scope.commodities.map(commodity => ({
            commodity,
            current_supply: {
              global_supply_mbpd: this.getGlobalSupply(commodity),
              supply_composition: {
                conventional_pct: this.getSupplyComposition(commodity, "conventional"),
                unconventional_pct: this.getSupplyComposition(commodity, "unconventional"),
                offshore_pct: this.getSupplyComposition(commodity, "offshore")
              },
              regional_supply: forecast_scope.geographic_regions.map(region => ({
                region,
                supply_mbpd: this.getRegionalSupply(commodity, region),
                production_trend: this.getProductionTrend(commodity, region)
              }))
            },
            supply_forecast: {
              short_term: {
                growth_rate_cagr: this.getSupplyGrowthRate(commodity),
                capacity_additions: this.getCapacityAdditions(commodity),
                decline_rate_assumptions: this.getDeclineRates(commodity)
              },
              medium_term: {
                growth_rate_cagr: this.getSupplyGrowthRate(commodity) * 0.9,
                technology_impact: analysis_factors.technology_impact ? this.getTechnologyImpact(commodity) : undefined,
                cost_curve_evolution: this.getCostCurveEvolution(commodity)
              },
              long_term: {
                growth_rate_cagr: this.getSupplyGrowthRate(commodity) * 0.6,
                resource_constraints: this.getResourceConstraints(commodity),
                transition_supply_impact: this.getTransitionSupplyImpact(commodity)
              }
            }
          })),
          balance_analysis: {
            supply_demand_balance: forecast_scope.commodities.map(commodity => ({
              commodity,
              current_balance: "BALANCED",
              forecast_balance: {
                short_term: Math.random() > 0.6 ? "TIGHT" : "BALANCED",
                medium_term: "BALANCED_TO_SURPLUS",
                long_term: "SURPLUS_EMERGING"
              },
              surplus_deficit_timeline: this.getBalanceTimeline(commodity),
              price_implications: {
                price_support_level: this.getPriceSupportLevel(commodity),
                price_ceiling_level: this.getPriceCeilingLevel(commodity),
                volatility_outlook: "MODERATE_VOLATILITY"
              }
            })),
            inventory_analysis: {
              current_inventory_days: 28 + Math.floor(Math.random() * 14),
              inventory_trend: "STABLE",
              strategic_reserve_impact: "MINIMAL",
              seasonal_inventory_patterns: "NORMAL_SEASONALITY"
            },
            spare_capacity: {
              current_spare_capacity_mbpd: 2.5 + Math.random() * 1.5,
              spare_capacity_trend: "DECLINING",
              spare_capacity_by_region: forecast_scope.geographic_regions.map(region => ({
                region,
                spare_capacity_mbpd: Math.random() * 1.5,
                capacity_utilization_pct: 85 + Math.random() * 10
              }))
            }
          },
          scenario_analysis: modeling_parameters.include_scenarios ? {
            base_case: {
              probability: 0.50,
              description: "Steady economic growth, gradual energy transition",
              balance_outcome: "BALANCED_WITH_PERIODIC_TIGHTNESS"
            },
            upside_scenario: {
              probability: 0.25,
              description: "Strong economic growth, slower energy transition",
              demand_impact: "+5-10% vs base case",
              supply_impact: "+3-6% vs base case",
              balance_outcome: "TIGHT_MARKETS"
            },
            downside_scenario: {
              probability: 0.25,
              description: "Economic slowdown, accelerated energy transition",
              demand_impact: "-8-15% vs base case",
              supply_impact: "-5-10% vs base case",
              balance_outcome: "SURPLUS_CONDITIONS"
            }
          } : undefined,
          strategic_implications: {
            investment_implications: [
              "Focus on low-cost, high-return projects",
              "Maintain operational flexibility",
              "Invest in technology and efficiency"
            ],
            supply_strategy: [
              "Optimize production based on market cycles",
              "Maintain strategic flexibility in development timing",
              "Focus on ESG-compliant, efficient operations"
            ],
            market_positioning: [
              "Position for cyclical market variations",
              "Develop differentiated product offerings",
              "Build resilient supply chain relationships"
            ],
            timing_considerations: [
              "Near-term: capitalize on balanced markets",
              "Medium-term: prepare for potential surplus",
              "Long-term: adapt to structural changes"
            ]
          }
        };

        // Save demand/supply forecast
        const outputPath = path.join(this.dataPath, 'forecasts', `forecast_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(demandSupplyForecast, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(demandSupplyForecast, null, 2)
          }]
        };
      }
    );

    // Evaluate macro factors tool
    this.server.registerTool(
      "evaluate_macro_factors",
      {
        title: "Evaluate Macro Factors",
        description: "Macroeconomic impact analysis on energy markets and investment decisions",
        inputSchema: {
          macro_scope: z.object({
            economic_indicators: z.array(z.enum(["gdp_growth", "inflation", "interest_rates", "currency_rates", "employment"])),
            geographic_focus: z.array(z.string()),
            time_horizon: z.enum(["current", "short_term", "medium_term", "long_term"]).default("medium_term")
          }),
          analysis_focus: z.object({
            energy_sector_impact: z.boolean().default(true),
            commodity_price_sensitivity: z.boolean().default(true),
            investment_flow_analysis: z.boolean().default(true),
            policy_fiscal_impact: z.boolean().default(false)
          }).optional(),
          scenario_modeling: z.object({
            include_base_case: z.boolean().default(true),
            include_stress_scenarios: z.boolean().default(true),
            monte_carlo_simulation: z.boolean().default(false)
          }).optional()
        }
      },
      async ({ macro_scope, analysis_focus = {}, scenario_modeling = {} }) => {
        console.log(`📊 Evaluating macro factors: ${macro_scope.economic_indicators.join(", ")} for ${macro_scope.geographic_focus.join(", ")}`);

        const macroAnalysis = {
          analysis_metadata: {
            analysis_date: new Date().toISOString(),
            analyst: "Gaius Mercatus Analyst",
            macro_scope,
            analysis_focus,
            scenario_modeling
          },
          macro_environment_overview: {
            global_economic_outlook: "MODERATE_GROWTH_WITH_UNCERTAINTIES",
            key_macro_themes: [
              "Central bank policy normalization",
              "Persistent but moderating inflation",
              "Geopolitical tensions and supply chain impacts",
              "Energy transition and investment shifts"
            ],
            systemic_risks: [
              "Financial market volatility",
              "Debt sustainability concerns",
              "Energy security challenges"
            ]
          },
          economic_indicator_analysis: macro_scope.economic_indicators.map(indicator => ({
            indicator,
            current_status: this.getCurrentIndicatorStatus(indicator),
            trend_analysis: {
              short_term_trend: this.getIndicatorTrend(indicator, "short_term"),
              medium_term_outlook: this.getIndicatorTrend(indicator, "medium_term"),
              long_term_projection: this.getIndicatorTrend(indicator, "long_term")
            },
            energy_sector_impact: analysis_focus.energy_sector_impact ? {
              impact_magnitude: this.getEnergyImpact(indicator),
              transmission_mechanism: this.getTransmissionMechanism(indicator),
              lag_effects: this.getLagEffects(indicator)
            } : undefined,
            regional_variations: macro_scope.geographic_focus.map(region => ({
              region,
              indicator_level: this.getRegionalIndicator(indicator, region),
              relative_strength: this.getRegionalStrength(indicator, region)
            }))
          })),
          commodity_sensitivity_analysis: analysis_focus.commodity_price_sensitivity ? {
            oil_price_sensitivity: {
              gdp_elasticity: -0.15,
              inflation_sensitivity: 0.25,
              currency_impact: "USD strength = price headwind",
              demand_elasticity: -0.08
            },
            natural_gas_sensitivity: {
              economic_growth_correlation: 0.65,
              industrial_activity_linkage: "STRONG",
              seasonal_demand_factors: "SIGNIFICANT",
              regional_price_divergence: "INCREASING"
            },
            cross_commodity_correlations: {
              oil_gas_correlation: 0.72,
              energy_metals_correlation: 0.55,
              energy_agriculture_correlation: 0.35
            }
          } : undefined,
          investment_flow_analysis: analysis_focus.investment_flow_analysis ? {
            capital_allocation_trends: {
              equity_flows_energy: "SELECTIVE_INFLOWS",
              debt_market_access: "ADEQUATE_FOR_QUALITY_CREDITS",
              private_capital_interest: "FOCUSED_ON_RETURNS",
              esg_capital_constraints: "INCREASING_INFLUENCE"
            },
            cost_of_capital_analysis: {
              risk_free_rate_impact: "ELEVATED_RATES_INCREASE_HURDLES",
              credit_spreads: "MODERATE_SPREADS",
              equity_risk_premium: "ELEVATED_DUE_TO_TRANSITION_UNCERTAINTY",
              project_financing_availability: "SELECTIVE_AVAILABILITY"
            },
            geographic_capital_flows: macro_scope.geographic_focus.map(region => ({
              region,
              capital_attractiveness: this.getCapitalAttractiveness(region),
              investment_barriers: this.getInvestmentBarriers(region),
              policy_support_level: this.getPolicySupportLevel(region)
            }))
          } : undefined,
          policy_fiscal_analysis: analysis_focus.policy_fiscal_impact ? {
            fiscal_policy_impact: {
              government_spending_energy: "INFRASTRUCTURE_FOCUS",
              tax_policy_implications: "CARBON_PRICING_EXPANSION",
              regulatory_environment: "TIGHTENING_ENVIRONMENTAL_STANDARDS",
              subsidy_support_levels: "SHIFTING_TO_RENEWABLES"
            },
            monetary_policy_effects: {
              interest_rate_sensitivity: "HIGH_FOR_CAPITAL_INTENSIVE_PROJECTS",
              liquidity_conditions: "ADEQUATE_BUT_TIGHTENING",
              currency_policy_impacts: "USD_POLICY_AFFECTS_COMMODITY_PRICING"
            }
          } : undefined,
          scenario_analysis: {
            base_case_scenario: scenario_modeling.include_base_case ? {
              probability: 0.50,
              gdp_growth_assumption: "2.0-3.0% global growth",
              inflation_assumption: "Moderating to 2-3% range",
              interest_rate_assumption: "Higher for longer policy",
              energy_sector_implications: "STEADY_DEMAND_GROWTH_DISCIPLINED_SUPPLY"
            } : undefined,
            stress_scenarios: scenario_modeling.include_stress_scenarios ? [
              {
                scenario_name: "Economic Downturn",
                probability: 0.25,
                key_assumptions: "GDP contraction, deflationary pressures",
                energy_impact: "DEMAND_DESTRUCTION_PRICE_WEAKNESS",
                investment_implications: "CAPITAL_CONSTRAINTS_PROJECT_DELAYS"
              },
              {
                scenario_name: "Inflation Resurgence",
                probability: 0.15,
                key_assumptions: "Persistent high inflation, aggressive policy response",
                energy_impact: "COST_INFLATION_MARGIN_PRESSURE",
                investment_implications: "HIGH_COST_OF_CAPITAL_SELECTIVITY"
              },
              {
                scenario_name: "Geopolitical Shock",
                probability: 0.10,
                key_assumptions: "Supply disruption, risk premium expansion",
                energy_impact: "SUPPLY_CONSTRAINTS_PRICE_SPIKES",
                investment_implications: "FLIGHT_TO_QUALITY_SAFE_HAVEN_DEMAND"
              }
            ] : undefined
          },
          strategic_implications: {
            investment_strategy: [
              "Maintain flexible capital allocation framework",
              "Focus on projects with strong macro resilience",
              "Hedge exposure to key macro variables"
            ],
            operational_strategy: [
              "Build operational flexibility for macro cycles",
              "Optimize cost structure for different scenarios",
              "Strengthen balance sheet for macro volatility"
            ],
            portfolio_positioning: [
              "Diversify across geographic regions",
              "Balance growth and defensive characteristics",
              "Position for energy transition macro themes"
            ],
            timing_considerations: [
              "Monitor macro inflection points for investment timing",
              "Prepare for counter-cyclical opportunities",
              "Align project development with macro cycles"
            ]
          }
        };

        // Save macro analysis
        const outputPath = path.join(this.dataPath, 'macro-analysis', `analysis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(macroAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(macroAnalysis, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Helper methods for generating realistic market data
   */
  private getCurrentPrice(commodity: string): number {
    const basePrices = {
      wti_crude: 72.50,
      brent_crude: 76.25,
      natural_gas: 3.45,
      ngl_composite: 28.50,
      refined_products: 82.75
    };
    return basePrices[commodity as keyof typeof basePrices] || 50.0;
  }

  private getPriceChange(commodity: string, period: string): number {
    const volatility = period === "24h" ? 0.02 : period === "7d" ? 0.05 : 0.12;
    return (Math.random() - 0.5) * 2 * volatility * 100;
  }

  private getSupplyFactors(commodity: string): string[] {
    const factors = {
      wti_crude: ["U.S. shale production", "OPEC+ policy", "Strategic releases"],
      brent_crude: ["North Sea production", "African supply", "Middle East geopolitics"],
      natural_gas: ["Associated gas growth", "LNG exports", "Storage levels"],
      ngl_composite: ["Ethane rejection", "Cracker demand", "Export capacity"],
      refined_products: ["Refinery utilization", "Maintenance schedules", "Crack spreads"]
    };
    return factors[commodity as keyof typeof factors] || ["Production trends", "Market dynamics"];
  }

  private getDemandFactors(commodity: string): string[] {
    const factors = {
      wti_crude: ["Transportation demand", "Economic growth", "Strategic purchases"],
      brent_crude: ["Global trade flows", "Refinery runs", "Product demand"],
      natural_gas: ["Power generation", "Industrial demand", "LNG exports"],
      ngl_composite: ["Petrochemical demand", "Export capacity", "Ethane consumption"],
      refined_products: ["Driving season", "Economic activity", "Jet fuel recovery"]
    };
    return factors[commodity as keyof typeof factors] || ["Economic growth", "Industrial activity"];
  }

  private getInventoryStatus(commodity: string): string {
    const statuses = ["BELOW_AVERAGE", "AVERAGE", "ABOVE_AVERAGE"];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private getSeasonalStrength(commodity: string): string {
    const patterns = {
      wti_crude: "DRIVING_SEASON_STRENGTH",
      brent_crude: "WINTER_HEATING_DEMAND",
      natural_gas: "WINTER_HEATING_SUMMER_COOLING",
      ngl_composite: "SPRING_SUMMER_STRENGTH",
      refined_products: "SUMMER_DRIVING_SEASON"
    };
    return patterns[commodity as keyof typeof patterns] || "MODERATE_SEASONALITY";
  }

  private generatePriceForecast(commodity: string, horizonDays: number): any {
    const currentPrice = this.getCurrentPrice(commodity);
    const volatility = 0.25;
    const drift = 0.02;
    
    return {
      target_price: currentPrice * (1 + drift * (horizonDays / 365)),
      price_range: {
        low: currentPrice * (1 + drift * (horizonDays / 365) - volatility),
        high: currentPrice * (1 + drift * (horizonDays / 365) + volatility)
      },
      confidence_level: 0.68
    };
  }

  private generateCorrelationMatrix(commodities: string[]): any {
    return commodities.map(commodity1 => ({
      commodity: commodity1,
      correlations: commodities.map(commodity2 => ({
        with_commodity: commodity2,
        correlation: commodity1 === commodity2 ? 1.0 : 0.6 + Math.random() * 0.35
      }))
    }));
  }

  private getRegionalAttractiveness(region: string): string {
    const attractiveness = ["HIGH", "MODERATE", "LOW"];
    return attractiveness[Math.floor(Math.random() * attractiveness.length)];
  }

  private getBusinessFriendliness(region: string): string {
    const friendliness = ["VERY_FRIENDLY", "FRIENDLY", "MODERATE", "CHALLENGING"];
    return friendliness[Math.floor(Math.random() * friendliness.length)];
  }

  private getMarketConcentration(region: string): string {
    const concentration = ["HIGH", "MODERATE", "LOW"];
    return concentration[Math.floor(Math.random() * concentration.length)];
  }

  private getSegmentGrowth(segment: string): string {
    const growth = {
      upstream: "MODERATE_GROWTH",
      midstream: "STEADY_GROWTH",
      downstream: "SLOW_GROWTH",
      oilfield_services: "RECOVERY_PHASE",
      renewables: "RAPID_GROWTH"
    };
    return growth[segment as keyof typeof growth] || "MODERATE_GROWTH";
  }

  private getCompetitiveDifferentiators(segment: string): string[] {
    const differentiators = {
      upstream: ["Technology capabilities", "Low-cost operations", "ESG performance"],
      midstream: ["Infrastructure scale", "Geographic positioning", "Reliability"],
      downstream: ["Refining complexity", "Product optimization", "Market access"],
      oilfield_services: ["Technology innovation", "Service quality", "Global reach"],
      renewables: ["Technology advancement", "Cost competitiveness", "Grid integration"]
    };
    return differentiators[segment as keyof typeof differentiators] || ["Operational excellence"];
  }

  private getTechnologyTrends(segment: string): string[] {
    const trends = {
      upstream: ["Digital drilling", "Enhanced recovery", "Predictive maintenance"],
      midstream: ["Pipeline monitoring", "Automated operations", "Emissions reduction"],
      downstream: ["Process optimization", "Product innovation", "Carbon capture"],
      oilfield_services: ["Drilling automation", "Data analytics", "Remote operations"],
      renewables: ["Storage technologies", "Grid integration", "Efficiency improvements"]
    };
    return trends[segment as keyof typeof trends] || ["Digital transformation"];
  }

  private getTransitionRisk(segment: string): string {
    const risks = {
      upstream: "HIGH",
      midstream: "MODERATE",
      downstream: "HIGH",
      oilfield_services: "HIGH",
      renewables: "LOW"
    };
    return risks[segment as keyof typeof risks] || "MODERATE";
  }

  private generateKeyTransactions(transactionType: string, count: number): any[] {
    const transactions = [];
    for (let i = 0; i < count; i++) {
      transactions.push({
        transaction_name: `${transactionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Transaction ${i + 1}`,
        transaction_value_usd_mm: Math.floor(Math.random() * 2000) + 500,
        announcement_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: Math.random() > 0.8 ? "PENDING" : "COMPLETED",
        asset_type: "Oil & Gas Assets",
        strategic_rationale: "Portfolio optimization and synergy realization"
      });
    }
    return transactions;
  }

  // Additional helper methods for demand/supply and macro analysis
  private getGlobalDemand(commodity: string): number {
    const demands = {
      crude_oil: 102.5,
      natural_gas: 155.8,
      ngl: 18.5,
      refined_products: 98.2
    };
    return demands[commodity as keyof typeof demands] || 50.0;
  }

  private getRegionalDemand(commodity: string, region: string): number {
    return this.getGlobalDemand(commodity) * (0.1 + Math.random() * 0.3);
  }

  private getDemandGrowthRate(commodity: string, region: string): number {
    return 0.5 + Math.random() * 2.5;
  }

  private getDemandDrivers(commodity: string): string[] {
    return ["Economic growth", "Transportation demand", "Industrial activity"];
  }

  private getStructuralChanges(commodity: string): string[] {
    return ["Energy transition", "Efficiency improvements", "Substitution effects"];
  }

  private getEmergingDemandCenters(commodity: string): string[] {
    return ["Asia Pacific", "Middle East", "Africa"];
  }

  private getTransitionImpact(commodity: string): string {
    const impacts = {
      crude_oil: "DECLINING_DEMAND_POST_2030",
      natural_gas: "BRIDGE_FUEL_GROWTH_THEN_DECLINE",
      ngl: "PETROCHEMICAL_DEMAND_SUPPORT",
      refined_products: "TRANSPORTATION_FUEL_DECLINE"
    };
    return impacts[commodity as keyof typeof impacts] || "MODERATE_IMPACT";
  }

  private getPeakDemandTiming(commodity: string): string {
    const timings = {
      crude_oil: "2025-2030",
      natural_gas: "2030-2035",
      ngl: "2035-2040",
      refined_products: "2025-2030"
    };
    return timings[commodity as keyof typeof timings] || "2030-2035";
  }

  private getGlobalSupply(commodity: string): number {
    return this.getGlobalDemand(commodity) * (0.98 + Math.random() * 0.04);
  }

  private getSupplyComposition(commodity: string, type: string): number {
    const compositions = {
      crude_oil: { conventional: 65, unconventional: 25, offshore: 10 },
      natural_gas: { conventional: 55, unconventional: 35, offshore: 10 },
      ngl: { conventional: 45, unconventional: 45, offshore: 10 }
    };
    const commodityComposition = compositions[commodity as keyof typeof compositions];
    if (commodityComposition) {
      return commodityComposition[type as keyof typeof commodityComposition] || 50;
    }
    return 50;
  }

  private getRegionalSupply(commodity: string, region: string): number {
    return this.getGlobalSupply(commodity) * (0.05 + Math.random() * 0.25);
  }

  private getProductionTrend(commodity: string, region: string): string {
    const trends = ["GROWING", "STABLE", "DECLINING"];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  private getSupplyGrowthRate(commodity: string): number {
    return 0.8 + Math.random() * 2.0;
  }

  private getCapacityAdditions(commodity: string): string {
    return "Selective growth based on market fundamentals";
  }

  private getDeclineRates(commodity: string): string {
    return "5-8% annual decline for mature fields";
  }

  private getTechnologyImpact(commodity: string): string {
    return "Efficiency gains offsetting natural decline";
  }

  private getCostCurveEvolution(commodity: string): string {
    return "Technology driving cost reductions";
  }

  private getResourceConstraints(commodity: string): string {
    return "High-quality resources becoming scarcer";
  }

  private getTransitionSupplyImpact(commodity: string): string {
    return "Investment discipline affecting long-term supply";
  }

  private getBalanceTimeline(commodity: string): string {
    return "Balanced near-term, surplus potential medium-term";
  }

  private getPriceSupportLevel(commodity: string): number {
    return this.getCurrentPrice(commodity) * 0.85;
  }

  private getPriceCeilingLevel(commodity: string): number {
    return this.getCurrentPrice(commodity) * 1.25;
  }

  private getSectoralBreakdown(commodity: string, sector: string): number {
    const breakdowns = {
      crude_oil: { transportation: 45, industrial: 25, residential: 5, petrochemical: 25 },
      natural_gas: { transportation: 15, industrial: 35, residential: 30, petrochemical: 20 }
    };
    const commodityBreakdown = breakdowns[commodity as keyof typeof breakdowns];
    if (commodityBreakdown) {
      return commodityBreakdown[sector as keyof typeof commodityBreakdown] || 25;
    }
    return 25;
  }

  private getCurrentIndicatorStatus(indicator: string): string {
    const statuses = {
      gdp_growth: "MODERATE_GROWTH_2_8_PCT",
      inflation: "MODERATING_FROM_PEAKS",
      interest_rates: "ELEVATED_RESTRICTIVE",
      currency_rates: "USD_STRONG_VOLATILITY",
      employment: "TIGHT_LABOR_MARKETS"
    };
    return statuses[indicator as keyof typeof statuses] || "STABLE";
  }

  private getIndicatorTrend(indicator: string, term: string): string {
    const trends = ["IMPROVING", "STABLE", "DETERIORATING"];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  private getEnergyImpact(indicator: string): string {
    const impacts = {
      gdp_growth: "HIGH_POSITIVE_CORRELATION",
      inflation: "COST_PRESSURE_MODERATE_IMPACT",
      interest_rates: "HIGH_CAPITAL_INTENSITY_IMPACT",
      currency_rates: "COMMODITY_PRICING_IMPACT",
      employment: "MODERATE_SECTOR_EMPLOYMENT"
    };
    return impacts[indicator as keyof typeof impacts] || "MODERATE_IMPACT";
  }

  private getTransmissionMechanism(indicator: string): string {
    return "Direct demand impact through economic activity";
  }

  private getLagEffects(indicator: string): string {
    return "3-6 month lag typical for energy sector impact";
  }

  private getRegionalIndicator(indicator: string, region: string): string {
    return "Regional variation within global trends";
  }

  private getRegionalStrength(indicator: string, region: string): string {
    const strengths = ["STRONG", "MODERATE", "WEAK"];
    return strengths[Math.floor(Math.random() * strengths.length)];
  }

  private getCapitalAttractiveness(region: string): string {
    const attractiveness = ["HIGH", "MODERATE", "LOW"];
    return attractiveness[Math.floor(Math.random() * attractiveness.length)];
  }

  private getInvestmentBarriers(region: string): string[] {
    return ["Regulatory complexity", "Political risk", "Currency volatility"];
  }

  private getPolicySupportLevel(region: string): string {
    const levels = ["STRONG", "MODERATE", "LIMITED"];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  /**
   * Setup market-specific MCP resources
   */
  private setupMarketResources(): void {
    // Commodity pricing data resource
    this.server.registerResource(
      "commodity_prices",
      new ResourceTemplate("market://prices/{commodity}", { 
        list: () => ({
          resources: [
            { name: "wti_crude", uri: "market://prices/wti_crude" },
            { name: "brent_crude", uri: "market://prices/brent_crude" },
            { name: "natural_gas", uri: "market://prices/natural_gas" },
            { name: "ngl_composite", uri: "market://prices/ngl_composite" }
          ]
        })
      }),
      {
        title: "Commodity Pricing Data",
        description: "Real-time and historical commodity pricing data and analysis"
      },
      async (uri, { commodity }) => {
        const priceData = {
          commodity,
          current_price: this.getCurrentPrice(typeof commodity === 'string' ? commodity : commodity.toString()),
          last_updated: new Date().toISOString(),
          price_unit: commodity.includes("gas") ? "$/MMBtu" : "$/bbl",
          market_status: "ACTIVE",
          analyst: "Gaius Mercatus Analyst"
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(priceData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Transaction comps and deal metrics resource
    this.server.registerResource(
      "transaction_comps",
      new ResourceTemplate("market://transactions/{region}", { 
        list: () => ({
          resources: [
            { name: "north_america", uri: "market://transactions/north_america" },
            { name: "international", uri: "market://transactions/international" },
            { name: "global", uri: "market://transactions/global" }
          ]
        })
      }),
      {
        title: "Transaction Comparables",
        description: "M&A transaction comparables and valuation benchmarks"
      },
      async (uri, { region }) => {
        const transactionData = {
          region,
          recent_transactions: 15 + Math.floor(Math.random() * 20),
          average_valuation_multiple: 8.5 + Math.random() * 4,
          transaction_volume_usd_bn: 25 + Math.floor(Math.random() * 50),
          data_as_of: new Date().toISOString(),
          analyst: "Gaius Mercatus Analyst"
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(transactionData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Market forecasting models resource
    this.server.registerResource(
      "market_forecasts",
      new ResourceTemplate("market://forecasts/{scenario}", { 
        list: () => ({
          resources: [
            { name: "base_case", uri: "market://forecasts/base_case" },
            { name: "bull_case", uri: "market://forecasts/bull_case" },
            { name: "bear_case", uri: "market://forecasts/bear_case" }
          ]
        })
      }),
      {
        title: "Market Forecasting Models",
        description: "Supply/demand forecasts and scenario modeling results"
      },
      async (uri, { scenario }) => {
        const forecastData = {
          scenario,
          forecast_horizon: "3 years",
          demand_growth_cagr: scenario === "bull_case" ? 3.2 : scenario === "bear_case" ? 0.8 : 2.0,
          supply_growth_cagr: scenario === "bull_case" ? 2.5 : scenario === "bear_case" ? 1.2 : 1.8,
          price_outlook: scenario === "bull_case" ? "STRENGTHENING" : scenario === "bear_case" ? "WEAKENING" : "STABLE",
          generated_date: new Date().toISOString(),
          analyst: "Gaius Mercatus Analyst"
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(forecastData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup market-specific MCP prompts
   */
  private setupMarketPrompts(): void {
    this.server.registerPrompt(
      "market_analysis_prompt",
      {
        title: "Market Analysis Prompt",
        description: "Template for commodity and market intelligence analysis"
      },
      async ({ market_data, analysis_type = "comprehensive" }) => {
        const prompt = `You are Gaius Mercatus Analyst, Imperial Market Intelligence Chief and Master of Economic Warfare.

MARKET DATA:
${JSON.stringify(market_data, null, 2)}

ANALYSIS TYPE: ${analysis_type}

IMPERIAL MARKET INTELLIGENCE DIRECTIVES:
1. Analyze commodity markets with Roman strategic precision
2. Assess supply/demand fundamentals and price dynamics
3. Evaluate macroeconomic factors and market drivers
4. Benchmark transactions and valuation metrics
5. Forecast market conditions and investment opportunities
6. Provide strategic market positioning recommendations

MARKET INTELLIGENCE DELIVERABLES:
- Market Overview and Sentiment Assessment
- Commodity Price Analysis and Forecasting
- Supply/Demand Balance and Fundamentals
- Transaction Benchmarking and Valuation Analysis
- Macroeconomic Impact Assessment
- Strategic Market Positioning Recommendations

Apply Roman economic intelligence to modern energy market analysis.`;

        return {
          description: "Market analysis prompt with market data",
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

    this.server.registerPrompt(
      "investment_decision_prompt",
      {
        title: "Investment Decision Prompt", 
        description: "Template for investment analysis and decision support"
      },
      async ({ investment_data, decision_framework = "dcf_analysis" }) => {
        const prompt = `You are Gaius Mercatus Analyst, providing investment analysis with imperial strategic insight.

INVESTMENT DATA:
${JSON.stringify(investment_data, null, 2)}

DECISION FRAMEWORK: ${decision_framework}

INVESTMENT ANALYSIS OBJECTIVES:
1. Evaluate investment opportunity attractiveness and risks
2. Assess market timing and competitive positioning
3. Analyze financial returns and value creation potential
4. Consider macroeconomic and commodity market factors
5. Benchmark against alternative investment opportunities
6. Provide clear investment recommendation and rationale

INVESTMENT DECISION DELIVERABLES:
- Investment Opportunity Assessment
- Market Timing and Positioning Analysis
- Financial Return Projections and Sensitivity
- Risk Assessment and Mitigation Strategies
- Competitive Benchmarking and Differentiation
- Investment Recommendation and Implementation Plan

Execute investment analysis with Roman financial discipline and strategic foresight.`;

        return {
          description: "Investment decision prompt with investment data",
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
   * Setup market data directory structure
   */
  private async setupMarketDirectories(): Promise<void> {
    const dirs = [
      'price-analysis',
      'market-conditions',
      'transactions',
      'forecasts',
      'macro-analysis',
      'benchmarks',
      'reports'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
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
   * Shutdown the market MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('📊 Market MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during market server shutdown:', error);
    }
  }
}