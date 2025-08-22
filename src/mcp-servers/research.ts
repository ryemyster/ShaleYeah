/**
 * Research-Intelligence MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for web research, competitive intelligence, and market data analysis
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface ResearchMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class ResearchMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: ResearchMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'research');

    // Create official MCP server with research domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupResearchTools();
    this.setupResearchResources();
    this.setupResearchPrompts();
  }

  /**
   * Initialize research MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupResearchDirectories();
      this.initialized = true;

      console.log(`🔍 Research MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Research MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup research-specific MCP tools
   */
  private setupResearchTools(): void {
    // Fetch web content tool for research and competitive intelligence
    this.server.registerTool(
      "fetch_web_content",
      {
        title: "Fetch Web Content for Research",
        description: "Web scraping and content extraction for competitive intelligence and market research",
        inputSchema: {
          url: z.string().url().describe("Target URL for content extraction"),
          content_type: z.enum(["article", "product_page", "press_release", "financial_report", "regulatory_filing"]).default("article"),
          extraction_scope: z.object({
            include_text: z.boolean().default(true),
            include_links: z.boolean().default(false),
            include_images: z.boolean().default(false),
            include_tables: z.boolean().default(true)
          }).optional(),
          competitive_focus: z.array(z.string()).optional().describe("Specific companies or products to focus on")
        }
      },
      async ({ url, content_type, extraction_scope = {}, competitive_focus }) => {
        console.log(`🔍 Fetching web content: ${url} (${content_type})`);

        // Simulate web content extraction (would use actual scraping in production)
        const urlHash = Buffer.from(url).toString('base64').slice(0, 8);
        const mockContent = {
          url,
          content_type,
          title: content_type === "financial_report" ? "Q4 2024 Energy Sector Analysis" : 
                 content_type === "press_release" ? "Major Oil & Gas Discovery Announced" :
                 "Industry Market Intelligence Report",
          extracted_text: this.generateMockContent(content_type, competitive_focus),
          metadata: {
            extraction_date: new Date().toISOString(),
            content_length: 2847,
            language: "en",
            reliability_score: 0.85,
            key_topics: content_type === "financial_report" ? ["financial_performance", "market_outlook", "capex_guidance"] :
                       content_type === "press_release" ? ["discovery", "reserves", "development_plans"] :
                       ["market_trends", "competitive_analysis", "regulatory_updates"]
          },
          competitive_insights: competitive_focus ? {
            mentioned_companies: competitive_focus.slice(0, 3),
            market_positioning: "Strong competitive position in Permian Basin",
            key_differentiators: ["Technology leadership", "Cost efficiency", "Environmental compliance"]
          } : undefined,
          regulatory_mentions: content_type === "regulatory_filing" ? [
            { agency: "EPA", topic: "Environmental compliance", impact: "moderate" },
            { agency: "BLM", topic: "Leasing regulations", impact: "high" }
          ] : []
        };

        // Save extracted content to research data directory
        const outputPath = path.join(this.dataPath, 'web-content', `${urlHash}_${content_type}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(mockContent, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(mockContent, null, 2)
          }]
        };
      }
    );

    // Analyze market data tool
    this.server.registerTool(
      "analyze_market_data",
      {
        title: "Analyze Market Data and Trends",
        description: "Market intelligence and trend analysis for oil & gas sector",
        inputSchema: {
          analysis_scope: z.object({
            geographic_focus: z.array(z.string()).describe("Geographic regions of interest"),
            commodity_focus: z.array(z.enum(["crude_oil", "natural_gas", "ngl", "refined_products"])),
            time_horizon: z.enum(["short_term", "medium_term", "long_term"]).default("medium_term"),
            analysis_depth: z.enum(["overview", "detailed", "comprehensive"]).default("detailed")
          }),
          data_sources: z.array(z.string()).optional().describe("Specific data sources to analyze"),
          comparative_analysis: z.object({
            baseline_period: z.string().optional().describe("Baseline period for comparison"),
            peer_companies: z.array(z.string()).optional(),
            benchmark_metrics: z.array(z.string()).optional()
          }).optional()
        }
      },
      async ({ analysis_scope, data_sources, comparative_analysis }) => {
        console.log(`🔍 Analyzing market data for ${analysis_scope.commodity_focus.join(", ")} in ${analysis_scope.geographic_focus.join(", ")}`);

        const marketAnalysis = {
          analysis_metadata: {
            scope: analysis_scope,
            analysis_date: new Date().toISOString(),
            analyst: "Gaius Investigatus Maximus",
            confidence_level: 0.82,
            data_sources_count: data_sources?.length || 5
          },
          market_overview: {
            primary_trends: [
              "Increasing consolidation in upstream sector",
              "Technology-driven efficiency improvements",
              "ESG considerations impacting investment decisions"
            ],
            market_sentiment: "Cautiously optimistic",
            key_drivers: ["Commodity price stability", "Regulatory environment", "Capital allocation discipline"]
          },
          commodity_analysis: analysis_scope.commodity_focus.map(commodity => ({
            commodity,
            current_price_environment: "Moderate",
            price_trend: commodity === "crude_oil" ? "Stable with upward bias" : "Seasonal fluctuations",
            supply_demand_balance: "Balanced to slightly tight",
            key_price_drivers: commodity === "crude_oil" ? 
              ["OPEC+ policy", "U.S. production growth", "Global demand"] :
              ["Weather patterns", "LNG exports", "Storage levels"]
          })),
          regional_insights: analysis_scope.geographic_focus.map(region => ({
            region,
            activity_level: region.includes("Permian") ? "High" : "Moderate", 
            development_outlook: "Positive",
            regulatory_environment: "Stable",
            infrastructure_status: "Adequate",
            key_operators: region.includes("Permian") ? 
              ["ExxonMobil", "Chevron", "ConocoPhillips"] :
              ["Regional operators", "Private equity backed"]
          })),
          competitive_landscape: comparative_analysis?.peer_companies ? {
            peer_analysis: comparative_analysis.peer_companies.map(company => ({
              company,
              market_position: "Established player",
              competitive_advantages: ["Operational efficiency", "Technology capabilities"],
              strategic_focus: "Capital discipline and returns"
            })),
            market_concentration: "Moderately concentrated",
            barrier_to_entry: "High"
          } : undefined,
          investment_implications: {
            overall_attractiveness: "Moderate to High",
            key_opportunities: ["Technology adoption", "Operational optimization", "Strategic acquisitions"],
            primary_risks: ["Commodity price volatility", "Regulatory changes", "Environmental compliance"],
            recommended_focus_areas: ["Cost efficiency", "ESG compliance", "Technology integration"]
          }
        };

        // Save market analysis
        const outputPath = path.join(this.dataPath, 'market-analysis', `analysis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(marketAnalysis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(marketAnalysis, null, 2)
          }]
        };
      }
    );

    // Extract competitor information tool
    this.server.registerTool(
      "extract_competitor_info",
      {
        title: "Extract Competitor Information",
        description: "Competitive analysis and benchmarking for oil & gas companies",
        inputSchema: {
          target_companies: z.array(z.string()).describe("Companies to analyze"),
          analysis_categories: z.array(z.enum([
            "financial_performance", "operational_metrics", "strategic_initiatives", 
            "technology_adoption", "esg_initiatives", "market_positioning"
          ])),
          benchmark_metrics: z.array(z.string()).optional().describe("Specific metrics to benchmark"),
          regional_focus: z.array(z.string()).optional().describe("Geographic regions to focus on")
        }
      },
      async ({ target_companies, analysis_categories, benchmark_metrics, regional_focus }) => {
        console.log(`🔍 Extracting competitor information for ${target_companies.length} companies`);

        const competitorAnalysis = {
          analysis_metadata: {
            target_companies,
            analysis_categories,
            analysis_date: new Date().toISOString(),
            analyst: "Gaius Investigatus Maximus", 
            regional_focus,
            confidence_level: 0.87
          },
          company_profiles: target_companies.map(company => ({
            company_name: company,
            market_position: {
              tier: "Tier 1",
              market_cap_category: "Large Cap",
              geographic_presence: regional_focus || ["North America", "International"],
              primary_business_segments: ["Upstream", "Downstream", "Midstream"]
            },
            financial_highlights: analysis_categories.includes("financial_performance") ? {
              revenue_trend: "Growing",
              profitability: "Strong",
              debt_levels: "Moderate",
              capital_allocation: "Disciplined",
              dividend_policy: "Stable"
            } : undefined,
            operational_metrics: analysis_categories.includes("operational_metrics") ? {
              production_growth: "3-5% annually",
              cost_structure: "Competitive",
              drilling_efficiency: "Above average",
              recovery_factors: "Industry leading"
            } : undefined,
            strategic_initiatives: analysis_categories.includes("strategic_initiatives") ? [
              "Digital transformation",
              "Carbon reduction programs", 
              "Portfolio optimization",
              "Technology partnerships"
            ] : undefined,
            technology_focus: analysis_categories.includes("technology_adoption") ? {
              digitalization_level: "Advanced",
              automation_adoption: "High",
              data_analytics_capability: "Strong",
              innovation_partnerships: "Active"
            } : undefined,
            esg_profile: analysis_categories.includes("esg_initiatives") ? {
              environmental_initiatives: "Carbon neutral by 2050",
              social_programs: "Community investment",
              governance_structure: "Strong board oversight",
              sustainability_reporting: "Comprehensive"
            } : undefined
          })),
          comparative_analysis: {
            industry_positioning: target_companies.map(company => ({
              company,
              overall_ranking: Math.floor(Math.random() * target_companies.length) + 1,
              key_strengths: ["Operational excellence", "Financial discipline"],
              improvement_areas: ["ESG metrics", "Technology adoption"],
              competitive_differentiation: "Cost leadership and operational efficiency"
            })),
            benchmark_results: benchmark_metrics ? benchmark_metrics.map(metric => ({
              metric,
              industry_average: "Baseline",
              top_performer: target_companies[0],
              performance_spread: "15-20% range",
              trend_direction: "Improving"
            })) : undefined
          },
          strategic_insights: {
            market_trends_impact: "Companies focusing on efficiency and ESG are outperforming",
            consolidation_opportunities: "Selective M&A for scale and synergies",
            competitive_threats: "Technology disruption and energy transition",
            success_factors: ["Operational excellence", "Capital discipline", "ESG leadership"]
          }
        };

        // Save competitor analysis
        const outputPath = path.join(this.dataPath, 'competitor-analysis', `analysis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(competitorAnalysis, null, 2));

        return {
          content: [{
            type: "text", 
            text: JSON.stringify(competitorAnalysis, null, 2)
          }]
        };
      }
    );

    // Aggregate insights tool
    this.server.registerTool(
      "aggregate_insights",
      {
        title: "Aggregate Multi-Source Research Insights", 
        description: "Synthesize research from multiple sources into actionable intelligence",
        inputSchema: {
          data_sources: z.array(z.object({
            source_type: z.enum(["web_content", "market_data", "competitor_analysis", "regulatory_data"]),
            source_name: z.string(),
            weight: z.number().min(0).max(1).describe("Importance weight for this source"),
            confidence: z.number().min(0).max(1).describe("Confidence in this source")
          })),
          aggregation_focus: z.enum(["investment_decision", "strategic_planning", "competitive_positioning", "market_entry"]),
          synthesis_depth: z.enum(["summary", "detailed", "comprehensive"]).default("detailed")
        }
      },
      async ({ data_sources, aggregation_focus, synthesis_depth }) => {
        console.log(`🔍 Aggregating insights from ${data_sources.length} sources for ${aggregation_focus}`);

        const aggregatedInsights = {
          synthesis_metadata: {
            sources_analyzed: data_sources.length,
            aggregation_focus,
            synthesis_depth,
            synthesis_date: new Date().toISOString(),
            analyst: "Gaius Investigatus Maximus",
            overall_confidence: data_sources.reduce((sum, s) => sum + (s.confidence * s.weight), 0) / 
                               data_sources.reduce((sum, s) => sum + s.weight, 0)
          },
          executive_summary: {
            key_findings: [
              "Market fundamentals remain supportive for selective investment",
              "Technology adoption driving operational efficiency gains",
              "ESG considerations increasingly important for capital allocation"
            ],
            primary_recommendation: aggregation_focus === "investment_decision" ? "PROCEED with enhanced due diligence" :
                                  aggregation_focus === "strategic_planning" ? "Focus on operational excellence and ESG" :
                                  aggregation_focus === "competitive_positioning" ? "Emphasize technology and efficiency" :
                                  "Enter market through strategic partnerships",
            confidence_level: "High"
          },
          thematic_insights: {
            market_dynamics: {
              trend_direction: "Positive with selective opportunities",
              key_drivers: ["Technology advancement", "Regulatory stability", "ESG focus"],
              risk_factors: ["Commodity volatility", "Environmental regulations", "Capital availability"]
            },
            competitive_landscape: {
              market_structure: "Consolidating with focus on efficiency",
              competitive_intensity: "Moderate to High",
              differentiation_factors: ["Technology capabilities", "ESG performance", "Cost structure"]
            },
            regulatory_environment: {
              overall_stability: "Stable with evolving ESG requirements",
              compliance_complexity: "Moderate",
              future_outlook: "Increasing focus on environmental compliance"
            }
          },
          source_analysis: data_sources.map(source => ({
            source_name: source.source_name,
            source_type: source.source_type,
            key_contributions: source.source_type === "market_data" ? "Price trends and demand outlook" :
                             source.source_type === "competitor_analysis" ? "Competitive positioning insights" :
                             source.source_type === "web_content" ? "Industry news and developments" :
                             "Regulatory updates and compliance requirements",
            reliability_assessment: source.confidence > 0.8 ? "High" : source.confidence > 0.6 ? "Moderate" : "Low",
            weight_in_analysis: source.weight
          })),
          actionable_recommendations: {
            immediate_actions: [
              aggregation_focus === "investment_decision" ? "Conduct detailed financial analysis" : "Update strategic plan",
              "Engage with key stakeholders",
              "Monitor regulatory developments"
            ],
            medium_term_initiatives: [
              "Technology capability development", 
              "ESG program enhancement",
              "Operational efficiency improvements"
            ],
            strategic_considerations: [
              "Market timing for major investments",
              "Portfolio optimization opportunities", 
              "Partnership and collaboration potential"
            ]
          }
        };

        // Save aggregated insights
        const outputPath = path.join(this.dataPath, 'insights', `insights_${aggregation_focus}_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(aggregatedInsights, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(aggregatedInsights, null, 2)
          }]
        };
      }
    );

    // Search regulatory data tool
    this.server.registerTool(
      "search_regulatory_data",
      {
        title: "Search Regulatory Data and Permits",
        description: "Regulatory and permit information research for compliance and planning",
        inputSchema: {
          jurisdiction: z.object({
            federal_agencies: z.array(z.string()).optional(),
            state_jurisdictions: z.array(z.string()).optional(),
            local_authorities: z.array(z.string()).optional()
          }),
          search_criteria: z.object({
            permit_types: z.array(z.enum(["drilling", "environmental", "transportation", "facility", "operational"])),
            regulatory_topics: z.array(z.string()).optional(),
            effective_date_range: z.object({
              start_date: z.string().optional(),
              end_date: z.string().optional()
            }).optional()
          }),
          project_context: z.object({
            project_type: z.string().describe("Type of project requiring permits"),
            location_details: z.string().describe("Geographic location details"),
            scope_description: z.string().describe("Project scope and activities")
          }).optional()
        }
      },
      async ({ jurisdiction, search_criteria, project_context }) => {
        console.log(`🔍 Searching regulatory data for ${search_criteria.permit_types.join(", ")} permits`);

        const regulatoryData = {
          search_metadata: {
            jurisdiction,
            search_criteria,
            search_date: new Date().toISOString(),
            analyst: "Gaius Investigatus Maximus",
            results_confidence: 0.88
          },
          regulatory_framework: {
            applicable_agencies: [
              ...(jurisdiction.federal_agencies || ["EPA", "BLM", "FERC"]),
              ...(jurisdiction.state_jurisdictions || ["State Environmental Agency", "State Oil & Gas Commission"]),
              ...(jurisdiction.local_authorities || ["County Planning", "Local Environmental"])
            ],
            regulatory_complexity: "Moderate",
            coordination_requirements: "Multi-agency coordination required"
          },
          permit_requirements: search_criteria.permit_types.map(permitType => ({
            permit_type: permitType,
            issuing_authority: permitType === "drilling" ? "State Oil & Gas Commission" :
                             permitType === "environmental" ? "EPA/State Environmental Agency" :
                             permitType === "transportation" ? "DOT/State Transportation" :
                             permitType === "facility" ? "Local Planning Authority" :
                             "Multiple Agencies",
            typical_timeline: permitType === "drilling" ? "60-90 days" :
                            permitType === "environmental" ? "90-180 days" :
                            permitType === "transportation" ? "30-60 days" :
                            permitType === "facility" ? "120-180 days" :
                            "30-90 days",
            key_requirements: permitType === "drilling" ? 
              ["Well permit application", "Environmental assessment", "Bonding requirements"] :
              permitType === "environmental" ?
              ["Environmental impact assessment", "Air quality permits", "Water discharge permits"] :
              ["Transportation impact study", "Route approval", "Safety compliance"],
            compliance_monitoring: "Regular reporting and inspections required",
            renewal_requirements: permitType === "drilling" ? "Well completion reporting" : "Annual renewal typical"
          })),
          regulatory_updates: [
            {
              update_type: "New Regulation",
              issuing_agency: "EPA",
              effective_date: "2024-06-01",
              impact_assessment: "Moderate - additional reporting requirements",
              compliance_timeline: "6 months implementation period"
            },
            {
              update_type: "Policy Clarification", 
              issuing_agency: "State Oil & Gas Commission",
              effective_date: "2024-03-15",
              impact_assessment: "Low - clarifies existing requirements",
              compliance_timeline: "Immediate"
            }
          ],
          compliance_assessment: project_context ? {
            project_specific_requirements: [
              "Standard drilling permits required",
              "Environmental assessment necessary",
              "Local authority coordination needed"
            ],
            estimated_total_timeline: "120-180 days for full permitting",
            key_risk_factors: [
              "Environmental sensitivity of location",
              "Public consultation requirements",
              "Agency coordination complexity"
            ],
            recommended_approach: "Early engagement with all agencies and comprehensive application preparation"
          } : undefined,
          strategic_implications: {
            regulatory_risk_level: "Moderate",
            compliance_cost_estimate: "5-10% of project cost",
            timeline_impact: "Material - plan for 4-6 month permitting process",
            mitigation_strategies: [
              "Early permit application submission",
              "Proactive stakeholder engagement", 
              "Regulatory consultant engagement"
            ]
          }
        };

        // Save regulatory research
        const outputPath = path.join(this.dataPath, 'regulatory', `regulatory_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(regulatoryData, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(regulatoryData, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Generate mock content based on content type
   */
  private generateMockContent(contentType: string, competitiveFocus?: string[]): string {
    switch (contentType) {
      case "financial_report":
        return "Q4 2024 energy sector demonstrated resilient performance with upstream operators reporting strong cash flow generation. Capital allocation remained disciplined with focus on shareholder returns. Technology investments driving operational efficiency gains. ESG initiatives gaining prominence in strategic planning.";
      case "press_release":
        return "Major oil and gas discovery announced in Permian Basin with estimated reserves of 500 million BOE. Development planning underway with first production expected in Q2 2025. Project economics supported by current commodity price environment and operational efficiency improvements.";
      case "regulatory_filing":
        return "Environmental compliance update filed with EPA regarding air quality monitoring results. All measurements within regulatory limits. Ongoing investment in emission reduction technology demonstrates commitment to environmental stewardship. Regulatory framework remains stable with predictable compliance requirements.";
      default:
        return "Industry market intelligence indicates continued consolidation trend in upstream sector. Technology adoption driving efficiency gains. ESG considerations increasingly important for capital allocation decisions. Regulatory environment remains stable with focus on environmental compliance.";
    }
  }

  /**
   * Setup research-specific MCP resources
   */
  private setupResearchResources(): void {
    // Web content cache resource
    this.server.registerResource(
      "research_content",
      new ResourceTemplate("research://content/{url_hash}", { 
        list: () => ({
          resources: [
            { name: "cached_content", uri: "research://content/cached" },
            { name: "market_reports", uri: "research://content/market_reports" },
            { name: "competitor_profiles", uri: "research://content/competitor_profiles" }
          ]
        })
      }),
      {
        title: "Research Content Cache",
        description: "Cached web content and metadata for research analysis"
      },
      async (uri, { url_hash }) => {
        const contentPath = path.join(this.dataPath, 'web-content', `${url_hash}_*.json`);

        try {
          // In a real implementation, would search for matching files
          const defaultContent = {
            url_hash,
            title: "Cached Research Content",
            content_type: "market_analysis",
            cached_date: new Date().toISOString(),
            summary: "Market intelligence and competitive analysis data"
          };

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultContent, null, 2),
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `{"error": "Content not found for hash: ${url_hash}"}`,
              mimeType: 'application/json'
            }]
          };
        }
      }
    );

    // Research insights resource
    this.server.registerResource(
      "research_insights",
      new ResourceTemplate("research://insights/{topic}", { 
        list: () => ({
          resources: [
            { name: "market_insights", uri: "research://insights/market_trends" },
            { name: "competitive_insights", uri: "research://insights/competitive_analysis" },
            { name: "regulatory_insights", uri: "research://insights/regulatory_updates" }
          ]
        })
      }),
      {
        title: "Research Insights Database",
        description: "Aggregated research insights and analysis results"
      },
      async (uri, { topic }) => {
        const insightsPath = path.join(this.dataPath, 'insights', `insights_${topic}*.json`);

        try {
          // Return latest insights for the topic
          const defaultInsights = {
            topic,
            generated_date: new Date().toISOString(),
            key_insights: [
              "Market fundamentals remain supportive",
              "Technology adoption accelerating",
              "ESG considerations gaining importance"
            ],
            confidence_level: 0.85,
            analyst: "Gaius Investigatus Maximus"
          };

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultInsights, null, 2),
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `{"error": "Insights not found for topic: ${topic}"}`,
              mimeType: 'application/json'
            }]
          };
        }
      }
    );

    // Competitor intelligence resource
    this.server.registerResource(
      "competitor_intelligence",
      new ResourceTemplate("research://competitors/{region}", { 
        list: () => ({
          resources: [
            { name: "permian_competitors", uri: "research://competitors/permian" },
            { name: "bakken_competitors", uri: "research://competitors/bakken" },
            { name: "eagle_ford_competitors", uri: "research://competitors/eagle_ford" }
          ]
        })
      }),
      {
        title: "Competitor Intelligence Database",
        description: "Competitive analysis and benchmarking data by region"
      },
      async (uri, { region }) => {
        const competitorPath = path.join(this.dataPath, 'competitor-analysis', `${region}*.json`);

        try {
          const defaultCompetitorData = {
            region,
            analysis_date: new Date().toISOString(),
            key_players: [
              "ExxonMobil", "Chevron", "ConocoPhillips", "EOG Resources", "Pioneer Natural Resources"
            ],
            market_concentration: "Moderately concentrated",
            competitive_dynamics: "Technology and efficiency focused",
            analyst: "Gaius Investigatus Maximus"
          };

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultCompetitorData, null, 2),
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `{"error": "Competitor data not found for region: ${region}"}`,
              mimeType: 'application/json'
            }]
          };
        }
      }
    );
  }

  /**
   * Setup research-specific MCP prompts
   */
  private setupResearchPrompts(): void {
    this.server.registerPrompt(
      "research_analysis_prompt",
      {
        title: "Research Analysis Prompt",
        description: "Template for comprehensive research analysis and intelligence synthesis"
      },
      async ({ research_data, analysis_type = "competitive_intelligence" }) => {
        const prompt = `You are Gaius Investigatus Maximus, Supreme Research Commander of the Imperial Intelligence Legion.

RESEARCH DATA:
${JSON.stringify(research_data, null, 2)}

ANALYSIS TYPE: ${analysis_type}

MISSION BRIEFINGS:
1. Conduct thorough intelligence analysis of market dynamics and competitive landscape
2. Identify strategic opportunities and threats for the Imperial Energy Portfolio
3. Assess regulatory risks and compliance requirements
4. Synthesize multi-source intelligence into actionable strategic insights
5. Provide confidence assessments and data quality evaluations

INTELLIGENCE REPORT FORMAT:
- Executive Intelligence Summary (2-3 key findings)
- Market Dynamics Analysis (trends, drivers, risks)
- Competitive Landscape Assessment (positioning, threats, opportunities)
- Regulatory Environment Analysis (compliance, risks, changes)
- Strategic Intelligence Recommendations (actions, timing, resources)
- Data Quality and Confidence Assessment

Remember: Apply Roman military intelligence discipline to modern market research methodologies.`;

        return {
          description: "Research analysis prompt with intelligence data",
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
      "competitive_intelligence_prompt",
      {
        title: "Competitive Intelligence Prompt",
        description: "Template for competitor analysis and benchmarking"
      },
      async ({ competitor_data, focus_areas = [] }) => {
        const prompt = `You are Gaius Investigatus Maximus, conducting strategic competitor intelligence analysis.

COMPETITOR DATA:
${JSON.stringify(competitor_data, null, 2)}

INTELLIGENCE FOCUS AREAS: ${Array.isArray(focus_areas) ? focus_areas.join(", ") : focus_areas || "All competitive factors"}

COMPETITIVE INTELLIGENCE OBJECTIVES:
1. Analyze competitor strategic positioning and market share
2. Assess operational capabilities and technology adoption
3. Evaluate financial performance and capital allocation strategies
4. Identify competitive advantages and vulnerabilities
5. Benchmark performance metrics against industry standards
6. Assess threat levels and competitive responses

INTELLIGENCE DELIVERABLES:
- Competitor Strategic Profiles
- Competitive Positioning Analysis
- Performance Benchmarking Results
- Threat Assessment and Risk Analysis
- Strategic Response Recommendations
- Market Share and Positioning Intelligence

Apply imperial strategic analysis to modern competitive intelligence gathering.`;

        return {
          description: "Competitive intelligence prompt with competitor data",
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
   * Setup research data directory structure
   */
  private async setupResearchDirectories(): Promise<void> {
    const dirs = [
      'web-content',
      'market-analysis', 
      'competitor-analysis',
      'insights',
      'regulatory',
      'reports',
      'cache'
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
   * Shutdown the research MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('🔍 Research MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during research server shutdown:', error);
    }
  }
}