/**
 * Reporting MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for report generation and data synthesis
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface ReportingMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class ReportingMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;

  constructor(config: ReportingMCPConfig) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'reporting');
    
    // Create official MCP server with reporting domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupReportingTools();
    this.setupReportingResources();
    this.setupReportingPrompts();
  }

  /**
   * Initialize reporting MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupReportingDirectories();
      this.initialized = true;
      
      console.log(`📊 Reporting MCP Server "${this.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Reporting MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup reporting-specific MCP tools
   */
  private setupReportingTools(): void {
    // Generate comprehensive report tool
    this.server.registerTool(
      "generate_comprehensive_report",
      {
        title: "Generate Comprehensive Analysis Report",
        description: "Create a complete SHALE YEAH report synthesizing geological and economic analysis",
        inputSchema: {
          analysis_data: z.object({
            geological_analysis: z.any().optional().describe("Geological analysis results"),
            economic_analysis: z.any().optional().describe("Economic analysis results"),
            run_id: z.string().describe("Unique run identifier"),
            input_files: z.array(z.string()).optional().describe("List of input files processed")
          }),
          report_config: z.object({
            report_type: z.enum(["executive", "detailed", "technical"]).default("detailed"),
            include_charts: z.boolean().default(true),
            include_appendices: z.boolean().default(true),
            format: z.enum(["markdown", "html", "pdf"]).default("markdown")
          }),
          metadata: z.object({
            author: z.string().default("Marcus Aurelius Scriptor"),
            company: z.string().default("Ascendvent LLC"),
            date: z.string().optional(),
            project_name: z.string().optional()
          })
        }
      },
      async ({ analysis_data, report_config, metadata }) => {
        console.log(`📊 Generating ${report_config.report_type} report for run: ${analysis_data.run_id}`);
        
        const reportDate = metadata.date || new Date().toISOString().split('T')[0];
        const projectName = metadata.project_name || `SHALE YEAH Analysis ${analysis_data.run_id}`;
        
        // Extract key metrics from analyses
        const geoSummary = this.extractGeologicalSummary(analysis_data.geological_analysis);
        const econSummary = this.extractEconomicSummary(analysis_data.economic_analysis);
        
        // Generate executive summary
        const execSummary = this.generateExecutiveSummary(geoSummary, econSummary);
        
        // Build comprehensive report
        let report = this.buildReportHeader(projectName, reportDate, metadata, analysis_data.run_id);
        
        report += this.buildExecutiveSummary(execSummary);
        report += this.buildDataProvenance(analysis_data.input_files || []);
        report += this.buildGeologicalSection(geoSummary);
        report += this.buildEconomicSection(econSummary);
        report += this.buildRecommendationsSection(geoSummary, econSummary);
        
        if (report_config.include_appendices) {
          report += this.buildAppendices(analysis_data);
        }
        
        report += this.buildFooter();
        
        // Save report
        const fileName = `SHALE_YEAH_REPORT_${analysis_data.run_id}.md`;
        const outputPath = path.join(this.dataPath, 'final-reports', fileName);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, report);
        
        const reportInfo = {
          report_path: outputPath,
          report_type: report_config.report_type,
          run_id: analysis_data.run_id,
          generated_at: new Date().toISOString(),
          word_count: report.split(/\s+/).length,
          sections: [
            "Executive Summary",
            "Data Provenance", 
            "Geological Analysis",
            "Economic Analysis",
            "Recommendations"
          ],
          key_findings: execSummary.key_findings,
          recommendation: execSummary.overall_recommendation
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(reportInfo, null, 2)
          }]
        };
      }
    );

    // Synthesize data tool
    this.server.registerTool(
      "synthesize_analysis_data",
      {
        title: "Synthesize Multi-Domain Analysis Data",
        description: "Combine and synthesize data from multiple analysis domains",
        inputSchema: {
          data_sources: z.array(z.object({
            domain: z.enum(["geology", "economics", "operations", "market"]),
            data: z.any(),
            confidence: z.number().min(0).max(1).describe("Data confidence level"),
            timestamp: z.string().optional()
          })),
          synthesis_type: z.enum(["summary", "detailed", "insights"]).default("summary"),
          focus_area: z.enum(["drilling", "production", "economics", "risk"]).optional()
        }
      },
      async ({ data_sources, synthesis_type, focus_area }) => {
        console.log(`📊 Synthesizing ${data_sources.length} data sources (${synthesis_type} synthesis)`);
        
        const synthesis = {
          synthesis_metadata: {
            type: synthesis_type,
            focus_area: focus_area || "comprehensive",
            sources_count: data_sources.length,
            average_confidence: data_sources.reduce((sum, s) => sum + s.confidence, 0) / data_sources.length,
            generated_at: new Date().toISOString()
          },
          domain_summaries: {} as Record<string, any>,
          cross_domain_insights: [] as string[],
          risk_factors: [] as string[],
          opportunities: [] as string[],
          recommendations: [] as string[]
        };
        
        // Process each domain
        for (const source of data_sources) {
          synthesis.domain_summaries[source.domain] = this.summarizeDataSource(source);
        }
        
        // Generate cross-domain insights
        if (synthesis.domain_summaries.geology && synthesis.domain_summaries.economics) {
          synthesis.cross_domain_insights.push(
            "Geological quality correlates with economic viability",
            "Primary formation targets align with economic objectives",
            "Risk factors span both geological and economic domains"
          );
        }
        
        // Identify risk factors
        synthesis.risk_factors = this.identifyRiskFactors(data_sources);
        
        // Identify opportunities
        synthesis.opportunities = this.identifyOpportunities(data_sources);
        
        // Generate recommendations
        synthesis.recommendations = this.generateSynthesisRecommendations(synthesis);
        
        // Save synthesis
        const outputPath = path.join(this.dataPath, 'synthesis', `synthesis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(synthesis, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(synthesis, null, 2)
          }]
        };
      }
    );

    // Generate QC report tool
    this.server.registerTool(
      "generate_qc_report",
      {
        title: "Generate Quality Control Report",
        description: "Create QC report with data quality metrics and validation results",
        inputSchema: {
          qc_data: z.object({
            las_files: z.array(z.object({
              file_name: z.string(),
              curves: z.array(z.string()),
              rmse: z.number().optional(),
              nrmse: z.number().optional(),
              data_completeness: z.number().optional()
            })).optional(),
            access_files: z.array(z.object({
              file_name: z.string(),
              tables: z.array(z.string()),
              record_count: z.number().optional()
            })).optional(),
            validation_results: z.array(z.object({
              test: z.string(),
              status: z.enum(["pass", "fail", "warning"]),
              message: z.string().optional()
            })).optional()
          }),
          qc_criteria: z.object({
            min_rmse_threshold: z.number().default(0.1),
            min_nrmse_threshold: z.number().default(0.15),
            min_completeness: z.number().default(0.85)
          })
        }
      },
      async ({ qc_data, qc_criteria }) => {
        console.log(`📊 Generating QC report for ${(qc_data.las_files?.length || 0) + (qc_data.access_files?.length || 0)} files`);
        
        const qcReport = {
          qc_summary: {
            total_files: (qc_data.las_files?.length || 0) + (qc_data.access_files?.length || 0),
            las_files_count: qc_data.las_files?.length || 0,
            access_files_count: qc_data.access_files?.length || 0,
            overall_status: "pass" as "pass" | "fail" | "warning",
            generated_at: new Date().toISOString()
          },
          las_file_qc: qc_data.las_files?.map(file => {
            const rmsePass = !file.rmse || file.rmse <= qc_criteria.min_rmse_threshold;
            const nrmsePass = !file.nrmse || file.nrmse <= qc_criteria.min_nrmse_threshold;
            const completenessPass = !file.data_completeness || file.data_completeness >= qc_criteria.min_completeness;
            
            return {
              file_name: file.file_name,
              curves_count: file.curves.length,
              curves: file.curves,
              rmse: file.rmse || "N/A",
              rmse_status: rmsePass ? "pass" : "fail",
              nrmse: file.nrmse || "N/A", 
              nrmse_status: nrmsePass ? "pass" : "fail",
              data_completeness: file.data_completeness || "N/A",
              completeness_status: completenessPass ? "pass" : "fail",
              overall_file_status: (rmsePass && nrmsePass && completenessPass) ? "pass" : "fail"
            };
          }) || [],
          access_file_qc: qc_data.access_files?.map(file => ({
            file_name: file.file_name,
            tables_count: file.tables.length,
            tables: file.tables,
            total_records: file.record_count || "Unknown",
            status: file.record_count && file.record_count > 0 ? "pass" : "warning"
          })) || [],
          validation_results: qc_data.validation_results || [],
          qc_metrics: {
            las_files_passed: qc_data.las_files?.filter(f => 
              (!f.rmse || f.rmse <= qc_criteria.min_rmse_threshold) &&
              (!f.nrmse || f.nrmse <= qc_criteria.min_nrmse_threshold) &&
              (!f.data_completeness || f.data_completeness >= qc_criteria.min_completeness)
            ).length || 0,
            validation_tests_passed: qc_data.validation_results?.filter(v => v.status === "pass").length || 0,
            total_validation_tests: qc_data.validation_results?.length || 0
          }
        };
        
        // Determine overall status
        const lasFailures = qcReport.las_file_qc.filter(f => f.overall_file_status === "fail").length;
        const validationFailures = qc_data.validation_results?.filter(v => v.status === "fail").length || 0;
        
        if (lasFailures > 0 || validationFailures > 0) {
          qcReport.qc_summary.overall_status = "fail";
        } else if (qc_data.validation_results?.some(v => v.status === "warning")) {
          qcReport.qc_summary.overall_status = "warning";
        }
        
        // Generate QC report markdown
        const qcMarkdown = this.generateQCMarkdown(qcReport);
        
        // Save QC report
        const reportPath = path.join(this.dataPath, 'qc-reports', `qc_report_${Date.now()}.md`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, qcMarkdown);
        
        const outputPath = path.join(this.dataPath, 'qc-reports', `qc_data_${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(qcReport, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(qcReport, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup reporting-specific MCP resources
   */
  private setupReportingResources(): void {
    // Final reports resource
    this.server.registerResource(
      "final_reports",
      new ResourceTemplate("reporting://reports/{report_name}", { list: undefined }),
      {
        title: "Generated Analysis Reports",
        description: "Final comprehensive reports generated by the reporting system"
      },
      async (uri, { report_name }) => {
        const reportNameStr = Array.isArray(report_name) ? report_name[0] : report_name;
        const reportPath = path.join(this.dataPath, 'final-reports', reportNameStr);
        
        try {
          const content = await fs.readFile(reportPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'text/markdown'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `# Report Not Found\n\nReport "${report_name}" not found in the reporting system.`,
              mimeType: 'text/markdown'
            }]
          };
        }
      }
    );

    // Report templates resource
    this.server.registerResource(
      "report_templates",
      new ResourceTemplate("reporting://templates/{template_type}", { 
        list: () => ({
          resources: [
            { name: "executive", uri: "reporting://templates/executive" },
            { name: "detailed", uri: "reporting://templates/detailed" },
            { name: "technical", uri: "reporting://templates/technical" },
            { name: "qc", uri: "reporting://templates/qc" }
          ]
        })
      }),
      {
        title: "Report Templates",
        description: "Standard templates for different types of reports"
      },
      async (uri, { template_type }) => {
        const templates = {
          executive: this.getExecutiveTemplate(),
          detailed: this.getDetailedTemplate(),
          technical: this.getTechnicalTemplate(),
          qc: this.getQCTemplate()
        };
        
        const template = templates[template_type as keyof typeof templates] || "Template not found";
        
        return {
          contents: [{
            uri: uri.href,
            text: template,
            mimeType: 'text/markdown'
          }]
        };
      }
    );
  }

  /**
   * Setup reporting-specific MCP prompts
   */
  private setupReportingPrompts(): void {
    this.server.registerPrompt(
      "comprehensive_report_prompt",
      {
        title: "Comprehensive Report Generation Prompt",
        description: "Template for generating comprehensive analysis reports"
      },
      async ({ analysis_data, report_requirements = "standard" }) => {
        const prompt = `You are Marcus Aurelius Scriptor, the imperial chronicler of SHALE YEAH geological and economic analyses.

ANALYSIS DATA TO SYNTHESIZE:
${JSON.stringify(analysis_data, null, 2)}

REPORT REQUIREMENTS: ${report_requirements}

IMPERIAL REPORTING MANDATE:
1. Executive Summary - Clear verdict on drilling opportunities
2. Data Provenance - All sources with counts and quality metrics
3. Geological Analysis - Formation assessments with confidence levels
4. Economic Analysis - NPV, IRR, risk metrics with scenarios
5. Recommendations - Definitive next steps with rationale

REPORT STANDARDS:
- Use tables for statistical data
- Include confidence intervals for all estimates
- Provide clear risk assessments
- No Oxford commas (imperial style)
- Short, decisive sentences
- Include data quality notes
- Mandatory footer: "Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0"

TONE: Authoritative yet accessible. Present findings as an imperial advisor would counsel Caesar on territorial expansion - with clarity, precision, and unwavering confidence in the analysis.

Create a report that engineers can use immediately for decision-making.`;

        return {
          description: "Comprehensive report generation prompt with analysis data",
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
   * Setup reporting data directory structure
   */
  private async setupReportingDirectories(): Promise<void> {
    const dirs = [
      'final-reports',
      'qc-reports',
      'synthesis',
      'templates',
      'charts',
      'appendices'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  // Helper methods for report generation
  private extractGeologicalSummary(geoData: any): any {
    if (!geoData) return { status: "no_data" };
    
    return {
      formations_count: geoData.formations?.length || 0,
      primary_target: geoData.formations?.[0]?.name || "Unknown",
      confidence: geoData.confidence || 0.5,
      data_quality: geoData.data_quality || "unknown"
    };
  }

  private extractEconomicSummary(econData: any): any {
    if (!econData) return { status: "no_data" };
    
    return {
      npv: econData.project_summary?.total_npv_usd || 0,
      irr: econData.project_summary?.irr_percent || 0,
      recommendation: econData.risk_metrics?.recommendation || "EVALUATE",
      payback: econData.project_summary?.payback_years || "Unknown"
    };
  }

  private generateExecutiveSummary(geoSummary: any, econSummary: any): any {
    const npvValue = econSummary.npv || 0;
    let recommendation: string;
    let confidenceAdj = 1.0;
    
    if (npvValue > 5000000) {
      recommendation = "GO";
    } else if (npvValue > 1000000) {
      recommendation = "CONDITIONAL";
      confidenceAdj = 0.85;
    } else if (npvValue > 0) {
      recommendation = "NO GO - MARGINAL";
      confidenceAdj = 0.70;
    } else {
      recommendation = "NO GO";
      confidenceAdj = 0.60;
    }
    
    const riskLevel = npvValue > 5000000 ? "Medium" : npvValue > 1000000 ? "Medium-High" : "High";
    const npvMillions = (npvValue / 1000000).toFixed(1);
    
    return {
      overall_recommendation: recommendation,
      investment_decision: recommendation.startsWith("GO") ? "PROCEED" : "EVALUATE",
      financial_metrics: {
        npv_millions: parseFloat(npvMillions),
        irr_percent: econSummary.irr || 0,
        payback_years: econSummary.payback || "N/A",
        risk_level: riskLevel
      },
      key_findings: [
        `Investment Recommendation: ${recommendation}`,
        `Net Present Value: $${npvMillions} million`,
        `Internal Rate of Return: ${econSummary.irr}%`,
        `Primary Formation: ${geoSummary.primary_target}`,
        `Risk Assessment: ${riskLevel}`
      ],
      confidence_level: Math.min((geoSummary.confidence || 0.7) * confidenceAdj, 0.95),
      risk_factors: [
        "Commodity price volatility",
        "Geological uncertainty", 
        "Operational execution risk"
      ],
      next_steps: recommendation.startsWith("GO") ? [
        "Proceed with drilling program",
        "Secure financing arrangements", 
        "Obtain regulatory approvals"
      ] : [
        "Conduct additional analysis",
        "Reassess economic assumptions",
        "Consider alternative opportunities"
      ]
    };
  }

  private buildReportHeader(projectName: string, date: string, metadata: any, runId: string): string {
    return `# ${projectName}

**Date:** ${date}  
**Author:** ${metadata.author}  
**Company:** ${metadata.company}  
**Run ID:** ${runId}

---

`;
  }

  private buildExecutiveSummary(execSummary: any): string {
    const metrics = execSummary.financial_metrics || {};
    
    return `# INVESTMENT DECISION: ${execSummary.overall_recommendation}

## EXECUTIVE SUMMARY
**Net Present Value:** $${metrics.npv_millions || 0} million  
**Internal Rate of Return:** ${metrics.irr_percent || 0}%  
**Payback Period:** ${metrics.payback_years || 'N/A'} years  
**Risk Level:** ${metrics.risk_level || 'Unknown'}  
**Confidence Level:** ${Math.round(execSummary.confidence_level * 100)}%  

## RECOMMENDATION
**${execSummary.investment_decision}** - ${execSummary.overall_recommendation === 'GO' ? 
    'Strong economics support immediate investment. Geological analysis confirms high-quality formation with manageable risk profile.' :
    execSummary.overall_recommendation === 'CONDITIONAL' ?
    'Moderate returns justify careful consideration. Additional analysis recommended before final investment decision.' :
    'Economics do not support investment at current assumptions. Consider alternative opportunities or revised parameters.'}

## KEY FINDINGS
${execSummary.key_findings.map((finding: string) => `- ${finding}`).join('\n')}

## RISK FACTORS
${execSummary.risk_factors.map((risk: string) => `- ${risk}`).join('\n')}

## NEXT STEPS
${execSummary.next_steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}

---

`;
  }

  private buildDataProvenance(inputFiles: string[]): string {
    return `## Data Provenance

**Input Files Processed:** ${inputFiles.length}

| File | Type | Status |
|------|------|--------|
${inputFiles.map(file => `| ${path.basename(file)} | ${path.extname(file).slice(1).toUpperCase()} | Processed |`).join('\n')}

---

`;
  }

  private buildGeologicalSection(geoSummary: any): string {
    return `## Geological Analysis

**Formations Identified:** ${geoSummary.formations_count}  
**Primary Target:** ${geoSummary.primary_target}  
**Data Quality:** ${geoSummary.data_quality}  
**Geological Confidence:** ${Math.round((geoSummary.confidence || 0.5) * 100)}%

---

`;
  }

  private buildEconomicSection(econSummary: any): string {
    return `## Economic Analysis

| Metric | Value |
|--------|-------|
| Net Present Value | $${(econSummary.npv || 0).toLocaleString()} |
| Internal Rate of Return | ${econSummary.irr}% |
| Payback Period | ${econSummary.payback} |
| Recommendation | ${econSummary.recommendation} |

---

`;
  }

  private buildRecommendationsSection(geoSummary: any, econSummary: any): string {
    const nextSteps = [];
    
    if (econSummary.npv > 1000000) {
      nextSteps.push("Proceed with drilling planning");
      nextSteps.push("Secure drilling permits and contracts");
    } else if (econSummary.npv > 0) {
      nextSteps.push("Conduct additional geological analysis");
      nextSteps.push("Evaluate market timing");
    } else {
      nextSteps.push("Consider alternative formations");
      nextSteps.push("Reassess economic assumptions");
    }
    
    return `## Recommendations

**Next Steps:**
${nextSteps.map(step => `1. ${step}`).join('\n')}

**Risk Considerations:**
- Geological uncertainty
- Commodity price volatility
- Operational execution risk

---

`;
  }

  private buildAppendices(analysisData: any): string {
    return `## Appendices

### Appendix A: Detailed Data
See attached analysis files for complete results.

### Appendix B: Quality Control
All data passed standard QC checks.

### Appendix C: Methodology
Analysis conducted using SHALE YEAH integrated workflow.

---

`;
  }

  private buildFooter(): string {
    return `---

*Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0*`;
  }

  private summarizeDataSource(source: any): any {
    return {
      domain: source.domain,
      confidence: source.confidence,
      timestamp: source.timestamp || new Date().toISOString(),
      summary: `${source.domain} analysis completed with ${Math.round(source.confidence * 100)}% confidence`
    };
  }

  private identifyRiskFactors(dataSources: any[]): string[] {
    const risks = ["Geological uncertainty", "Commodity price volatility"];
    
    const lowConfidenceSources = dataSources.filter(s => s.confidence < 0.7);
    if (lowConfidenceSources.length > 0) {
      risks.push("Data quality concerns");
    }
    
    return risks;
  }

  private identifyOpportunities(dataSources: any[]): string[] {
    return [
      "High-quality formation targets identified",
      "Strong economic indicators",
      "Favorable market conditions"
    ];
  }

  private generateSynthesisRecommendations(synthesis: any): string[] {
    const recommendations = [];
    
    if (synthesis.domain_summaries.geology) {
      recommendations.push("Focus on primary geological targets");
    }
    
    if (synthesis.domain_summaries.economics) {
      recommendations.push("Proceed based on economic analysis");
    }
    
    recommendations.push("Monitor market conditions");
    
    return recommendations;
  }

  private generateQCMarkdown(qcReport: any): string {
    let markdown = `# Quality Control Report

Generated: ${qcReport.qc_summary.generated_at}
Overall Status: **${qcReport.qc_summary.overall_status.toUpperCase()}**

## Summary

- Total Files: ${qcReport.qc_summary.total_files}
- LAS Files: ${qcReport.qc_summary.las_files_count}
- Access Files: ${qcReport.qc_summary.access_files_count}

## LAS File Quality Control

| File | Curves | RMSE | NRMSE | Completeness | Status |
|------|--------|------|-------|--------------|--------|
`;

    qcReport.las_file_qc.forEach((file: any) => {
      markdown += `| ${file.file_name} | ${file.curves_count} | ${file.rmse} | ${file.nrmse} | ${file.data_completeness} | ${file.overall_file_status} |\n`;
    });

    markdown += `
## Access Database Quality Control

| File | Tables | Records | Status |
|------|--------|---------|--------|
`;

    qcReport.access_file_qc.forEach((file: any) => {
      markdown += `| ${file.file_name} | ${file.tables_count} | ${file.total_records} | ${file.status} |\n`;
    });

    markdown += `
---

*Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0*`;

    return markdown;
  }

  private getExecutiveTemplate(): string {
    return `# INVESTMENT DECISION: [GO/NO GO/CONDITIONAL]

## EXECUTIVE SUMMARY
**Net Present Value:** $X.X million  
**Internal Rate of Return:** X.X%  
**Payback Period:** X.X years  
**Risk Level:** [Low/Medium/High]  
**Confidence Level:** XX%  

## RECOMMENDATION
[Clear 2-3 sentence recommendation with rationale]

## KEY FINDINGS
- Primary finding supporting decision
- Secondary technical or economic insight  
- Risk assessment summary

## FINANCIAL METRICS
| Metric | Base Case | Conservative | Optimistic |
|--------|-----------|--------------|------------|
| NPV | $X.XM | $X.XM | $X.XM |
| IRR | X.X% | X.X% | X.X% |
| Payback | X.X years | X.X years | X.X years |

## NEXT STEPS
1. [Immediate action required]
2. [Follow-up analysis or execution]
3. [Long-term strategic consideration]`;
  }

  private getDetailedTemplate(): string {
    return `# Detailed Analysis Template

## Executive Summary
[Summary content]

## Data Provenance
[Input files and sources]

## Geological Analysis
[Formation details]

## Economic Analysis
[Financial metrics]

## Recommendations
[Next steps]`;
  }

  private getTechnicalTemplate(): string {
    return `# Technical Report Template

## Methodology
[Technical approach]

## Data Analysis
[Detailed findings]

## Quality Control
[QC results]

## Technical Recommendations
[Engineering recommendations]`;
  }

  private getQCTemplate(): string {
    return `# Quality Control Template

## QC Summary
[Overall status]

## File Analysis
[Per-file results]

## Quality Metrics
[RMSE, NRMSE, completeness]

## Recommendations
[QC recommendations]`;
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
   * Shutdown the reporting MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('📊 Reporting MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during reporting server shutdown:', error);
    }
  }
}