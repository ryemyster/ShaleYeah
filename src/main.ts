#!/usr/bin/env node
/**
 * SHALE YEAH - Standards-Compliant MCP Entry Point
 * 
 * **UNIFIED MCP ARCHITECTURE:** Uses official Anthropic MCP SDK
 * 
 * This replaces the custom MCP controller with a standards-compliant implementation:
 * - Uses official MCP TypeScript SDK for all communication
 * - Domain-specific MCP servers (geology, economics, reporting)
 * - JSON-RPC 2.0 compliant with proper protocol versioning
 * - Interoperable with Claude Desktop and other MCP clients
 */

import path from 'path';
import { UnifiedMCPClient } from './unified-mcp-client.js';
import { 
  getEnvironmentConfig, 
  getOutputDir,
  setupLogging,
  validateEnvironment 
} from './shared/config.js';

/**
 * Main SHALE YEAH execution entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      argMap[args[i].slice(2)] = args[i + 1] || 'true';
    }
  }
  
  // Handle help flag
  if (argMap.help || argMap.h) {
    console.log(`
🛢️  SHALE YEAH - AI-Powered Oil & Gas Analysis Platform

USAGE:
  npm run demo              # Quick demo with sample data
  npm run start             # Start unified MCP pipeline
  npm run pipeline:demo     # Demo mode with fast execution
  npm run pipeline:batch    # Batch processing mode
  npm run pipeline:research # Research and RFC generation

CLI OPTIONS:
  --mode <mode>        Pipeline mode: demo, production, batch, research
  --run-id <id>        Unique run identifier (auto-generated if not provided)
  --out-dir <dir>      Output directory (auto-generated if not provided)
  --las-files <files>  Comma-separated LAS file paths
  --access-files <files> Comma-separated Access database file paths
  --well-lat <lat>     Well latitude coordinate
  --well-lon <lon>     Well longitude coordinate
  --help, -h           Show this help

EXAMPLES:
  npx tsx src/main.ts --mode=demo
  npx tsx src/main.ts --run-id=my-analysis --las-files=data/well1.las,data/well2.las
  npx tsx src/main.ts --mode=production --well-lat=47.7511 --well-lon=-101.7778
    `);
    process.exit(0);
  }

  try {
    // Setup logging
    setupLogging();
    
    // Get configuration
    const config = getEnvironmentConfig(argMap.mode);
    const runId = argMap['run-id'] || `run-${Date.now()}`;
    const outDir = argMap['out-dir'] || getOutputDir(runId);
    
    console.log(`🚀 Starting SHALE YEAH Analysis (${config.mode.toUpperCase()} mode)`);
    console.log(`📋 Run ID: ${runId}`);
    console.log(`📁 Output Directory: ${outDir}`);
    
    // Validate environment
    const validation = validateEnvironment();
    
    // Log errors (blocking)
    if (validation.errors.length > 0) {
      for (const error of validation.errors) {
        console.error(`❌ ${error}`);
      }
      process.exit(1);
    }
    
    // Log warnings (non-blocking)
    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        console.warn(`⚠️  ${warning}`);
      }
    }

    // Initialize unified MCP client
    const unifiedClient = new UnifiedMCPClient({
      name: 'shale-yeah-unified-client',
      version: '1.0.0',
      resourceRoot: outDir,
      runId: runId
    });

    await unifiedClient.initialize();
    
    // Prepare input data
    const inputData = {
      lasFiles: argMap['las-files'] ? argMap['las-files'].split(',') : [
        'data/samples/demo.las'
      ],
      accessFiles: argMap['access-files'] ? argMap['access-files'].split(',') : [
        'data/samples/demo.accdb'
      ],
      wellLocation: (argMap['well-lat'] && argMap['well-lon']) ? {
        latitude: parseFloat(argMap['well-lat']),
        longitude: parseFloat(argMap['well-lon'])
      } : undefined,
      economicParams: {
        // Use defaults or could be customized via CLI args
      }
    };

    console.log(`📊 Input Data:`);
    console.log(`   LAS Files: ${inputData.lasFiles.join(', ')}`);
    console.log(`   Access Files: ${inputData.accessFiles.join(', ')}`);
    if (inputData.wellLocation) {
      console.log(`   Well Location: ${inputData.wellLocation.latitude}, ${inputData.wellLocation.longitude}`);
    }

    // Execute complete pipeline
    console.log('\n🎯 Executing Complete SHALE YEAH Analysis Pipeline...');
    const pipelineResult = await unifiedClient.executeCompletePipeline(inputData);

    // Report results
    console.log('\n📈 Pipeline Results:');
    console.log(`   Overall Success: ${pipelineResult.success ? '✅' : '❌'}`);
    console.log(`   Total Duration: ${pipelineResult.duration}ms`);
    console.log(`   Geological Analysis: ${pipelineResult.geological.success ? '✅' : '❌'}`);
    console.log(`   Economic Analysis: ${pipelineResult.economic.success ? '✅' : '❌'}`);
    console.log(`   Reporting: ${pipelineResult.reporting.success ? '✅' : '❌'}`);

    if (pipelineResult.reporting.finalReport) {
      console.log(`\n📄 Final Report: ${pipelineResult.reporting.finalReport}`);
    }

    // Workflow details
    console.log('\n📋 Workflow Summary:');
    console.log(`   Geological Steps: ${pipelineResult.geological.steps.length}`);
    console.log(`   Economic Steps: ${pipelineResult.economic.steps.length}`);
    console.log(`   Reporting Steps: ${pipelineResult.reporting.steps.length}`);

    // Clean shutdown
    await unifiedClient.shutdown();
    
    console.log(`\n${pipelineResult.success ? '🎉' : '💥'} SHALE YEAH Analysis ${pipelineResult.success ? 'Completed Successfully' : 'Failed'}`);
    console.log(`⏱️  Total execution time: ${(pipelineResult.duration / 1000).toFixed(2)} seconds`);
    
    if (pipelineResult.success) {
      console.log('\n🎯 Next Steps:');
      console.log('   1. Review the generated analysis report');
      console.log('   2. Examine geological formations and economic metrics');
      console.log('   3. Use results for investment decision making');
      console.log('   4. Archive analysis data for future reference');
      
      if (config.mode === 'demo') {
        console.log('\n💡 Demo Mode Complete! For production analysis:');
        console.log('   - Use real LAS files with --las-files');
        console.log('   - Provide actual well coordinates');
        console.log('   - Run with --mode=production');
      }
    }
    
    process.exit(pipelineResult.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ SHALE YEAH Analysis Failed:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}