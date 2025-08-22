/**
 * Base MCP Server - Standards-Compliant Implementation
 * Eliminates duplicate code across domain-specific MCP servers
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface BaseMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

/**
 * Base MCP Server providing common functionality for all domain servers
 */
export abstract class BaseMCPServer {
  protected server: McpServer;
  protected resourceRoot: string;
  protected dataPath: string;
  protected initialized = false;
  protected name: string;
  protected version: string;
  protected domainName: string;

  constructor(config: BaseMCPConfig, domainName: string) {
    this.name = config.name;
    this.version = config.version;
    this.domainName = domainName;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, domainName);

    // Create official MCP server with domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupDomainSpecifics();
  }

  /**
   * Abstract method for domain-specific setup
   */
  protected abstract setupDomainSpecifics(): void;

  /**
   * Abstract method for domain-specific directories
   */
  protected abstract setupDomainDirectories(): Promise<void>;

  /**
   * Initialize MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupDomainDirectories();
      
      this.initialized = true;
      console.log(`✅ ${this.domainName} MCP Server initialized: ${this.name}`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.domainName} MCP server:`, error);
      throw error;
    }
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get server info
   */
  getServerInfo(): { name: string; version: string; domain: string; initialized: boolean } {
    return {
      name: this.name,
      version: this.version,
      domain: this.domainName,
      initialized: this.initialized
    };
  }

  /**
   * Get MCP server instance for direct access
   */
  getMCPServer(): McpServer {
    return this.server;
  }

  /**
   * Shutdown server gracefully
   */
  async shutdown(): Promise<void> {
    try {
      // MCP SDK doesn't require explicit shutdown, but we clean up our state
      this.initialized = false;
      console.log(`✅ ${this.domainName} MCP Server shutdown complete`);
    } catch (error) {
      console.error(`❌ Error during ${this.domainName} server shutdown:`, error);
      throw error;
    }
  }

  /**
   * Helper method to create directory structures
   */
  protected async createDirectories(dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      const fullPath = path.join(this.dataPath, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Helper method to setup tool handlers with common validation
   */
  protected setupToolHandler(name: string, schema: z.ZodSchema, handler: (input: any) => Promise<any>): void {
    this.server.tool(name, {
      description: `${this.domainName} domain tool: ${name}`,
      inputSchema: schema
    }, async (input) => {
      try {
        console.log(`🔧 Executing ${this.domainName} tool: ${name}`);
        const result = await handler(input);
        console.log(`✅ ${this.domainName} tool completed: ${name}`);
        return result;
      } catch (error) {
        console.error(`❌ ${this.domainName} tool failed: ${name}`, error);
        throw error;
      }
    });
  }

  /**
   * Helper method to register resources with common patterns
   */
  protected registerResource(name: string, uri: string, description: string, mimeType?: string): void {
    this.server.resource(name, uri, async () => {
      try {
        const filePath = path.join(this.dataPath, name);
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          contents: [{
            uri,
            mimeType: mimeType || 'text/plain',
            text: content
          }]
        };
      } catch (error) {
        console.warn(`⚠️ Resource not found: ${uri}`);
        return {
          contents: [{
            uri,
            mimeType: 'text/plain', 
            text: `Resource not yet available: ${name}`
          }]
        };
      }
    });
  }

  /**
   * Helper method to register prompts with common patterns
   */
  protected registerPrompt(name: string, description: string, handler: () => Promise<any>): void {
    this.server.prompt(name, `${this.domainName} domain prompt: ${description}`, async () => {
      try {
        console.log(`💭 Executing ${this.domainName} prompt: ${name}`);
        const result = await handler();
        console.log(`✅ ${this.domainName} prompt completed: ${name}`);
        return result;
      } catch (error) {
        console.error(`❌ ${this.domainName} prompt failed: ${name}`, error);
        throw error;
      }
    });
  }
}