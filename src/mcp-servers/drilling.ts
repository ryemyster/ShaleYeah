/**
 * Drilling-Engineering MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for drilling engineering, CapEx estimation, and well complexity assessment
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface DrillingMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class DrillingMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: DrillingMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'drilling');

    // Create official MCP server with drilling engineering domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupDrillingTools();
    this.setupDrillingResources();
    this.setupDrillingPrompts();
  }

  /**
   * Initialize drilling MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupDrillingDirectories();
      this.initialized = true;

      console.log(`🛠️ Drilling-Engineering MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Drilling-Engineering MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup drilling-engineering specific MCP tools
   */
  private setupDrillingTools(): void {
    // Estimate CapEx tool
    this.server.registerTool(
      "estimate_capex",
      {
        title: "Drilling CapEx Estimation",
        description: "Estimate drilling and completion costs by region, formation, and well specifications",
        inputSchema: {
          well_design: z.object({
            well_type: z.enum(["vertical", "horizontal", "directional"]).describe("Well trajectory type"),
            total_depth: z.number().describe("Total depth (ft)"),
            lateral_length: z.number().optional().describe("Lateral length for horizontal wells (ft)"),
            target_formation: z.string().describe("Target formation name"),
            casing_design: z.enum(["simple", "intermediate", "complex"]).default("intermediate"),
            completion_type: z.enum(["openhole", "cased_hole", "multistage_frac"]).default("multistage_frac")
          }),
          location_factors: z.object({
            region: z.enum(["bakken", "permian", "eagle_ford", "marcellus", "anadarko", "other"]).describe("Geographic region"),
            infrastructure_access: z.enum(["excellent", "good", "limited"]).default("good"),
            environmental_sensitivity: z.enum(["low", "medium", "high"]).default("medium"),
            permitting_complexity: z.enum(["standard", "moderate", "complex"]).default("standard")
          }),
          market_conditions: z.object({
            service_cost_environment: z.enum(["low", "moderate", "high"]).default("moderate"),
            rig_availability: z.enum(["abundant", "adequate", "tight"]).default("adequate"),
            crew_availability: z.enum(["good", "adequate", "limited"]).default("adequate"),
            material_costs: z.enum(["low", "normal", "elevated"]).default("normal")
          }),
          project_timing: z.object({
            urgency: z.enum(["standard", "expedited", "rush"]).default("standard"),
            seasonal_factors: z.boolean().default(false).describe("Account for seasonal restrictions"),
            multi_well_program: z.boolean().default(false).describe("Part of multi-well drilling program")
          })
        }
      },
      async ({ well_design, location_factors, market_conditions, project_timing }) => {
        console.log(`🛠️ Estimating CapEx for ${well_design.well_type} well in ${location_factors.region} region`);

        // Base cost calculations by region and well type
        const baseCosts = this.calculateBaseCosts(well_design, location_factors.region);
        
        // Apply location adjustments
        const locationAdjustedCosts = this.applyLocationFactors(baseCosts, location_factors);
        
        // Apply market condition adjustments
        const marketAdjustedCosts = this.applyMarketFactors(locationAdjustedCosts, market_conditions);
        
        // Apply project timing adjustments
        const finalCosts = this.applyTimingFactors(marketAdjustedCosts, project_timing);

        // Calculate detailed cost breakdown
        const costBreakdown = {
          drilling_costs: {
            rig_operations: Math.round(finalCosts.drilling * 0.45),
            directional_drilling: Math.round(finalCosts.drilling * 0.15),
            mud_chemicals: Math.round(finalCosts.drilling * 0.12),
            casing_cement: Math.round(finalCosts.drilling * 0.18),
            wellhead_equipment: Math.round(finalCosts.drilling * 0.10)
          },
          completion_costs: {
            perforating: Math.round(finalCosts.completion * 0.08),
            hydraulic_fracturing: Math.round(finalCosts.completion * 0.70),
            wellbore_cleanup: Math.round(finalCosts.completion * 0.05),
            flowback_equipment: Math.round(finalCosts.completion * 0.12),
            surface_equipment: Math.round(finalCosts.completion * 0.05)
          },
          facilities_costs: {
            pad_construction: Math.round(finalCosts.facilities * 0.40),
            access_roads: Math.round(finalCosts.facilities * 0.25),
            gathering_connections: Math.round(finalCosts.facilities * 0.35)
          },
          contingency_costs: {
            drilling_contingency: Math.round(finalCosts.drilling * 0.10),
            completion_contingency: Math.round(finalCosts.completion * 0.08),
            weather_delays: Math.round(finalCosts.total * 0.03),
            permit_delays: Math.round(finalCosts.total * 0.02)
          }
        };

        // Calculate cost per foot metrics
        const drillingCostPerFt = Math.round(finalCosts.drilling / well_design.total_depth);
        const lateralCostPerFt = well_design.lateral_length ? 
          Math.round(finalCosts.completion * 0.7 / well_design.lateral_length) : 0;

        // Risk assessment
        const riskFactors = this.assessDrillingRisks(well_design, location_factors, market_conditions);
        
        // Benchmarking
        const benchmarks = this.getBenchmarkCosts(well_design.target_formation, location_factors.region);

        const analysis = {
          capex_summary: {
            total_capex: Math.round(finalCosts.total),
            drilling_costs: Math.round(finalCosts.drilling),
            completion_costs: Math.round(finalCosts.completion),
            facilities_costs: Math.round(finalCosts.facilities),
            contingency_total: Math.round(Object.values(costBreakdown.contingency_costs).reduce((sum, cost) => sum + cost, 0)),
            cost_per_total_foot: drillingCostPerFt,
            cost_per_lateral_foot: lateralCostPerFt || "N/A"
          },
          detailed_cost_breakdown: costBreakdown,
          cost_drivers: {
            primary_cost_driver: this.identifyPrimaryCostDriver(well_design, location_factors),
            market_impact_percent: Math.round(((finalCosts.total / baseCosts.total) - 1) * 100),
            location_impact_percent: Math.round(((locationAdjustedCosts.total / baseCosts.total) - 1) * 100),
            timing_impact_percent: Math.round(((finalCosts.total / marketAdjustedCosts.total) - 1) * 100)
          },
          risk_assessment: {
            overall_risk_rating: riskFactors.overall_risk,
            cost_overrun_probability: riskFactors.cost_overrun_prob,
            schedule_risk: riskFactors.schedule_risk,
            technical_risk: riskFactors.technical_risk,
            key_risk_factors: riskFactors.key_risks,
            mitigation_strategies: riskFactors.mitigation
          },
          benchmarking: {
            formation_benchmark: benchmarks,
            cost_competitiveness: this.assessCostCompetitiveness(finalCosts.total, benchmarks),
            regional_ranking: this.getRegionalRanking(finalCosts.total, location_factors.region),
            optimization_potential: this.identifyOptimizationOpportunities(well_design, finalCosts)
          },
          project_recommendations: {
            recommended_adjustments: this.recommendDesignAdjustments(well_design, finalCosts, riskFactors),
            cost_reduction_opportunities: this.identifyCostReduction(costBreakdown, well_design),
            timing_considerations: this.getTimingRecommendations(project_timing, market_conditions),
            contractor_selection_guidance: this.getContractorGuidance(location_factors, market_conditions)
          }
        };

        // Save CapEx analysis
        const outputPath = path.join(this.dataPath, 'capex-estimates', `capex_${well_design.target_formation}_${Date.now()}.json`);
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

    // Calculate drill time tool
    this.server.registerTool(
      "calculate_drill_time",
      {
        title: "Drilling Time Estimation",
        description: "Estimate drilling time by formation complexity, depth, and operational factors",
        inputSchema: {
          well_specifications: z.object({
            total_depth: z.number().describe("Total depth (ft)"),
            lateral_length: z.number().optional().describe("Lateral length (ft)"),
            target_formation: z.string().describe("Target formation"),
            hole_size_program: z.array(z.object({
              section: z.string(),
              diameter: z.number(),
              depth: z.number()
            })).optional()
          }),
          formation_properties: z.object({
            formation_hardness: z.enum(["soft", "medium", "hard", "very_hard"]).describe("Formation hardness"),
            drilling_difficulty: z.enum(["easy", "moderate", "difficult", "very_difficult"]).describe("Overall drilling difficulty"),
            pressure_regime: z.enum(["normal", "overpressured", "underpressured"]).default("normal"),
            hazard_potential: z.enum(["low", "medium", "high"]).default("medium")
          }),
          operational_factors: z.object({
            rig_capability: z.enum(["basic", "intermediate", "advanced"]).describe("Rig sophistication"),
            crew_experience: z.enum(["experienced", "average", "limited"]).describe("Crew experience level"),
            weather_conditions: z.enum(["favorable", "seasonal", "challenging"]).default("favorable"),
            logistics_complexity: z.enum(["simple", "moderate", "complex"]).default("moderate")
          }),
          drilling_program: z.object({
            drilling_method: z.enum(["conventional", "directional", "horizontal"]).describe("Drilling method"),
            mud_system: z.enum(["water_based", "oil_based", "synthetic"]).default("oil_based"),
            casing_points: z.number().default(3).describe("Number of casing strings"),
            logging_program: z.enum(["basic", "standard", "comprehensive"]).default("standard")
          })
        }
      },
      async ({ well_specifications, formation_properties, operational_factors, drilling_program }) => {
        console.log(`🛠️ Calculating drill time for ${well_specifications.target_formation} well`);

        // Base time calculations by section
        const sectionTimes = this.calculateSectionDrillTimes(
          well_specifications,
          formation_properties,
          drilling_program
        );

        // Apply operational adjustments
        const adjustedTimes = this.applyOperationalAdjustments(
          sectionTimes,
          operational_factors,
          formation_properties
        );

        // Calculate non-productive time (NPT)
        const nptEstimate = this.estimateNonProductiveTime(
          adjustedTimes.total_drilling_hours,
          formation_properties,
          operational_factors
        );

        // Completion time estimate
        const completionTime = this.estimateCompletionTime(
          well_specifications,
          drilling_program
        );

        // Total project timeline
        const totalProjectHours = adjustedTimes.total_drilling_hours + nptEstimate.total_npt + completionTime.total_hours;
        const totalProjectDays = Math.ceil(totalProjectHours / 24);

        // Risk-adjusted timeline
        const riskBuffer = this.calculateScheduleRiskBuffer(formation_properties, operational_factors);
        const riskadjustedDays = Math.ceil(totalProjectDays * (1 + riskBuffer));

        // Benchmarking
        const benchmarks = this.getDrillingTimeBenchmarks(
          well_specifications.target_formation,
          drilling_program.drilling_method
        );

        const analysis = {
          drilling_time_summary: {
            total_drilling_hours: Math.round(adjustedTimes.total_drilling_hours),
            total_drilling_days: Math.ceil(adjustedTimes.total_drilling_hours / 24),
            completion_hours: Math.round(completionTime.total_hours),
            total_project_days: totalProjectDays,
            risk_adjusted_days: riskadjustedDays,
            average_rop_fph: Math.round((well_specifications.total_depth / adjustedTimes.total_drilling_hours) * 100) / 100
          },
          section_breakdown: {
            surface_section: {
              depth_interval: "0 - 1,500 ft",
              drilling_hours: adjustedTimes.surface_hours,
              rop_fph: adjustedTimes.surface_rop,
              challenges: ["Weather exposure", "Surface hazards"]
            },
            intermediate_section: {
              depth_interval: `1,500 - ${Math.round(well_specifications.total_depth * 0.7)} ft`,
              drilling_hours: adjustedTimes.intermediate_hours,
              rop_fph: adjustedTimes.intermediate_rop,
              challenges: ["Pressure transitions", "Lost circulation"]
            },
            production_section: {
              depth_interval: `${Math.round(well_specifications.total_depth * 0.7)} - ${well_specifications.total_depth} ft`,
              drilling_hours: adjustedTimes.production_hours,
              rop_fph: adjustedTimes.production_rop,
              challenges: ["Formation hardness", "Directional control"]
            },
            ...(well_specifications.lateral_length && {
              lateral_section: {
                length: well_specifications.lateral_length,
                drilling_hours: adjustedTimes.lateral_hours,
                rop_fph: adjustedTimes.lateral_rop,
                challenges: ["Geosteering", "Wellbore stability"]
              }
            })
          },
          non_productive_time: {
            total_npt_hours: Math.round(nptEstimate.total_npt),
            npt_percentage: Math.round((nptEstimate.total_npt / adjustedTimes.total_drilling_hours) * 100),
            breakdown: nptEstimate.breakdown,
            primary_npt_drivers: nptEstimate.primary_drivers
          },
          completion_timeline: {
            completion_hours: Math.round(completionTime.total_hours),
            perforation_hours: completionTime.perforation_hours,
            fracturing_hours: completionTime.fracturing_hours,
            flowback_hours: completionTime.flowback_hours,
            tie_in_hours: completionTime.tie_in_hours
          },
          schedule_risks: {
            risk_buffer_percentage: Math.round(riskBuffer * 100),
            high_risk_factors: this.identifyHighRiskFactors(formation_properties, operational_factors),
            mitigation_strategies: this.getScheduleMitigationStrategies(formation_properties, operational_factors),
            weather_contingency: operational_factors.weather_conditions === "challenging" ? "Additional 10-15 days" : "5-7 days",
            equipment_failure_risk: "5% probability of 3-5 day delay"
          },
          benchmarking_analysis: {
            formation_benchmark: benchmarks,
            performance_ranking: this.rankDrillingPerformance(totalProjectDays, benchmarks),
            optimization_potential: this.identifyTimeOptimization(adjustedTimes, well_specifications),
            best_practices: this.getBestPractices(well_specifications.target_formation, drilling_program.drilling_method)
          },
          cost_time_relationship: {
            daily_rig_cost: this.estimateDailyRigCost(operational_factors.rig_capability),
            time_dependent_costs: Math.round(this.estimateDailyRigCost(operational_factors.rig_capability) * totalProjectDays),
            schedule_compression_options: this.getScheduleCompressionOptions(adjustedTimes, well_specifications),
            economic_optimization: "Balance rig costs against completion timing for maximum NPV"
          }
        };

        // Save drill time analysis
        const outputPath = path.join(this.dataPath, 'drill-times', `drilltime_${well_specifications.target_formation}_${Date.now()}.json`);
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

    // Assess well complexity tool
    this.server.registerTool(
      "assess_well_complexity",
      {
        title: "Well Complexity Assessment",
        description: "Assess technical difficulty and complexity scoring for well design optimization",
        inputSchema: {
          well_design: z.object({
            well_type: z.enum(["vertical", "horizontal", "directional", "multilateral"]),
            total_depth: z.number(),
            lateral_length: z.number().optional(),
            dogleg_severity: z.number().optional().describe("Maximum dogleg severity (degrees/100ft)"),
            target_formation: z.string(),
            multiple_targets: z.boolean().default(false)
          }),
          geological_complexity: z.object({
            formation_heterogeneity: z.enum(["homogeneous", "moderate", "heterogeneous"]).describe("Formation variability"),
            structural_complexity: z.enum(["simple", "moderate", "complex"]).describe("Structural geology"),
            pressure_complexity: z.enum(["normal", "abnormal", "severe"]).describe("Pressure regimes"),
            drilling_hazards: z.array(z.enum(["h2s", "co2", "lost_circulation", "wellbore_instability", "overpressure", "stuck_pipe"])).default([])
          }),
          technical_requirements: z.object({
            directional_tolerance: z.enum(["standard", "tight", "very_tight"]).describe("Directional accuracy requirements"),
            completion_complexity: z.enum(["simple", "intermediate", "complex", "advanced"]).describe("Completion design complexity"),
            logging_requirements: z.enum(["basic", "standard", "advanced", "research"]).describe("Logging program scope"),
            environmental_restrictions: z.array(z.string()).default([]).describe("Environmental constraints")
          }),
          operational_challenges: z.object({
            location_accessibility: z.enum(["easy", "moderate", "difficult", "extreme"]).describe("Site accessibility"),
            infrastructure_maturity: z.enum(["developed", "moderate", "limited", "none"]).describe("Infrastructure availability"),
            seasonal_restrictions: z.boolean().default(false),
            regulatory_complexity: z.enum(["standard", "moderate", "complex", "exceptional"]).describe("Regulatory requirements")
          })
        }
      },
      async ({ well_design, geological_complexity, technical_requirements, operational_challenges }) => {
        console.log(`🛠️ Assessing complexity for ${well_design.well_type} well in ${well_design.target_formation}`);

        // Calculate complexity scores for each category
        const geometricScore = this.calculateGeometricComplexity(well_design);
        const geologicalScore = this.calculateGeologicalComplexity(geological_complexity);
        const technicalScore = this.calculateTechnicalComplexity(technical_requirements);
        const operationalScore = this.calculateOperationalComplexity(operational_challenges);

        // Weighted overall complexity score
        const weights = { geometric: 0.25, geological: 0.30, technical: 0.25, operational: 0.20 };
        const overallScore = (geometricScore * weights.geometric) + 
                            (geologicalScore * weights.geological) + 
                            (technicalScore * weights.technical) + 
                            (operationalScore * weights.operational);

        // Classify complexity level
        const complexityLevel = this.classifyComplexityLevel(overallScore);
        const complexityTier = this.getComplexityTier(overallScore);

        // Risk assessment based on complexity
        const riskAssessment = this.assessComplexityRisks(overallScore, geological_complexity, technical_requirements);

        // Drilling recommendations
        const recommendations = this.generateComplexityRecommendations(
          complexityLevel,
          well_design,
          geological_complexity,
          technical_requirements,
          operational_challenges
        );

        // Benchmarking and comparisons
        const benchmarks = this.getComplexityBenchmarks(well_design.target_formation, well_design.well_type);

        const analysis = {
          complexity_assessment: {
            overall_complexity_score: Math.round(overallScore * 100) / 100,
            complexity_level: complexityLevel,
            complexity_tier: complexityTier,
            assessment_confidence: 0.85 + Math.random() * 0.10,
            assessment_date: new Date().toISOString(),
            analyst: "Marcus Aurelius Engineerius"
          },
          complexity_breakdown: {
            geometric_complexity: {
              score: Math.round(geometricScore * 100) / 100,
              level: this.scoreToLevel(geometricScore),
              weight: weights.geometric,
              key_factors: this.getGeometricFactors(well_design),
              impact: "Well trajectory and path complexity"
            },
            geological_complexity: {
              score: Math.round(geologicalScore * 100) / 100,
              level: this.scoreToLevel(geologicalScore),
              weight: weights.geological,
              key_factors: this.getGeologicalFactors(geological_complexity),
              impact: "Formation drilling challenges and hazards"
            },
            technical_complexity: {
              score: Math.round(technicalScore * 100) / 100,
              level: this.scoreToLevel(technicalScore),
              weight: weights.technical,
              key_factors: this.getTechnicalFactors(technical_requirements),
              impact: "Completion and measurement requirements"
            },
            operational_complexity: {
              score: Math.round(operationalScore * 100) / 100,
              level: this.scoreToLevel(operationalScore),
              weight: weights.operational,
              key_factors: this.getOperationalFactors(operational_challenges),
              impact: "Logistical and regulatory challenges"
            }
          },
          risk_implications: {
            technical_risk_rating: riskAssessment.technical_risk,
            schedule_risk_rating: riskAssessment.schedule_risk,
            cost_risk_rating: riskAssessment.cost_risk,
            safety_risk_rating: riskAssessment.safety_risk,
            success_probability: riskAssessment.success_probability,
            key_risk_drivers: riskAssessment.key_drivers,
            risk_mitigation_priority: riskAssessment.mitigation_priority
          },
          drilling_recommendations: {
            rig_requirements: recommendations.rig_requirements,
            crew_experience_needed: recommendations.crew_experience,
            technology_requirements: recommendations.technology,
            planning_timeline: recommendations.planning_timeline,
            contingency_planning: recommendations.contingency,
            monitoring_requirements: recommendations.monitoring
          },
          cost_time_implications: {
            complexity_cost_multiplier: this.getComplexityCostMultiplier(overallScore),
            estimated_time_multiplier: this.getComplexityTimeMultiplier(overallScore),
            contingency_percentage: Math.round(this.getComplexityContingency(overallScore) * 100),
            specialized_services_needed: this.getSpecializedServices(overallScore, geological_complexity, technical_requirements),
            equipment_upgrades_required: this.getEquipmentUpgrades(overallScore, well_design)
          },
          benchmarking: {
            formation_complexity_ranking: benchmarks.formation_ranking,
            regional_complexity_comparison: benchmarks.regional_comparison,
            industry_percentile: benchmarks.industry_percentile,
            similar_wells_performance: benchmarks.similar_wells,
            optimization_potential: this.getOptimizationPotential(overallScore, well_design)
          },
          decision_support: {
            proceed_recommendation: this.getComplexityDecision(overallScore, riskAssessment),
            alternative_designs: this.getAlternativeDesigns(well_design, overallScore),
            phase_approach_recommendation: overallScore > 7 ? "Consider phased approach or pilot well" : "Proceed with standard development",
            resource_allocation_guidance: this.getResourceGuidance(complexityLevel, overallScore),
            success_factors: this.getSuccessFactors(complexityLevel, geological_complexity, technical_requirements)
          }
        };

        // Save complexity assessment
        const outputPath = path.join(this.dataPath, 'complexity', `complexity_${well_design.target_formation}_${Date.now()}.json`);
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

    // Optimize lateral length tool
    this.server.registerTool(
      "optimize_lateral_length",
      {
        title: "Lateral Length vs EUR Optimization",
        description: "Optimize lateral length based on EUR potential, costs, and economic constraints",
        inputSchema: {
          reservoir_properties: z.object({
            formation: z.string().describe("Target formation"),
            permeability: z.number().describe("Formation permeability (mD)"),
            porosity: z.number().describe("Formation porosity (fraction)"),
            pressure: z.number().describe("Reservoir pressure (psi)"),
            fluid_type: z.enum(["oil", "gas", "condensate"]).describe("Hydrocarbon type")
          }),
          well_parameters: z.object({
            completion_stages: z.number().describe("Number of planned frac stages"),
            stage_spacing: z.number().default(250).describe("Stage spacing (ft)"),
            wellbore_diameter: z.number().default(6.125).describe("Wellbore diameter (inches)"),
            landing_zone_thickness: z.number().describe("Target zone thickness (ft)")
          }),
          economic_constraints: z.object({
            drilling_cost_per_ft: z.number().describe("Drilling cost per lateral foot ($/ft)"),
            completion_cost_per_stage: z.number().describe("Completion cost per stage ($)"),
            oil_price: z.number().describe("Oil price assumption ($/bbl)"),
            gas_price: z.number().optional().describe("Gas price assumption ($/mcf)"),
            discount_rate: z.number().default(0.10).describe("Economic discount rate")
          }),
          development_constraints: z.object({
            maximum_lateral_length: z.number().default(10000).describe("Maximum feasible lateral length (ft)"),
            minimum_lateral_length: z.number().default(4000).describe("Minimum economic lateral length (ft)"),
            spacing_constraints: z.object({
              well_spacing: z.number().default(660).describe("Well spacing (ft)"),
              boundary_setbacks: z.number().default(500).describe("Lease boundary setbacks (ft)")
            }),
            operational_constraints: z.array(z.string()).default([]).describe("Operational limitations")
          })
        }
      },
      async ({ reservoir_properties, well_parameters, economic_constraints, development_constraints }) => {
        console.log(`🛠️ Optimizing lateral length for ${reservoir_properties.formation} formation`);

        // Generate lateral length scenarios
        const scenarios = this.generateLateralScenarios(
          development_constraints.minimum_lateral_length,
          development_constraints.maximum_lateral_length
        );

        // Calculate EUR for each scenario
        const scenarioAnalysis = scenarios.map(length => {
          const stages = Math.floor(length / well_parameters.stage_spacing);
          const eur = this.calculateEURByLateralLength(length, reservoir_properties, well_parameters);
          const drillingCost = length * economic_constraints.drilling_cost_per_ft;
          const completionCost = stages * economic_constraints.completion_cost_per_stage;
          const totalCost = drillingCost + completionCost;
          
          // Economic calculations
          const grossRevenue = eur * economic_constraints.oil_price;
          const npv = this.calculateSimpleNPV(grossRevenue, totalCost, economic_constraints.discount_rate);
          const irr = this.estimateIRR(grossRevenue, totalCost);
          
          return {
            lateral_length: length,
            estimated_eur: Math.round(eur),
            stages_count: stages,
            drilling_cost: Math.round(drillingCost),
            completion_cost: Math.round(completionCost),
            total_cost: Math.round(totalCost),
            gross_revenue: Math.round(grossRevenue),
            npv: Math.round(npv),
            irr: Math.round(irr * 10000) / 100,
            cost_per_eur_bbl: Math.round(totalCost / eur * 100) / 100,
            eur_per_lateral_ft: Math.round(eur / length * 100) / 100,
            npv_per_lateral_ft: Math.round(npv / length * 100) / 100
          };
        });

        // Find optimal length
        const optimalScenario = scenarioAnalysis.reduce((best, current) => 
          current.npv > best.npv ? current : best
        );

        // Find length with best EUR per foot
        const bestEURPerFoot = scenarioAnalysis.reduce((best, current) =>
          current.eur_per_lateral_ft > best.eur_per_lateral_ft ? current : best
        );

        // Find length with best NPV per foot
        const bestNPVPerFoot = scenarioAnalysis.reduce((best, current) =>
          current.npv_per_lateral_ft > best.npv_per_lateral_ft ? current : best
        );

        // Sensitivity analysis
        const sensitivityAnalysis = this.performLateralSensitivityAnalysis(
          optimalScenario.lateral_length,
          reservoir_properties,
          well_parameters,
          economic_constraints
        );

        // Drainage area analysis
        const drainageAnalysis = this.analyzeDrainageEfficiency(
          optimalScenario.lateral_length,
          development_constraints.spacing_constraints.well_spacing,
          reservoir_properties
        );

        // Risk considerations
        const riskFactors = this.assessLateralRisks(
          optimalScenario.lateral_length,
          reservoir_properties,
          development_constraints
        );

        const analysis = {
          optimization_summary: {
            optimal_lateral_length: optimalScenario.lateral_length,
            optimal_eur: optimalScenario.estimated_eur,
            optimal_npv: optimalScenario.npv,
            optimal_irr: optimalScenario.irr,
            optimal_stage_count: optimalScenario.stages_count,
            optimization_confidence: 0.75 + Math.random() * 0.15
          },
          scenario_analysis: {
            scenarios_evaluated: scenarios.length,
            length_range: `${development_constraints.minimum_lateral_length} - ${development_constraints.maximum_lateral_length} ft`,
            scenario_results: scenarioAnalysis,
            optimization_metrics: {
              best_npv_scenario: optimalScenario,
              best_eur_per_ft_scenario: bestEURPerFoot,
              best_npv_per_ft_scenario: bestNPVPerFoot
            }
          },
          economic_analysis: {
            breakeven_lateral_length: this.calculateBreakevenLateralLength(scenarioAnalysis),
            diminishing_returns_point: this.findDiminishingReturnsPoint(scenarioAnalysis),
            cost_curve_analysis: {
              marginal_cost_per_ft: economic_constraints.drilling_cost_per_ft,
              marginal_revenue_per_ft: Math.round(optimalScenario.gross_revenue / optimalScenario.lateral_length),
              economic_optimum: "Length where marginal revenue equals marginal cost"
            },
            npv_sensitivity: sensitivityAnalysis
          },
          reservoir_engineering: {
            drainage_efficiency: drainageAnalysis.efficiency_percent,
            drainage_area_acres: drainageAnalysis.drainage_area_acres,
            reservoir_contact_area: Math.round(optimalScenario.lateral_length * reservoir_properties.porosity * 43560 / 5280),
            completion_density: Math.round(optimalScenario.stages_count / (optimalScenario.lateral_length / 1000) * 10) / 10,
            stimulated_rock_volume: this.estimateStimulatedRockVolume(optimalScenario.lateral_length, optimalScenario.stages_count)
          },
          technical_considerations: {
            drilling_complexity: this.assessDrillingComplexityByLength(optimalScenario.lateral_length),
            completion_complexity: this.assessCompletionComplexityByLength(optimalScenario.stages_count),
            operational_risks: riskFactors.operational_risks,
            equipment_requirements: this.getEquipmentRequirements(optimalScenario.lateral_length),
            execution_timeline: this.estimateExecutionTimeline(optimalScenario.lateral_length, optimalScenario.stages_count)
          },
          field_development_implications: {
            wells_per_section: Math.floor(5280 / development_constraints.spacing_constraints.well_spacing),
            section_recovery_factor: this.calculateSectionRecoveryFactor(optimalScenario.lateral_length, development_constraints.spacing_constraints.well_spacing),
            infill_drilling_potential: this.assessInfillPotential(optimalScenario.lateral_length, development_constraints.spacing_constraints.well_spacing),
            pad_drilling_optimization: this.optimizePadDrilling(optimalScenario.lateral_length, development_constraints),
            development_sequence_impact: "Optimal length supports efficient pad drilling operations"
          },
          risk_assessment: {
            length_specific_risks: riskFactors.length_risks,
            completion_risks: riskFactors.completion_risks,
            reservoir_risks: riskFactors.reservoir_risks,
            mitigation_strategies: riskFactors.mitigation_strategies,
            alternative_scenarios: this.getAlternativeLengthScenarios(optimalScenario, scenarioAnalysis)
          },
          recommendations: {
            primary_recommendation: `Optimal lateral length: ${optimalScenario.lateral_length} ft`,
            alternative_options: [
              `Conservative: ${bestNPVPerFoot.lateral_length} ft (highest NPV per foot)`,
              `Aggressive: ${bestEURPerFoot.lateral_length} ft (highest EUR per foot)`
            ],
            implementation_strategy: this.getImplementationStrategy(optimalScenario, riskFactors),
            monitoring_plan: this.getLateralOptimizationMonitoring(optimalScenario),
            future_optimization: "Consider length optimization as reservoir data matures"
          }
        };

        // Save lateral optimization analysis
        const outputPath = path.join(this.dataPath, 'lateral-optimization', `lateral_opt_${reservoir_properties.formation}_${Date.now()}.json`);
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
   * Setup drilling-engineering specific MCP resources
   */
  private setupDrillingResources(): void {
    // Well specifications resource
    this.server.registerResource(
      "well_specifications",
      new ResourceTemplate("drilling://specs/{well_type}", {
        list: () => ({
          resources: [
            { name: "horizontal", uri: "drilling://specs/horizontal" },
            { name: "vertical", uri: "drilling://specs/vertical" },
            { name: "directional", uri: "drilling://specs/directional" },
            { name: "multilateral", uri: "drilling://specs/multilateral" }
          ]
        })
      }),
      {
        title: "Well Design Specifications",
        description: "Drilling specifications and design parameters for different well types"
      },
      async (uri, { well_type }) => {
        const specPath = path.join(this.dataPath, 'specifications', `${well_type}_spec.json`);

        try {
          const content = await fs.readFile(specPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Return default specification data
          const defaultSpecs = {
            well_type,
            typical_depth_range: well_type === "horizontal" ? "8000-15000 ft" : "3000-12000 ft",
            completion_type: well_type === "horizontal" ? "multistage_fracturing" : "conventional",
            drilling_method: well_type === "vertical" ? "conventional" : "directional",
            typical_costs: {
              drilling: well_type === "horizontal" ? "6-10M USD" : "2-5M USD",
              completion: well_type === "horizontal" ? "3-6M USD" : "0.5-2M USD"
            }
          };

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultSpecs, null, 2),
              mimeType: 'application/json'
            }]
          };
        }
      }
    );

    // Regional cost data resource
    this.server.registerResource(
      "regional_costs",
      new ResourceTemplate("drilling://costs/{region}", {
        list: () => ({
          resources: [
            { name: "bakken", uri: "drilling://costs/bakken" },
            { name: "permian", uri: "drilling://costs/permian" },
            { name: "eagle_ford", uri: "drilling://costs/eagle_ford" },
            { name: "marcellus", uri: "drilling://costs/marcellus" }
          ]
        })
      }),
      {
        title: "Regional Cost Database",
        description: "Drilling and completion costs by geographic region"
      },
      async (uri, variables) => {
        const region = variables?.region as string;
        // Mock regional cost data (would use actual market data in production)
        const regionalCosts: {[key: string]: any} = {
          bakken: {
            drilling_cost_per_ft: 450,
            completion_cost_per_stage: 85000,
            rig_day_rate: 18000,
            service_cost_multiplier: 1.0
          },
          permian: {
            drilling_cost_per_ft: 380,
            completion_cost_per_stage: 75000,
            rig_day_rate: 16000,
            service_cost_multiplier: 0.9
          },
          eagle_ford: {
            drilling_cost_per_ft: 420,
            completion_cost_per_stage: 80000,
            rig_day_rate: 17000,
            service_cost_multiplier: 0.95
          },
          marcellus: {
            drilling_cost_per_ft: 500,
            completion_cost_per_stage: 90000,
            rig_day_rate: 20000,
            service_cost_multiplier: 1.1
          }
        };

        const costData = regionalCosts[region] || {
          error: `Unknown region: ${region}`,
          available_regions: Object.keys(regionalCosts)
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(costData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup drilling-engineering specific MCP prompts
   */
  private setupDrillingPrompts(): void {
    this.server.registerPrompt(
      "drilling_engineering_prompt",
      {
        title: "Drilling Engineering Analysis Prompt",
        description: "Template for comprehensive drilling engineering analysis and optimization"
      },
      async ({ well_design, project_requirements, analysis_focus = "comprehensive" }) => {
        const prompt = `You are Marcus Aurelius Engineerius, a Roman imperial drilling engineer with expertise in modern drilling technology and project optimization.

WELL DESIGN:
${JSON.stringify(well_design, null, 2)}

PROJECT REQUIREMENTS:
${JSON.stringify(project_requirements, null, 2)}

ANALYSIS FOCUS: ${analysis_focus}

ANALYSIS REQUIREMENTS:
1. Estimate comprehensive drilling and completion costs (CapEx)
2. Calculate drilling time estimates with risk factors
3. Assess overall well complexity and technical risks
4. Optimize lateral length vs EUR economics
5. Provide engineering recommendations and risk mitigation

DELIVERABLES:
- Detailed CapEx breakdown with cost drivers and benchmarking
- Drilling timeline with section-by-section analysis
- Complexity assessment with risk scoring
- Lateral length optimization with economic justification
- Technical recommendations with implementation guidance

ENGINEERING PRINCIPLES:
- Cost Optimization: Balance quality, speed, and cost efficiency
- Risk Management: Identify and mitigate technical and operational risks
- Technology Integration: Leverage appropriate drilling technologies
- Economic Optimization: Maximize NPV while managing complexity
- Safety First: Prioritize operational safety in all recommendations

Apply Roman engineering discipline to modern drilling challenges. Provide precise, actionable recommendations based on technical analysis and economic optimization.`;

        return {
          description: "Drilling engineering analysis prompt with well design data",
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
   * Setup drilling data directory structure
   */
  private async setupDrillingDirectories(): Promise<void> {
    const dirs = [
      'capex-estimates',
      'drill-times',
      'complexity',
      'lateral-optimization',
      'specifications',
      'cost-data',
      'benchmarks'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  /**
   * Helper functions for drilling analysis
   */
  private calculateBaseCosts(wellDesign: any, region: string): any {
    // Regional base cost multipliers
    const regionalMultipliers: {[key: string]: number} = {
      bakken: 1.0,
      permian: 0.85,
      eagle_ford: 0.9,
      marcellus: 1.15,
      anadarko: 0.95,
      other: 1.0
    };

    const multiplier = regionalMultipliers[region] || 1.0;

    // Base costs by well type
    let baseDrilling = 0;
    let baseCompletion = 0;
    let baseFacilities = 0;

    if (wellDesign.well_type === "horizontal") {
      baseDrilling = 7000000;
      baseCompletion = 4000000;
      baseFacilities = 800000;
      
      // Adjust for lateral length
      if (wellDesign.lateral_length) {
        const extraLength = Math.max(0, wellDesign.lateral_length - 7500);
        baseDrilling += extraLength * 400;
        baseCompletion += Math.floor(extraLength / 250) * 80000;
      }
    } else if (wellDesign.well_type === "vertical") {
      baseDrilling = 3000000;
      baseCompletion = 800000;
      baseFacilities = 400000;
    } else {
      baseDrilling = 5000000;
      baseCompletion = 2000000;
      baseFacilities = 600000;
    }

    // Adjust for total depth
    const depthAdjustment = Math.max(0, (wellDesign.total_depth - 10000) / 1000) * 0.05;
    baseDrilling *= (1 + depthAdjustment);

    return {
      drilling: baseDrilling * multiplier,
      completion: baseCompletion * multiplier,
      facilities: baseFacilities * multiplier,
      total: (baseDrilling + baseCompletion + baseFacilities) * multiplier
    };
  }

  private applyLocationFactors(baseCosts: any, locationFactors: any): any {
    let multiplier = 1.0;

    // Infrastructure access
    const accessMultipliers = { excellent: 0.95, good: 1.0, limited: 1.15 };
    multiplier *= accessMultipliers[locationFactors.infrastructure_access as keyof typeof accessMultipliers] || 1.0;

    // Environmental sensitivity
    const envMultipliers = { low: 1.0, medium: 1.05, high: 1.15 };
    multiplier *= envMultipliers[locationFactors.environmental_sensitivity as keyof typeof envMultipliers] || 1.0;

    // Permitting complexity
    const permitMultipliers = { standard: 1.0, moderate: 1.03, complex: 1.08 };
    multiplier *= permitMultipliers[locationFactors.permitting_complexity as keyof typeof permitMultipliers] || 1.0;

    return {
      drilling: baseCosts.drilling * multiplier,
      completion: baseCosts.completion * multiplier,
      facilities: baseCosts.facilities * multiplier,
      total: baseCosts.total * multiplier
    };
  }

  private applyMarketFactors(costs: any, marketConditions: any): any {
    let multiplier = 1.0;

    // Service cost environment
    const serviceMultipliers = { low: 0.85, moderate: 1.0, high: 1.25 };
    multiplier *= serviceMultipliers[marketConditions.service_cost_environment as keyof typeof serviceMultipliers] || 1.0;

    // Rig availability
    const rigMultipliers = { abundant: 0.95, adequate: 1.0, tight: 1.15 };
    multiplier *= rigMultipliers[marketConditions.rig_availability as keyof typeof rigMultipliers] || 1.0;

    return {
      drilling: costs.drilling * multiplier,
      completion: costs.completion * multiplier,
      facilities: costs.facilities * multiplier,
      total: costs.total * multiplier
    };
  }

  private applyTimingFactors(costs: any, projectTiming: any): any {
    let multiplier = 1.0;

    // Urgency
    const urgencyMultipliers = { standard: 1.0, expedited: 1.1, rush: 1.25 };
    multiplier *= urgencyMultipliers[projectTiming.urgency as keyof typeof urgencyMultipliers] || 1.0;

    // Multi-well program discount
    if (projectTiming.multi_well_program) {
      multiplier *= 0.92; // 8% discount for multi-well programs
    }

    // Seasonal factors
    if (projectTiming.seasonal_factors) {
      multiplier *= 1.05; // 5% premium for seasonal restrictions
    }

    return {
      drilling: costs.drilling * multiplier,
      completion: costs.completion * multiplier,
      facilities: costs.facilities * multiplier,
      total: costs.total * multiplier
    };
  }

  private assessDrillingRisks(wellDesign: any, locationFactors: any, marketConditions: any): any {
    let riskScore = 1.0;

    // Well type risk
    const wellTypeRisks = { vertical: 1.0, directional: 1.2, horizontal: 1.4, multilateral: 1.8 };
    riskScore *= wellTypeRisks[wellDesign.well_type as keyof typeof wellTypeRisks] || 1.0;

    // Depth risk
    if (wellDesign.total_depth > 12000) riskScore += 0.3;
    if (wellDesign.total_depth > 15000) riskScore += 0.5;

    // Market risk
    if (marketConditions.rig_availability === "tight") riskScore += 0.2;
    if (marketConditions.crew_availability === "limited") riskScore += 0.3;

    const overallRisk = riskScore < 1.5 ? "Low" : riskScore < 2.0 ? "Medium" : "High";
    const costOverrunProb = Math.min(0.4, (riskScore - 1.0) * 0.3);

    return {
      overall_risk: overallRisk,
      cost_overrun_prob: Math.round(costOverrunProb * 100) / 100,
      schedule_risk: riskScore > 1.8 ? "High" : riskScore > 1.3 ? "Medium" : "Low",
      technical_risk: wellDesign.well_type === "multilateral" ? "High" : wellDesign.well_type === "horizontal" ? "Medium" : "Low",
      key_risks: this.identifyKeyRisks(wellDesign, locationFactors, riskScore),
      mitigation: this.getRiskMitigation(overallRisk, wellDesign)
    };
  }

  private identifyPrimaryCostDriver(wellDesign: any, locationFactors: any): string {
    if (wellDesign.well_type === "horizontal" && wellDesign.lateral_length > 8000) {
      return "Extended lateral length";
    }
    if (locationFactors.infrastructure_access === "limited") {
      return "Infrastructure limitations";
    }
    if (wellDesign.total_depth > 12000) {
      return "Total depth complexity";
    }
    return "Standard drilling operations";
  }

  private getBenchmarkCosts(formation: string, region: string): any {
    return {
      formation_average: 9500000,
      regional_average: 8800000,
      industry_average: 9200000,
      top_quartile: 7500000,
      bottom_quartile: 11500000
    };
  }

  private assessCostCompetitiveness(totalCost: number, benchmark: any): string {
    if (totalCost <= benchmark.top_quartile) return "Highly Competitive";
    if (totalCost <= benchmark.formation_average) return "Competitive";
    if (totalCost <= benchmark.bottom_quartile) return "Above Average";
    return "High Cost";
  }

  private getRegionalRanking(totalCost: number, region: string): string {
    const percentile = 35 + Math.floor(Math.random() * 40);
    return `${percentile}th percentile for ${region} region`;
  }

  private identifyOptimizationOpportunities(wellDesign: any, costs: any): string[] {
    const opportunities = [];
    
    if (wellDesign.lateral_length > 9000) {
      opportunities.push("Consider lateral length optimization");
    }
    if (costs.completion > costs.drilling * 0.6) {
      opportunities.push("Evaluate completion design efficiency");
    }
    opportunities.push("Assess multi-well pad development");
    
    return opportunities;
  }

  private recommendDesignAdjustments(wellDesign: any, costs: any, riskFactors: any): string[] {
    const recommendations = [];
    
    if (riskFactors.overall_risk === "High") {
      recommendations.push("Consider design simplification to reduce risk");
    }
    if (costs.total > 12000000) {
      recommendations.push("Evaluate cost reduction opportunities");
    }
    
    return recommendations.length ? recommendations : ["Design appears optimized for current constraints"];
  }

  private identifyCostReduction(costBreakdown: any, wellDesign: any): string[] {
    return [
      "Optimize casing design",
      "Evaluate completion efficiency improvements",
      "Consider alternative mud systems"
    ];
  }

  private getTimingRecommendations(projectTiming: any, marketConditions: any): string[] {
    const recommendations = [];
    
    if (marketConditions.rig_availability === "tight") {
      recommendations.push("Secure rig contracts early");
    }
    if (projectTiming.seasonal_factors) {
      recommendations.push("Plan for seasonal weather delays");
    }
    
    return recommendations;
  }

  private getContractorGuidance(locationFactors: any, marketConditions: any): string[] {
    return [
      "Prequalify contractors based on experience and performance",
      "Consider integrated service packages",
      "Establish clear performance metrics and incentives"
    ];
  }

  // Drilling time calculation helpers
  private calculateSectionDrillTimes(wellSpecs: any, formationProps: any, drillingProgram: any): any {
    const hardnessMultiplier = { soft: 1.0, medium: 1.3, hard: 1.8, very_hard: 2.5 };
    const multiplier = hardnessMultiplier[formationProps.formation_hardness as keyof typeof hardnessMultiplier] || 1.0;

    // Base ROP estimates by section
    const baseROP = {
      surface: 180, // ft/hr
      intermediate: 120,
      production: 80,
      lateral: 60
    };

    // Apply formation hardness
    const adjustedROP = {
      surface: baseROP.surface / Math.pow(multiplier, 0.3),
      intermediate: baseROP.intermediate / Math.pow(multiplier, 0.6),
      production: baseROP.production / multiplier,
      lateral: baseROP.lateral / multiplier
    };

    // Calculate drilling hours by section
    const surfaceDepth = 1500;
    const intermediateDepth = wellSpecs.total_depth * 0.7 - surfaceDepth;
    const productionDepth = wellSpecs.total_depth * 0.3;
    const lateralLength = wellSpecs.lateral_length || 0;

    const surfaceHours = surfaceDepth / adjustedROP.surface;
    const intermediateHours = intermediateDepth / adjustedROP.intermediate;
    const productionHours = productionDepth / adjustedROP.production;
    const lateralHours = lateralLength / adjustedROP.lateral;

    return {
      surface_hours: surfaceHours,
      surface_rop: Math.round(adjustedROP.surface),
      intermediate_hours: intermediateHours,
      intermediate_rop: Math.round(adjustedROP.intermediate),
      production_hours: productionHours,
      production_rop: Math.round(adjustedROP.production),
      lateral_hours: lateralHours,
      lateral_rop: Math.round(adjustedROP.lateral),
      total_drilling_hours: surfaceHours + intermediateHours + productionHours + lateralHours
    };
  }

  private applyOperationalAdjustments(sectionTimes: any, operationalFactors: any, formationProps: any): any {
    let efficiencyMultiplier = 1.0;

    // Rig capability
    const rigMultipliers = { basic: 1.25, intermediate: 1.0, advanced: 0.85 };
    efficiencyMultiplier *= rigMultipliers[operationalFactors.rig_capability as keyof typeof rigMultipliers] || 1.0;

    // Crew experience
    const crewMultipliers = { experienced: 0.9, average: 1.0, limited: 1.3 };
    efficiencyMultiplier *= crewMultipliers[operationalFactors.crew_experience as keyof typeof crewMultipliers] || 1.0;

    // Weather conditions
    const weatherMultipliers = { favorable: 1.0, seasonal: 1.15, challenging: 1.35 };
    efficiencyMultiplier *= weatherMultipliers[operationalFactors.weather_conditions as keyof typeof weatherMultipliers] || 1.0;

    return {
      ...sectionTimes,
      total_drilling_hours: sectionTimes.total_drilling_hours * efficiencyMultiplier,
      surface_hours: sectionTimes.surface_hours * efficiencyMultiplier,
      intermediate_hours: sectionTimes.intermediate_hours * efficiencyMultiplier,
      production_hours: sectionTimes.production_hours * efficiencyMultiplier,
      lateral_hours: sectionTimes.lateral_hours * efficiencyMultiplier
    };
  }

  private estimateNonProductiveTime(drillingHours: number, formationProps: any, operationalFactors: any): any {
    let nptRate = 0.15; // Base 15% NPT

    // Formation factors
    if (formationProps.drilling_difficulty === "very_difficult") nptRate += 0.10;
    if (formationProps.hazard_potential === "high") nptRate += 0.08;
    if (formationProps.pressure_regime === "overpressured") nptRate += 0.05;

    // Operational factors
    if (operationalFactors.crew_experience === "limited") nptRate += 0.05;
    if (operationalFactors.weather_conditions === "challenging") nptRate += 0.08;

    const totalNPT = drillingHours * nptRate;

    return {
      total_npt: totalNPT,
      npt_rate: Math.round(nptRate * 100) / 100,
      breakdown: {
        weather_delays: totalNPT * 0.3,
        equipment_failures: totalNPT * 0.25,
        wellbore_instability: totalNPT * 0.2,
        logistics_delays: totalNPT * 0.15,
        other: totalNPT * 0.1
      },
      primary_drivers: ["Weather conditions", "Equipment reliability", "Formation stability"]
    };
  }

  private estimateCompletionTime(wellSpecs: any, drillingProgram: any): any {
    const stages = wellSpecs.lateral_length ? Math.floor(wellSpecs.lateral_length / 250) : 1;
    
    return {
      total_hours: 120 + (stages * 8), // Base + per stage
      perforation_hours: stages * 2,
      fracturing_hours: stages * 6,
      flowback_hours: 48,
      tie_in_hours: 24
    };
  }

  private calculateScheduleRiskBuffer(formationProps: any, operationalFactors: any): number {
    let riskBuffer = 0.10; // Base 10% buffer

    if (formationProps.drilling_difficulty === "very_difficult") riskBuffer += 0.15;
    if (operationalFactors.weather_conditions === "challenging") riskBuffer += 0.10;
    if (operationalFactors.logistics_complexity === "complex") riskBuffer += 0.08;

    return Math.min(riskBuffer, 0.40); // Cap at 40%
  }

  private getDrillingTimeBenchmarks(formation: string, drillingMethod: string): any {
    return {
      formation_average_days: 25,
      regional_average_days: 28,
      industry_best_days: 18,
      method_specific_average: drillingMethod === "horizontal" ? 30 : 20
    };
  }

  private rankDrillingPerformance(totalDays: number, benchmarks: any): string {
    if (totalDays <= benchmarks.industry_best_days * 1.1) return "Excellent";
    if (totalDays <= benchmarks.formation_average_days) return "Good";
    if (totalDays <= benchmarks.regional_average_days) return "Average";
    return "Below Average";
  }

  private identifyTimeOptimization(adjustedTimes: any, wellSpecs: any): string[] {
    return [
      "Consider continuous circulation systems",
      "Optimize tripping speeds",
      "Implement real-time drilling optimization"
    ];
  }

  private getBestPractices(formation: string, drillingMethod: string): string[] {
    return [
      "Use formation-specific bit selection",
      "Implement automated drilling systems",
      "Optimize hydraulics program",
      "Apply real-time monitoring"
    ];
  }

  private estimateDailyRigCost(rigCapability: string): number {
    const rigCosts = { basic: 15000, intermediate: 22000, advanced: 32000 };
    return rigCosts[rigCapability as keyof typeof rigCosts] || 22000;
  }

  private getScheduleCompressionOptions(adjustedTimes: any, wellSpecs: any): string[] {
    return [
      "Dual activity operations",
      "Extended drilling hours", 
      "Parallel completion activities"
    ];
  }

  private identifyHighRiskFactors(formationProps: any, operationalFactors: any): string[] {
    const risks = [];
    
    if (formationProps.drilling_difficulty === "very_difficult") {
      risks.push("Formation drilling difficulty");
    }
    if (formationProps.hazard_potential === "high") {
      risks.push("Formation hazards (H2S, overpressure)");
    }
    if (operationalFactors.weather_conditions === "challenging") {
      risks.push("Weather-related delays");
    }
    
    return risks.length ? risks : ["Standard drilling risks"];
  }

  private getScheduleMitigationStrategies(formationProps: any, operationalFactors: any): string[] {
    return [
      "Develop detailed contingency plans",
      "Pre-position critical equipment and materials",
      "Establish backup contractor arrangements",
      "Implement real-time monitoring systems"
    ];
  }

  // Complexity assessment helpers
  private calculateGeometricComplexity(wellDesign: any): number {
    let score = 1.0;

    // Well type complexity
    const typeScores = { vertical: 1.0, directional: 2.0, horizontal: 3.0, multilateral: 4.5 };
    score = typeScores[wellDesign.well_type as keyof typeof typeScores] || 1.0;

    // Depth complexity
    if (wellDesign.total_depth > 10000) score += 0.5;
    if (wellDesign.total_depth > 15000) score += 1.0;

    // Lateral length complexity
    if (wellDesign.lateral_length) {
      if (wellDesign.lateral_length > 8000) score += 0.5;
      if (wellDesign.lateral_length > 12000) score += 1.0;
    }

    // Dogleg severity
    if (wellDesign.dogleg_severity && wellDesign.dogleg_severity > 8) {
      score += 0.8;
    }

    return Math.min(score, 5.0);
  }

  private calculateGeologicalComplexity(geologicalComplexity: any): number {
    let score = 1.0;

    // Formation heterogeneity
    const hetScores = { homogeneous: 0.5, moderate: 1.0, heterogeneous: 2.0 };
    score += hetScores[geologicalComplexity.formation_heterogeneity as keyof typeof hetScores] || 1.0;

    // Structural complexity
    const structScores = { simple: 0.5, moderate: 1.0, complex: 2.0 };
    score += structScores[geologicalComplexity.structural_complexity as keyof typeof structScores] || 1.0;

    // Pressure complexity
    const pressScores = { normal: 0.5, abnormal: 1.5, severe: 2.5 };
    score += pressScores[geologicalComplexity.pressure_complexity as keyof typeof pressScores] || 0.5;

    // Drilling hazards
    score += geologicalComplexity.drilling_hazards.length * 0.3;

    return Math.min(score, 5.0);
  }

  private calculateTechnicalComplexity(technicalRequirements: any): number {
    let score = 1.0;

    // Directional tolerance
    const dirScores = { standard: 0.5, tight: 1.5, very_tight: 2.5 };
    score += dirScores[technicalRequirements.directional_tolerance as keyof typeof dirScores] || 0.5;

    // Completion complexity
    const compScores = { simple: 0.5, intermediate: 1.0, complex: 2.0, advanced: 3.0 };
    score += compScores[technicalRequirements.completion_complexity as keyof typeof compScores] || 1.0;

    // Logging requirements
    const logScores = { basic: 0.2, standard: 0.5, advanced: 1.0, research: 1.5 };
    score += logScores[technicalRequirements.logging_requirements as keyof typeof logScores] || 0.5;

    // Environmental restrictions
    score += technicalRequirements.environmental_restrictions.length * 0.2;

    return Math.min(score, 5.0);
  }

  private calculateOperationalComplexity(operationalChallenges: any): number {
    let score = 1.0;

    // Location accessibility
    const accessScores = { easy: 0.2, moderate: 0.8, difficult: 1.8, extreme: 3.0 };
    score += accessScores[operationalChallenges.location_accessibility as keyof typeof accessScores] || 0.8;

    // Infrastructure maturity
    const infraScores = { developed: 0.2, moderate: 0.8, limited: 1.5, none: 2.5 };
    score += infraScores[operationalChallenges.infrastructure_maturity as keyof typeof infraScores] || 0.8;

    // Regulatory complexity
    const regScores = { standard: 0.5, moderate: 1.0, complex: 2.0, exceptional: 3.0 };
    score += regScores[operationalChallenges.regulatory_complexity as keyof typeof regScores] || 1.0;

    // Seasonal restrictions
    if (operationalChallenges.seasonal_restrictions) score += 0.5;

    return Math.min(score, 5.0);
  }

  private classifyComplexityLevel(score: number): string {
    if (score <= 2.5) return "Low Complexity";
    if (score <= 4.5) return "Medium Complexity";
    if (score <= 6.5) return "High Complexity";
    return "Very High Complexity";
  }

  private getComplexityTier(score: number): string {
    if (score <= 2.0) return "Tier 1 - Routine";
    if (score <= 4.0) return "Tier 2 - Standard";
    if (score <= 6.0) return "Tier 3 - Complex";
    return "Tier 4 - Advanced";
  }

  private scoreToLevel(score: number): string {
    if (score <= 2.0) return "Low";
    if (score <= 3.5) return "Medium";
    return "High";
  }

  private assessComplexityRisks(overallScore: number, geologicalComplexity: any, technicalRequirements: any): any {
    const baseSuccessProbability = 0.95 - (overallScore - 1.0) * 0.08;
    
    return {
      technical_risk: overallScore > 6 ? "High" : overallScore > 4 ? "Medium" : "Low",
      schedule_risk: overallScore > 5.5 ? "High" : overallScore > 3.5 ? "Medium" : "Low",
      cost_risk: overallScore > 5 ? "High" : overallScore > 3 ? "Medium" : "Low",
      safety_risk: geologicalComplexity.drilling_hazards.length > 2 ? "High" : "Medium",
      success_probability: Math.round(Math.max(0.6, baseSuccessProbability) * 100) / 100,
      key_drivers: this.identifyRiskDrivers(overallScore, geologicalComplexity),
      mitigation_priority: overallScore > 6 ? "Critical" : overallScore > 4 ? "High" : "Standard"
    };
  }

  private identifyRiskDrivers(score: number, geoComplexity: any): string[] {
    const drivers = [];
    
    if (score > 5) drivers.push("High overall complexity");
    if (geoComplexity.drilling_hazards.length > 1) drivers.push("Multiple drilling hazards");
    if (geoComplexity.pressure_complexity === "severe") drivers.push("Severe pressure regime");
    
    return drivers.length ? drivers : ["Standard risk factors"];
  }

  private generateComplexityRecommendations(complexityLevel: string, wellDesign: any, geoComplexity: any, techReq: any, opChallenges: any): any {
    const recommendations = {
      rig_requirements: "Standard rig capability sufficient",
      crew_experience: "Average crew experience acceptable",
      technology: ["Standard drilling technology"],
      planning_timeline: "6-8 weeks planning",
      contingency: ["Standard contingency planning"],
      monitoring: ["Basic monitoring requirements"]
    };

    if (complexityLevel.includes("High") || complexityLevel.includes("Very High")) {
      recommendations.rig_requirements = "Advanced rig capability required";
      recommendations.crew_experience = "Experienced crew essential";
      recommendations.technology = ["Advanced drilling systems", "Real-time monitoring"];
      recommendations.planning_timeline = "12-16 weeks planning";
      recommendations.contingency = ["Detailed contingency plans", "Risk mitigation protocols"];
      recommendations.monitoring = ["Comprehensive monitoring", "Real-time decision support"];
    }

    return recommendations;
  }

  private getComplexityCostMultiplier(score: number): number {
    return 1.0 + (score - 1.0) * 0.15; // 15% cost increase per complexity point
  }

  private getComplexityTimeMultiplier(score: number): number {
    return 1.0 + (score - 1.0) * 0.12; // 12% time increase per complexity point
  }

  private getComplexityContingency(score: number): number {
    return Math.min(0.25, 0.05 + (score - 1.0) * 0.03); // 3% contingency increase per point, max 25%
  }

  private getSpecializedServices(score: number, geoComplexity: any, techReq: any): string[] {
    const services = [];
    
    if (score > 5) services.push("Advanced directional drilling");
    if (geoComplexity.drilling_hazards.includes("h2s")) services.push("H2S monitoring and safety");
    if (techReq.completion_complexity === "advanced") services.push("Specialized completion services");
    
    return services.length ? services : ["Standard services adequate"];
  }

  private getEquipmentUpgrades(score: number, wellDesign: any): string[] {
    const upgrades = [];
    
    if (score > 4.5) upgrades.push("Enhanced BHA configuration");
    if (wellDesign.well_type === "multilateral") upgrades.push("Multilateral junction systems");
    if (score > 6) upgrades.push("Advanced drilling automation");
    
    return upgrades.length ? upgrades : ["Standard equipment sufficient"];
  }

  private getComplexityBenchmarks(formation: string, wellType: string): any {
    return {
      formation_ranking: "Above average complexity",
      regional_comparison: "Moderate complexity for region",
      industry_percentile: "65th percentile",
      similar_wells: "Comparable to recent area wells"
    };
  }

  private getOptimizationPotential(score: number, wellDesign: any): string {
    if (score > 6) return "High potential for design optimization";
    if (score > 4) return "Moderate optimization opportunities";
    return "Well optimized for current design";
  }

  private getComplexityDecision(score: number, riskAssessment: any): string {
    if (score <= 4 && riskAssessment.success_probability > 0.85) return "Proceed";
    if (score <= 6 && riskAssessment.success_probability > 0.75) return "Proceed with Enhanced Planning";
    return "Detailed Review Required";
  }

  private getAlternativeDesigns(wellDesign: any, score: number): string[] {
    const alternatives = [];
    
    if (score > 5 && wellDesign.well_type === "horizontal") {
      alternatives.push("Shorter lateral length");
      alternatives.push("Simpler completion design");
    }
    if (score > 6) {
      alternatives.push("Phased development approach");
    }
    
    return alternatives.length ? alternatives : ["Current design appears optimal"];
  }

  private getResourceGuidance(complexityLevel: string, score: number): string {
    if (score > 6) return "Allocate premium resources and extended timeline";
    if (score > 4) return "Standard resource allocation with enhanced planning";
    return "Standard resource allocation sufficient";
  }

  private getSuccessFactors(complexityLevel: string, geoComplexity: any, techReq: any): string[] {
    const factors = ["Proper planning and preparation"];
    
    if (complexityLevel.includes("High")) {
      factors.push("Experienced technical team");
      factors.push("Advanced equipment and technology");
    }
    if (geoComplexity.drilling_hazards.length > 1) {
      factors.push("Comprehensive hazard management");
    }
    
    return factors;
  }

  private getGeometricFactors(wellDesign: any): string[] {
    const factors = [`${wellDesign.well_type} well type`];
    
    if (wellDesign.total_depth > 12000) factors.push("Extended total depth");
    if (wellDesign.lateral_length && wellDesign.lateral_length > 8000) factors.push("Extended lateral");
    if (wellDesign.dogleg_severity && wellDesign.dogleg_severity > 8) factors.push("High dogleg severity");
    
    return factors;
  }

  private getGeologicalFactors(geoComplexity: any): string[] {
    const factors = [`${geoComplexity.formation_heterogeneity} formation heterogeneity`];
    
    factors.push(`${geoComplexity.structural_complexity} structural complexity`);
    factors.push(`${geoComplexity.pressure_complexity} pressure regime`);
    
    if (geoComplexity.drilling_hazards.length > 0) {
      factors.push(`Drilling hazards: ${geoComplexity.drilling_hazards.join(", ")}`);
    }
    
    return factors;
  }

  private getTechnicalFactors(techReq: any): string[] {
    const factors = [
      `${techReq.directional_tolerance} directional tolerance`,
      `${techReq.completion_complexity} completion complexity`,
      `${techReq.logging_requirements} logging requirements`
    ];
    
    if (techReq.environmental_restrictions.length > 0) {
      factors.push(`Environmental restrictions: ${techReq.environmental_restrictions.length}`);
    }
    
    return factors;
  }

  private getOperationalFactors(opChallenges: any): string[] {
    const factors = [
      `${opChallenges.location_accessibility} location accessibility`,
      `${opChallenges.infrastructure_maturity} infrastructure`,
      `${opChallenges.regulatory_complexity} regulatory complexity`
    ];
    
    if (opChallenges.seasonal_restrictions) {
      factors.push("Seasonal restrictions");
    }
    
    return factors;
  }

  private identifyKeyRisks(wellDesign: any, locationFactors: any, riskScore: number): string[] {
    const risks = [];
    
    if (wellDesign.well_type === "horizontal" && wellDesign.lateral_length > 10000) {
      risks.push("Extended lateral drilling challenges");
    }
    if (locationFactors.infrastructure_access === "limited") {
      risks.push("Logistical complexity");
    }
    if (riskScore > 2.0) {
      risks.push("Technical execution complexity");
    }
    
    return risks.length ? risks : ["Standard drilling risks"];
  }

  private getRiskMitigation(overallRisk: string, wellDesign: any): string[] {
    const mitigation = ["Standard risk management protocols"];
    
    if (overallRisk === "High") {
      mitigation.push("Enhanced contingency planning");
      mitigation.push("Pre-positioned backup equipment");
      mitigation.push("Experienced crew and supervision");
    }
    
    return mitigation;
  }

  // Lateral optimization helpers
  private generateLateralScenarios(minLength: number, maxLength: number): number[] {
    const scenarios = [];
    const step = (maxLength - minLength) / 8;
    
    for (let i = 0; i <= 8; i++) {
      scenarios.push(Math.round(minLength + (step * i)));
    }
    
    return scenarios;
  }

  private calculateEURByLateralLength(lateralLength: number, reservoirProps: any, wellParams: any): number {
    // Simplified EUR calculation - would use more sophisticated reservoir model in production
    const baseEUR = 250000; // Base EUR for formation
    const lengthMultiplier = Math.pow(lateralLength / 7500, 0.7); // Diminishing returns
    const stageMultiplier = Math.floor(lateralLength / wellParams.stage_spacing) / 30; // Stage effect
    
    return baseEUR * lengthMultiplier * (1 + stageMultiplier * 0.1);
  }

  private calculateSimpleNPV(revenue: number, cost: number, discountRate: number): number {
    // Simplified NPV over 15 years with decline
    let npv = -cost; // Initial investment
    
    for (let year = 1; year <= 15; year++) {
      const yearlyRevenue = (revenue / 15) * Math.pow(0.9, year - 1); // 10% annual decline
      const presentValue = yearlyRevenue / Math.pow(1 + discountRate, year);
      npv += presentValue;
    }
    
    return npv;
  }

  private estimateIRR(revenue: number, cost: number): number {
    // Simplified IRR estimation
    if (revenue <= cost) return -0.1;
    
    const payback = cost / (revenue / 15);
    if (payback > 15) return 0.05;
    
    return Math.min(0.35, 1 / payback + 0.05);
  }

  private calculateBreakevenLateralLength(scenarios: any[]): number {
    const breakevenScenario = scenarios.find(s => s.npv >= 0);
    return breakevenScenario?.lateral_length || scenarios[0].lateral_length;
  }

  private findDiminishingReturnsPoint(scenarios: any[]): number {
    // Find where marginal NPV per foot starts declining significantly
    let maxMarginalNPV = 0;
    let diminishingPoint = scenarios[scenarios.length - 1].lateral_length;
    
    for (let i = 1; i < scenarios.length; i++) {
      const marginalNPV = (scenarios[i].npv - scenarios[i-1].npv) / 
                         (scenarios[i].lateral_length - scenarios[i-1].lateral_length);
      
      if (marginalNPV > maxMarginalNPV) {
        maxMarginalNPV = marginalNPV;
      } else if (marginalNPV < maxMarginalNPV * 0.5) {
        diminishingPoint = scenarios[i].lateral_length;
        break;
      }
    }
    
    return diminishingPoint;
  }

  private performLateralSensitivityAnalysis(optimalLength: number, reservoirProps: any, wellParams: any, economics: any): any {
    return {
      oil_price_sensitivity: "±$10/bbl changes optimal length by ±500-800 ft",
      completion_cost_sensitivity: "±20% completion cost changes optimal length by ±300-600 ft",
      eur_sensitivity: "±15% EUR uncertainty affects optimal length by ±400-700 ft",
      discount_rate_sensitivity: "±2% discount rate changes optimal length by ±200-400 ft"
    };
  }

  private analyzeDrainageEfficiency(lateralLength: number, wellSpacing: number, reservoirProps: any): any {
    const drainageArea = (lateralLength * wellSpacing) / 43560; // acres
    const efficiency = Math.min(0.85, 0.5 + (lateralLength / wellSpacing) * 0.1);
    
    return {
      drainage_area_acres: Math.round(drainageArea * 100) / 100,
      efficiency_percent: Math.round(efficiency * 100)
    };
  }

  private assessLateralRisks(lateralLength: number, reservoirProps: any, constraints: any): any {
    const risks = {
      operational_risks: [] as string[],
      length_risks: [] as string[],
      completion_risks: [] as string[],
      reservoir_risks: [] as string[],
      mitigation_strategies: [] as string[]
    };
    
    if (lateralLength > 9000) {
      risks.length_risks.push("Wellbore instability in extended laterals");
      risks.operational_risks.push("Increased drilling complexity");
    }
    
    if (lateralLength > 10000) {
      risks.completion_risks.push("Frac hit risks from nearby wells");
      risks.mitigation_strategies.push("Enhanced frac scheduling and monitoring");
    }
    
    return risks;
  }

  private getEquipmentRequirements(lateralLength: number): string[] {
    const requirements = ["Standard horizontal drilling equipment"];
    
    if (lateralLength > 8000) {
      requirements.push("Extended reach drilling capability");
    }
    if (lateralLength > 10000) {
      requirements.push("Advanced directional drilling systems");
    }
    
    return requirements;
  }

  private estimateExecutionTimeline(lateralLength: number, stageCount: number): string {
    const drillingDays = 15 + Math.floor(lateralLength / 1000);
    const completionDays = 5 + Math.floor(stageCount / 5);
    const totalDays = drillingDays + completionDays;
    
    return `${totalDays} days (${drillingDays} drilling, ${completionDays} completion)`;
  }

  private calculateSectionRecoveryFactor(lateralLength: number, wellSpacing: number): number {
    const contactRatio = lateralLength / wellSpacing;
    return Math.min(0.75, 0.3 + contactRatio * 0.15);
  }

  private assessInfillPotential(lateralLength: number, wellSpacing: number): string {
    if (lateralLength / wellSpacing > 10) return "Limited - high drainage efficiency";
    if (lateralLength / wellSpacing > 7) return "Moderate - some infill potential";
    return "High - significant infill opportunities";
  }

  private optimizePadDrilling(lateralLength: number, constraints: any): string {
    if (lateralLength > 8000) {
      return "4-6 well pads optimal for extended laterals";
    }
    return "6-8 well pads optimal for standard laterals";
  }

  private getAlternativeLengthScenarios(optimalScenario: any, allScenarios: any[]): any[] {
    return [
      {
        scenario: "Conservative",
        length: optimalScenario.lateral_length * 0.85,
        rationale: "Lower risk, proven performance"
      },
      {
        scenario: "Aggressive", 
        length: optimalScenario.lateral_length * 1.15,
        rationale: "Maximum resource contact, higher risk"
      }
    ];
  }

  private getImplementationStrategy(optimalScenario: any, riskFactors: any): string {
    if (optimalScenario.lateral_length > 10000) {
      return "Phase 1: Pilot well at optimal length, Phase 2: Field development";
    }
    return "Direct implementation with standard risk management";
  }

  private getLateralOptimizationMonitoring(optimalScenario: any): string[] {
    return [
      "Monitor actual EUR vs predicted by month 6",
      "Track drilling performance vs time estimates", 
      "Compare completion effectiveness across stages",
      "Assess interference with offset wells"
    ];
  }

  private assessDrillingComplexityByLength(lateralLength: number): string {
    if (lateralLength > 12000) return "Very High - Extended reach challenges";
    if (lateralLength > 9000) return "High - Advanced directional control required";
    if (lateralLength > 6000) return "Moderate - Standard horizontal drilling";
    return "Low - Short lateral complexity";
  }

  private assessCompletionComplexityByLength(stageCount: number): string {
    if (stageCount > 40) return "Very High - Extended completion operations";
    if (stageCount > 25) return "High - Multiple completion phases";
    if (stageCount > 15) return "Moderate - Standard completion";
    return "Low - Simple completion";
  }

  private estimateStimulatedRockVolume(lateralLength: number, stageCount: number): number {
    // Simplified SRV calculation in cubic feet
    const srvPerStage = 50000000; // 50 million cubic feet per stage
    return srvPerStage * stageCount;
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
   * Shutdown the drilling MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('🛠️ Drilling-Engineering MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during drilling server shutdown:', error);
    }
  }
}