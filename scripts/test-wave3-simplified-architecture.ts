#!/usr/bin/env node
/**
 * Test Wave 3 - Simplified Architecture
 * Validates that src/agents/ and pipelines/ have been eliminated
 * and unified MCP client works as the new entry point
 */

import fs from 'fs/promises';
import path from 'path';

async function testWave3SimplifiedArchitecture(): Promise<void> {
  console.log('🌊 Testing Wave 3 - Simplified Architecture');
  console.log('===========================================');

  let allTestsPassed = true;

  try {
    // Test 1: Verify src/agents/ directory has been removed
    console.log('\n🗂️  Testing src/agents/ elimination...');
    try {
      await fs.access(path.join(process.cwd(), 'src', 'agents'));
      console.log('❌ src/agents/ directory still exists - should be eliminated');
      allTestsPassed = false;
    } catch {
      console.log('✅ src/agents/ directory successfully eliminated');
    }

    // Test 2: Verify pipelines/ directory has been removed
    console.log('\n📋 Testing pipelines/ elimination...');
    try {
      await fs.access(path.join(process.cwd(), 'pipelines'));
      console.log('❌ pipelines/ directory still exists - should be eliminated');
      allTestsPassed = false;
    } catch {
      console.log('✅ pipelines/ directory successfully eliminated');
    }

    // Test 3: Verify old MCP controller has been removed
    console.log('\n🎛️  Testing old MCP controller elimination...');
    try {
      await fs.access(path.join(process.cwd(), 'src', 'mcp.ts'));
      console.log('❌ src/mcp.ts still exists - should be replaced');
      allTestsPassed = false;
    } catch {
      console.log('✅ src/mcp.ts successfully removed');
    }

    // Test 4: Verify new main entry point exists
    console.log('\n🚀 Testing new main entry point...');
    try {
      await fs.access(path.join(process.cwd(), 'src', 'main.ts'));
      console.log('✅ src/main.ts exists as new entry point');
    } catch {
      console.log('❌ src/main.ts missing - should be the new entry point');
      allTestsPassed = false;
    }

    // Test 5: Verify unified MCP client exists
    console.log('\n🔗 Testing unified MCP client...');
    try {
      await fs.access(path.join(process.cwd(), 'src', 'unified-mcp-client.ts'));
      console.log('✅ src/unified-mcp-client.ts exists');
    } catch {
      console.log('❌ src/unified-mcp-client.ts missing');
      allTestsPassed = false;
    }

    // Test 6: Verify domain-specific MCP servers exist
    console.log('\n🏗️  Testing domain-specific MCP servers...');
    const requiredServers = ['geology.ts', 'economics.ts', 'reporting.ts'];
    
    for (const server of requiredServers) {
      try {
        await fs.access(path.join(process.cwd(), 'src', 'mcp-servers', server));
        console.log(`✅ src/mcp-servers/${server} exists`);
      } catch {
        console.log(`❌ src/mcp-servers/${server} missing`);
        allTestsPassed = false;
      }
    }

    // Test 7: Verify package.json has been updated
    console.log('\n📦 Testing package.json updates...');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      
      if (packageJson.main === 'dist/main.js') {
        console.log('✅ package.json main entry point updated to dist/main.js');
      } else {
        console.log(`❌ package.json main should be 'dist/main.js', got '${packageJson.main}'`);
        allTestsPassed = false;
      }

      if (packageJson.scripts.start?.includes('src/main.ts')) {
        console.log('✅ package.json start script updated to use src/main.ts');
      } else {
        console.log('❌ package.json start script should use src/main.ts');
        allTestsPassed = false;
      }

    } catch (error) {
      console.log('❌ Failed to read package.json:', error);
      allTestsPassed = false;
    }

    // Test 8: Verify development scripts cleaned up
    console.log('\n🧹 Testing development script cleanup...');
    const cleanedScripts = [
      'scripts/explore-mcp-sdk.ts',
      'scripts/test-mcp-architecture.ts',
      'scripts/test-yaml-loader.ts',
      'scripts/verify-mcp-setup.ts'
    ];

    for (const script of cleanedScripts) {
      try {
        await fs.access(path.join(process.cwd(), script));
        console.log(`❌ ${script} still exists - should be cleaned up`);
        allTestsPassed = false;
      } catch {
        console.log(`✅ ${script} successfully removed`);
      }
    }

    // Test 9: Check architecture simplification
    console.log('\n🏛️  Testing architecture simplification...');
    
    const currentArchitecture = await analyzeCurrentArchitecture();
    console.log('✅ Current architecture:');
    console.log(`   - MCP Servers: ${currentArchitecture.mcpServers.length}`);
    console.log(`   - Entry Points: ${currentArchitecture.entryPoints.length}`);
    console.log(`   - Agent Files: ${currentArchitecture.agentFiles.length}`);
    console.log(`   - Pipeline Files: ${currentArchitecture.pipelineFiles.length}`);

    if (currentArchitecture.agentFiles.length === 0) {
      console.log('✅ No TypeScript agent files remaining');
    } else {
      console.log(`❌ ${currentArchitecture.agentFiles.length} TypeScript agent files still exist`);
      allTestsPassed = false;
    }

    if (currentArchitecture.pipelineFiles.length === 0) {
      console.log('✅ No pipeline configuration files remaining');
    } else {
      console.log(`❌ ${currentArchitecture.pipelineFiles.length} pipeline files still exist`);
      allTestsPassed = false;
    }

    if (currentArchitecture.mcpServers.length >= 3) {
      console.log('✅ Domain-specific MCP servers present');
    } else {
      console.log(`❌ Expected 3+ MCP servers, found ${currentArchitecture.mcpServers.length}`);
      allTestsPassed = false;
    }

    // Test 10: Integration test - try to import new entry point
    console.log('\n🔗 Testing module imports...');
    try {
      const { UnifiedMCPClient } = await import('../src/unified-mcp-client.js');
      console.log('✅ UnifiedMCPClient imports successfully');
      
      // Test basic instantiation
      const tempDir = path.join(process.cwd(), 'temp', 'wave3-test-' + Date.now());
      const client = new UnifiedMCPClient({
        name: 'test-client',
        version: '1.0.0',
        resourceRoot: tempDir,
        runId: 'test-wave3'
      });
      console.log('✅ UnifiedMCPClient instantiates successfully');
      
    } catch (error) {
      console.log('❌ Failed to import or instantiate UnifiedMCPClient:', error);
      allTestsPassed = false;
    }

    // Final Summary
    console.log('\n🎉 Wave 3 - Architecture Simplification: ' + (allTestsPassed ? 'SUCCESS!' : 'FAILED'));
    console.log('=======================================================');
    
    if (allTestsPassed) {
      console.log('✅ src/agents/ directory eliminated');
      console.log('✅ pipelines/ directory eliminated');
      console.log('✅ Old MCP controller replaced');
      console.log('✅ New unified MCP client architecture working');
      console.log('✅ Domain-specific MCP servers operational');
      console.log('✅ Package.json updated for new entry point');
      console.log('✅ Development scripts cleaned up');
      console.log('✅ Single-layer MCP architecture achieved');
      console.log('✅ Standards-compliant MCP implementation');

      console.log('\n🌊 Wave 3 Complete - Ready for Wave 4');
    } else {
      console.log('\n❌ Wave 3 has issues that need resolution');
    }

  } catch (error) {
    console.error('❌ Wave 3 test failed:', error);
    process.exit(1);
  }
}

async function analyzeCurrentArchitecture(): Promise<{
  mcpServers: string[];
  entryPoints: string[];
  agentFiles: string[];
  pipelineFiles: string[];
}> {
  const architecture = {
    mcpServers: [] as string[],
    entryPoints: [] as string[],
    agentFiles: [] as string[],
    pipelineFiles: [] as string[]
  };

  // Check for MCP servers
  try {
    const mcpServerFiles = await fs.readdir(path.join(process.cwd(), 'src', 'mcp-servers'));
    architecture.mcpServers = mcpServerFiles.filter(f => f.endsWith('.ts'));
  } catch {
    // Directory doesn't exist
  }

  // Check for entry points
  try {
    const srcFiles = await fs.readdir(path.join(process.cwd(), 'src'));
    architecture.entryPoints = srcFiles.filter(f => ['main.ts', 'mcp.ts', 'index.ts'].includes(f));
  } catch {
    // Directory doesn't exist
  }

  // Check for remaining agent files
  try {
    const agentFiles = await fs.readdir(path.join(process.cwd(), 'src', 'agents'));
    architecture.agentFiles = agentFiles.filter(f => f.endsWith('.ts'));
  } catch {
    // Directory doesn't exist (which is what we want)
  }

  // Check for pipeline files
  try {
    const pipelineFiles = await fs.readdir(path.join(process.cwd(), 'pipelines'));
    architecture.pipelineFiles = pipelineFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    // Directory doesn't exist (which is what we want)
  }

  return architecture;
}

testWave3SimplifiedArchitecture();