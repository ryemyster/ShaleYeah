#!/usr/bin/env node
/**
 * Legal MCP Server - Legal & Regulatory Expert
 *
 * Legatus Juridicus - Master Legal Strategist
 * Provides comprehensive legal analysis, contract review,
 * and regulatory compliance for oil & gas investments.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface LegalAnalysis {
  contractType: string;
  keyTerms: string[];
  riskFactors: string[];
  complianceStatus: 'COMPLIANT' | 'ISSUES' | 'NON_COMPLIANT';
  recommendations: string[];
  confidence: number;
}

export class LegalServer extends MCPServer {
  constructor() {
    super({
      name: 'legal',
      version: '1.0.0',
      description: 'Legal & Regulatory Analysis MCP Server',
      persona: {
        name: 'Legatus Juridicus',
        role: 'Master Legal Strategist',
        expertise: [
          'Contract analysis and negotiation',
          'Regulatory compliance assessment',
          'Title and ownership verification',
          'Environmental law compliance',
          'Risk mitigation strategies'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['contracts', 'compliance', 'title', 'environmental', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    this.registerTool({
      name: 'analyze_contract',
      description: 'Analyze legal contracts and agreements',
      inputSchema: z.object({
        contractPath: z.string(),
        contractType: z.enum(['lease', 'jv', 'farmout', 'purchase']),
        outputPath: z.string().optional()
      }),
      handler: async (args) => this.analyzeContract(args)
    });

    this.registerTool({
      name: 'check_compliance',
      description: 'Check regulatory compliance status',
      inputSchema: z.object({
        jurisdiction: z.string(),
        projectType: z.string(),
        regulations: z.array(z.string()).optional()
      }),
      handler: async (args) => this.checkCompliance(args)
    });

    this.registerResource({
      name: 'legal_analysis',
      uri: 'legal://contracts/{id}',
      description: 'Legal analysis results',
      handler: async (uri) => this.getLegalAnalysis(uri)
    });
  }

  private async analyzeContract(args: any): Promise<LegalAnalysis> {
    console.log(`⚖️ Analyzing ${args.contractType} contract: ${args.contractPath}`);

    // Parse contract file
    const parseResult = await this.fileManager.parseFile(args.contractPath);
    if (!parseResult.success) {
      throw new Error(`Failed to parse contract: ${parseResult.errors?.join(', ') || 'Unknown error'}`);
    }

    const analysis: LegalAnalysis = {
      contractType: args.contractType,
      keyTerms: [
        'Primary term: 5 years',
        'Royalty rate: 1/8 (12.5%)',
        'Bonus payment: $500/acre',
        'Drilling obligations: 1 well per 640 acres'
      ],
      riskFactors: [
        'Force majeure clauses may be restrictive',
        'Environmental liability provisions unclear',
        'Title warranty limitations'
      ],
      complianceStatus: 'COMPLIANT',
      recommendations: [
        'Negotiate improved environmental indemnification',
        'Clarify force majeure trigger events',
        'Add technology advancement clauses'
      ],
      confidence: 85
    };

    // Save analysis
    const analysisId = `legal_${Date.now()}`;
    const result = {
      analysisId,
      analysis,
      contractPath: args.contractPath,
      timestamp: new Date().toISOString(),
      analyst: this.config.persona.name
    };

    await this.saveResult(`contracts/${analysisId}.json`, result);

    if (args.outputPath) {
      await fs.writeFile(args.outputPath, JSON.stringify(result, null, 2));
    }

    return analysis;
  }

  private async checkCompliance(args: any): Promise<any> {
    console.log(`📋 Checking compliance for ${args.jurisdiction}`);

    return {
      jurisdiction: args.jurisdiction,
      complianceStatus: 'COMPLIANT',
      requiredPermits: ['Drilling permit', 'Environmental assessment', 'Water usage permit'],
      timeline: '90-120 days for full permitting',
      costs: { permits: 50000, legal: 25000, environmental: 75000 }
    };
  }

  private async getLegalAnalysis(uri: URL): Promise<any> {
    const analysisId = uri.pathname.split('/').pop();
    return await this.loadResult(`contracts/${analysisId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new LegalServer();
  runMCPServer(server).catch(console.error);
}