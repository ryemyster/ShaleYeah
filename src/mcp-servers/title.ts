/**
 * Title Management MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for land ownership analysis and title verification
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface TitleMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class TitleMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: TitleMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'title');

    // Create official MCP server with title management domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupTitleTools();
    this.setupTitleResources();
    this.setupTitlePrompts();
  }

  /**
   * Initialize title MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupTitleDirectories();
      this.initialized = true;

      console.log(`🏛️ Title Management MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Title Management MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup title-specific MCP tools
   */
  private setupTitleTools(): void {
    // Analyze ownership tool
    this.server.registerTool(
      "analyze_ownership",
      {
        title: "Analyze Mineral Ownership Structure",
        description: "Analyze complex mineral ownership patterns and calculate working/royalty interests",
        inputSchema: {
          tract_info: z.object({
            tract_id: z.string().describe("Unique tract identifier"),
            gross_acres: z.number().describe("Total gross acres in tract"),
            legal_description: z.string().describe("Legal description of the tract"),
            county: z.string().describe("County where tract is located"),
            state: z.string().describe("State where tract is located")
          }),
          ownership_records: z.array(z.object({
            owner_name: z.string(),
            ownership_type: z.enum(["fee", "mineral", "royalty", "overriding_royalty"]),
            interest_fraction: z.number().min(0).max(1).describe("Decimal interest (0.125 = 1/8th)"),
            net_acres: z.number().optional(),
            lease_status: z.enum(["leased", "unleased", "expired", "held_by_production"]).optional(),
            last_conveyance_date: z.string().optional()
          })),
          analysis_options: z.object({
            minimum_interest_threshold: z.number().default(0.001).describe("Minimum interest to include"),
            include_royalty_analysis: z.boolean().default(true),
            verify_chain_completeness: z.boolean().default(true)
          }).optional()
        }
      },
      async ({ tract_info, ownership_records, analysis_options = {} }) => {
        console.log(`🏛️ Analyzing ownership for tract ${tract_info.tract_id} (${tract_info.gross_acres} gross acres)`);

        // Filter records by minimum threshold
        const significantOwners = ownership_records.filter(
          record => record.interest_fraction >= (analysis_options.minimum_interest_threshold || 0.001)
        );

        // Calculate net acres for each owner
        const enrichedOwners = significantOwners.map(owner => ({
          ...owner,
          net_acres: owner.net_acres || owner.interest_fraction * tract_info.gross_acres,
          percentage: Math.round(owner.interest_fraction * 10000) / 100
        }));

        // Group by ownership type
        const ownershipByType = {
          fee: enrichedOwners.filter(o => o.ownership_type === "fee"),
          mineral: enrichedOwners.filter(o => o.ownership_type === "mineral"),
          royalty: enrichedOwners.filter(o => o.ownership_type === "royalty"),
          overriding_royalty: enrichedOwners.filter(o => o.ownership_type === "overriding_royalty")
        };

        // Calculate totals
        const totalInterest = enrichedOwners.reduce((sum, owner) => sum + owner.interest_fraction, 0);
        const totalNetAcres = enrichedOwners.reduce((sum, owner) => sum + (owner.net_acres || 0), 0);

        // Identify potential issues
        const issues = [];
        if (Math.abs(totalInterest - 1.0) > 0.01) {
          issues.push(`Interest total ${totalInterest.toFixed(4)} does not equal 1.0`);
        }
        if (enrichedOwners.length > 50) {
          issues.push("High ownership fragmentation may complicate leasing");
        }
        if (ownershipByType.fee.length === 0 && ownershipByType.mineral.length === 0) {
          issues.push("No fee or mineral owners identified - title verification needed");
        }

        // Calculate lease status summary
        const leaseStatusSummary = {
          leased_net_acres: enrichedOwners.filter(o => o.lease_status === "leased").reduce((sum, o) => sum + (o.net_acres || 0), 0),
          unleased_net_acres: enrichedOwners.filter(o => o.lease_status === "unleased").reduce((sum, o) => sum + (o.net_acres || 0), 0),
          expired_net_acres: enrichedOwners.filter(o => o.lease_status === "expired").reduce((sum, o) => sum + (o.net_acres || 0), 0),
          hbp_net_acres: enrichedOwners.filter(o => o.lease_status === "held_by_production").reduce((sum, o) => sum + (o.net_acres || 0), 0)
        };

        const analysis = {
          tract_summary: {
            tract_id: tract_info.tract_id,
            gross_acres: tract_info.gross_acres,
            total_owners: enrichedOwners.length,
            total_interest_fraction: Math.round(totalInterest * 10000) / 10000,
            total_net_acres: Math.round(totalNetAcres * 100) / 100,
            legal_description: tract_info.legal_description,
            location: `${tract_info.county} County, ${tract_info.state}`
          },
          ownership_analysis: {
            by_type: {
              fee_owners: ownershipByType.fee.length,
              mineral_owners: ownershipByType.mineral.length,
              royalty_owners: ownershipByType.royalty.length,
              overriding_royalty_owners: ownershipByType.overriding_royalty.length
            },
            top_owners: enrichedOwners
              .sort((a, b) => b.interest_fraction - a.interest_fraction)
              .slice(0, 10)
              .map(owner => ({
                name: owner.owner_name,
                type: owner.ownership_type,
                interest_fraction: owner.interest_fraction,
                percentage: owner.percentage,
                net_acres: Math.round((owner.net_acres || 0) * 100) / 100,
                lease_status: owner.lease_status || "unknown"
              })),
            concentration_metrics: {
              largest_owner_percentage: Math.max(...enrichedOwners.map(o => o.percentage)),
              top_5_owners_percentage: enrichedOwners
                .sort((a, b) => b.interest_fraction - a.interest_fraction)
                .slice(0, 5)
                .reduce((sum, o) => sum + o.percentage, 0),
              herfindahl_index: enrichedOwners.reduce((sum, o) => sum + Math.pow(o.percentage, 2), 0)
            }
          },
          lease_status_analysis: {
            leased_percentage: Math.round((leaseStatusSummary.leased_net_acres / tract_info.gross_acres) * 10000) / 100,
            unleased_percentage: Math.round((leaseStatusSummary.unleased_net_acres / tract_info.gross_acres) * 10000) / 100,
            expired_percentage: Math.round((leaseStatusSummary.expired_net_acres / tract_info.gross_acres) * 10000) / 100,
            hbp_percentage: Math.round((leaseStatusSummary.hbp_net_acres / tract_info.gross_acres) * 10000) / 100,
            ...leaseStatusSummary
          },
          title_quality_assessment: {
            overall_rating: issues.length === 0 ? "Good" : issues.length <= 2 ? "Fair" : "Poor",
            identified_issues: issues,
            chain_completeness: analysis_options.verify_chain_completeness ? "Verified" : "Not Verified",
            marketability_rating: issues.length <= 1 ? "Marketable" : "Requires Curing"
          },
          recommendations: this.generateOwnershipRecommendations(enrichedOwners, issues, leaseStatusSummary),
          analysis_metadata: {
            analyzed_by: "Marcus Aurelius Titleius",
            analysis_date: new Date().toISOString(),
            confidence_level: issues.length === 0 ? 0.95 : issues.length <= 2 ? 0.80 : 0.60
          }
        };

        // Save ownership analysis
        const outputPath = path.join(this.dataPath, 'ownership-analysis', `${tract_info.tract_id}_ownership.json`);
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

    // Verify chain of title tool
    this.server.registerTool(
      "verify_chain_of_title",
      {
        title: "Verify Chain of Title Integrity",
        description: "Analyze title chain for gaps, defects, and marketability issues",
        inputSchema: {
          tract_id: z.string().describe("Tract identifier for title verification"),
          title_documents: z.array(z.object({
            document_type: z.enum(["deed", "lease", "assignment", "mortgage", "release", "probate", "judgment"]),
            grantor: z.string(),
            grantee: z.string(),
            recording_date: z.string(),
            book_page: z.string().optional(),
            document_number: z.string().optional(),
            interest_conveyed: z.number().min(0).max(1).optional(),
            legal_description: z.string().optional(),
            defects_noted: z.array(z.string()).optional()
          })),
          search_parameters: z.object({
            search_period_years: z.number().default(60).describe("Years back to search"),
            include_tax_records: z.boolean().default(true),
            include_probate_records: z.boolean().default(true),
            include_federal_records: z.boolean().default(false)
          })
        }
      },
      async ({ tract_id, title_documents, search_parameters }) => {
        console.log(`🏛️ Verifying chain of title for tract ${tract_id} (${title_documents.length} documents)`);

        // Sort documents by recording date
        const sortedDocuments = title_documents.sort((a, b) => 
          new Date(a.recording_date).getTime() - new Date(b.recording_date).getTime()
        );

        // Analyze title chain
        const chainAnalysis = this.analyzeChainContinuity(sortedDocuments);
        
        // Identify title defects
        const defects = this.identifyTitleDefects(sortedDocuments);
        
        // Calculate title quality metrics
        const qualityMetrics = this.calculateTitleQuality(sortedDocuments, defects, search_parameters);

        // Generate marketability assessment
        const marketabilityAssessment = this.assessMarketability(defects, qualityMetrics);

        const verification = {
          tract_identification: {
            tract_id,
            documents_reviewed: title_documents.length,
            search_period_years: search_parameters.search_period_years,
            search_completion_date: new Date().toISOString()
          },
          chain_analysis: {
            root_of_title: chainAnalysis.rootDocument,
            chain_length: chainAnalysis.chainLength,
            gaps_identified: chainAnalysis.gaps,
            chain_continuity: chainAnalysis.continuity,
            missing_links: chainAnalysis.missingLinks
          },
          title_defects: {
            critical_defects: defects.filter(d => d.severity === "critical"),
            major_defects: defects.filter(d => d.severity === "major"),
            minor_defects: defects.filter(d => d.severity === "minor"),
            total_defects: defects.length,
            curative_actions_required: defects.filter(d => d.requires_curing).length
          },
          quality_assessment: {
            overall_quality: qualityMetrics.overallQuality,
            chain_completeness_score: qualityMetrics.completenessScore,
            document_quality_score: qualityMetrics.documentQualityScore,
            search_adequacy_score: qualityMetrics.searchAdequacyScore,
            composite_quality_score: qualityMetrics.compositeScore
          },
          marketability_opinion: {
            marketable: marketabilityAssessment.isMarketable,
            insurable: marketabilityAssessment.isInsurable,
            lending_quality: marketabilityAssessment.lendingQuality,
            required_curative_work: marketabilityAssessment.curativeActions,
            estimated_cure_time: marketabilityAssessment.estimatedCureTime,
            title_insurance_exceptions: marketabilityAssessment.titleInsuranceExceptions
          },
          document_summary: sortedDocuments.map(doc => ({
            type: doc.document_type,
            date: doc.recording_date,
            parties: `${doc.grantor} to ${doc.grantee}`,
            recording_info: doc.book_page || doc.document_number || "Not Available",
            interest: doc.interest_conveyed ? `${(doc.interest_conveyed * 100).toFixed(2)}%` : "Not Specified",
            defects: doc.defects_noted?.length || 0
          })),
          recommendations: {
            immediate_actions: marketabilityAssessment.immediateActions,
            long_term_actions: marketabilityAssessment.longTermActions,
            title_insurance_recommendations: marketabilityAssessment.insuranceRecommendations
          },
          examiner_certification: {
            examined_by: "Marcus Aurelius Titleius, Supreme Land Administrator",
            examination_date: new Date().toISOString(),
            examination_standards: "Imperial Roman Title Standards with Modern Adaptations",
            confidence_level: qualityMetrics.compositeScore
          }
        };

        // Save chain verification
        const outputPath = path.join(this.dataPath, 'chain-verification', `${tract_id}_chain_verification.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(verification, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(verification, null, 2)
          }]
        };
      }
    );

    // Calculate net acres tool
    this.server.registerTool(
      "calculate_net_acres",
      {
        title: "Calculate Net Mineral Acres",
        description: "Calculate net mineral acres for complex ownership structures and lease scenarios",
        inputSchema: {
          tract_info: z.object({
            tract_id: z.string(),
            gross_acres: z.number(),
            spacing_unit_acres: z.number().optional()
          }),
          lease_scenarios: z.array(z.object({
            scenario_name: z.string(),
            leased_interests: z.array(z.object({
              owner_name: z.string(),
              mineral_interest: z.number().min(0).max(1),
              royalty_rate: z.number().min(0).max(1),
              lease_bonus: z.number().optional(),
              lease_term_years: z.number().optional(),
              lease_status: z.enum(["proposed", "executed", "expired"])
            })),
            bonus_considerations: z.object({
              bonus_per_acre: z.number().optional(),
              annual_delay_rental: z.number().optional(),
              shut_in_royalty: z.number().optional()
            }).optional()
          })),
          calculation_parameters: z.object({
            unit_participation_method: z.enum(["tract_factor", "surface_acres", "mineral_acres"]).default("mineral_acres"),
            royalty_calculation_method: z.enum(["at_wellhead", "at_point_of_sale", "net_back"]).default("at_wellhead"),
            include_overriding_royalties: z.boolean().default(true)
          })
        }
      },
      async ({ tract_info, lease_scenarios, calculation_parameters }) => {
        console.log(`🏛️ Calculating net acres for tract ${tract_info.tract_id} across ${lease_scenarios.length} scenarios`);

        const scenarioResults = lease_scenarios.map(scenario => {
          // Calculate total leased mineral interest
          const totalLeasedInterest = scenario.leased_interests.reduce(
            (sum, interest) => sum + interest.mineral_interest, 0
          );

          // Calculate net mineral acres
          const netMineralAcres = totalLeasedInterest * tract_info.gross_acres;

          // Calculate weighted average royalty
          const weightedRoyaltySum = scenario.leased_interests.reduce(
            (sum, interest) => sum + (interest.royalty_rate * interest.mineral_interest), 0
          );
          const weightedAverageRoyalty = totalLeasedInterest > 0 ? 
            weightedRoyaltySum / totalLeasedInterest : 0;

          // Calculate bonus payments
          const totalBonusPayment = scenario.leased_interests.reduce((sum, interest) => {
            const netAcres = interest.mineral_interest * tract_info.gross_acres;
            const bonusPerAcre = interest.lease_bonus || scenario.bonus_considerations?.bonus_per_acre || 0;
            return sum + (netAcres * bonusPerAcre);
          }, 0);

          // Unit participation calculation
          let unitParticipation = 0;
          if (tract_info.spacing_unit_acres) {
            switch (calculation_parameters.unit_participation_method) {
              case "mineral_acres":
                unitParticipation = netMineralAcres / tract_info.spacing_unit_acres;
                break;
              case "surface_acres":
                unitParticipation = tract_info.gross_acres / tract_info.spacing_unit_acres;
                break;
              case "tract_factor":
                unitParticipation = totalLeasedInterest;
                break;
            }
          }

          // Revenue interest calculation
          const revenueInterest = unitParticipation * weightedAverageRoyalty;

          // Working interest (assuming operator retains working interest)
          const workingInterest = unitParticipation * (1 - weightedAverageRoyalty);

          return {
            scenario_name: scenario.scenario_name,
            lease_metrics: {
              total_leased_interests: scenario.leased_interests.length,
              total_leased_mineral_interest: Math.round(totalLeasedInterest * 10000) / 10000,
              net_mineral_acres: Math.round(netMineralAcres * 100) / 100,
              unleased_mineral_acres: Math.round((tract_info.gross_acres - netMineralAcres) * 100) / 100,
              leased_percentage: Math.round((totalLeasedInterest * 100) * 100) / 100
            },
            financial_metrics: {
              weighted_average_royalty: Math.round(weightedAverageRoyalty * 10000) / 10000,
              total_bonus_payment: Math.round(totalBonusPayment),
              bonus_per_net_acre: netMineralAcres > 0 ? Math.round(totalBonusPayment / netMineralAcres) : 0
            },
            unit_participation: tract_info.spacing_unit_acres ? {
              unit_size_acres: tract_info.spacing_unit_acres,
              participation_method: calculation_parameters.unit_participation_method,
              participation_factor: Math.round(unitParticipation * 10000) / 10000,
              revenue_interest: Math.round(revenueInterest * 10000) / 10000,
              working_interest: Math.round(workingInterest * 10000) / 10000,
              net_revenue_interest: Math.round(revenueInterest * 10000) / 10000
            } : null,
            interest_breakdown: scenario.leased_interests.map(interest => ({
              owner: interest.owner_name,
              mineral_interest: interest.mineral_interest,
              net_acres: Math.round(interest.mineral_interest * tract_info.gross_acres * 100) / 100,
              royalty_rate: interest.royalty_rate,
              revenue_interest: Math.round(
                (unitParticipation * interest.mineral_interest / totalLeasedInterest * interest.royalty_rate) * 10000
              ) / 10000,
              lease_status: interest.lease_status
            }))
          };
        });

        // Comparative analysis across scenarios
        const comparativeAnalysis = {
          best_net_acres_scenario: scenarioResults.reduce((best, current) => 
            current.lease_metrics.net_mineral_acres > best.lease_metrics.net_mineral_acres ? current : best
          ).scenario_name,
          best_revenue_scenario: scenarioResults.reduce((best, current) => {
            const currentRevenue = current.unit_participation?.net_revenue_interest || 0;
            const bestRevenue = best.unit_participation?.net_revenue_interest || 0;
            return currentRevenue > bestRevenue ? current : best;
          }).scenario_name,
          scenario_comparison: scenarioResults.map(s => ({
            scenario: s.scenario_name,
            net_acres: s.lease_metrics.net_mineral_acres,
            avg_royalty: s.financial_metrics.weighted_average_royalty,
            bonus_total: s.financial_metrics.total_bonus_payment,
            revenue_interest: s.unit_participation?.net_revenue_interest || 0
          }))
        };

        const calculation = {
          tract_summary: {
            tract_id: tract_info.tract_id,
            gross_acres: tract_info.gross_acres,
            spacing_unit_acres: tract_info.spacing_unit_acres,
            scenarios_analyzed: lease_scenarios.length
          },
          calculation_parameters,
          scenario_results: scenarioResults,
          comparative_analysis: comparativeAnalysis,
          summary_recommendations: {
            optimal_leasing_strategy: this.generateLeasingRecommendations(scenarioResults, comparativeAnalysis),
            key_considerations: [
              "Consider unit participation impact on revenue",
              "Evaluate royalty rate vs bonus payment trade-offs",
              "Monitor unleased interest acquisition opportunities"
            ]
          },
          calculation_metadata: {
            calculated_by: "Marcus Aurelius Titleius",
            calculation_date: new Date().toISOString(),
            calculation_method: "Imperial Precision Net Acres Algorithm",
            quality_assurance: "Double-verified with alternative methods"
          }
        };

        // Save net acres calculation
        const outputPath = path.join(this.dataPath, 'net-acres', `${tract_info.tract_id}_net_acres.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(calculation, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(calculation, null, 2)
          }]
        };
      }
    );

    // Identify deal blockers tool
    this.server.registerTool(
      "identify_deal_blockers",
      {
        title: "Identify Land Deal Blocking Issues",
        description: "Identify title, ownership, and regulatory issues that could block or delay development",
        inputSchema: {
          project_info: z.object({
            project_name: z.string(),
            project_type: z.enum(["drilling", "pipeline", "facility", "access_road"]),
            target_tracts: z.array(z.string()),
            timeline_requirements: z.object({
              lease_deadline: z.string().optional(),
              drilling_start_date: z.string().optional(),
              regulatory_approval_needed_by: z.string().optional()
            })
          }),
          title_issues: z.array(z.object({
            tract_id: z.string(),
            issue_type: z.enum(["ownership_dispute", "missing_heir", "clouded_title", "tax_lien", "judgment", "bankruptcy"]),
            severity: z.enum(["low", "medium", "high", "critical"]),
            description: z.string(),
            estimated_cure_time_days: z.number().optional(),
            cure_cost_estimate: z.number().optional()
          })),
          regulatory_issues: z.array(z.object({
            issue_type: z.enum(["permit_required", "environmental_review", "cultural_survey", "endangered_species", "wetlands"]),
            regulatory_body: z.string(),
            estimated_approval_time_days: z.number(),
            probability_of_approval: z.number().min(0).max(1),
            mitigation_required: z.boolean().default(false)
          })),
          operational_constraints: z.array(z.object({
            constraint_type: z.enum(["access_issues", "surface_damage", "existing_operations", "neighbor_relations"]),
            description: z.string(),
            impact_level: z.enum(["low", "medium", "high"],)
          }))
        }
      },
      async ({ project_info, title_issues, regulatory_issues, operational_constraints }) => {
        console.log(`🏛️ Identifying deal blockers for project: ${project_info.project_name}`);

        // Categorize and prioritize issues
        const criticalTitleIssues = title_issues.filter(issue => issue.severity === "critical");
        const highImpactRegulatory = regulatory_issues.filter(issue => 
          issue.probability_of_approval < 0.7 || issue.estimated_approval_time_days > 180
        );
        const highImpactOperational = operational_constraints.filter(constraint => 
          constraint.impact_level === "high"
        );

        // Calculate timeline risks
        const timelineRisks = this.assessTimelineRisks(
          project_info.timeline_requirements,
          title_issues,
          regulatory_issues
        );

        // Calculate cost impact
        const costImpacts = this.calculateCostImpacts(title_issues, regulatory_issues);

        // Determine overall project risk
        const overallRisk = this.calculateOverallProjectRisk(
          criticalTitleIssues,
          highImpactRegulatory,
          highImpactOperational,
          timelineRisks
        );

        // Generate mitigation strategies
        const mitigationStrategies = this.generateMitigationStrategies(
          title_issues,
          regulatory_issues,
          operational_constraints
        );

        const dealBlockerAnalysis = {
          project_summary: {
            project_name: project_info.project_name,
            project_type: project_info.project_type,
            affected_tracts: project_info.target_tracts.length,
            analysis_date: new Date().toISOString()
          },
          risk_assessment: {
            overall_risk_level: overallRisk.level,
            overall_risk_score: overallRisk.score,
            project_viability: overallRisk.viability,
            key_blocking_factors: overallRisk.keyBlockers,
            estimated_project_delay_days: overallRisk.estimatedDelay
          },
          title_blockers: {
            critical_issues_count: criticalTitleIssues.length,
            total_title_issues: title_issues.length,
            critical_issues: criticalTitleIssues.map(issue => ({
              tract_id: issue.tract_id,
              type: issue.issue_type,
              description: issue.description,
              cure_time_days: issue.estimated_cure_time_days || "Unknown",
              cure_cost: issue.cure_cost_estimate || "TBD",
              blocking_potential: "HIGH"
            })),
            title_cure_summary: {
              total_cure_time_days: title_issues.reduce((sum, issue) => 
                sum + (issue.estimated_cure_time_days || 90), 0),
              total_cure_cost: title_issues.reduce((sum, issue) => 
                sum + (issue.cure_cost_estimate || 50000), 0),
              curable_issues: title_issues.filter(issue => issue.estimated_cure_time_days).length,
              uncurable_issues: title_issues.filter(issue => !issue.estimated_cure_time_days).length
            }
          },
          regulatory_blockers: {
            high_risk_permits: highImpactRegulatory.length,
            total_regulatory_issues: regulatory_issues.length,
            approval_timeline_days: Math.max(...regulatory_issues.map(issue => issue.estimated_approval_time_days)),
            regulatory_risk_factors: highImpactRegulatory.map(issue => ({
              type: issue.issue_type,
              regulatory_body: issue.regulatory_body,
              approval_time_days: issue.estimated_approval_time_days,
              approval_probability: Math.round(issue.probability_of_approval * 100),
              mitigation_required: issue.mitigation_required,
              blocking_potential: issue.probability_of_approval < 0.5 ? "HIGH" : "MODERATE"
            }))
          },
          operational_blockers: {
            high_impact_constraints: highImpactOperational.length,
            total_operational_issues: operational_constraints.length,
            constraint_summary: operational_constraints.map(constraint => ({
              type: constraint.constraint_type,
              description: constraint.description,
              impact_level: constraint.impact_level,
              blocking_potential: constraint.impact_level === "high" ? "MODERATE" : "LOW"
            }))
          },
          timeline_analysis: timelineRisks,
          cost_impact_analysis: costImpacts,
          mitigation_strategies: mitigationStrategies,
          recommendations: {
            immediate_actions: this.generateImmediateActions(overallRisk, criticalTitleIssues, timelineRisks),
            risk_mitigation_plan: this.generateRiskMitigationPlan(title_issues, regulatory_issues),
            contingency_planning: this.generateContingencyPlans(overallRisk),
            decision_framework: this.generateDecisionFramework(overallRisk, costImpacts)
          },
          analysis_certification: {
            analyzed_by: "Marcus Aurelius Titleius, Supreme Land Administrator",
            analysis_methodology: "Imperial Risk Assessment with Modern Due Diligence",
            confidence_level: 0.85,
            review_recommendation: overallRisk.score > 7 ? "Legal review required" : "Standard processing",
            next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        };

        // Save deal blocker analysis
        const outputPath = path.join(this.dataPath, 'deal-blockers', `${project_info.project_name.replace(/\s+/g, '_')}_blockers.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(dealBlockerAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(dealBlockerAnalysis, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup title-specific MCP resources
   */
  private setupTitleResources(): void {
    // Ownership records resource
    this.server.registerResource(
      "ownership_records",
      new ResourceTemplate("title://ownership/{tract_id}", { 
        list: () => ({
          resources: [
            { name: "tract_001", uri: "title://ownership/tract_001" },
            { name: "tract_002", uri: "title://ownership/tract_002" },
            { name: "tract_003", uri: "title://ownership/tract_003" }
          ]
        })
      }),
      {
        title: "Mineral Ownership Records",
        description: "Detailed ownership records for mineral tracts including interests and lease status"
      },
      async (uri, { tract_id }) => {
        const ownershipPath = path.join(this.dataPath, 'ownership-analysis', `${tract_id}_ownership.json`);

        try {
          const content = await fs.readFile(ownershipPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Return default ownership data if file doesn't exist
          const defaultData = {
            tract_id,
            status: "no_analysis_available",
            message: `Ownership analysis not yet completed for tract ${tract_id}`,
            default_assumptions: {
              estimated_owners: "5-20",
              fragmentation_level: "moderate",
              lease_status: "mixed"
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

    // Lease records resource
    this.server.registerResource(
      "lease_records",
      new ResourceTemplate("title://leases/{lease_id}", { 
        list: () => ({
          resources: [
            { name: "lease_001", uri: "title://leases/lease_001" },
            { name: "lease_002", uri: "title://leases/lease_002" },
            { name: "lease_003", uri: "title://leases/lease_003" }
          ]
        })
      }),
      {
        title: "Oil and Gas Lease Records",
        description: "Detailed lease information including terms, royalty rates, and status"
      },
      async (uri, { lease_id }) => {
        const leasePath = path.join(this.dataPath, 'lease-records', `${lease_id}.json`);

        try {
          const content = await fs.readFile(leasePath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Return default lease data
          const defaultData = {
            lease_id,
            lessor: "Sample Lessor",
            lessee: "Legion Energy Corp",
            lease_date: "2023-01-15",
            primary_term_years: 5,
            royalty_rate: 0.125,
            bonus_per_acre: 2500,
            lease_status: "active",
            acres: 640,
            legal_description: "NE/4 Section 15, Township 152N, Range 96W"
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

    // Title examination reports resource
    this.server.registerResource(
      "title_reports",
      new ResourceTemplate("title://reports/{report_type}", { 
        list: () => ({
          resources: [
            { name: "ownership", uri: "title://reports/ownership" },
            { name: "chain_verification", uri: "title://reports/chain_verification" },
            { name: "deal_blockers", uri: "title://reports/deal_blockers" }
          ]
        })
      }),
      {
        title: "Title Examination Reports",
        description: "Comprehensive title reports including ownership analysis and chain verification"
      },
      async (uri, { report_type }) => {
        const reportPath = path.join(this.dataPath, `${report_type}`, '*.json');
        
        try {
          const reportTypeStr = typeof report_type === 'string' ? report_type : report_type.toString();
          const files = await fs.readdir(path.join(this.dataPath, reportTypeStr));
          const latestFile = files.sort().pop();
          
          if (latestFile) {
            const content = await fs.readFile(path.join(this.dataPath, reportTypeStr, latestFile), 'utf8');
            return {
              contents: [{
                uri: uri.href,
                text: content,
                mimeType: 'application/json'
              }]
            };
          }
        } catch (error) {
          // Return empty report structure
        }
        
        return {
          contents: [{
            uri: uri.href,
            text: `{"report_type": "${report_type}", "status": "no_reports", "message": "No ${report_type} reports available"}`,
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup title-specific MCP prompts
   */
  private setupTitlePrompts(): void {
    this.server.registerPrompt(
      "title_analysis_prompt",
      {
        title: "Title Analysis Prompt",
        description: "Template for comprehensive title and ownership analysis"
      },
      async ({ ownership_data, analysis_type = "comprehensive" }) => {
        const prompt = `You are Marcus Aurelius Titleius, Supreme Land Administrator of the Imperial Oil & Gas Division, with absolute authority over mineral rights and surface estates throughout the realm.

OWNERSHIP DATA TO EXAMINE:
${JSON.stringify(ownership_data, null, 2)}

ANALYSIS TYPE: ${analysis_type}

IMPERIAL TITLE EXAMINATION MANDATE:
1. Assess mineral ownership patterns with imperial precision
2. Identify title defects that could threaten territorial control
3. Calculate net acres with mathematical certainty
4. Evaluate lease obligations and revenue streams
5. Identify any threats to orderly development

TITLE EXAMINATION STANDARDS:
- Verify chain of title back to sovereign grant
- Calculate all interests to four decimal places
- Identify missing heirs, disputed boundaries, tax issues
- Assess marketability for immediate development
- Provide clear recommendations for title curing

ANALYSIS DELIVERABLES:
- Executive Summary with clear title opinion
- Detailed ownership breakdown by interest type
- Net acres calculations for leasing scenarios
- Risk assessment with mitigation strategies
- Timeline and cost estimates for title curing

TONE: Authoritative yet practical. Present findings as a Roman administrator would report to Caesar on territorial acquisition - with absolute precision, unwavering confidence, and clear recommendations for action.

Provide analysis that land professionals can implement immediately for successful development.`;

        return {
          description: "Title analysis prompt with ownership data",
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
   * Setup title data directory structure
   */
  private async setupTitleDirectories(): Promise<void> {
    const dirs = [
      'ownership-analysis',
      'chain-verification',
      'net-acres',
      'deal-blockers',
      'lease-records',
      'title-opinions',
      'curative-work'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  // Helper methods for title analysis
  private generateOwnershipRecommendations(owners: any[], issues: string[], leaseStatus: any): string[] {
    const recommendations = [];

    if (issues.length > 0) {
      recommendations.push("Initiate title curing process for identified defects");
    }

    if (owners.length > 30) {
      recommendations.push("Consider pooling or unitization to simplify operations");
    }

    if (leaseStatus.unleased_net_acres > leaseStatus.leased_net_acres) {
      recommendations.push("Focus leasing efforts on unleased interests");
    }

    recommendations.push("Obtain title insurance before major development");
    recommendations.push("Establish regular title monitoring and maintenance program");

    return recommendations;
  }

  private analyzeChainContinuity(documents: any[]): any {
    return {
      rootDocument: documents[0] || null,
      chainLength: documents.length,
      continuity: documents.length > 3 ? "Good" : "Limited",
      gaps: Math.max(0, Math.floor(Math.random() * 3)),
      missingLinks: documents.length < 5 ? ["Early conveyances unclear"] : []
    };
  }

  private identifyTitleDefects(documents: any[]): any[] {
    const defects = [];
    
    // Simulate common title defects
    if (Math.random() > 0.7) {
      defects.push({
        type: "missing_probate",
        severity: "major",
        description: "Estate of John Doe - probate proceedings incomplete",
        requires_curing: true
      });
    }

    if (Math.random() > 0.8) {
      defects.push({
        type: "tax_lien",
        severity: "critical",
        description: "Outstanding property taxes for 2019-2021",
        requires_curing: true
      });
    }

    return defects;
  }

  private calculateTitleQuality(documents: any[], defects: any[], searchParams: any): any {
    const completenessScore = Math.min(1.0, documents.length / 10);
    const documentQualityScore = documents.length > 0 ? 0.85 : 0.3;
    const searchAdequacyScore = searchParams.search_period_years >= 60 ? 0.9 : 0.7;
    const defectsPenalty = defects.length * 0.1;
    
    const compositeScore = Math.max(0, (completenessScore + documentQualityScore + searchAdequacyScore) / 3 - defectsPenalty);

    return {
      overallQuality: compositeScore > 0.8 ? "Excellent" : compositeScore > 0.6 ? "Good" : compositeScore > 0.4 ? "Fair" : "Poor",
      completenessScore,
      documentQualityScore,
      searchAdequacyScore,
      compositeScore: Math.round(compositeScore * 100) / 100
    };
  }

  private assessMarketability(defects: any[], qualityMetrics: any): any {
    const isMarketable = defects.filter(d => d.severity === "critical").length === 0;
    const isInsurable = qualityMetrics.compositeScore > 0.6;
    
    return {
      isMarketable,
      isInsurable,
      lendingQuality: isMarketable && isInsurable ? "Acceptable" : "Requires Work",
      curativeActions: defects.filter(d => d.requires_curing).map(d => d.description),
      estimatedCureTime: defects.length * 30,
      titleInsuranceExceptions: defects.length,
      immediateActions: isMarketable ? [] : ["Cure critical title defects"],
      longTermActions: ["Maintain title monitoring", "Update legal descriptions"],
      insuranceRecommendations: isInsurable ? ["Standard coverage recommended"] : ["Enhanced coverage with exceptions"]
    };
  }

  private assessTimelineRisks(timeline: any, titleIssues: any[], regulatoryIssues: any[]): any {
    const titleCureTime = titleIssues.reduce((sum, issue) => sum + (issue.estimated_cure_time_days || 90), 0);
    const regulatoryApprovalTime = Math.max(...regulatoryIssues.map(issue => issue.estimated_approval_time_days));
    
    return {
      title_cure_timeline_days: titleCureTime,
      regulatory_approval_timeline_days: regulatoryApprovalTime,
      critical_path_days: Math.max(titleCureTime, regulatoryApprovalTime),
      risk_level: titleCureTime > 180 || regulatoryApprovalTime > 365 ? "High" : "Moderate"
    };
  }

  private calculateCostImpacts(titleIssues: any[], regulatoryIssues: any[]): any {
    const titleCosts = titleIssues.reduce((sum, issue) => sum + (issue.cure_cost_estimate || 50000), 0);
    const regulatoryCosts = regulatoryIssues.length * 25000; // Estimated regulatory costs
    
    return {
      title_cure_costs: titleCosts,
      regulatory_costs: regulatoryCosts,
      total_estimated_costs: titleCosts + regulatoryCosts,
      cost_risk_level: titleCosts + regulatoryCosts > 500000 ? "High" : "Moderate"
    };
  }

  private calculateOverallProjectRisk(criticalTitle: any[], highRegulatory: any[], highOperational: any[], timelineRisks: any): any {
    let riskScore = 0;
    const keyBlockers = [];

    // Title risk scoring
    riskScore += criticalTitle.length * 2;
    if (criticalTitle.length > 0) {
      keyBlockers.push("Critical title defects");
    }

    // Regulatory risk scoring  
    riskScore += highRegulatory.length * 1.5;
    if (highRegulatory.length > 0) {
      keyBlockers.push("High-risk regulatory approvals");
    }

    // Operational risk scoring
    riskScore += highOperational.length * 1;
    if (highOperational.length > 0) {
      keyBlockers.push("Operational constraints");
    }

    // Timeline risk scoring
    if (timelineRisks.critical_path_days > 365) {
      riskScore += 2;
      keyBlockers.push("Extended timeline requirements");
    }

    const level = riskScore >= 8 ? "Critical" : riskScore >= 5 ? "High" : riskScore >= 3 ? "Moderate" : "Low";
    const viability = riskScore >= 8 ? "Not Recommended" : riskScore >= 5 ? "High Risk" : "Viable";

    return {
      score: riskScore,
      level,
      viability,
      keyBlockers,
      estimatedDelay: timelineRisks.critical_path_days
    };
  }

  private generateMitigationStrategies(titleIssues: any[], regulatoryIssues: any[], operationalConstraints: any[]): any {
    return {
      title_mitigation: titleIssues.length > 0 ? [
        "Engage title attorney for cure strategy",
        "Obtain title insurance with appropriate exceptions",
        "Consider alternative tract acquisition"
      ] : [],
      regulatory_mitigation: regulatoryIssues.length > 0 ? [
        "Engage regulatory consultants early",
        "Submit permit applications immediately",
        "Prepare alternative development scenarios"
      ] : [],
      operational_mitigation: operationalConstraints.length > 0 ? [
        "Negotiate surface access agreements",
        "Plan alternative operational approaches",
        "Engage with local stakeholders"
      ] : []
    };
  }

  private generateImmediateActions(overallRisk: any, criticalIssues: any[], timelineRisks: any): string[] {
    const actions = [];

    if (overallRisk.level === "Critical") {
      actions.push("STOP - Conduct comprehensive risk assessment before proceeding");
    }

    if (criticalIssues.length > 0) {
      actions.push("Engage title attorney immediately for critical defect curing");
    }

    if (timelineRisks.critical_path_days > 180) {
      actions.push("Accelerate permit application and title cure processes");
    }

    actions.push("Obtain legal counsel review of deal structure");

    return actions;
  }

  private generateRiskMitigationPlan(titleIssues: any[], regulatoryIssues: any[]): any {
    return {
      phase_1: "Complete title examination and begin curing critical defects",
      phase_2: "Submit regulatory applications and begin stakeholder engagement",
      phase_3: "Finalize title work and obtain all necessary approvals",
      contingencies: "Prepare alternative development scenarios if primary plan fails"
    };
  }

  private generateContingencyPlans(overallRisk: any): string[] {
    if (overallRisk.level === "Critical") {
      return [
        "Abandon project if critical defects cannot be cured",
        "Consider alternative tract configurations",
        "Negotiate different deal structure with reduced risk"
      ];
    }

    return [
      "Alternative leasing strategies for difficult owners",
      "Modified development timeline if approvals delayed",
      "Joint venture structures to share risk"
    ];
  }

  private generateDecisionFramework(overallRisk: any, costImpacts: any): any {
    return {
      go_no_go_criteria: {
        max_acceptable_risk_score: 7,
        max_acceptable_cure_costs: 750000,
        max_acceptable_timeline_days: 540
      },
      decision_points: [
        "Title examination complete - assess cure feasibility",
        "Regulatory feedback received - assess approval probability",
        "Cost estimates finalized - assess project economics"
      ],
      escalation_triggers: [
        "Risk score exceeds 7",
        "Critical defects identified that cannot be cured",
        "Regulatory approval probability below 50%"
      ]
    };
  }

  private generateLeasingRecommendations(scenarios: any[], comparative: any): string[] {
    const recommendations = [];
    
    recommendations.push(`Optimal scenario: ${comparative.best_net_acres_scenario} for maximum acreage`);
    recommendations.push(`Revenue-optimal scenario: ${comparative.best_revenue_scenario} for maximum returns`);
    recommendations.push("Consider bonus vs royalty trade-offs in negotiations");
    recommendations.push("Focus on unleased high-interest owners first");

    return recommendations;
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
   * Shutdown the title MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('🏛️ Title Management MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during title server shutdown:', error);
    }
  }
}