/**
 * Standalone MCP Server Base Class
 *
 * Provides the foundation for creating true standalone MCP servers that can:
 * - Run independently via stdio transport
 * - Serve HTTP requests for web integration
 * - Be discovered by Claude Desktop and other MCP clients
 * - Follow MCP protocol standards
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { FileIntegrationManager } from './file-integration.js';

export interface StandaloneMCPConfig {
  name: string;
  version: string;
  description: string;
  resourceRoot: string;
  dataPath?: string;
  transport: 'stdio' | 'http' | 'websocket';
  port?: number; // For HTTP/WebSocket transport
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  handler: (args: any) => Promise<any>;
}

export interface MCPResourceDefinition {
  name: string;
  uri: string;
  description: string;
  mimeType?: string;
  handler: (uri: URL) => Promise<any>;
}

/**
 * Abstract base class for creating standalone MCP servers
 */
export abstract class StandaloneMCPServer {
  protected server: McpServer;
  protected transport: StdioServerTransport | any;
  protected resourceRoot: string;
  protected dataPath: string;
  protected initialized = false;
  protected name: string;
  protected version: string;
  protected description: string;
  protected fileManager: FileIntegrationManager;
  protected config: StandaloneMCPConfig;

  constructor(config: StandaloneMCPConfig) {
    this.config = config;
    this.name = config.name;
    this.version = config.version;
    this.description = config.description;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, this.name);

    // Initialize file processing capabilities
    this.fileManager = new FileIntegrationManager();

    // Create MCP server using the same API as existing servers
    this.server = new McpServer({
      name: config.name,
      version: config.version,
    });

    // Setup transport based on configuration
    this.setupTransport();

    // Setup domain-specific implementations
    this.setupServerCapabilities();
  }

  /**
   * Abstract method - Domain servers must implement their specific tools/resources
   */
  protected abstract setupServerCapabilities(): void;

  /**
   * Abstract method - Domain servers must setup their data directories
   */
  protected abstract setupDomainDirectories(): Promise<void>;

  /**
   * Setup transport layer based on configuration
   */
  private setupTransport(): void {
    switch (this.config.transport) {
      case 'stdio':
        this.transport = new StdioServerTransport();
        break;
      case 'http':
        // HTTP transport setup (future implementation)
        throw new Error('HTTP transport not yet implemented');
      case 'websocket':
        // WebSocket transport setup (future implementation)
        throw new Error('WebSocket transport not yet implemented');
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }

  /**
   * Initialize the MCP server
   */
  async initialize(): Promise<void> {
    try {
      // Create directory structure
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupDomainDirectories();

      // Connect server to transport
      await this.server.connect(this.transport);

      this.initialized = true;
      console.log(`✅ ${this.name} MCP Server v${this.version} initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
      console.log(`🔌 Transport: ${this.config.transport}`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.name} MCP server:`, error);
      throw error;
    }
  }

  /**
   * Start the server and begin listening
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // For stdio transport, we just need to ensure the server is ready
    if (this.config.transport === 'stdio') {
      console.log(`🚀 ${this.name} MCP Server ready for stdio communication`);
    } else {
      // For HTTP/WebSocket, we would start listening on the specified port
      console.log(`🚀 ${this.name} MCP Server listening on port ${this.config.port}`);
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
      this.initialized = false;
      console.log(`✅ ${this.name} MCP Server stopped gracefully`);
    } catch (error) {
      console.error(`❌ Error stopping ${this.name} server:`, error);
      throw error;
    }
  }

  /**
   * Get server status and capabilities
   */
  getServerInfo(): any {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      initialized: this.initialized,
      transport: this.config.transport,
      capabilities: this.server.getCapabilities?.() || {},
      resourceRoot: this.resourceRoot,
      dataPath: this.dataPath
    };
  }

  /**
   * Helper method to register MCP tools with consistent patterns
   */
  protected registerTool(definition: MCPToolDefinition): void {
    // Use the same API as existing MCP servers
    this.server.tool(
      definition.name,
      definition.description,
      {
        type: 'object',
        properties: definition.inputSchema._def?.shape || {},
        required: definition.inputSchema._def?.required || []
      },
      async (args, extra) => {
        try {
          console.log(`🔧 Executing tool: ${definition.name}`);

          // Validate input with Zod schema
          const validatedInput = definition.inputSchema.parse(args);

          // Execute tool handler
          const result = await definition.handler(validatedInput);

          console.log(`✅ Tool completed: ${definition.name}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          console.error(`❌ Tool failed: ${definition.name}`, error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: `Tool execution failed: ${definition.name}`,
                  message: String(error),
                  timestamp: new Date().toISOString()
                })
              }
            ]
          };
        }
      }
    );
  }

  /**
   * Helper method to register MCP resources with consistent patterns
   */
  protected registerResource(definition: MCPResourceDefinition): void {
    // Use the same API as existing MCP servers
    this.server.resource(
      definition.name,
      definition.uri,
      async (uri) => {
        try {
          console.log(`📄 Reading resource: ${definition.name}`);

          const result = await definition.handler(uri);

          console.log(`✅ Resource read: ${definition.name}`);
          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: definition.mimeType || 'application/json',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          console.error(`❌ Resource read failed: ${definition.name}`, error);
          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: 'application/json',
                text: JSON.stringify({
                  error: `Resource read failed: ${definition.name}`,
                  message: String(error),
                  timestamp: new Date().toISOString()
                })
              }
            ]
          };
        }
      }
    );
  }

  /**
   * Helper method to create standardized error responses
   */
  protected createErrorResponse(message: string, details?: string[], suggestions?: string[]): any {
    return {
      error: message,
      details: details || [],
      suggestions: suggestions || [],
      timestamp: new Date().toISOString(),
      server: this.name,
      version: this.version
    };
  }

  /**
   * Helper method to create standardized success responses
   */
  protected createSuccessResponse(data: any, metadata?: any): any {
    return {
      success: true,
      data,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        server: this.name,
        version: this.version
      }
    };
  }
}

/**
 * Main entry point for running a standalone MCP server
 */
export async function runStandaloneMCPServer(server: StandaloneMCPServer): Promise<void> {
  try {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n📡 Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n📡 Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    // Start the server
    await server.start();

    // Keep the process alive for stdio transport
    if (server.getServerInfo().transport === 'stdio') {
      // For stdio transport, we keep the process alive
      await new Promise(() => {}); // Never resolves, keeps process alive
    }

  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}