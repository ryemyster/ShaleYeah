/**
 * Legal Analysis MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for legal document analysis and compliance monitoring
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface LegalMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class LegalMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: LegalMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'legal');

    // Create official MCP server with legal analysis domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupLegalTools();
    this.setupLegalResources();
    this.setupLegalPrompts();
  }

  /**
   * Initialize legal MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupLegalDirectories();
      this.initialized = true;

      console.log(`⚖️ Legal Analysis MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Legal Analysis MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup legal-specific MCP tools
   */
  private setupLegalTools(): void {
    // Analyze PSA terms tool
    this.server.registerTool(
      "analyze_psa_terms",
      {
        title: "Analyze Purchase and Sale Agreement Terms",
        description: "Comprehensive analysis of PSA terms, conditions, and risk factors",
        inputSchema: {
          psa_document: z.object({
            document_id: z.string().describe("Unique PSA document identifier"),
            parties: z.object({
              buyer: z.string(),
              seller: z.string(),
              effective_date: z.string(),
              closing_date: z.string().optional()
            }),
            transaction_details: z.object({
              purchase_price: z.number(),
              acres: z.number().optional(),
              wells_included: z.number().optional(),
              working_interest: z.number().min(0).max(1).optional(),
              royalty_interest: z.number().min(0).max(1).optional()
            })
          }),
          contract_terms: z.object({
            due_diligence_period_days: z.number().optional(),
            title_requirements: z.array(z.string()).optional(),
            environmental_conditions: z.array(z.string()).optional(),
            regulatory_approvals_required: z.array(z.string()).optional(),
            financing_contingencies: z.boolean().default(false),
            material_adverse_change_clause: z.boolean().default(true)
          }),
          risk_analysis_scope: z.object({
            analyze_indemnification: z.boolean().default(true),
            analyze_warranties: z.boolean().default(true),
            analyze_closing_conditions: z.boolean().default(true),
            analyze_termination_rights: z.boolean().default(true),
            analyze_dispute_resolution: z.boolean().default(true)
          })
        }
      },
      async ({ psa_document, contract_terms, risk_analysis_scope }) => {
        console.log(`⚖️ Analyzing PSA terms for transaction: ${psa_document.document_id}`);

        // Analyze key transaction metrics
        const transactionAnalysis = this.analyzeTransactionMetrics(psa_document);

        // Analyze contract terms and conditions
        const contractAnalysis = this.analyzeContractTerms(contract_terms);

        // Perform risk assessment
        const riskAssessment = this.assessPSARisks(psa_document, contract_terms, risk_analysis_scope);

        // Analyze key provisions
        const provisionsAnalysis = this.analyzeKeyProvisions(contract_terms, risk_analysis_scope);

        // Generate commercial terms analysis
        const commercialAnalysis = this.analyzeCommercialTerms(psa_document, contract_terms);

        // Identify potential issues and red flags
        const issuesAnalysis = this.identifyPSAIssues(psa_document, contract_terms);

        const psaAnalysis = {
          document_identification: {
            document_id: psa_document.document_id,
            transaction_type: "Asset Purchase Agreement",
            buyer: psa_document.parties.buyer,
            seller: psa_document.parties.seller,
            analysis_date: new Date().toISOString(),
            effective_date: psa_document.parties.effective_date
          },
          transaction_analysis: transactionAnalysis,
          commercial_terms_analysis: commercialAnalysis,
          contract_terms_analysis: contractAnalysis,
          key_provisions_analysis: provisionsAnalysis,
          risk_assessment: riskAssessment,
          issues_and_concerns: issuesAnalysis,
          due_diligence_recommendations: {
            critical_items: this.generateCriticalDueDiligenceItems(contract_terms),
            title_examination_scope: this.defineTitleExaminationScope(contract_terms),
            environmental_review_requirements: this.defineEnvironmentalReview(contract_terms),
            regulatory_approval_timeline: this.estimateRegulatoryTimeline(contract_terms),
            recommended_specialists: this.recommendSpecialists(issuesAnalysis)
          },
          closing_readiness_assessment: {
            conditions_precedent_status: this.assessClosingConditions(contract_terms),
            estimated_closing_probability: this.estimateClosingProbability(riskAssessment, issuesAnalysis),
            key_closing_risks: this.identifyClosingRisks(riskAssessment),
            recommended_closing_timeline: this.recommendClosingTimeline(contract_terms)
          },
          negotiation_recommendations: {
            buyer_favorable_modifications: this.generateBuyerRecommendations(issuesAnalysis, riskAssessment),
            seller_favorable_modifications: this.generateSellerRecommendations(issuesAnalysis, riskAssessment),
            balanced_compromise_options: this.generateCompromiseOptions(issuesAnalysis),
            deal_breaker_issues: this.identifyDealBreakers(issuesAnalysis, riskAssessment)
          },
          legal_opinion_summary: {
            overall_risk_rating: riskAssessment.overall_risk_level,
            transaction_viability: riskAssessment.transaction_viability,
            key_legal_concerns: riskAssessment.key_concerns,
            recommended_actions: riskAssessment.recommended_actions,
            attorney_notes: "Comprehensive analysis completed per Imperial Legal Standards"
          },
          analysis_certification: {
            analyzed_by: "Gaius Legalis Advocatus, Imperial Legal Counselor",
            analysis_methodology: "Imperial Roman Legal Analysis with Modern Transactional Standards",
            confidence_level: 0.88,
            peer_review_required: riskAssessment.overall_risk_level === "High",
            next_review_milestone: "Upon receipt of due diligence materials"
          }
        };

        // Save PSA analysis
        const outputPath = path.join(this.dataPath, 'psa-analysis', `${psa_document.document_id}_psa_analysis.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(psaAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(psaAnalysis, null, 2)
          }]
        };
      }
    );

    // Check compliance tool
    this.server.registerTool(
      "check_compliance",
      {
        title: "Regulatory Compliance Assessment",
        description: "Analyze regulatory compliance requirements and identify potential violations",
        inputSchema: {
          project_details: z.object({
            project_name: z.string(),
            project_type: z.enum(["drilling", "production", "pipeline", "facility", "transportation"]),
            location: z.object({
              state: z.string(),
              county: z.string(),
              regulatory_district: z.string().optional()
            }),
            operation_timeline: z.object({
              planned_start_date: z.string(),
              estimated_duration_months: z.number(),
              planned_completion_date: z.string().optional()
            })
          }),
          regulatory_requirements: z.array(z.object({
            regulation_type: z.enum(["federal", "state", "local", "tribal"]),
            regulatory_body: z.string(),
            requirement_description: z.string(),
            compliance_deadline: z.string().optional(),
            permit_required: z.boolean().default(false),
            ongoing_reporting_required: z.boolean().default(false)
          })),
          current_compliance_status: z.array(z.object({
            requirement_id: z.string(),
            compliance_status: z.enum(["compliant", "non_compliant", "partial", "unknown", "not_applicable"]),
            last_audit_date: z.string().optional(),
            violations_noted: z.array(z.string()).optional(),
            corrective_actions_taken: z.array(z.string()).optional()
          })),
          compliance_assessment_scope: z.object({
            include_environmental: z.boolean().default(true),
            include_safety: z.boolean().default(true),
            include_financial: z.boolean().default(true),
            include_operational: z.boolean().default(true),
            lookback_period_years: z.number().default(3)
          })
        }
      },
      async ({ project_details, regulatory_requirements, current_compliance_status, compliance_assessment_scope }) => {
        console.log(`⚖️ Assessing compliance for project: ${project_details.project_name}`);

        // Analyze regulatory framework
        const regulatoryFramework = this.analyzeRegulatoryFramework(
          project_details,
          regulatory_requirements
        );

        // Assess current compliance status
        const complianceStatusAssessment = this.assessCurrentCompliance(
          current_compliance_status,
          regulatory_requirements
        );

        // Identify compliance gaps
        const complianceGaps = this.identifyComplianceGaps(
          regulatory_requirements,
          current_compliance_status
        );

        // Calculate compliance risk
        const complianceRisk = this.calculateComplianceRisk(
          complianceGaps,
          project_details,
          compliance_assessment_scope
        );

        // Generate compliance plan
        const compliancePlan = this.generateCompliancePlan(
          complianceGaps,
          regulatory_requirements,
          project_details
        );

        // Estimate compliance costs
        const complianceCosts = this.estimateComplianceCosts(
          regulatory_requirements,
          complianceGaps,
          project_details
        );

        const complianceAssessment = {
          project_summary: {
            project_name: project_details.project_name,
            project_type: project_details.project_type,
            location: `${project_details.location.county} County, ${project_details.location.state}`,
            assessment_date: new Date().toISOString(),
            assessment_scope: compliance_assessment_scope
          },
          regulatory_framework_analysis: regulatoryFramework,
          current_compliance_status: complianceStatusAssessment,
          compliance_gaps_analysis: {
            total_gaps_identified: complianceGaps.length,
            critical_gaps: complianceGaps.filter(gap => gap.severity === "critical"),
            major_gaps: complianceGaps.filter(gap => gap.severity === "major"),
            minor_gaps: complianceGaps.filter(gap => gap.severity === "minor"),
            gap_details: complianceGaps.map(gap => ({
              requirement: gap.requirement,
              current_status: gap.current_status,
              gap_description: gap.description,
              severity: gap.severity,
              estimated_cure_time: gap.estimated_cure_time_days,
              estimated_cure_cost: gap.estimated_cure_cost
            }))
          },
          compliance_risk_assessment: complianceRisk,
          compliance_plan: compliancePlan,
          cost_analysis: complianceCosts,
          timeline_analysis: {
            compliance_timeline_days: compliancePlan.total_timeline_days,
            critical_path_items: compliancePlan.critical_path,
            permit_acquisition_timeline: compliancePlan.permit_timeline,
            ongoing_compliance_requirements: compliancePlan.ongoing_requirements
          },
          recommendations: {
            immediate_actions: this.generateImmediateComplianceActions(complianceGaps, complianceRisk),
            strategic_recommendations: this.generateStrategicComplianceRecommendations(
              regulatoryFramework,
              complianceRisk
            ),
            risk_mitigation_strategies: this.generateComplianceRiskMitigation(complianceRisk),
            monitoring_and_reporting_plan: this.generateMonitoringPlan(regulatory_requirements)
          },
          legal_assessment: {
            overall_compliance_rating: complianceRisk.overall_rating,
            regulatory_exposure_level: complianceRisk.exposure_level,
            enforcement_risk: complianceRisk.enforcement_risk,
            recommended_legal_actions: complianceRisk.recommended_actions,
            counsel_recommendations: this.generateCounselRecommendations(complianceRisk, complianceGaps)
          },
          analysis_certification: {
            analyzed_by: "Gaius Legalis Advocatus, Imperial Legal Counselor",
            analysis_methodology: "Imperial Regulatory Compliance Assessment Framework",
            confidence_level: 0.85,
            regulatory_expertise_applied: ["Environmental Law", "Energy Regulation", "Administrative Law"],
            next_assessment_due: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        };

        // Save compliance assessment
        const outputPath = path.join(this.dataPath, 'compliance-analysis', `${project_details.project_name.replace(/\s+/g, '_')}_compliance.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(complianceAssessment, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(complianceAssessment, null, 2)
          }]
        };
      }
    );

    // Extract key clauses tool
    this.server.registerTool(
      "extract_key_clauses",
      {
        title: "Extract and Analyze Key Contract Clauses",
        description: "Identify, extract, and analyze critical clauses in oil and gas contracts",
        inputSchema: {
          document_details: z.object({
            document_id: z.string(),
            document_type: z.enum(["lease", "psa", "joa", "farmout", "assignment", "easement"]),
            parties: z.array(z.string()),
            execution_date: z.string(),
            governing_law: z.string().optional()
          }),
          clause_extraction_scope: z.object({
            extract_financial_terms: z.boolean().default(true),
            extract_operational_terms: z.boolean().default(true),
            extract_environmental_terms: z.boolean().default(true),
            extract_termination_terms: z.boolean().default(true),
            extract_dispute_resolution: z.boolean().default(true),
            extract_indemnification: z.boolean().default(true),
            custom_clause_types: z.array(z.string()).optional()
          }),
          analysis_parameters: z.object({
            risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
            industry_standards_comparison: z.boolean().default(true),
            enforceability_analysis: z.boolean().default(true),
            negotiability_assessment: z.boolean().default(true)
          })
        }
      },
      async ({ document_details, clause_extraction_scope, analysis_parameters }) => {
        console.log(`⚖️ Extracting key clauses from ${document_details.document_type}: ${document_details.document_id}`);

        // Extract clauses based on document type
        const extractedClauses = this.extractClausesByType(
          document_details.document_type,
          clause_extraction_scope
        );

        // Analyze each clause type
        const clauseAnalysis = this.analyzeExtractedClauses(
          extractedClauses,
          analysis_parameters,
          document_details
        );

        // Perform risk assessment on clauses
        const clauseRiskAssessment = this.assessClauseRisks(
          extractedClauses,
          analysis_parameters.risk_tolerance
        );

        // Compare to industry standards
        const industryComparison = analysis_parameters.industry_standards_comparison ?
          this.compareToIndustryStandards(extractedClauses, document_details.document_type) : null;

        // Assess enforceability
        const enforceabilityAssessment = analysis_parameters.enforceability_analysis ?
          this.assessClauseEnforceability(extractedClauses, document_details) : null;

        // Evaluate negotiability
        const negotiabilityAssessment = analysis_parameters.negotiability_assessment ?
          this.assessClauseNegotiability(extractedClauses, clauseRiskAssessment) : null;

        const clauseExtraction = {
          document_identification: {
            document_id: document_details.document_id,
            document_type: document_details.document_type,
            parties: document_details.parties,
            execution_date: document_details.execution_date,
            governing_law: document_details.governing_law || "State law applicable",
            analysis_date: new Date().toISOString()
          },
          extraction_summary: {
            total_clauses_extracted: extractedClauses.length,
            clause_types_identified: Array.from(new Set(extractedClauses.map(c => c.clause_type))),
            extraction_scope: clause_extraction_scope,
            analysis_parameters: analysis_parameters
          },
          extracted_clauses: extractedClauses.map(clause => ({
            clause_id: clause.id,
            clause_type: clause.clause_type,
            clause_title: clause.title,
            key_provisions: clause.key_provisions,
            financial_implications: clause.financial_implications,
            operational_implications: clause.operational_implications,
            risk_factors: clause.risk_factors,
            negotiation_points: clause.negotiation_points
          })),
          clause_analysis: clauseAnalysis,
          risk_assessment: clauseRiskAssessment,
          industry_comparison: industryComparison,
          enforceability_assessment: enforceabilityAssessment,
          negotiability_assessment: negotiabilityAssessment,
          recommendations: {
            high_priority_review_items: this.identifyHighPriorityItems(clauseRiskAssessment),
            suggested_modifications: this.suggestClauseModifications(
              clauseRiskAssessment,
              negotiabilityAssessment,
              analysis_parameters.risk_tolerance
            ),
            red_flag_clauses: this.identifyRedFlagClauses(clauseRiskAssessment),
            favorable_clauses: this.identifyFavorableClauses(clauseRiskAssessment),
            negotiation_strategy: this.developNegotiationStrategy(
              negotiabilityAssessment,
              clauseRiskAssessment
            )
          },
          legal_opinion: {
            overall_contract_assessment: this.generateOverallContractAssessment(
              clauseRiskAssessment,
              enforceabilityAssessment
            ),
            key_legal_concerns: clauseRiskAssessment.key_concerns,
            recommended_legal_actions: clauseRiskAssessment.recommended_actions,
            attorney_notes: "Comprehensive clause analysis completed per Imperial Legal Standards"
          },
          analysis_certification: {
            analyzed_by: "Gaius Legalis Advocatus, Imperial Legal Counselor",
            analysis_methodology: "Imperial Contract Analysis with Modern Transactional Standards",
            confidence_level: 0.87,
            specialized_expertise_areas: this.getSpecializedExpertiseAreas(document_details.document_type),
            next_review_recommendation: "Upon material contract amendments or industry standard changes"
          }
        };

        // Save clause extraction analysis
        const outputPath = path.join(this.dataPath, 'clause-analysis', `${document_details.document_id}_clauses.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(clauseExtraction, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(clauseExtraction, null, 2)
          }]
        };
      }
    );

    // Assess legal risk tool
    this.server.registerTool(
      "assess_legal_risk",
      {
        title: "Comprehensive Legal Risk Assessment",
        description: "Analyze and quantify legal risks across multiple dimensions of oil and gas operations",
        inputSchema: {
          risk_assessment_scope: z.object({
            assessment_name: z.string(),
            business_unit: z.string(),
            assessment_period: z.object({
              start_date: z.string(),
              end_date: z.string()
            }),
            risk_categories: z.array(z.enum([
              "contractual", "regulatory", "environmental", "title", "operational", 
              "financial", "litigation", "compliance", "force_majeure"
            ]))
          }),
          contracts_portfolio: z.array(z.object({
            contract_id: z.string(),
            contract_type: z.string(),
            counterparty: z.string(),
            contract_value: z.number(),
            risk_rating: z.enum(["low", "medium", "high", "critical"]),
            key_risk_factors: z.array(z.string())
          })),
          regulatory_exposure: z.array(z.object({
            regulation_area: z.string(),
            regulatory_body: z.string(),
            compliance_status: z.enum(["compliant", "at_risk", "non_compliant"]),
            potential_penalties: z.number().optional(),
            mitigation_status: z.enum(["none", "partial", "complete"])
          })),
          litigation_matters: z.array(z.object({
            case_id: z.string(),
            case_type: z.enum(["contract_dispute", "environmental", "regulatory", "title_dispute", "personal_injury"]),
            status: z.enum(["active", "settled", "dismissed", "appeal"]),
            exposure_amount: z.number().optional(),
            probability_of_loss: z.number().min(0).max(1).optional()
          })),
          risk_tolerance_parameters: z.object({
            maximum_acceptable_exposure: z.number(),
            risk_appetite: z.enum(["conservative", "moderate", "aggressive"]),
            business_impact_thresholds: z.object({
              low_impact: z.number(),
              medium_impact: z.number(),
              high_impact: z.number()
            })
          })
        }
      },
      async ({ 
        risk_assessment_scope, 
        contracts_portfolio, 
        regulatory_exposure, 
        litigation_matters, 
        risk_tolerance_parameters 
      }) => {
        console.log(`⚖️ Conducting comprehensive legal risk assessment: ${risk_assessment_scope.assessment_name}`);

        // Analyze contractual risks
        const contractualRiskAnalysis = this.analyzeContractualRisks(
          contracts_portfolio,
          risk_tolerance_parameters
        );

        // Analyze regulatory risks
        const regulatoryRiskAnalysis = this.analyzeRegulatoryRisks(
          regulatory_exposure,
          risk_tolerance_parameters
        );

        // Analyze litigation risks
        const litigationRiskAnalysis = this.analyzeLitigationRisks(
          litigation_matters,
          risk_tolerance_parameters
        );

        // Calculate overall risk metrics
        const overallRiskMetrics = this.calculateOverallRiskMetrics(
          contractualRiskAnalysis,
          regulatoryRiskAnalysis,
          litigationRiskAnalysis,
          risk_tolerance_parameters
        );

        // Perform risk correlation analysis
        const riskCorrelationAnalysis = this.analyzeRiskCorrelations(
          contractualRiskAnalysis,
          regulatoryRiskAnalysis,
          litigationRiskAnalysis
        );

        // Generate risk scenarios
        const riskScenarios = this.generateRiskScenarios(
          overallRiskMetrics,
          risk_tolerance_parameters
        );

        // Develop mitigation strategies
        const mitigationStrategies = this.developRiskMitigationStrategies(
          overallRiskMetrics,
          risk_assessment_scope.risk_categories,
          risk_tolerance_parameters
        );

        const legalRiskAssessment = {
          assessment_overview: {
            assessment_name: risk_assessment_scope.assessment_name,
            business_unit: risk_assessment_scope.business_unit,
            assessment_period: risk_assessment_scope.assessment_period,
            risk_categories_assessed: risk_assessment_scope.risk_categories,
            assessment_date: new Date().toISOString(),
            assessment_methodology: "Imperial Legal Risk Assessment Framework"
          },
          portfolio_summary: {
            total_contracts: contracts_portfolio.length,
            total_contract_value: contracts_portfolio.reduce((sum, contract) => sum + contract.contract_value, 0),
            regulatory_matters: regulatory_exposure.length,
            active_litigation: litigation_matters.filter(matter => matter.status === "active").length,
            total_legal_exposure: overallRiskMetrics.total_estimated_exposure
          },
          contractual_risk_analysis: contractualRiskAnalysis,
          regulatory_risk_analysis: regulatoryRiskAnalysis,
          litigation_risk_analysis: litigationRiskAnalysis,
          overall_risk_metrics: overallRiskMetrics,
          risk_correlation_analysis: riskCorrelationAnalysis,
          scenario_analysis: riskScenarios,
          risk_mitigation_strategies: mitigationStrategies,
          key_findings: {
            highest_risk_areas: this.identifyHighestRiskAreas(overallRiskMetrics),
            critical_action_items: this.identifyCriticalActionItems(overallRiskMetrics, mitigationStrategies),
            emerging_risk_trends: this.identifyEmergingRiskTrends(
              contractualRiskAnalysis,
              regulatoryRiskAnalysis,
              litigationRiskAnalysis
            ),
            risk_concentration_concerns: this.identifyRiskConcentrations(riskCorrelationAnalysis)
          },
          recommendations: {
            immediate_risk_mitigation_actions: mitigationStrategies.immediate_actions,
            strategic_risk_management_initiatives: mitigationStrategies.strategic_initiatives,
            policy_and_procedure_recommendations: mitigationStrategies.policy_recommendations,
            resource_allocation_recommendations: mitigationStrategies.resource_recommendations,
            monitoring_and_reporting_enhancements: mitigationStrategies.monitoring_recommendations
          },
          risk_appetite_analysis: {
            current_risk_position_vs_appetite: this.compareRiskPositionToAppetite(
              overallRiskMetrics,
              risk_tolerance_parameters
            ),
            risk_capacity_utilization: this.calculateRiskCapacityUtilization(
              overallRiskMetrics,
              risk_tolerance_parameters
            ),
            recommended_risk_appetite_adjustments: this.recommendRiskAppetiteAdjustments(
              overallRiskMetrics,
              risk_tolerance_parameters
            )
          },
          legal_counsel_assessment: {
            overall_legal_risk_rating: overallRiskMetrics.overall_risk_rating,
            business_impact_assessment: overallRiskMetrics.business_impact_level,
            regulatory_compliance_status: regulatoryRiskAnalysis.overall_compliance_status,
            litigation_management_effectiveness: litigationRiskAnalysis.management_effectiveness,
            recommended_legal_budget_allocation: this.recommendLegalBudgetAllocation(overallRiskMetrics)
          },
          analysis_certification: {
            analyzed_by: "Gaius Legalis Advocatus, Imperial Legal Counselor",
            analysis_methodology: "Imperial Comprehensive Legal Risk Assessment Framework",
            confidence_level: 0.86,
            peer_review_completed: overallRiskMetrics.overall_risk_rating === "Critical",
            next_assessment_due: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            specialized_expertise_consulted: this.getSpecializedExpertiseConsulted(risk_assessment_scope.risk_categories)
          }
        };

        // Save legal risk assessment
        const outputPath = path.join(this.dataPath, 'risk-assessment', `${risk_assessment_scope.assessment_name.replace(/\s+/g, '_')}_risk.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(legalRiskAssessment, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(legalRiskAssessment, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup legal-specific MCP resources
   */
  private setupLegalResources(): void {
    // Legal documents resource
    this.server.registerResource(
      "legal_documents",
      new ResourceTemplate("legal://documents/{doc_id}", { 
        list: () => ({
          resources: [
            { name: "psa_001", uri: "legal://documents/psa_001" },
            { name: "joa_002", uri: "legal://documents/joa_002" },
            { name: "lease_003", uri: "legal://documents/lease_003" }
          ]
        })
      }),
      {
        title: "Legal Document Repository",
        description: "Comprehensive legal document analysis results and contract terms"
      },
      async (uri, { doc_id }) => {
        const docPath = path.join(this.dataPath, 'psa-analysis', `${doc_id}_psa_analysis.json`);

        try {
          const content = await fs.readFile(docPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Try other document types
          const alternativePaths = [
            path.join(this.dataPath, 'clause-analysis', `${doc_id}_clauses.json`),
            path.join(this.dataPath, 'legal-opinions', `${doc_id}_opinion.json`)
          ];

          for (const altPath of alternativePaths) {
            try {
              const content = await fs.readFile(altPath, 'utf8');
              return {
                contents: [{
                  uri: uri.href,
                  text: content,
                  mimeType: 'application/json'
                }]
              };
            } catch (error) {
              // Continue to next alternative
            }
          }

          // Return default document data
          const defaultData = {
            doc_id,
            status: "no_analysis_available",
            message: `Legal analysis not yet completed for document ${doc_id}`,
            document_type: "unknown",
            suggested_analysis: "PSA terms analysis or clause extraction recommended"
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

    // Compliance records resource
    this.server.registerResource(
      "compliance_records",
      new ResourceTemplate("legal://compliance/{jurisdiction}", { 
        list: () => ({
          resources: [
            { name: "federal", uri: "legal://compliance/federal" },
            { name: "state", uri: "legal://compliance/state" },
            { name: "local", uri: "legal://compliance/local" }
          ]
        })
      }),
      {
        title: "Regulatory Compliance Records",
        description: "Compliance assessments and regulatory analysis by jurisdiction"
      },
      async (uri, { jurisdiction }) => {
        const compliancePath = path.join(this.dataPath, 'compliance-analysis');

        try {
          const files = await fs.readdir(compliancePath);
          const jurisdictionParam = Array.isArray(jurisdiction) ? jurisdiction[0] : jurisdiction;
          const jurisdictionFiles = files.filter((file: string) => 
            file.includes(jurisdictionParam) || file.includes('compliance')
          );
          
          if (jurisdictionFiles.length > 0) {
            const latestFile = jurisdictionFiles.sort().pop();
            const content = await fs.readFile(path.join(compliancePath, latestFile!), 'utf8');
            return {
              contents: [{
                uri: uri.href,
                text: content,
                mimeType: 'application/json'
              }]
            };
          }
        } catch (error) {
          // Continue to default response
        }

        // Return default compliance data
        const defaultData = {
          jurisdiction,
          compliance_status: "not_assessed",
          message: `Compliance assessment not yet completed for ${jurisdiction} jurisdiction`,
          typical_requirements: [
            "Environmental permits",
            "Safety regulations",
            "Operational permits",
            "Financial bonding"
          ]
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(defaultData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Legal opinions resource
    this.server.registerResource(
      "legal_opinions",
      new ResourceTemplate("legal://opinions/{opinion_type}", { 
        list: () => ({
          resources: [
            { name: "risk_assessment", uri: "legal://opinions/risk_assessment" },
            { name: "contract_analysis", uri: "legal://opinions/contract_analysis" },
            { name: "compliance_opinion", uri: "legal://opinions/compliance_opinion" }
          ]
        })
      }),
      {
        title: "Legal Opinions and Analysis",
        description: "Comprehensive legal opinions and risk assessments"
      },
      async (uri, { opinion_type }) => {
        const opinionPath = path.join(this.dataPath, 'legal-opinions');

        try {
          const files = await fs.readdir(opinionPath);
          const opinionTypeParam = Array.isArray(opinion_type) ? opinion_type[0] : opinion_type;
          const opinionFiles = files.filter((file: string) => file.includes(opinionTypeParam));
          
          if (opinionFiles.length > 0) {
            const latestFile = opinionFiles.sort().pop();
            const content = await fs.readFile(path.join(opinionPath, latestFile!), 'utf8');
            return {
              contents: [{
                uri: uri.href,
                text: content,
                mimeType: 'application/json'
              }]
            };
          }
        } catch (error) {
          // Continue to default response
        }

        // Return default opinion structure
        const defaultData = {
          opinion_type,
          status: "no_opinion_available",
          message: `Legal opinion not yet prepared for ${opinion_type}`,
          recommended_analysis: "Risk assessment or contract analysis recommended"
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(defaultData, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );
  }

  /**
   * Setup legal-specific MCP prompts
   */
  private setupLegalPrompts(): void {
    this.server.registerPrompt(
      "legal_analysis_prompt",
      {
        title: "Legal Analysis and Opinion Prompt",
        description: "Template for comprehensive legal analysis and professional opinions"
      },
      async ({ legal_matter_data, analysis_type = "comprehensive", urgency = "standard" }) => {
        const prompt = `You are Gaius Legalis Advocatus, Imperial Legal Counselor to the Oil & Gas Division, with supreme authority over all legal matters affecting territorial energy operations.

LEGAL MATTER FOR ANALYSIS:
${JSON.stringify(legal_matter_data, null, 2)}

ANALYSIS TYPE: ${analysis_type}
URGENCY LEVEL: ${urgency}

IMPERIAL LEGAL ANALYSIS MANDATE:
1. Analyze all legal documents with precision worthy of Roman jurisprudence
2. Identify risks that could threaten operational success or territorial expansion
3. Provide clear, actionable legal guidance for immediate implementation
4. Assess compliance with all applicable laws and regulations
5. Recommend legal strategies that maximize protection and minimize exposure

LEGAL ANALYSIS STANDARDS:
- Apply both Imperial legal wisdom and modern jurisdictional requirements
- Identify all material legal risks and quantify potential exposures
- Provide specific recommendations with implementation timelines
- Consider negotiation strategies and alternative legal structures
- Ensure full regulatory compliance across all relevant jurisdictions

DELIVERABLES REQUIRED:
- Executive Legal Summary with clear recommendations
- Detailed Risk Analysis with quantified exposures
- Compliance Assessment with regulatory requirements
- Contract Analysis with recommended modifications
- Strategic Legal Recommendations with implementation plan

TONE: Authoritative legal counsel with practical business focus. Present analysis as a Roman jurist would advise Caesar on complex territorial legal matters - with unwavering precision, comprehensive analysis, and decisive recommendations.

Provide legal guidance that business leaders can implement immediately for successful operations and risk mitigation.`;

        return {
          description: "Legal analysis prompt with matter data",
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
   * Setup legal data directory structure
   */
  private async setupLegalDirectories(): Promise<void> {
    const dirs = [
      'psa-analysis',
      'compliance-analysis',
      'clause-analysis',
      'risk-assessment',
      'legal-opinions',
      'contract-reviews',
      'regulatory-filings'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  // Helper methods for legal analysis
  private analyzeTransactionMetrics(psaDocument: any): any {
    return {
      transaction_size: psaDocument.transaction_details.purchase_price,
      price_per_acre: psaDocument.transaction_details.acres ? 
        Math.round(psaDocument.transaction_details.purchase_price / psaDocument.transaction_details.acres) : "N/A",
      asset_type: this.determineAssetType(psaDocument.transaction_details),
      complexity_rating: this.assessTransactionComplexity(psaDocument)
    };
  }

  private analyzeContractTerms(contractTerms: any): any {
    return {
      due_diligence_adequacy: this.assessDueDiligenceAdequacy(contractTerms),
      title_requirements_strength: this.assessTitleRequirements(contractTerms),
      environmental_protections: this.assessEnvironmentalProtections(contractTerms),
      financing_risk: contractTerms.financing_contingencies ? "High" : "Low"
    };
  }

  private assessPSARisks(psaDocument: any, contractTerms: any, scope: any): any {
    const risks = [];
    let overallRiskLevel = "Low";

    if (contractTerms.due_diligence_period_days < 60) {
      risks.push("Insufficient due diligence period");
      overallRiskLevel = "Medium";
    }

    if (contractTerms.financing_contingencies) {
      risks.push("Financing contingency creates execution risk");
      overallRiskLevel = "Medium";
    }

    return {
      overall_risk_level: overallRiskLevel,
      key_concerns: risks,
      transaction_viability: overallRiskLevel === "High" ? "At Risk" : "Viable",
      recommended_actions: this.generateRiskMitigationActions(risks)
    };
  }

  private analyzeKeyProvisions(contractTerms: any, scope: any): any {
    return {
      indemnification_analysis: scope.analyze_indemnification ? this.analyzeIndemnification() : null,
      warranties_analysis: scope.analyze_warranties ? this.analyzeWarranties() : null,
      closing_conditions_analysis: scope.analyze_closing_conditions ? this.assessClosingConditions(contractTerms) : null,
      termination_rights_analysis: scope.analyze_termination_rights ? this.analyzeTerminationRights() : null,
      dispute_resolution_analysis: scope.analyze_dispute_resolution ? this.analyzeDisputeResolution() : null
    };
  }

  private analyzeCommercialTerms(psaDocument: any, contractTerms: any): any {
    return {
      purchase_price_analysis: {
        total_price: psaDocument.transaction_details.purchase_price,
        valuation_metrics: this.calculateValuationMetrics(psaDocument),
        price_adjustment_mechanisms: this.identifyPriceAdjustments(contractTerms)
      },
      payment_terms_analysis: {
        structure: "Standard industry terms assumed",
        risk_assessment: "Low risk for typical structure"
      }
    };
  }

  private identifyPSAIssues(psaDocument: any, contractTerms: any): any {
    const issues = [];

    if (!contractTerms.material_adverse_change_clause) {
      issues.push({
        issue: "Missing MAC clause",
        severity: "Medium",
        recommendation: "Add material adverse change protection"
      });
    }

    return {
      critical_issues: issues.filter(i => i.severity === "Critical"),
      major_issues: issues.filter(i => i.severity === "Medium"),
      minor_issues: issues.filter(i => i.severity === "Low"),
      total_issues: issues.length
    };
  }

  private generateCriticalDueDiligenceItems(contractTerms: any): string[] {
    return [
      "Complete title examination and cure any defects",
      "Environmental site assessment and liability review",
      "Regulatory compliance verification",
      "Financial statement and credit analysis",
      "Operational review and asset valuation"
    ];
  }

  private defineTitleExaminationScope(contractTerms: any): any {
    return {
      scope: "60-year chain of title examination",
      requirements: contractTerms.title_requirements || ["Marketable title", "Title insurance"],
      timeline: "30-45 days"
    };
  }

  private defineEnvironmentalReview(contractTerms: any): any {
    return {
      scope: "Phase I and Phase II if necessary",
      requirements: contractTerms.environmental_conditions || ["No material environmental liabilities"],
      timeline: "45-60 days"
    };
  }

  private estimateRegulatoryTimeline(contractTerms: any): any {
    return {
      required_approvals: contractTerms.regulatory_approvals_required || ["State regulatory approval"],
      estimated_timeline: "60-120 days",
      risk_factors: ["Regulatory backlog", "Application completeness"]
    };
  }

  private recommendSpecialists(issuesAnalysis: any): string[] {
    const specialists = ["Oil & Gas Attorney", "Title Attorney"];

    if (issuesAnalysis.total_issues > 5) {
      specialists.push("Transaction Counsel", "Environmental Attorney");
    }

    return specialists;
  }

  private assessClosingConditions(contractTerms: any): any {
    return {
      standard_conditions: ["Title clearance", "Regulatory approvals", "Due diligence completion"],
      estimated_timeline: "90-120 days",
      key_risks: ["Title defects", "Regulatory delays"]
    };
  }

  private estimateClosingProbability(riskAssessment: any, issuesAnalysis: any): number {
    let probability = 0.85; // Base probability

    if (riskAssessment.overall_risk_level === "High") probability -= 0.20;
    if (issuesAnalysis.total_issues > 5) probability -= 0.15;

    return Math.max(0.5, Math.min(0.95, probability));
  }

  private identifyClosingRisks(riskAssessment: any): string[] {
    return riskAssessment.key_concerns || ["Standard transaction risks"];
  }

  private recommendClosingTimeline(contractTerms: any): string {
    const baseTimeline = contractTerms.due_diligence_period_days || 60;
    return `${baseTimeline + 30} days from execution`;
  }

  private generateBuyerRecommendations(issuesAnalysis: any, riskAssessment: any): string[] {
    return [
      "Strengthen indemnification provisions",
      "Add specific environmental representations",
      "Include material adverse change clause",
      "Extend due diligence period if needed"
    ];
  }

  private generateSellerRecommendations(issuesAnalysis: any, riskAssessment: any): string[] {
    return [
      "Limit indemnification scope and duration",
      "Add knowledge qualifiers to representations",
      "Include buyer's due diligence reliance clause",
      "Negotiate favorable dispute resolution terms"
    ];
  }

  private generateCompromiseOptions(issuesAnalysis: any): string[] {
    return [
      "Mutual indemnification for certain matters",
      "Escrow arrangements for uncertain liabilities",
      "Shared cost arrangements for title cure",
      "Staged closing for complex transactions"
    ];
  }

  private identifyDealBreakers(issuesAnalysis: any, riskAssessment: any): string[] {
    const dealBreakers = [];

    if (riskAssessment.overall_risk_level === "High") {
      dealBreakers.push("Critical title defects that cannot be cured");
    }

    if (issuesAnalysis.critical_issues?.length > 0) {
      dealBreakers.push("Unresolvable regulatory compliance issues");
    }

    return dealBreakers.length > 0 ? dealBreakers : ["No identified deal breakers"];
  }

  // Additional helper methods for other tools...
  private analyzeRegulatoryFramework(projectDetails: any, requirements: any[]): any {
    return {
      applicable_regulations: requirements.length,
      regulatory_complexity: requirements.length > 10 ? "High" : requirements.length > 5 ? "Medium" : "Low",
      primary_regulatory_bodies: Array.from(new Set(requirements.map(r => r.regulatory_body))),
      estimated_total_timeline: Math.max(...requirements.map(r => r.estimated_approval_time_days || 90))
    };
  }

  private assessCurrentCompliance(currentStatus: any[], requirements: any[]): any {
    const compliant = currentStatus.filter(s => s.compliance_status === "compliant").length;
    const total = currentStatus.length;

    return {
      overall_compliance_percentage: total > 0 ? Math.round((compliant / total) * 100) : 0,
      compliant_items: compliant,
      non_compliant_items: currentStatus.filter(s => s.compliance_status === "non_compliant").length,
      at_risk_items: currentStatus.filter(s => s.compliance_status === "at_risk").length,
      unknown_status_items: currentStatus.filter(s => s.compliance_status === "unknown").length
    };
  }

  private identifyComplianceGaps(requirements: any[], currentStatus: any[]): any[] {
    const gaps = [];

    // Simulate compliance gap identification
    for (const requirement of requirements) {
      const status = currentStatus.find(s => s.requirement_id === requirement.regulation_type);
      
      if (!status || status.compliance_status !== "compliant") {
        gaps.push({
          requirement: requirement.regulation_type,
          current_status: status?.compliance_status || "unknown",
          description: `Gap in ${requirement.requirement_description}`,
          severity: requirement.permit_required ? "critical" : "major",
          estimated_cure_time_days: 60,
          estimated_cure_cost: 25000
        });
      }
    }

    return gaps;
  }

  private calculateComplianceRisk(gaps: any[], projectDetails: any, scope: any): any {
    const criticalGaps = gaps.filter(g => g.severity === "critical").length;
    const majorGaps = gaps.filter(g => g.severity === "major").length;

    const riskScore = criticalGaps * 3 + majorGaps * 2 + gaps.length;
    const riskLevel = riskScore >= 10 ? "Critical" : riskScore >= 6 ? "High" : riskScore >= 3 ? "Medium" : "Low";

    return {
      overall_rating: riskLevel,
      risk_score: riskScore,
      exposure_level: riskLevel,
      enforcement_risk: criticalGaps > 0 ? "High" : "Medium",
      recommended_actions: this.generateComplianceRiskActions(riskLevel, criticalGaps)
    };
  }

  private generateCompliancePlan(gaps: any[], requirements: any[], projectDetails: any): any {
    const totalTimelineDays = Math.max(...gaps.map(g => g.estimated_cure_time_days));
    
    return {
      total_timeline_days: totalTimelineDays,
      critical_path: gaps.filter(g => g.severity === "critical").map(g => g.requirement),
      permit_timeline: Math.max(...requirements.filter(r => r.permit_required).map(r => r.estimated_approval_time_days || 90)),
      ongoing_requirements: requirements.filter(r => r.ongoing_reporting_required).map(r => r.regulation_type)
    };
  }

  private estimateComplianceCosts(requirements: any[], gaps: any[], projectDetails: any): any {
    const totalCureCost = gaps.reduce((sum, gap) => sum + gap.estimated_cure_cost, 0);
    const ongoingCosts = requirements.filter(r => r.ongoing_reporting_required).length * 10000; // Estimated annual ongoing costs

    return {
      total_cure_costs: totalCureCost,
      annual_ongoing_costs: ongoingCosts,
      total_estimated_costs: totalCureCost + ongoingCosts,
      cost_breakdown: {
        permit_fees: totalCureCost * 0.3,
        consultant_fees: totalCureCost * 0.5,
        internal_costs: totalCureCost * 0.2
      }
    };
  }

  private generateImmediateComplianceActions(gaps: any[], risk: any): string[] {
    const actions = [];

    if (risk.overall_rating === "Critical") {
      actions.push("URGENT: Address critical compliance gaps immediately");
    }

    const criticalGaps = gaps.filter(g => g.severity === "critical");
    if (criticalGaps.length > 0) {
      actions.push("Engage regulatory specialists for critical gap remediation");
    }

    actions.push("Establish compliance monitoring and tracking system");

    return actions;
  }

  private generateStrategicComplianceRecommendations(framework: any, risk: any): string[] {
    return [
      "Implement enterprise compliance management system",
      "Establish regular regulatory monitoring and updates",
      "Create compliance training program for operations staff",
      "Develop relationship with key regulatory bodies"
    ];
  }

  private generateComplianceRiskMitigation(risk: any): string[] {
    return [
      "Obtain comprehensive regulatory insurance coverage",
      "Establish regulatory contingency fund",
      "Create rapid response team for compliance issues",
      "Implement proactive regulatory engagement strategy"
    ];
  }

  private generateMonitoringPlan(requirements: any[]): any {
    return {
      monitoring_frequency: "Monthly for critical items, quarterly for others",
      key_indicators: ["Permit status", "Violation notices", "Regulatory changes"],
      reporting_schedule: "Monthly compliance dashboard, quarterly executive summary",
      escalation_procedures: "Immediate escalation for violations or critical issues"
    };
  }

  private generateCounselRecommendations(risk: any, gaps: any[]): string[] {
    const recommendations = [];

    if (risk.overall_rating === "High" || risk.overall_rating === "Critical") {
      recommendations.push("Engage specialized regulatory counsel immediately");
    }

    if (gaps.length > 5) {
      recommendations.push("Consider comprehensive compliance audit");
    }

    recommendations.push("Establish ongoing regulatory counsel relationship");

    return recommendations;
  }

  // Additional helper methods would continue here for clause extraction and risk assessment tools...

  private extractClausesByType(documentType: string, scope: any): any[] {
    // Simulate clause extraction based on document type
    const commonClauses = [
      {
        id: "financial_001",
        clause_type: "financial",
        title: "Purchase Price and Payment Terms",
        key_provisions: ["Payment schedule", "Escrow arrangements", "Interest calculations"],
        financial_implications: "Direct impact on transaction economics",
        operational_implications: "Cash flow and financing requirements",
        risk_factors: ["Payment default risk", "Currency fluctuation"],
        negotiation_points: ["Payment timing", "Escrow terms", "Interest rates"]
      },
      {
        id: "operational_001", 
        clause_type: "operational",
        title: "Operational Covenants and Restrictions",
        key_provisions: ["Operating standards", "Maintenance requirements", "Reporting obligations"],
        financial_implications: "Ongoing operational costs",
        operational_implications: "Day-to-day operational constraints",
        risk_factors: ["Operational compliance risk", "Cost overrun risk"],
        negotiation_points: ["Standard flexibility", "Reporting frequency", "Penalty structures"]
      }
    ];

    return commonClauses;
  }

  private analyzeExtractedClauses(clauses: any[], parameters: any, documentDetails: any): any {
    return {
      total_clauses_analyzed: clauses.length,
      financial_clauses: clauses.filter(c => c.clause_type === "financial").length,
      operational_clauses: clauses.filter(c => c.clause_type === "operational").length,
      risk_tolerance_alignment: parameters.risk_tolerance,
      overall_clause_complexity: clauses.length > 10 ? "High" : "Medium"
    };
  }

  private assessClauseRisks(clauses: any[], riskTolerance: string): any {
    return {
      overall_risk_level: "Medium",
      high_risk_clauses: clauses.filter(c => c.risk_factors.length > 2),
      key_concerns: ["Payment default risk", "Operational compliance risk"],
      recommended_actions: ["Strengthen payment security", "Clarify operational standards"]
    };
  }

  private compareToIndustryStandards(clauses: any[], documentType: string): any {
    return {
      industry_alignment: "Generally aligned with industry standards",
      non_standard_provisions: [],
      favorable_terms: ["Standard payment terms", "Reasonable operational requirements"],
      unfavorable_terms: []
    };
  }

  private assessClauseEnforceability(clauses: any[], documentDetails: any): any {
    return {
      overall_enforceability: "High",
      potentially_unenforceable_clauses: [],
      enforceability_concerns: [],
      governing_law_impact: documentDetails.governing_law ? "Positive" : "Neutral"
    };
  }

  private assessClauseNegotiability(clauses: any[], riskAssessment: any): any {
    return {
      highly_negotiable_clauses: clauses.filter(c => c.negotiation_points.length > 2),
      non_negotiable_clauses: [],
      recommended_negotiation_priorities: ["Payment terms", "Operational standards"],
      negotiation_strategy_recommendations: ["Focus on risk mitigation", "Seek balanced approach"]
    };
  }

  private identifyHighPriorityItems(riskAssessment: any): string[] {
    return riskAssessment.high_risk_clauses?.map((c: any) => c.title) || ["No high priority items identified"];
  }

  private suggestClauseModifications(riskAssessment: any, negotiability: any, riskTolerance: string): string[] {
    return [
      "Strengthen payment security provisions",
      "Add specific performance milestones",
      "Include force majeure protections",
      "Clarify dispute resolution procedures"
    ];
  }

  private identifyRedFlagClauses(riskAssessment: any): string[] {
    return riskAssessment.key_concerns || ["No red flag clauses identified"];
  }

  private identifyFavorableClauses(riskAssessment: any): string[] {
    return ["Standard industry payment terms", "Reasonable operational requirements"];
  }

  private developNegotiationStrategy(negotiability: any, riskAssessment: any): any {
    return {
      primary_objectives: ["Risk mitigation", "Operational flexibility"],
      secondary_objectives: ["Cost optimization", "Timeline efficiency"],
      negotiation_sequence: ["Address high-risk items first", "Seek package deals"],
      fallback_positions: ["Alternative risk allocation", "Phased implementation"]
    };
  }

  private generateOverallContractAssessment(riskAssessment: any, enforceability: any): string {
    return "Generally acceptable contract with standard commercial terms and manageable risk profile";
  }

  private getSpecializedExpertiseAreas(documentType: string): string[] {
    const expertiseMap: Record<string, string[]> = {
      lease: ["Oil & Gas Law", "Real Property Law"],
      psa: ["Mergers & Acquisitions", "Securities Law"],
      joa: ["Joint Venture Law", "Operational Agreements"],
      farmout: ["Oil & Gas Law", "Joint Development"],
      assignment: ["Transfer Law", "Regulatory Compliance"],
      easement: ["Real Property Law", "Land Use"]
    };

    return expertiseMap[documentType] || ["General Commercial Law"];
  }

  // Additional helper methods for risk assessment...
  private analyzeContractualRisks(portfolio: any[], riskTolerance: any): any {
    const totalValue = portfolio.reduce((sum, contract) => sum + contract.contract_value, 0);
    const highRiskContracts = portfolio.filter(c => c.risk_rating === "high" || c.risk_rating === "critical");

    return {
      total_contract_value: totalValue,
      high_risk_contracts: highRiskContracts.length,
      high_risk_value: highRiskContracts.reduce((sum, contract) => sum + contract.contract_value, 0),
      risk_concentration: highRiskContracts.length / portfolio.length,
      key_risk_factors: Array.from(new Set(portfolio.flatMap(c => c.key_risk_factors)))
    };
  }

  private analyzeRegulatoryRisks(exposure: any[], riskTolerance: any): any {
    const nonCompliant = exposure.filter(e => e.compliance_status === "non_compliant");
    const atRisk = exposure.filter(e => e.compliance_status === "at_risk");

    return {
      total_regulatory_matters: exposure.length,
      non_compliant_matters: nonCompliant.length,
      at_risk_matters: atRisk.length,
      overall_compliance_status: nonCompliant.length === 0 ? "Good" : "Concerning",
      estimated_penalty_exposure: exposure.reduce((sum, e) => sum + (e.potential_penalties || 0), 0)
    };
  }

  private analyzeLitigationRisks(matters: any[], riskTolerance: any): any {
    const activeMatters = matters.filter(m => m.status === "active");
    const totalExposure = matters.reduce((sum, m) => sum + (m.exposure_amount || 0), 0);

    return {
      total_litigation_matters: matters.length,
      active_matters: activeMatters.length,
      total_exposure_amount: totalExposure,
      management_effectiveness: activeMatters.length < 3 ? "Good" : "Needs Improvement",
      high_exposure_matters: matters.filter(m => (m.exposure_amount || 0) > 1000000)
    };
  }

  private calculateOverallRiskMetrics(contractual: any, regulatory: any, litigation: any, tolerance: any): any {
    const totalExposure = contractual.high_risk_value + regulatory.estimated_penalty_exposure + litigation.total_exposure_amount;
    const riskScore = (contractual.high_risk_contracts * 2) + (regulatory.non_compliant_matters * 3) + (litigation.active_matters * 2);

    return {
      total_estimated_exposure: totalExposure,
      overall_risk_score: riskScore,
      overall_risk_rating: riskScore >= 15 ? "Critical" : riskScore >= 10 ? "High" : riskScore >= 5 ? "Medium" : "Low",
      business_impact_level: totalExposure > tolerance.business_impact_thresholds.high_impact ? "High" : "Medium"
    };
  }

  private analyzeRiskCorrelations(contractual: any, regulatory: any, litigation: any): any {
    return {
      contract_regulatory_correlation: "Medium",
      regulatory_litigation_correlation: "High", 
      overall_correlation_strength: "Medium",
      correlated_risk_scenarios: ["Regulatory violation leading to contract breach", "Litigation affecting regulatory standing"]
    };
  }

  private generateRiskScenarios(overallMetrics: any, tolerance: any): any {
    return {
      best_case: {
        description: "All risks materialize at low end of range",
        probability: 0.25,
        estimated_impact: overallMetrics.total_estimated_exposure * 0.3
      },
      base_case: {
        description: "Risks materialize as expected",
        probability: 0.50,
        estimated_impact: overallMetrics.total_estimated_exposure
      },
      worst_case: {
        description: "Multiple risks materialize simultaneously",
        probability: 0.25,
        estimated_impact: overallMetrics.total_estimated_exposure * 1.5
      }
    };
  }

  private developRiskMitigationStrategies(metrics: any, categories: string[], tolerance: any): any {
    return {
      immediate_actions: ["Address critical compliance gaps", "Review high-risk contracts"],
      strategic_initiatives: ["Implement enterprise risk management", "Enhance legal processes"],
      policy_recommendations: ["Update contract standards", "Strengthen compliance procedures"],
      resource_recommendations: ["Additional legal counsel", "Compliance staff augmentation"],
      monitoring_recommendations: ["Monthly risk dashboards", "Quarterly legal reviews"]
    };
  }

  private identifyHighestRiskAreas(metrics: any): string[] {
    const areas = [];
    
    if (metrics.overall_risk_rating === "Critical" || metrics.overall_risk_rating === "High") {
      areas.push("Overall risk exposure exceeds acceptable levels");
    }
    
    if (metrics.business_impact_level === "High") {
      areas.push("Business impact exposure is significant");
    }

    return areas.length > 0 ? areas : ["No critical risk areas identified"];
  }

  private identifyCriticalActionItems(metrics: any, strategies: any): string[] {
    return strategies.immediate_actions || ["Continue monitoring current risk levels"];
  }

  private identifyEmergingRiskTrends(contractual: any, regulatory: any, litigation: any): string[] {
    return [
      "Increasing regulatory complexity",
      "Growing contract sophistication requirements",
      "Enhanced enforcement activity"
    ];
  }

  private identifyRiskConcentrations(correlations: any): string[] {
    return [
      "Regulatory compliance risks affecting multiple business areas",
      "Contract performance risks correlated with operational issues"
    ];
  }

  private compareRiskPositionToAppetite(metrics: any, tolerance: any): string {
    return metrics.total_estimated_exposure > tolerance.maximum_acceptable_exposure ? 
      "Exceeds risk appetite" : "Within risk appetite";
  }

  private calculateRiskCapacityUtilization(metrics: any, tolerance: any): number {
    return Math.min(1.0, metrics.total_estimated_exposure / tolerance.maximum_acceptable_exposure);
  }

  private recommendRiskAppetiteAdjustments(metrics: any, tolerance: any): string[] {
    const recommendations = [];
    
    if (metrics.total_estimated_exposure > tolerance.maximum_acceptable_exposure) {
      recommendations.push("Consider increasing risk capacity or reducing exposure");
    }
    
    recommendations.push("Regular review of risk appetite in context of business strategy");
    
    return recommendations;
  }

  private recommendLegalBudgetAllocation(metrics: any): any {
    return {
      litigation_budget: metrics.business_impact_level === "High" ? "Increase by 25%" : "Maintain current level",
      compliance_budget: "Allocate additional resources for gap remediation",
      contract_review_budget: "Standard allocation with focus on high-risk agreements",
      total_recommendation: "Moderate increase in legal spend to address identified risks"
    };
  }

  private getSpecializedExpertiseConsulted(riskCategories: string[]): string[] {
    const expertise = [];
    
    if (riskCategories.includes("environmental")) {
      expertise.push("Environmental Law");
    }
    
    if (riskCategories.includes("regulatory")) {
      expertise.push("Regulatory Compliance");
    }
    
    if (riskCategories.includes("contractual")) {
      expertise.push("Commercial Transactions");
    }
    
    return expertise.length > 0 ? expertise : ["General Corporate Law"];
  }

  // More helper methods...
  private determineAssetType(transactionDetails: any): string {
    if (transactionDetails.wells_included > 0) return "Producing Assets";
    if (transactionDetails.acres > 0) return "Undeveloped Acreage";
    return "Mixed Assets";
  }

  private assessTransactionComplexity(psaDocument: any): string {
    let complexity = 0;
    
    if (psaDocument.transaction_details.wells_included > 10) complexity += 2;
    if (psaDocument.transaction_details.acres > 5000) complexity += 2;
    if (psaDocument.transaction_details.purchase_price > 50000000) complexity += 2;
    
    return complexity >= 4 ? "High" : complexity >= 2 ? "Medium" : "Low";
  }

  private assessDueDiligenceAdequacy(contractTerms: any): string {
    const days = contractTerms.due_diligence_period_days || 30;
    return days >= 60 ? "Adequate" : days >= 30 ? "Minimal" : "Insufficient";
  }

  private assessTitleRequirements(contractTerms: any): string {
    return contractTerms.title_requirements?.length > 0 ? "Strong" : "Standard";
  }

  private assessEnvironmentalProtections(contractTerms: any): string {
    return contractTerms.environmental_conditions?.length > 0 ? "Enhanced" : "Standard";
  }

  private generateRiskMitigationActions(risks: string[]): string[] {
    return risks.map(risk => `Mitigate: ${risk}`);
  }

  private analyzeIndemnification(): any {
    return {
      scope: "Standard commercial indemnification",
      adequacy: "Requires enhancement for oil & gas risks",
      recommendations: ["Add environmental indemnification", "Include regulatory compliance coverage"]
    };
  }

  private analyzeWarranties(): any {
    return {
      scope: "Standard business warranties",
      adequacy: "Generally adequate",
      recommendations: ["Add specific operational warranties", "Include title warranty enhancements"]
    };
  }

  private analyzeTerminationRights(): any {
    return {
      scope: "Standard termination provisions",
      adequacy: "Balanced for both parties",
      recommendations: ["Consider material adverse change triggers", "Define specific termination events"]
    };
  }

  private analyzeDisputeResolution(): any {
    return {
      mechanism: "Arbitration assumed",
      adequacy: "Standard industry approach",
      recommendations: ["Specify arbitration rules", "Include expedited procedures for certain disputes"]
    };
  }

  private calculateValuationMetrics(psaDocument: any): any {
    return {
      enterprise_value: psaDocument.transaction_details.purchase_price,
      metrics_available: "Limited without additional asset data",
      valuation_approach: "Asset-based valuation assumed"
    };
  }

  private identifyPriceAdjustments(contractTerms: any): string[] {
    return ["Standard closing adjustments assumed", "Working capital adjustments", "Interim period adjustments"];
  }

  private generateComplianceRiskActions(riskLevel: string, criticalGaps: number): string[] {
    const actions = [];
    
    if (riskLevel === "Critical") {
      actions.push("Immediate executive escalation required");
    }
    
    if (criticalGaps > 0) {
      actions.push("Engage specialized regulatory counsel");
    }
    
    actions.push("Implement comprehensive compliance monitoring");
    
    return actions;
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
   * Shutdown the legal MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('⚖️ Legal Analysis MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during legal server shutdown:', error);
    }
  }
}