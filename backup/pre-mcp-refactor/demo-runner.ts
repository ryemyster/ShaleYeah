#!/usr/bin/env node
/**
 * SHALE YEAH Demo Runner - Working Demo with Realistic Mocks
 * 
 * This creates a working demonstration that shows:
 * - Complete oil & gas investment analysis workflow
 * - Professional-grade outputs and reports
 * - All 6 domain expert agents working together
 * - Realistic but mocked data (no API costs)
 * 
 * Perfect for presentations and demonstrations
 */

import fs from 'fs/promises';
import path from 'path';

interface DemoAnalysisInput {
  runId: string;
  outDir: string;
  tractName: string;
  mode: 'demo' | 'production';
}

interface AgentResult {
  agent: string;
  persona: string;
  analysis: any;
  confidence: number;
  executionTime: number;
  success: boolean;
}

class ShaleYeahDemo {
  private runId: string;
  private outDir: string;
  private tractName: string;
  private startTime: number;

  constructor(config: DemoAnalysisInput) {
    this.runId = config.runId;
    this.outDir = config.outDir;
    this.tractName = config.tractName;
    this.startTime = Date.now();
  }

  async runCompleteDemo(): Promise<void> {
    console.log('🛢️  SHALE YEAH - AI-Powered Oil & Gas Investment Analysis');
    console.log('=====================================');
    console.log(`📋 Analysis ID: ${this.runId}`);
    console.log(`🗺️  Target Tract: ${this.tractName}`);
    console.log(`📁 Output Directory: ${this.outDir}`);
    console.log('💡 Mode: DEMO (Using realistic mocks for presentation)\n');

    // Setup output directory
    await this.setupOutputDirectory();

    // Run all agent analyses
    const agents = [
      { name: 'geowiz', persona: 'Marcus Aurelius Geologicus', domain: 'Geological Analysis' },
      { name: 'curve-smith', persona: 'Lucius Technicus Engineer', domain: 'Reservoir Engineering' },
      { name: 'econobot', persona: 'Caesar Augustus Economicus', domain: 'Financial Analysis' },
      { name: 'riskranger', persona: 'Gaius Probabilis Assessor', domain: 'Risk Assessment' },
      { name: 'titlebot', persona: 'Legatus Titulus Tracker', domain: 'Title & Legal' },
      { name: 'reporter', persona: 'Scriptor Reporticus Maximus', domain: 'Executive Reporting' }
    ];

    const results: AgentResult[] = [];
    
    for (const agent of agents) {
      console.log(`\n🤖 Executing ${agent.persona} (${agent.domain})`);
      const result = await this.runAgentAnalysis(agent);
      results.push(result);
      
      console.log(`   ✅ ${agent.domain}: ${result.confidence}% confidence in ${result.executionTime}ms`);
    }

    // Generate final reports
    await this.generateExecutiveReport(results);
    await this.generateDetailedAnalysis(results);
    await this.generateFinancialModel(results);

    const totalTime = Date.now() - this.startTime;
    console.log(`\n🎯 SHALE YEAH Analysis Complete!`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`📊 Overall Recommendation: ${this.getInvestmentDecision(results)}`);
    console.log(`\n📄 Reports Generated:`);
    console.log(`   • Executive Summary: ${this.outDir}/INVESTMENT_DECISION.md`);
    console.log(`   • Detailed Analysis: ${this.outDir}/DETAILED_ANALYSIS.md`);
    console.log(`   • Financial Model: ${this.outDir}/FINANCIAL_MODEL.json`);
    console.log(`\n💡 This was a demonstration using realistic mock data.`);
    console.log(`   For production analysis, use --mode=production with real API keys.`);
  }

  private async setupOutputDirectory(): Promise<void> {
    await fs.mkdir(this.outDir, { recursive: true });
  }

  private async runAgentAnalysis(agent: any): Promise<AgentResult> {
    const startTime = Date.now();
    
    // Simulate analysis time (realistic but fast for demo)
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    const analysis = this.generateMockAnalysis(agent.name);
    const executionTime = Date.now() - startTime;
    
    return {
      agent: agent.name,
      persona: agent.persona,
      analysis,
      confidence: 75 + Math.floor(Math.random() * 20), // 75-95% confidence
      executionTime,
      success: true
    };
  }

  private generateMockAnalysis(agentType: string): any {
    const mockData: Record<string, any> = {
      geowiz: {
        formations: ['Wolfcamp A', 'Wolfcamp B', 'Bone Spring'],
        netPay: 180,
        porosity: 8.2,
        permeability: 0.0002,
        toc: 4.5,
        maturity: 'Peak Oil Window',
        targets: 3,
        drilling_recommendation: 'Proceed with 10,000ft laterals'
      },
      'curve-smith': {
        initial_rate_oil: 1200,
        initial_rate_gas: 2800,
        decline_rate: 0.068,
        eur_oil: 145000,
        eur_gas: 420000,
        type_curve: 'Tier 1 Wolfcamp',
        completion_recommendation: '30-stage completion with ceramic proppant'
      },
      econobot: {
        npv_10: 3.2,
        irr: 28.5,
        payback_months: 11,
        roi_multiple: 3.4,
        breakeven_oil: 52.80,
        capex_well: 8.5,
        dcf_analysis: 'Strong economics across price scenarios'
      },
      riskranger: {
        overall_risk: 'Medium',
        geological_risk: 'Low-Medium',
        operational_risk: 'Medium',
        commodity_risk: 'Medium-High',
        p10_npv: 1.8,
        p90_npv: 5.1,
        success_probability: 0.78
      },
      titlebot: {
        net_acres: 640,
        working_interest: 0.875,
        royalty_rate: 0.125,
        lease_status: 'Held by Production',
        title_issues: 'None identified',
        permits_status: 'APD approved'
      },
      reporter: {
        recommendation: 'PROCEED',
        executive_summary: 'High-quality Permian Basin opportunity with attractive economics',
        key_risks: ['Commodity price volatility', 'Operational execution'],
        next_steps: ['Finalize drilling contract', 'Secure takeaway capacity', 'Execute hedging strategy']
      }
    };

    return mockData[agentType] || { status: 'Analysis complete', data: 'Mock data' };
  }

  private getInvestmentDecision(results: AgentResult[]): string {
    const econobotResult = results.find(r => r.agent === 'econobot');
    const riskResult = results.find(r => r.agent === 'riskranger');
    
    if (econobotResult?.analysis.npv_10 > 2.0 && riskResult?.analysis.success_probability > 0.7) {
      return '✅ PROCEED (Strong Economics & Acceptable Risk)';
    }
    return '⚠️ EVALUATE (Review economics and risk factors)';
  }

  private async generateExecutiveReport(results: AgentResult[]): Promise<void> {
    const econobot = results.find(r => r.agent === 'econobot')?.analysis;
    const geowiz = results.find(r => r.agent === 'geowiz')?.analysis;
    const riskranger = results.find(r => r.agent === 'riskranger')?.analysis;

    const report = `# SHALE YEAH Investment Analysis Report

**Analysis Date:** ${new Date().toISOString().split('T')[0]}
**Tract:** ${this.tractName}
**Analysis ID:** ${this.runId}
**Mode:** DEMONSTRATION (Realistic Mock Data)

## Executive Summary

**RECOMMENDATION: ${this.getInvestmentDecision(results)}**

Our AI-powered analysis indicates a ${riskranger?.overall_risk.toLowerCase()} risk opportunity with strong economic returns. All domain experts concur on the investment thesis based on comprehensive geological, engineering, and financial analysis.

## Key Investment Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| **NPV (10%)** | $${econobot?.npv_10.toFixed(1)}M | ${econobot?.npv_10 > 2 ? 'Strong' : 'Moderate'} |
| **IRR** | ${econobot?.irr}% | ${econobot?.irr > 20 ? 'Excellent' : 'Good'} |
| **Payback Period** | ${econobot?.payback_months} months | ${econobot?.payback_months < 18 ? 'Fast' : 'Standard'} |
| **Net Pay** | ${geowiz?.netPay} ft | ${geowiz?.netPay > 150 ? 'Excellent' : 'Good'} |
| **Success Probability** | ${Math.round(riskranger?.success_probability * 100)}% | ${riskranger?.success_probability > 0.75 ? 'High' : 'Moderate'} |

## Domain Expert Analysis

### 🗿 Geological Assessment - Marcus Aurelius Geologicus
- **Target Formations:** ${geowiz?.formations.join(', ')}
- **Net Pay:** ${geowiz?.netPay} ft across all zones
- **Reservoir Quality:** Porosity ${geowiz?.porosity}%, TOC ${geowiz?.toc}%
- **Maturity:** ${geowiz?.maturity}
- **Recommendation:** ${geowiz?.drilling_recommendation}

### 💰 Economic Analysis - Caesar Augustus Economicus  
- **NPV (10%):** $${econobot?.npv_10}M base case
- **IRR:** ${econobot?.irr}% internal rate of return
- **Break-even:** $${econobot?.breakeven_oil}/bbl oil price
- **Capital Required:** $${econobot?.capex_well}M per well
- **Assessment:** ${econobot?.dcf_analysis}

### ⚠️ Risk Assessment - Gaius Probabilis Assessor
- **Overall Risk:** ${riskranger?.overall_risk}
- **P10/P90 NPV Range:** $${riskranger?.p10_npv}M - $${riskranger?.p90_npv}M
- **Success Probability:** ${Math.round(riskranger?.success_probability * 100)}%
- **Key Risks:** Commodity volatility, operational execution

## Recommended Next Steps

1. **Technical Due Diligence** - Validate geological assumptions with offset data
2. **Financial Structuring** - Implement commodity hedging for 18-month production
3. **Operational Planning** - Finalize drilling and completion program
4. **Investment Committee** - Present for final approval

---
*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*
*This analysis used demonstration data for presentation purposes*
`;

    await fs.writeFile(path.join(this.outDir, 'INVESTMENT_DECISION.md'), report);
  }

  private async generateDetailedAnalysis(results: AgentResult[]): Promise<void> {
    const detailed = `# Detailed Technical Analysis

## Agent Execution Summary

${results.map(r => `
### ${r.persona} (${r.agent.toUpperCase()})
- **Confidence Level:** ${r.confidence}%
- **Execution Time:** ${r.executionTime}ms
- **Status:** ${r.success ? 'Success' : 'Failed'}
- **Analysis:** ${JSON.stringify(r.analysis, null, 2)}
`).join('\n')}

## Technical Specifications

- **Analysis Framework:** Model Context Protocol (MCP) compliant
- **Agent Architecture:** 6 specialized domain experts
- **Processing Time:** ${(Date.now() - this.startTime) / 1000} seconds
- **Data Quality:** Demonstration grade (not production data)

---
*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*
`;

    await fs.writeFile(path.join(this.outDir, 'DETAILED_ANALYSIS.md'), detailed);
  }

  private async generateFinancialModel(results: AgentResult[]): Promise<void> {
    const econobot = results.find(r => r.agent === 'econobot')?.analysis;
    const curveSmith = results.find(r => r.agent === 'curve-smith')?.analysis;
    
    const financialModel = {
      analysis_metadata: {
        run_id: this.runId,
        analysis_date: new Date().toISOString(),
        mode: 'demonstration',
        tract_name: this.tractName
      },
      investment_summary: {
        npv_10_percent: econobot?.npv_10 * 1000000,
        irr: econobot?.irr / 100,
        payback_months: econobot?.payback_months,
        roi_multiple: econobot?.roi_multiple
      },
      production_profile: {
        initial_oil_rate: curveSmith?.initial_rate_oil,
        initial_gas_rate: curveSmith?.initial_rate_gas,
        decline_rate_annual: curveSmith?.decline_rate,
        eur_oil_bbls: curveSmith?.eur_oil,
        eur_gas_mcf: curveSmith?.eur_gas
      },
      economic_assumptions: {
        oil_price_bbl: 75.00,
        gas_price_mcf: 3.50,
        discount_rate: 0.10,
        tax_rate: 0.35,
        royalty_rate: 0.125
      },
      disclaimer: "This financial model uses demonstration data for presentation purposes. Not suitable for actual investment decisions."
    };

    await fs.writeFile(path.join(this.outDir, 'FINANCIAL_MODEL.json'), JSON.stringify(financialModel, null, 2));
  }
}

// Main execution
async function runDemo() {
  const runId = `demo-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;
  const outDir = path.join('data', 'outputs', runId);

  const demo = new ShaleYeahDemo({
    runId,
    outDir,
    tractName: 'Permian Basin Demo Tract',
    mode: 'demo'
  });

  await demo.runCompleteDemo();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { ShaleYeahDemo };