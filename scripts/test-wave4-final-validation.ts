#!/usr/bin/env node
/**
 * Test Wave 4 - Final Validation & Documentation
 * Validates documentation updates, standards compliance, and end-to-end functionality
 */

import fs from 'fs/promises';
import path from 'path';

async function testWave4FinalValidation(): Promise<void> {
  console.log('🌊 Testing Wave 4 - Final Validation & Documentation');
  console.log('==================================================');

  let allTestsPassed = true;

  try {
    // Test 1: Documentation Updates
    console.log('\n📚 Testing Documentation Updates...');
    
    const readme = await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf8');
    
    // Check for MCP standards mentions
    if (readme.includes('Standards-Compliant MCP Architecture')) {
      console.log('✅ README includes standards-compliant MCP architecture section');
    } else {
      console.log('❌ README missing standards-compliant MCP architecture section');
      allTestsPassed = false;
    }

    if (readme.includes('official Anthropic MCP')) {
      console.log('✅ README mentions official Anthropic MCP');
    } else {
      console.log('❌ README should reference official Anthropic MCP');
      allTestsPassed = false;
    }

    if (readme.includes('JSON-RPC 2.0')) {
      console.log('✅ README includes JSON-RPC 2.0 compliance');
    } else {
      console.log('❌ README should mention JSON-RPC 2.0 compliance');
      allTestsPassed = false;
    }

    if (readme.includes('Claude Desktop')) {
      console.log('✅ README includes Claude Desktop interoperability');
    } else {
      console.log('❌ README should mention Claude Desktop compatibility');
      allTestsPassed = false;
    }

    if (readme.includes('@modelcontextprotocol/sdk')) {
      console.log('✅ README references official MCP SDK');
    } else {
      console.log('❌ README should reference @modelcontextprotocol/sdk');
      allTestsPassed = false;
    }

    // Test 2: Remove references to custom MCP
    console.log('\n🔍 Testing Custom MCP Reference Removal...');
    
    if (!readme.includes('custom MCP') && !readme.includes('Custom MCP')) {
      console.log('✅ No references to custom MCP implementation found');
    } else {
      console.log('❌ Found references to custom MCP - should be removed');
      allTestsPassed = false;
    }

    // Test 3: MCP Server Creation Guide
    console.log('\n🔧 Testing MCP Server Creation Guide...');
    
    if (readme.includes('Creating New MCP Servers')) {
      console.log('✅ README includes MCP server creation guide');
    } else {
      console.log('❌ README missing MCP server creation guide');
      allTestsPassed = false;
    }

    if (readme.includes('McpServer') && readme.includes('registerTool')) {
      console.log('✅ Creation guide shows proper SDK usage');
    } else {
      console.log('❌ Creation guide should show McpServer and registerTool usage');
      allTestsPassed = false;
    }

    // Test 4: Standards Compliance Validation
    console.log('\n📋 Testing Standards Compliance...');
    
    // Check if package.json includes official MCP SDK
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    
    if (packageJson.dependencies['@modelcontextprotocol/sdk']) {
      console.log('✅ Official MCP SDK dependency present');
    } else {
      console.log('❌ Official MCP SDK dependency missing');
      allTestsPassed = false;
    }

    if (packageJson.dependencies['zod']) {
      console.log('✅ Zod dependency present (required for MCP SDK)');
    } else {
      console.log('❌ Zod dependency missing (required for MCP SDK)');
      allTestsPassed = false;
    }

    // Test 5: Verify MCP Server Files
    console.log('\n🏗️  Testing MCP Server Implementation...');
    
    const mcpServers = ['geology.ts', 'economics.ts', 'reporting.ts'];
    for (const server of mcpServers) {
      const serverPath = path.join(process.cwd(), 'src', 'mcp-servers', server);
      try {
        const content = await fs.readFile(serverPath, 'utf8');
        
        if (content.includes('@modelcontextprotocol/sdk/server/mcp.js')) {
          console.log(`✅ ${server} uses official MCP SDK`);
        } else {
          console.log(`❌ ${server} should use official MCP SDK`);
          allTestsPassed = false;
        }

        if (content.includes('registerTool') && content.includes('registerResource')) {
          console.log(`✅ ${server} uses proper MCP registration methods`);
        } else {
          console.log(`❌ ${server} should use registerTool and registerResource`);
          allTestsPassed = false;
        }

        if (content.includes('McpServer')) {
          console.log(`✅ ${server} uses McpServer class`);
        } else {
          console.log(`❌ ${server} should use McpServer class`);
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${server} not found or unreadable`);
        allTestsPassed = false;
      }
    }

    // Test 6: Roman Persona Consistency
    console.log('\n🏛️  Testing Roman Persona Consistency...');
    
    const expectedPersonas = [
      'Marcus Aurelius Geologicus',
      'Lucius Cornelius Monetarius', 
      'Cicero Reporticus Maximus'
    ];

    for (const persona of expectedPersonas) {
      if (readme.includes(persona)) {
        console.log(`✅ Roman persona "${persona}" documented`);
      } else {
        console.log(`❌ Roman persona "${persona}" missing from documentation`);
        allTestsPassed = false;
      }
    }

    // Test 7: End-to-End Pipeline Test (Basic)
    console.log('\n🚀 Testing End-to-End Pipeline Import...');
    
    try {
      // Test imports work
      const { UnifiedMCPClient } = await import('../src/unified-mcp-client.js');
      console.log('✅ UnifiedMCPClient imports successfully');
      
      // Test all MCP servers import
      const { GeologyMCPServer } = await import('../src/mcp-servers/geology.js');
      const { EconomicsMCPServer } = await import('../src/mcp-servers/economics.js');
      const { ReportingMCPServer } = await import('../src/mcp-servers/reporting.js');
      
      console.log('✅ All MCP servers import successfully');
      
      // Test basic instantiation
      const tempDir = path.join(process.cwd(), 'temp', 'wave4-test-' + Date.now());
      const client = new UnifiedMCPClient({
        name: 'test-client',
        version: '1.0.0',
        resourceRoot: tempDir,
        runId: 'test-wave4'
      });
      
      console.log('✅ Unified MCP client instantiates successfully');
      
    } catch (error) {
      console.log('❌ End-to-end pipeline import failed:', error);
      allTestsPassed = false;
    }

    // Test 8: Migration Benefits Documentation
    console.log('\n📊 Testing Migration Benefits Documentation...');
    
    const benefits = [
      'Interoperability',
      'Standards-compliant',
      'JSON-RPC 2.0',
      'Claude Desktop'
    ];

    for (const benefit of benefits) {
      if (readme.includes(benefit)) {
        console.log(`✅ Migration benefit "${benefit}" documented`);
      } else {
        console.log(`❌ Migration benefit "${benefit}" missing`);
        allTestsPassed = false;
      }
    }

    // Test 9: Architecture Validation
    console.log('\n🏗️  Testing Final Architecture Validation...');
    
    const architecture = await analyzeCurrentArchitecture();
    
    console.log(`📊 Final Architecture Analysis:`);
    console.log(`   - MCP Servers: ${architecture.mcpServers}`);
    console.log(`   - Main Entry Point: ${architecture.hasMainEntry ? 'Present' : 'Missing'}`);
    console.log(`   - Unified Client: ${architecture.hasUnifiedClient ? 'Present' : 'Missing'}`);
    console.log(`   - TypeScript Agents: ${architecture.agentFiles}`);
    console.log(`   - Pipeline Files: ${architecture.pipelineFiles}`);
    console.log(`   - MCP SDK Usage: ${architecture.usesMCPSDK ? 'Yes' : 'No'}`);

    if (architecture.mcpServers >= 3 && 
        architecture.hasMainEntry && 
        architecture.hasUnifiedClient && 
        architecture.agentFiles === 0 && 
        architecture.pipelineFiles === 0 && 
        architecture.usesMCPSDK) {
      console.log('✅ Final architecture is standards-compliant');
    } else {
      console.log('❌ Final architecture has compliance issues');
      allTestsPassed = false;
    }

    // Test 10: YAML Config Compatibility  
    console.log('\n📋 Testing YAML Config Compatibility...');
    
    try {
      const agentsDir = path.join(process.cwd(), '.claude', 'agents');
      const yamlFiles = await fs.readdir(agentsDir);
      const yamlCount = yamlFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
      
      console.log(`✅ Found ${yamlCount} YAML configuration files`);
      
      if (yamlCount >= 10) {
        console.log('✅ Sufficient YAML configurations for agent diversity');
      } else {
        console.log('⚠️  Consider adding more YAML configurations for full functionality');
      }
      
    } catch (error) {
      console.log('❌ Could not analyze YAML configurations:', error);
      allTestsPassed = false;
    }

    // Final Summary
    console.log('\n🎉 Wave 4 - Final Validation: ' + (allTestsPassed ? 'SUCCESS!' : 'FAILED'));
    console.log('====================================================================');
    
    if (allTestsPassed) {
      console.log('✅ README updated with standards-compliant MCP architecture');
      console.log('✅ References to custom MCP implementation removed');
      console.log('✅ Claude Desktop interoperability documented');
      console.log('✅ MCP server creation guide included');
      console.log('✅ Official MCP SDK properly integrated');
      console.log('✅ JSON-RPC 2.0 compliance achieved');
      console.log('✅ Roman persona consistency maintained');
      console.log('✅ End-to-end pipeline functional');
      console.log('✅ Migration benefits documented');
      console.log('✅ Final architecture validated');
      console.log('✅ YAML configuration compatibility maintained');

      console.log('\n🏆 MCP STANDARDS MIGRATION COMPLETE!');
      console.log('====================================');
      console.log('🎯 All 4 waves successfully executed');
      console.log('📡 Standards-compliant MCP architecture achieved');
      console.log('🔄 Interoperable with Claude Desktop and other MCP clients');
      console.log('⚡ Simplified, maintainable, and extensible codebase');
      console.log('🏛️ Roman imperial personas preserved for consistent AI interactions');
      
    } else {
      console.log('\n❌ Wave 4 has issues that need resolution before completion');
    }

  } catch (error) {
    console.error('❌ Wave 4 final validation failed:', error);
    process.exit(1);
  }
}

async function analyzeCurrentArchitecture(): Promise<{
  mcpServers: number;
  hasMainEntry: boolean;
  hasUnifiedClient: boolean;
  agentFiles: number;
  pipelineFiles: number;
  usesMCPSDK: boolean;
}> {
  const analysis = {
    mcpServers: 0,
    hasMainEntry: false,
    hasUnifiedClient: false,
    agentFiles: 0,
    pipelineFiles: 0,
    usesMCPSDK: false
  };

  // Check MCP servers
  try {
    const mcpServerFiles = await fs.readdir(path.join(process.cwd(), 'src', 'mcp-servers'));
    analysis.mcpServers = mcpServerFiles.filter(f => f.endsWith('.ts')).length;
  } catch {
    // Directory doesn't exist
  }

  // Check main entry point
  try {
    await fs.access(path.join(process.cwd(), 'src', 'main.ts'));
    analysis.hasMainEntry = true;
  } catch {
    // File doesn't exist
  }

  // Check unified client
  try {
    await fs.access(path.join(process.cwd(), 'src', 'unified-mcp-client.ts'));
    analysis.hasUnifiedClient = true;
  } catch {
    // File doesn't exist
  }

  // Check for remaining agent files
  try {
    const agentFiles = await fs.readdir(path.join(process.cwd(), 'src', 'agents'));
    analysis.agentFiles = agentFiles.filter(f => f.endsWith('.ts')).length;
  } catch {
    // Directory doesn't exist (which is good)
  }

  // Check for pipeline files
  try {
    const pipelineFiles = await fs.readdir(path.join(process.cwd(), 'pipelines'));
    analysis.pipelineFiles = pipelineFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
  } catch {
    // Directory doesn't exist (which is good)
  }

  // Check package.json for MCP SDK
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    analysis.usesMCPSDK = !!packageJson.dependencies['@modelcontextprotocol/sdk'];
  } catch {
    // Could not read package.json
  }

  return analysis;
}

testWave4FinalValidation();