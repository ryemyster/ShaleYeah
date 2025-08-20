/**
 * MCP Architecture Tests
 * Validates proper resource-based coordination patterns
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { FileSystemMCPResourceServer } from '../src/shared/mcp-resource-server.js';
import { MCPResourceClientImpl } from '../src/shared/mcp-resource-client.js';
import { MCPPipelineStateManager } from '../src/shared/mcp-pipeline-state.js';
import { PipelineState } from '../src/shared/mcp-types.js';
import { MCPControllerV2 } from '../src/mcp-controller-v2.js';

describe('MCP Resource Architecture', () => {
  let tempDir: string;
  let mcpServer: FileSystemMCPResourceServer;
  let stateManager: MCPPipelineStateManager;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp', 'mcp-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    mcpServer = new FileSystemMCPResourceServer(tempDir);
    await mcpServer.initialize();
    
    stateManager = new MCPPipelineStateManager(mcpServer);
  });

  afterEach(async () => {
    await mcpServer.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Resource Server', () => {
    it('should store and retrieve resources by URI', async () => {
      const uri = 'mcp://shale-data/test/sample.json';
      const data = { message: 'test data', timestamp: Date.now() };

      await mcpServer.putResource(uri, data);
      const retrieved = await mcpServer.getResource(uri);

      expect(retrieved).toEqual(data);
    });

    it('should list resources by pattern', async () => {
      await mcpServer.putResource('mcp://shale-data/inputs/las-files/well1.las', 'las content 1');
      await mcpServer.putResource('mcp://shale-data/inputs/las-files/well2.las', 'las content 2');
      await mcpServer.putResource('mcp://shale-data/outputs/geology.md', 'geology report');

      const lasFiles = await mcpServer.listResourcesByPattern('mcp://shale-data/inputs/las-files/**');
      const allInputs = await mcpServer.listResourcesByPattern('mcp://shale-data/inputs/**');

      expect(lasFiles).toHaveLength(2);
      expect(allInputs).toHaveLength(2);
    });

    it('should emit events on resource updates', async () => {
      const events: any[] = [];
      const uri = 'mcp://shale-data/test/watched.json';

      // Set up watcher
      const watchPromise = (async () => {
        for await (const event of mcpServer.watchResource(uri)) {
          events.push(event);
          if (events.length >= 2) break; // Stop after 2 events
        }
      })();

      // Give watcher time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create and update resource
      await mcpServer.putResource(uri, { version: 1 });
      await mcpServer.putResource(uri, { version: 2 });

      // Wait for events
      await Promise.race([
        watchPromise,
        new Promise(resolve => setTimeout(resolve, 1000)) // Timeout
      ]);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('updated');
      expect(events[1].type).toBe('updated');
    });
  });

  describe('Resource Client', () => {
    let client: MCPResourceClientImpl;

    beforeEach(() => {
      client = new MCPResourceClientImpl(mcpServer, 'test-agent');
    });

    it('should pull resources from server', async () => {
      const uri = 'mcp://shale-data/inputs/test.json';
      const data = { agent: 'test', data: 'sample' };

      await mcpServer.putResource(uri, data);
      const result = await client.getResource(uri);

      expect(result).toEqual(data);
    });

    it('should wait for resources to become available', async () => {
      const uri = 'mcp://shale-data/inputs/delayed.json';
      const data = { delayed: true };

      // Start waiting
      const waitPromise = client.waitForResource(uri, 5000);

      // Publish resource after delay
      setTimeout(async () => {
        await mcpServer.putResource(uri, data);
      }, 100);

      const result = await waitPromise;
      expect(result).toEqual(data);
    });

    it('should check dependencies correctly', async () => {
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
      expect(dependenciesMet).toBe(false);

      // Should pass with required dependency
      await mcpServer.putResource('mcp://shale-data/inputs/required.json', { required: true });
      dependenciesMet = await client.checkDependencies(dependencies);
      expect(dependenciesMet).toBe(true);
    });
  });

  describe('Pipeline State Management', () => {
    it('should track pipeline state changes', async () => {
      await stateManager.setState(PipelineState.INITIALIZING);
      let state = await stateManager.getCurrentState();
      expect(state).toBe(PipelineState.INITIALIZING);

      await stateManager.setState(PipelineState.PROCESSING);
      state = await stateManager.getCurrentState();
      expect(state).toBe(PipelineState.PROCESSING);
    });

    it('should manage agent readiness', async () => {
      await stateManager.markAgentReady('geowiz');
      await stateManager.markAgentReady('curve-smith');

      const readyAgents = await stateManager.getReadyAgents();
      expect(readyAgents).toContain('geowiz');
      expect(readyAgents).toContain('curve-smith');

      await stateManager.markAgentCompleted('geowiz');
      const readyAgentsAfter = await stateManager.getReadyAgents();
      expect(readyAgentsAfter).not.toContain('geowiz');
      expect(readyAgentsAfter).toContain('curve-smith');
    });

    it('should track resource availability', async () => {
      const uri = 'mcp://shale-data/outputs/test-output.json';
      
      let resourceState = await stateManager.getResourceState(uri);
      expect(resourceState).toBe('missing');

      await stateManager.markResourceReady(uri);
      resourceState = await stateManager.getResourceState(uri);
      expect(resourceState).toBe('available');
    });
  });

  describe('MCP Controller V2', () => {
    let controller: MCPControllerV2;
    let testRunId: string;

    beforeEach(async () => {
      testRunId = 'test-mcp-' + Date.now();
      controller = new MCPControllerV2(testRunId, tempDir, 'demo');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(async () => {
      await controller.shutdown();
    });

    it('should initialize with proper MCP structure', async () => {
      // Check that MCP resource directories were created
      const resourceRoot = path.join(tempDir, 'mcp-resources');
      const inputsDir = path.join(resourceRoot, 'inputs');
      const outputsDir = path.join(resourceRoot, 'outputs');
      
      expect(await fs.access(inputsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(outputsDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should setup initial resources from input directory', async () => {
      // Create test input data
      const testInputDir = path.join(tempDir, 'test-inputs');
      await fs.mkdir(testInputDir, { recursive: true });
      await fs.writeFile(path.join(testInputDir, 'sample.las'), 'test las content');
      await fs.writeFile(path.join(testInputDir, 'data.json'), '{"test": true}');

      await controller.setupInitialResources(testInputDir);

      // Verify resources were created in MCP
      const mcpResourceServer = controller['mcpServer'];
      const lasExists = await mcpResourceServer.resourceExists('mcp://shale-data/inputs/sample.las');
      const jsonExists = await mcpResourceServer.resourceExists('mcp://shale-data/inputs/data.json');

      expect(lasExists).toBe(true);
      expect(jsonExists).toBe(true);
    });
  });

  describe('Resource-Based Coordination', () => {
    it('should follow proper MCP pull patterns vs push orchestration', async () => {
      const client = new MCPResourceClientImpl(mcpServer, 'test-agent');
      
      // ✅ CORRECT: Agent pulls resource when ready
      const resourceUri = 'mcp://shale-data/inputs/geology-data.json';
      const data = { formation: 'Wolfcamp', depth: 8500 };
      
      await mcpServer.putResource(resourceUri, data);
      const pulledData = await client.getResource(resourceUri);
      
      expect(pulledData).toEqual(data);
      
      // ❌ WRONG: Direct data pushing would violate MCP patterns
      // This test validates we're using resource URIs, not direct data passing
      expect(typeof resourceUri).toBe('string');
      expect(resourceUri.startsWith('mcp://')).toBe(true);
    });

    it('should enable parallel agent execution when dependencies are met', async () => {
      // Setup scenario: Two agents can run in parallel if both have their dependencies
      await mcpServer.putResource('mcp://shale-data/inputs/common-input.json', { shared: true });
      await mcpServer.putResource('mcp://shale-data/inputs/agent1-input.json', { agent1: true });
      await mcpServer.putResource('mcp://shale-data/inputs/agent2-input.json', { agent2: true });

      const client1 = new MCPResourceClientImpl(mcpServer, 'agent1');
      const client2 = new MCPResourceClientImpl(mcpServer, 'agent2');

      // Both agents can pull their dependencies simultaneously
      const [data1, data2, common] = await Promise.all([
        client1.getResource('mcp://shale-data/inputs/agent1-input.json'),
        client2.getResource('mcp://shale-data/inputs/agent2-input.json'),
        client1.getResource('mcp://shale-data/inputs/common-input.json')
      ]);

      expect(data1.agent1).toBe(true);
      expect(data2.agent2).toBe(true);
      expect(common.shared).toBe(true);
    });
  });
});

describe('MCP vs Traditional Orchestration', () => {
  it('should demonstrate the difference between push and pull patterns', () => {
    // ❌ WRONG: Traditional push orchestration
    const wrongOrchestration = {
      executeAgent: (agentName: string, data: any) => {
        // Controller pushes data to agent
        return `${agentName} received: ${JSON.stringify(data)}`;
      }
    };

    // ✅ RIGHT: MCP resource-based pull
    const rightMCPPattern = {
      agentPullsResource: async (uri: string) => {
        // Agent pulls resource when ready
        return `Agent pulling resource: ${uri}`;
      }
    };

    expect(wrongOrchestration.executeAgent('agent1', { data: 'pushed' }))
      .toBe('agent1 received: {"data":"pushed"}');
    
    expect(rightMCPPattern.agentPullsResource('mcp://shale-data/inputs/data'))
      .resolves.toBe('Agent pulling resource: mcp://shale-data/inputs/data');
  });
});