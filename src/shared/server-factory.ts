/**
 * MCP Server Factory - DRY Solution for Server Creation
 * Eliminates duplication across 14+ MCP servers
 */

import { MCPServer, MCPServerConfig } from './mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface ServerPersona {
  name: string;
  role: string;
  expertise: string[];
}

export interface ServerTemplate {
  name: string;
  description: string;
  persona: ServerPersona;
  directories: string[];
  tools: ServerToolTemplate[];
  resources?: ServerResourceTemplate[];
}

export interface ServerToolTemplate {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (args: any) => Promise<any>;
}

export interface ServerResourceTemplate {
  pattern: string;
  description: string;
  handler: (uri: URL) => Promise<any>;
}

/**
 * Factory for creating standardized MCP servers with DRY principles
 */
export class ServerFactory {
  /**
   * Create a new MCP server from template
   */
  static createServer(template: ServerTemplate): typeof MCPServer {
    return class extends MCPServer {
      constructor() {
        super({
          name: template.name,
          version: '1.0.0',
          description: template.description,
          persona: template.persona
        });
      }

      protected async setupDataDirectories(): Promise<void> {
        for (const dir of template.directories) {
          await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
        }
      }

      protected setupCapabilities(): void {
        // Register all tools from template
        for (const tool of template.tools) {
          this.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            handler: tool.handler
          });
        }

        // Register all resources from template
        if (template.resources) {
          for (const resource of template.resources) {
            // Resources implementation would need to match MCPServer interface
            // this.registerResource(resource.pattern, resource.description, resource.handler);
          }
        }
      }
    };
  }

  /**
   * Create analysis tool with standard confidence scoring
   */
  static createAnalysisTool(
    name: string,
    description: string,
    inputSchema: z.ZodSchema,
    analyzeFunction: (args: any) => Promise<any>
  ): ServerToolTemplate {
    return {
      name,
      description,
      inputSchema,
      handler: async (args: any) => {
        try {
          const startTime = Date.now();
          const analysis = await analyzeFunction(args);
          const executionTime = Date.now() - startTime;

          return {
            success: true,
            analysis,
            metadata: {
              executionTime,
              confidence: analysis.confidence || 0.85,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            suggestions: ['Check input parameters', 'Verify data format']
          };
        }
      }
    };
  }

  /**
   * Create file processing tool with standard validation
   */
  static createFileProcessingTool(
    name: string,
    description: string,
    supportedFormats: string[],
    processFunction: (filePath: string, args: any) => Promise<any>
  ): ServerToolTemplate {
    return {
      name,
      description,
      inputSchema: z.object({
        filePath: z.string().describe('Path to input file'),
        outputPath: z.string().optional().describe('Path for output file'),
        options: z.object({}).optional().describe('Processing options')
      }),
      handler: async (args: any) => {
        try {
          // Validate file exists
          await fs.access(args.filePath);

          // Validate format
          const ext = path.extname(args.filePath).toLowerCase();
          if (!supportedFormats.includes(ext)) {
            throw new Error(`Unsupported format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
          }

          const result = await processFunction(args.filePath, args);

          return {
            success: true,
            data: result,
            metadata: {
              inputFile: args.filePath,
              outputFile: args.outputPath,
              format: ext,
              processedAt: new Date().toISOString()
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            suggestions: [
              'Check file exists and is readable',
              'Verify file format is supported',
              'Check file permissions'
            ]
          };
        }
      }
    };
  }

  /**
   * Common server templates for standard domains
   */
  static readonly TEMPLATES = {
    SIMPLE_ANALYSIS: (name: string, persona: ServerPersona, directories: string[]) => ({
      name,
      description: `${persona.role} MCP Server`,
      persona,
      directories,
      tools: [],
      resources: []
    }),

    FILE_PROCESSOR: (name: string, persona: ServerPersona, formats: string[]) => ({
      name,
      description: `${persona.role} MCP Server`,
      persona,
      directories: ['inputs', 'outputs', 'analyses', 'reports'],
      tools: [],
      resources: []
    })
  };
}

/**
 * Utility functions for common server patterns
 */
export class ServerUtils {
  /**
   * Standard confidence calculation
   */
  static calculateConfidence(dataQuality: number, analysisDepth: number): number {
    return Math.min(0.95, (dataQuality * 0.6) + (analysisDepth * 0.4));
  }

  /**
   * Standard error response
   */
  static createErrorResponse(message: string, details?: string[]): any {
    return {
      success: false,
      error: message,
      details: details || [],
      timestamp: new Date().toISOString(),
      suggestions: [
        'Check input parameters',
        'Verify data format and quality',
        'Review error details for specific issues'
      ]
    };
  }

  /**
   * Standard success response
   */
  static createSuccessResponse(data: any, metadata?: any): any {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }
}

export default ServerFactory;