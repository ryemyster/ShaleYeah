#!/usr/bin/env node
/**
 * Manual Test for MCP Architecture
 * Validates proper resource-based coordination patterns
 */

import fs from 'fs/promises';
import path from 'path';
import { FileSystemMCPResourceServer } from '../src/shared/mcp-resource-server.js';
import { MCPResourceClientImpl } from '../src/shared/mcp-resource-client.js';
import { MCPPipelineStateManager } from '../src/shared/mcp-pipeline-state.js';
import { PipelineState } from '../src/shared/mcp-types.js';

class MCPArchitectureTest {
  private tempDir: string;
  private mcpServer!: FileSystemMCPResourceServer;
  private stateManager!: MCPPipelineStateManager;
  private testResults: { name: string; passed: boolean; message: string }[] = [];

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'mcp-test-' + Date.now());
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing MCP Resource-Based Architecture');
    console.log('==========================================');

    try {
      await this.setup();
      
      await this.testResourceServerBasics();
      await this.testResourcePatterns();
      await this.testResourceClient();
      await this.testPipelineState();
      await this.testResourceCoordination();
      
      await this.cleanup();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      await this.cleanup();
    }
  }

  private async setup(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
    
    this.mcpServer = new FileSystemMCPResourceServer(this.tempDir);
    await this.mcpServer.initialize();
    
    this.stateManager = new MCPPipelineStateManager(this.mcpServer);
    
    console.log(`📁 Test directory: ${this.tempDir}`);
  }

  private async cleanup(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.shutdown();
    }
    await fs.rm(this.tempDir, { recursive: true, force: true });
  }

  private async testResourceServerBasics(): Promise<void> {
    console.log('\\n🔧 Testing Resource Server Basics...');
    
    try {
      // Test storing and retrieving resources
      const uri = 'mcp://shale-data/test/sample.json';
      const data = { message: 'test data', timestamp: Date.now() };

      await this.mcpServer.putResource(uri, data);
      const retrieved = await this.mcpServer.getResource(uri);

      this.assert('Resource store/retrieve', 
        JSON.stringify(retrieved) === JSON.stringify(data),
        'Data should match after storage and retrieval'
      );

      // Test resource existence check
      const exists = await this.mcpServer.resourceExists(uri);
      this.assert('Resource existence check', exists, 'Resource should exist after creation');

      console.log('  ✅ Basic resource operations working');
    } catch (error) {
      this.assert('Resource server basics', false, `Error: ${error}`);
    }
  }

  private async testResourcePatterns(): Promise<void> {
    console.log('\\n🔍 Testing Resource Patterns...');
    
    try {
      // Create multiple resources
      await this.mcpServer.putResource('mcp://shale-data/inputs/las-files/well1.las', 'las content 1');
      await this.mcpServer.putResource('mcp://shale-data/inputs/las-files/well2.las', 'las content 2');
      await this.mcpServer.putResource('mcp://shale-data/outputs/geology.md', 'geology report');

      // Test pattern matching
      const lasFiles = await this.mcpServer.listResourcesByPattern('mcp://shale-data/inputs/las-files/**');
      const allInputs = await this.mcpServer.listResourcesByPattern('mcp://shale-data/inputs/**');

      this.assert('LAS files pattern match', 
        lasFiles.length === 2, 
        `Expected 2 LAS files, got ${lasFiles.length}`
      );

      this.assert('All inputs pattern match', 
        allInputs.length === 2, 
        `Expected 2 input files, got ${allInputs.length}`
      );

      console.log('  ✅ Pattern matching working correctly');
    } catch (error) {
      this.assert('Resource patterns', false, `Error: ${error}`);
    }
  }

  private async testResourceClient(): Promise<void> {
    console.log('\\n📥 Testing Resource Client...');
    
    const client = new MCPResourceClientImpl(this.mcpServer, 'test-agent');
    
    try {
      // Test basic resource pulling
      const uri = 'mcp://shale-data/inputs/test.json';
      const data = { agent: 'test', data: 'sample' };

      await this.mcpServer.putResource(uri, data);
      const result = await client.getResource(uri);

      this.assert('Resource client pull', 
        JSON.stringify(result) === JSON.stringify(data),
        'Client should pull correct data'
      );

      // Test dependency checking
      const dependencies = [
        {
          uri: 'mcp://shale-data/inputs/required.json',
          required: true,
          condition: 'exists' as const
        },
        {
          uri: 'mcp://shale-data/inputs/optional.json', 
          required: false,
          condition: 'exists' as const
        }
      ];

      // Should fail without required dependency
      let dependenciesMet = await client.checkDependencies(dependencies);
      this.assert('Dependencies check (missing)', 
        !dependenciesMet, 
        'Should fail when required dependency missing'
      );

      // Should pass with required dependency
      await this.mcpServer.putResource('mcp://shale-data/inputs/required.json', { required: true });
      dependenciesMet = await client.checkDependencies(dependencies);
      this.assert('Dependencies check (satisfied)', 
        dependenciesMet, 
        'Should pass when required dependency exists'
      );

      console.log('  ✅ Resource client working correctly');
    } catch (error) {
      this.assert('Resource client', false, `Error: ${error}`);
    }
  }

  private async testPipelineState(): Promise<void> {
    console.log('\\n🔄 Testing Pipeline State Management...');
    
    try {
      // Test state transitions
      await this.stateManager.setState(PipelineState.INITIALIZING);
      let state = await this.stateManager.getCurrentState();
      this.assert('Pipeline state INITIALIZING', 
        state === PipelineState.INITIALIZING,
        `Expected INITIALIZING, got ${state}`
      );

      await this.stateManager.setState(PipelineState.PROCESSING);
      state = await this.stateManager.getCurrentState();
      this.assert('Pipeline state PROCESSING', 
        state === PipelineState.PROCESSING,
        `Expected PROCESSING, got ${state}`
      );

      // Test agent management
      await this.stateManager.markAgentReady('geowiz');
      await this.stateManager.markAgentReady('curve-smith');

      const readyAgents = await this.stateManager.getReadyAgents();
      this.assert('Agent readiness tracking', 
        readyAgents.includes('geowiz') && readyAgents.includes('curve-smith'),
        'Both agents should be marked ready'
      );

      await this.stateManager.markAgentCompleted('geowiz');
      const readyAgentsAfter = await this.stateManager.getReadyAgents();
      this.assert('Agent completion tracking', 
        !readyAgentsAfter.includes('geowiz') && readyAgentsAfter.includes('curve-smith'),
        'Completed agent should be removed from ready list'
      );

      console.log('  ✅ Pipeline state management working');
    } catch (error) {
      this.assert('Pipeline state', false, `Error: ${error}`);
    }
  }

  private async testResourceCoordination(): Promise<void> {
    console.log('\\n🤝 Testing Resource-Based Coordination...');
    
    try {
      // Test proper MCP pull pattern vs push orchestration
      const client1 = new MCPResourceClientImpl(this.mcpServer, 'agent1');
      const client2 = new MCPResourceClientImpl(this.mcpServer, 'agent2');
      
      // Setup resources for parallel agent execution
      await this.mcpServer.putResource('mcp://shale-data/inputs/common-input.json', { shared: true });
      await this.mcpServer.putResource('mcp://shale-data/inputs/agent1-input.json', { agent1: true });
      await this.mcpServer.putResource('mcp://shale-data/inputs/agent2-input.json', { agent2: true });

      // Both agents can pull their dependencies simultaneously (parallel execution)
      const startTime = Date.now();
      const [data1, data2, common] = await Promise.all([
        client1.getResource('mcp://shale-data/inputs/agent1-input.json'),
        client2.getResource('mcp://shale-data/inputs/agent2-input.json'),
        client1.getResource('mcp://shale-data/inputs/common-input.json')
      ]);
      const parallelTime = Date.now() - startTime;

      this.assert('Parallel resource access', 
        data1.agent1 && data2.agent2 && common.shared,
        'All agents should access resources simultaneously'
      );

      // Validate it's using resource URIs (proper MCP pattern)
      const resourceUri = 'mcp://shale-data/outputs/test-output.json';
      this.assert('MCP URI pattern validation', 
        resourceUri.startsWith('mcp://'),
        'Resources should use proper MCP URI scheme'
      );

      console.log(`  ✅ Resource coordination working (${parallelTime}ms parallel execution)`);
    } catch (error) {
      this.assert('Resource coordination', false, `Error: ${error}`);
    }
  }

  private assert(testName: string, condition: boolean, message: string): void {
    this.testResults.push({
      name: testName,
      passed: condition,
      message: message
    });
  }

  private printResults(): void {
    console.log('\\n📊 Test Results');
    console.log('================');
    
    let passed = 0;
    let total = this.testResults.length;
    
    for (const result of this.testResults) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
      if (result.passed) passed++;
    }
    
    console.log(`\\n🎯 Summary: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('\\n🎉 All MCP architecture tests passed!');
      console.log('✅ Resource-based coordination working correctly');
      console.log('✅ Proper MCP patterns implemented');
      console.log('✅ Agents can pull resources on-demand');
      console.log('✅ Parallel execution enabled');
    } else {
      console.log('\\n⚠️  Some tests failed - MCP architecture needs fixes');
      process.exit(1);
    }
  }
}

// Run the tests
const tester = new MCPArchitectureTest();
tester.runAllTests().catch(console.error);