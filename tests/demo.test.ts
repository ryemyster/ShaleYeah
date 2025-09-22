#!/usr/bin/env node
/**
 * Basic tests to verify SHALE YEAH demo mode works correctly
 */

import fs from 'fs/promises';
import path from 'path';
import { ShaleYeahDemo } from '../src/demo-runner.js';

async function testDemoMode(): Promise<boolean> {
  console.log('🧪 Testing SHALE YEAH Demo Mode...');
  
  const testRunId = `test-${Date.now()}`;
  const testOutDir = path.join('data', 'outputs', testRunId);
  
  try {
    // Run demo analysis
    const demo = new ShaleYeahDemo({
      runId: testRunId,
      outDir: testOutDir,
      tractName: 'Test Tract',
      mode: 'demo'
    });
    
    await demo.runCompleteDemo();
    
    // Verify files were created
    const requiredFiles = [
      'INVESTMENT_DECISION.md',
      'DETAILED_ANALYSIS.md', 
      'FINANCIAL_MODEL.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(testOutDir, file);
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Required file not found: ${file}`);
      }
      console.log(`✅ Found ${file} (${stats.size} bytes)`);
    }
    
    // Verify file contents
    const reportContent = await fs.readFile(path.join(testOutDir, 'INVESTMENT_DECISION.md'), 'utf-8');
    if (!reportContent.includes('SHALE YEAH Investment Analysis Report')) {
      throw new Error('Report content validation failed');
    }
    
    const modelContent = await fs.readFile(path.join(testOutDir, 'FINANCIAL_MODEL.json'), 'utf-8');
    const model = JSON.parse(modelContent);
    if (!model.investment_summary?.npv_10_percent) {
      throw new Error('Financial model validation failed');
    }
    
    console.log('✅ All demo tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Demo test failed:', error);
    return false;
  }
}

async function testProductionModeDetection(): Promise<boolean> {
  console.log('🧪 Testing Production Mode Detection...');
  
  // This should fail gracefully when API keys are missing
  try {
    // TODO: Add production mode test when implemented
    console.log('⚠️  Production mode testing not yet implemented');
    return true;
  } catch (error) {
    console.error('❌ Production mode test failed:', error);
    return false;
  }
}

async function runAllTests(): Promise<void> {
  const testResults = await Promise.all([
    testDemoMode(),
    testProductionModeDetection()
  ]);
  
  const allPassed = testResults.every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}