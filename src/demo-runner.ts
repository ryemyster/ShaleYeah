#!/usr/bin/env node
/**
 * SHALE YEAH Demo Runner - MCP-Compliant Demo with Realistic Mocks
 *
 * This creates a working demonstration that shows:
 * - Complete oil & gas investment analysis workflow using MCP architecture
 * - Professional-grade outputs and reports
 * - All 14 domain expert agents working through MCP client
 * - Realistic but mocked data (no API costs)
 * - Same fast performance as before (~6 seconds)
 *
 * Perfect for presentations and demonstrations while being MCP standards-compliant
 */

import { ShaleYeahMCPClient, AnalysisRequest } from './mcp-client.js';
import fs from 'fs/promises';
import path from 'path';

export interface DemoConfig {
  runId?: string;
  outputDir?: string;
  tractName?: string;
}

/**
 * MCP-Compliant Demo Runner
 * Uses the same MCP client architecture as production mode
 */
export class ShaleYeahMCPDemo {
  private client: ShaleYeahMCPClient;
  private runId: string;
  private outputDir: string;
  private tractName: string;

  constructor(config?: DemoConfig) {
    this.client = new ShaleYeahMCPClient();

    // Use provided config or generate defaults
    if (config?.runId) {
      this.runId = config.runId;
    } else {
      const timestamp = new Date().toISOString().replace(/\..+/, '').replace(/[-:]/g, '');
      this.runId = `demo-${timestamp}`;
    }

    this.outputDir = config?.outputDir || `./outputs/demo/${this.runId}`;
    this.tractName = config?.tractName || 'Permian Basin Demo Tract';
  }

  async runCompleteDemo(): Promise<void> {
    try {
      // Setup graceful shutdown for demo
      process.on('SIGINT', async () => {
        console.log('\n🛑 Demo interrupted, cleaning up...');
        await this.client.cleanup();
        process.exit(0);
      });

      // Create analysis request for demo mode
      const request: AnalysisRequest = {
        runId: this.runId,
        tractName: this.tractName,
        mode: 'demo', // This tells the MCP client to use mock data
        outputDir: this.outputDir
      };

      // Execute analysis using MCP client (same as production, but with demo mode)
      const result = await this.client.executeAnalysis(request);

      if (result.success) {
        console.log('\n✅ Demo completed successfully!');
        console.log(`📊 Confidence: ${result.confidence}%`);
        console.log(`⏱️  Total Time: ${(result.totalTime / 1000).toFixed(2)} seconds`);
        console.log(`📁 Results: ${this.outputDir}`);
        console.log();
        console.log('💡 This was a demonstration using realistic mock data.');
        console.log('   For production analysis, use --mode=production with real API keys.');
      } else {
        console.log('\n❌ Demo analysis failed or incomplete');
        console.log(`📊 Confidence: ${result.confidence}%`);
        process.exit(1);
      }

    } catch (error) {
      console.error('💥 Demo failed:', error instanceof Error ? error.message : String(error));
      await this.client.cleanup();
      process.exit(1);
    } finally {
      await this.client.cleanup();
    }
  }
}

// Main execution - MCP-compliant demo
async function runDemo(): Promise<void> {
  const demo = new ShaleYeahMCPDemo();
  await demo.runCompleteDemo();
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch((error) => {
    console.error('💥 Demo failed:', error);
    process.exit(1);
  });
}