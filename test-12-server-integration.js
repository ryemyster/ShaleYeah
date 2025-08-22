#!/usr/bin/env node

/**
 * Test script for Wave 3: 12-Server Integration Test
 * Tests Research → Market Intelligence workflows with all servers
 */

import { UnifiedMCPClient } from './dist/src/unified-mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function test12ServerIntegration() {
  console.log('🚀 Wave 3: Testing 12-Server Integration');
  console.log('=' .repeat(50));

  const runId = `test-${Date.now()}`;
  const config = {
    name: 'shale-yeah-12-server-test',
    version: '1.0.0',
    resourceRoot: path.join(__dirname, 'data'),
    runId: runId
  };

  const client = new UnifiedMCPClient(config);

  try {
    // Test 1: Initialize all 12 servers
    console.log('\n📍 Test 1: Initializing all 12 servers...');
    await client.initialize();
    
    const status = client.getServerStatus();
    console.log('Server Status:', {
      geology: status.geology,
      economics: status.economics,
      drilling: status.drilling,
      risk: status.riskAnalysis,
      title: status.title,
      legal: status.legal,
      reporting: status.reporting,
      curveSmith: status.curveSmith,
      research: status.research,      // NEW Wave 3
      development: status.development, // NEW Wave 3
      infrastructure: status.infrastructure, // NEW Wave 3
      market: status.market,          // NEW Wave 3
      unified: status.unified
    });

    const successfulServers = Object.values(status).filter(s => s === true).length;
    console.log(`✅ ${successfulServers}/13 servers initialized successfully`);

    // Test 2: Research Intelligence Workflow
    console.log('\n📍 Test 2: Testing Research Intelligence workflow...');
    const researchResult = await client.executeResearchIntelligenceWorkflow({
      competitive_focus: ['ExxonMobil', 'Chevron', 'ConocoPhillips'],
      market_analysis_regions: ['North America', 'Permian Basin'],
      regulatory_jurisdictions: ['Federal', 'State', 'Local']
    });

    console.log(`Research workflow: ${researchResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - Steps completed: ${researchResult.steps.length}`);
    console.log(`  - Duration: ${Math.round((researchResult.duration || 0) / 1000)}s`);

    // Test 3: Market Intelligence Workflow
    console.log('\n📍 Test 3: Testing Market Intelligence workflow...');
    const marketResult = await client.executeMarketIntelligenceWorkflow({
      commodities: ['crude_oil', 'natural_gas'],
      regions: ['North America', 'Permian Basin'],
      analysis_depth: 'detailed'
    });

    console.log(`Market workflow: ${marketResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - Steps completed: ${marketResult.steps.length}`);
    console.log(`  - Duration: ${Math.round((marketResult.duration || 0) / 1000)}s`);

    // Test 4: Infrastructure Monitoring
    console.log('\n📍 Test 4: Testing Infrastructure monitoring...');
    const infraResult = await client.executeToolCall(
      'infrastructure',
      'monitor_build_health',
      {
        monitoring_scope: {
          pipeline_names: ['research-intelligence', 'market-intelligence', 'geological-analysis'],
          time_window_hours: 1,
          severity_threshold: 'medium'
        },
        health_checks: {
          compilation_check: true,
          test_execution: true,
          deployment_verification: true
        }
      }
    );

    console.log(`Infrastructure monitoring: ${infraResult.success ? '✅ PASSED' : '❌ FAILED'}`);

    // Test 5: Development Agent Integration
    console.log('\n📍 Test 5: Testing Development agent integration...');
    const devResult = await client.executeToolCall(
      'development',
      'validate_integration',
      {
        agent_details: {
          agent_name: 'wave-3-enhanced-pipeline',
          agent_file: 'unified-mcp-client.ts',
          integration_points: ['research', 'market', 'infrastructure']
        },
        validation_scope: {
          compile_check: true,
          integration_tests: true
        }
      }
    );

    console.log(`Development validation: ${devResult.success ? '✅ PASSED' : '❌ FAILED'}`);

    // Test 6: Enhanced Complete Pipeline (all 12 servers)
    console.log('\n📍 Test 6: Testing Enhanced Complete Pipeline (12 servers)...');
    const pipelineResult = await client.executeEnhancedCompletePipeline({
      lasFiles: ['./data/samples/demo.las'],
      accessFiles: ['./data/samples/demo.accdb'],
      wellLocation: { latitude: 47.8, longitude: -103.2 },
      researchScope: {
        competitive_focus: ['ExxonMobil', 'Chevron'],
        market_analysis_regions: ['North America', 'Permian Basin']
      },
      marketScope: {
        commodities: ['crude_oil', 'natural_gas'],
        regions: ['North America']
      }
    });

    console.log(`Enhanced pipeline: ${pipelineResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - Research: ${pipelineResult.research.success ? '✅' : '❌'}`);
    console.log(`  - Geological: ${pipelineResult.geological.success ? '✅' : '❌'}`);
    console.log(`  - Economic: ${pipelineResult.economic.success ? '✅' : '❌'}`);
    console.log(`  - Drilling: ${pipelineResult.drilling.success ? '✅' : '❌'}`);
    console.log(`  - Risk: ${pipelineResult.riskAssessment.success ? '✅' : '❌'}`);
    console.log(`  - Title: ${pipelineResult.title.success ? '✅' : '❌'}`);
    console.log(`  - Legal: ${pipelineResult.legal.success ? '✅' : '❌'}`);
    console.log(`  - Market: ${pipelineResult.market.success ? '✅' : '❌'}`);
    console.log(`  - Reporting: ${pipelineResult.reporting.success ? '✅' : '❌'}`);
    console.log(`  - Total duration: ${Math.round(pipelineResult.duration / 1000)}s`);

    // Summary
    console.log('\n🎯 Wave 3 Integration Test Summary');
    console.log('=' .repeat(50));
    const tests = [
      { name: '12-Server Initialization', result: successfulServers === 13 },
      { name: 'Research Intelligence', result: researchResult.success },
      { name: 'Market Intelligence', result: marketResult.success },
      { name: 'Infrastructure Monitoring', result: infraResult.success },
      { name: 'Development Validation', result: devResult.success },
      { name: 'Enhanced Complete Pipeline', result: pipelineResult.success }
    ];

    const passedTests = tests.filter(t => t.result).length;
    console.log(`Overall: ${passedTests}/${tests.length} tests passed`);
    
    tests.forEach(test => {
      console.log(`  ${test.result ? '✅' : '❌'} ${test.name}`);
    });

    if (passedTests === tests.length) {
      console.log('\n🚀 Wave 3 SUCCESS: All 12 servers integrated successfully!');
      console.log('📊 Pipeline: Research → Geo → Econ → Drilling → Risk → Title → Legal → Market → Reporting');
    } else {
      console.log(`\n⚠️  Wave 3 PARTIAL: ${passedTests}/${tests.length} tests passed`);
    }

  } catch (error) {
    console.error('❌ Wave 3 Integration Test failed:', error);
    process.exit(1);
  } finally {
    await client.shutdown();
  }
}

// Run the test
test12ServerIntegration().catch(console.error);