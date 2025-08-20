/**
 * MCP Resource Client
 * Agent-side interface for accessing MCP resources
 */

import type { 
  MCPResourceClient, 
  MCPResource, 
  MCPResourceDependency,
  MCPResourceServer 
} from './mcp-types.js';

export class MCPResourceClientImpl implements MCPResourceClient {
  private server: MCPResourceServer;
  private agentName: string;
  private logger: Console;

  constructor(server: MCPResourceServer, agentName: string) {
    this.server = server;
    this.agentName = agentName;
    this.logger = console;
  }

  async getResource<T = any>(uri: string): Promise<T> {
    try {
      const resource = await this.server.getResource(uri);
      this.logger.info(`📥 ${this.agentName} pulled resource: ${uri}`);
      return resource;
    } catch (error) {
      this.logger.error(`❌ ${this.agentName} failed to get resource ${uri}:`, error);
      throw error;
    }
  }

  async putResource(uri: string, data: any): Promise<void> {
    try {
      await this.server.putResource(uri, data);
      this.logger.info(`📤 ${this.agentName} published resource: ${uri}`);
    } catch (error) {
      this.logger.error(`❌ ${this.agentName} failed to put resource ${uri}:`, error);
      throw error;
    }
  }

  async waitForResource<T = any>(uri: string, timeout: number = 30000): Promise<T> {
    const startTime = Date.now();
    
    // Check if resource already exists
    if (await this.server.resourceExists(uri)) {
      return this.getResource<T>(uri);
    }

    this.logger.info(`⏳ ${this.agentName} waiting for resource: ${uri}`);

    return new Promise<T>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for resource: ${uri}`));
      }, timeout);

      try {
        // Watch for the resource to become available
        for await (const event of this.server.watchResource(uri)) {
          if (event.type === 'created' || event.type === 'updated') {
            clearTimeout(timeoutId);
            const resource = await this.getResource<T>(uri);
            const waitTime = Date.now() - startTime;
            this.logger.info(`✅ ${this.agentName} resource ready after ${waitTime}ms: ${uri}`);
            resolve(resource);
            break;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async checkDependencies(dependencies: MCPResourceDependency[]): Promise<boolean> {
    for (const dep of dependencies) {
      const available = await this.checkSingleDependency(dep);
      
      if (!available && dep.required) {
        this.logger.warn(`⚠️  ${this.agentName} missing required dependency: ${dep.uri}`);
        return false;
      }
      
      if (!available && !dep.required) {
        this.logger.info(`ℹ️  ${this.agentName} optional dependency not available: ${dep.uri}`);
      }
    }

    return true;
  }

  async waitForDependencies(dependencies: MCPResourceDependency[]): Promise<void> {
    const requiredDeps = dependencies.filter(dep => dep.required);
    
    if (requiredDeps.length === 0) {
      return;
    }

    this.logger.info(`⏳ ${this.agentName} waiting for ${requiredDeps.length} dependencies...`);

    const dependencyPromises = requiredDeps.map(async (dep) => {
      const timeout = dep.timeout || 60000; // Default 60s timeout
      
      try {
        await this.waitForResource(dep.uri, timeout);
        return { dep, success: true };
      } catch (error) {
        this.logger.error(`❌ ${this.agentName} dependency failed: ${dep.uri}`, error);
        return { dep, success: false, error };
      }
    });

    const results = await Promise.allSettled(dependencyPromises);
    
    const failures = results.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.success)
    );

    if (failures.length > 0) {
      const failedUris = failures.map(f => 
        f.status === 'fulfilled' ? f.value.dep.uri : 'unknown'
      );
      throw new Error(`${this.agentName} dependencies failed: ${failedUris.join(', ')}`);
    }

    this.logger.info(`✅ ${this.agentName} all dependencies satisfied`);
  }

  async discoverResources(pattern: string): Promise<MCPResource[]> {
    const resources = await this.server.listResourcesByPattern(pattern);
    this.logger.info(`🔍 ${this.agentName} discovered ${resources.length} resources matching: ${pattern}`);
    return resources;
  }

  private async checkSingleDependency(dep: MCPResourceDependency): Promise<boolean> {
    try {
      const exists = await this.server.resourceExists(dep.uri);
      
      if (!exists) {
        return false;
      }

      switch (dep.condition) {
        case 'exists':
          return true;
          
        case 'not-empty':
          const resource = await this.server.getResource(dep.uri);
          if (typeof resource === 'string') {
            return resource.trim().length > 0;
          }
          if (Array.isArray(resource)) {
            return resource.length > 0;
          }
          if (typeof resource === 'object') {
            return Object.keys(resource).length > 0;
          }
          return true;
          
        case 'valid-schema':
          // TODO: Implement schema validation
          return true;
          
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }
}