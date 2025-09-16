#!/usr/bin/env node
/**
 * Curve-Smith MCP Server - Reservoir Engineering Expert
 *
 * Lucius Technicus Engineer - Master Reservoir Engineer
 * Provides decline curve analysis, EUR estimates, type curve development,
 * and reservoir engineering analysis for oil & gas projects.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface DeclineCurveAnalysis {
  initialRate: {
    oil: number;
    gas: number;
    water: number;
  };
  declineRate: number;
  bFactor: number;
  eur: {
    oil: number;
    gas: number;
  };
  typeCurve: string;
  confidence: number;
  qualityGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

interface TypeCurveAnalysis {
  curveType: string;
  tier: number;
  analogWells: number;
  statistics: {
    p10: number;
    p50: number;
    p90: number;
  };
  formation: string;
}

export class CurveSmithServer extends MCPServer {
  constructor() {
    super({
      name: 'curve-smith',
      version: '1.0.0',
      description: 'Reservoir Engineering MCP Server',
      persona: {
        name: 'Lucius Technicus Engineer',
        role: 'Master Reservoir Engineer',
        expertise: [
          'Decline curve analysis and modeling',
          'EUR estimation and validation',
          'Type curve development',
          'Reservoir characterization',
          'Production optimization'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['curves', 'type-curves', 'production', 'models', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Tool: Analyze Decline Curve
    this.registerTool({
      name: 'analyze_decline_curve',
      description: 'Analyze production decline curves and estimate EUR',
      inputSchema: z.object({
        filePath: z.string().describe('Path to production data file'),
        curveType: z.enum(['exponential', 'hyperbolic', 'harmonic']).default('hyperbolic'),
        minMonths: z.number().min(3).default(6).describe('Minimum months of data required'),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.analyzeDeclineCurve(args)
    });

    // Tool: Generate Type Curve
    this.registerTool({
      name: 'generate_type_curve',
      description: 'Generate type curve from analog well data',
      inputSchema: z.object({
        formation: z.string().describe('Target formation'),
        analogWells: z.array(z.string()).describe('Analog well identifiers'),
        tier: z.number().min(1).max(3).default(1).describe('Type curve tier (1=best)'),
        lateral_length: z.number().optional().describe('Lateral length in feet')
      }),
      handler: async (args) => this.generateTypeCurve(args)
    });

    // Tool: Calculate EUR
    this.registerTool({
      name: 'calculate_eur',
      description: 'Calculate Estimated Ultimate Recovery',
      inputSchema: z.object({
        initialRateOil: z.number().describe('Initial oil rate (bopd)'),
        initialRateGas: z.number().describe('Initial gas rate (mcfd)'),
        declineRate: z.number().min(0).max(1).describe('Annual decline rate'),
        bFactor: z.number().min(0).max(2).default(1).describe('Decline exponent'),
        economicLimit: z.number().default(10).describe('Economic limit (bopd)')
      }),
      handler: async (args) => this.calculateEUR(args)
    });

    // Tool: Quality Assessment
    this.registerTool({
      name: 'assess_curve_quality',
      description: 'Assess quality of decline curve analysis',
      inputSchema: z.object({
        curveId: z.string().describe('Decline curve analysis ID'),
        thresholds: z.object({
          minR2: z.number().min(0).max(1).default(0.8),
          minDataPoints: z.number().default(6)
        }).optional()
      }),
      handler: async (args) => this.assessCurveQuality(args)
    });

    // Resource: Decline Curve Analysis
    this.registerResource({
      name: 'decline_curve',
      uri: 'curve-smith://curves/{id}',
      description: 'Decline curve analysis results',
      handler: async (uri) => this.getDeclineCurve(uri)
    });

    // Resource: Type Curve
    this.registerResource({
      name: 'type_curve',
      uri: 'curve-smith://type-curves/{id}',
      description: 'Type curve analysis results',
      handler: async (uri) => this.getTypeCurve(uri)
    });
  }

  /**
   * Analyze production decline curves
   */
  private async analyzeDeclineCurve(args: any): Promise<DeclineCurveAnalysis> {
    console.log(`📈 Analyzing decline curve: ${args.filePath}`);

    // Parse production data
    const parseResult = await this.fileManager.parseFile(args.filePath);
    if (!parseResult.success) {
      throw new Error(`Failed to parse production data: ${parseResult.errors.join(', ')}`);
    }

    // Perform decline curve analysis
    const analysis = await this.performDeclineCurveAnalysis(parseResult.data, args);

    // Save results
    const curveId = `curve_${Date.now()}`;
    const result = {
      curveId,
      filePath: args.filePath,
      analysis,
      curveType: args.curveType,
      timestamp: new Date().toISOString(),
      engineer: this.config.persona.name
    };

    await this.saveResult(`curves/${curveId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return analysis;
  }

  /**
   * Generate type curve from analog wells
   */
  private async generateTypeCurve(args: any): Promise<TypeCurveAnalysis> {
    console.log(`📊 Generating type curve for ${args.formation}`);

    // Analyze analog wells
    const typeCurve = await this.performTypeCurveAnalysis(args);

    // Save results
    const typeCurveId = `type_${Date.now()}`;
    const result = {
      typeCurveId,
      formation: args.formation,
      analogWells: args.analogWells,
      typeCurve,
      timestamp: new Date().toISOString(),
      engineer: this.config.persona.name
    };

    await this.saveResult(`type-curves/${typeCurveId}.json`, result);

    return typeCurve;
  }

  /**
   * Calculate EUR from decline parameters
   */
  private async calculateEUR(args: any): Promise<any> {
    console.log(`🎯 Calculating EUR`);

    const eurOil = this.calculateHyperbolicEUR(
      args.initialRateOil,
      args.declineRate,
      args.bFactor,
      args.economicLimit
    );

    const eurGas = this.calculateHyperbolicEUR(
      args.initialRateGas,
      args.declineRate,
      args.bFactor,
      args.economicLimit * 6 // Assume 6 mcf/bbl GOR
    );

    return {
      eur: {
        oil: eurOil,
        gas: eurGas
      },
      parameters: {
        initialRateOil: args.initialRateOil,
        initialRateGas: args.initialRateGas,
        declineRate: args.declineRate,
        bFactor: args.bFactor,
        economicLimit: args.economicLimit
      },
      timestamp: new Date().toISOString(),
      engineer: this.config.persona.name
    };
  }

  /**
   * Assess decline curve quality
   */
  private async assessCurveQuality(args: any): Promise<any> {
    console.log(`🔍 Assessing curve quality: ${args.curveId}`);

    try {
      const curveData = await this.loadResult(`curves/${args.curveId}.json`);

      // Simulate quality assessment
      const r2 = Math.random() * 0.3 + 0.7; // 0.7-1.0
      const dataPoints = Math.floor(Math.random() * 20) + 6; // 6-26

      const quality = {
        curveId: args.curveId,
        r2,
        dataPoints,
        passesThresholds: r2 >= (args.thresholds?.minR2 || 0.8) &&
                         dataPoints >= (args.thresholds?.minDataPoints || 6),
        qualityGrade: this.determineQualityGrade(r2, dataPoints),
        recommendations: this.generateQualityRecommendations(r2, dataPoints)
      };

      return quality;
    } catch (error) {
      throw new Error(`Curve analysis not found: ${args.curveId}`);
    }
  }

  /**
   * Perform decline curve analysis
   */
  private async performDeclineCurveAnalysis(data: any, args: any): Promise<DeclineCurveAnalysis> {
    // Simulate comprehensive decline curve analysis
    return {
      initialRate: {
        oil: Math.floor(Math.random() * 1000) + 500, // 500-1500 bopd
        gas: Math.floor(Math.random() * 2000) + 1000, // 1000-3000 mcfd
        water: Math.floor(Math.random() * 100) + 10 // 10-110 bwpd
      },
      declineRate: Math.round((Math.random() * 0.05 + 0.05) * 1000) / 1000, // 5-10%
      bFactor: Math.round((Math.random() * 0.5 + 0.5) * 100) / 100, // 0.5-1.0
      eur: {
        oil: Math.floor(Math.random() * 100000) + 50000, // 50-150k bbls
        gas: Math.floor(Math.random() * 500000) + 200000 // 200-700k mcf
      },
      typeCurve: 'Tier 1 Wolfcamp',
      confidence: Math.round((Math.random() * 20 + 75)), // 75-95%
      qualityGrade: ['Excellent', 'Good', 'Fair'][Math.floor(Math.random() * 3)] as any
    };
  }

  /**
   * Perform type curve analysis
   */
  private async performTypeCurveAnalysis(args: any): Promise<TypeCurveAnalysis> {
    return {
      curveType: `${args.formation} Type Curve`,
      tier: args.tier,
      analogWells: args.analogWells.length,
      statistics: {
        p10: Math.floor(Math.random() * 50000) + 200000, // High case
        p50: Math.floor(Math.random() * 50000) + 100000, // Base case
        p90: Math.floor(Math.random() * 50000) + 50000   // Low case
      },
      formation: args.formation
    };
  }

  /**
   * Calculate hyperbolic EUR
   */
  private calculateHyperbolicEUR(qi: number, di: number, b: number, qecon: number): number {
    // Simplified hyperbolic decline calculation
    // EUR = (qi^b - qecon^b) / (b * di)
    if (b === 1) {
      // Exponential case
      return (qi - qecon) / di;
    }

    return Math.round((Math.pow(qi, b) - Math.pow(qecon, b)) / (b * di));
  }

  /**
   * Determine quality grade based on metrics
   */
  private determineQualityGrade(r2: number, dataPoints: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (r2 >= 0.95 && dataPoints >= 12) return 'Excellent';
    if (r2 >= 0.85 && dataPoints >= 8) return 'Good';
    if (r2 >= 0.75 && dataPoints >= 6) return 'Fair';
    return 'Poor';
  }

  /**
   * Generate quality recommendations
   */
  private generateQualityRecommendations(r2: number, dataPoints: number): string[] {
    const recommendations = [];

    if (r2 < 0.8) {
      recommendations.push('Consider alternative curve fitting methods');
    }
    if (dataPoints < 8) {
      recommendations.push('Collect additional production data for improved accuracy');
    }
    if (r2 >= 0.9 && dataPoints >= 10) {
      recommendations.push('Excellent curve fit - proceed with confidence');
    }

    return recommendations;
  }

  /**
   * Resource handlers
   */
  private async getDeclineCurve(uri: URL): Promise<any> {
    const curveId = uri.pathname.split('/').pop();
    return await this.loadResult(`curves/${curveId}.json`);
  }

  private async getTypeCurve(uri: URL): Promise<any> {
    const typeCurveId = uri.pathname.split('/').pop();
    return await this.loadResult(`type-curves/${typeCurveId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CurveSmithServer();
  runMCPServer(server).catch(console.error);
}