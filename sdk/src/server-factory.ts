/**
 * MCP Server Factory - DRY Solution for Server Creation
 * Eliminates duplication across 14+ MCP servers
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type ConfidenceScale, confidenceMetadata, validateConfidenceScale } from "./confidence-metadata.js";
import { classifyToolError, isToolFailure } from "./errors.js";
import { type MCPExecutionContext, MCPServer, type MCPServerConfig, type MCPTool } from "./mcp-server.js";

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

export type ServerRuntimeOptions = Pick<MCPServerConfig, "http" | "dataPath">;

export interface ServerToolTemplate extends MCPTool {}

export interface AnalysisToolOptions {
	/** Trusted declaration of the handler's score units; never inferred from result prose or magnitude. */
	confidenceScale?: ConfidenceScale;
}

export interface ServerResourceTemplate {
	pattern: string;
	description: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	handler: (uri: URL) => Promise<any>;
}

/**
 * Factory for creating standardized MCP servers with DRY principles
 */
export class ServerFactory {
	/**
	 * Create a new MCP server from template
	 */
	static createServer(template: ServerTemplate): new (options?: ServerRuntimeOptions) => MCPServer {
		return class ConcreteServer extends MCPServer {
			constructor(options: ServerRuntimeOptions = {}) {
				super({
					name: template.name,
					version: "1.0.0",
					description: template.description,
					persona: template.persona,
					dataPath: options.dataPath,
					http: options.http,
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
					this.registerTool(tool);
				}
			}
		};
	}

	/**
	 * Create an analysis tool with truthful score availability and optional declared units.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static createAnalysisTool(
		name: string,
		description: string,
		inputSchema: z.ZodObject<z.ZodRawShape>,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		analyzeFunction: (args: any, context?: MCPExecutionContext, signal?: AbortSignal) => Promise<any>,
		options: AnalysisToolOptions = {},
	): ServerToolTemplate {
		const scale = options.confidenceScale;
		validateConfidenceScale(scale);
		return {
			name,
			description,
			inputSchema,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			handler: async (args: any, context?: MCPExecutionContext, signal?: AbortSignal) => {
				try {
					const startTime = Date.now();
					const analysis = await analyzeFunction(args, context, signal);
					const executionTime = Date.now() - startTime;
					if (isToolFailure(analysis)) return analysis;

					return {
						success: true,
						analysis,
						metadata: {
							executionTime,
							...confidenceMetadata(analysis.confidence, scale),
							timestamp: new Date().toISOString(),
						},
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						error_type: classifyToolError(error),
						suggestions: ["Check input parameters", "Verify data format"],
					};
				}
			},
		};
	}

	/**
	 * Create file processing tool with standard validation
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static createFileProcessingTool(
		name: string,
		description: string,
		supportedFormats: string[],
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		processFunction: (filePath: string, args: any) => Promise<any>,
	): ServerToolTemplate {
		return {
			name,
			description,
			inputSchema: z.object({
				filePath: z.string().describe("Path to input file"),
				outputPath: z.string().optional().describe("Path for output file"),
				options: z.object({}).optional().describe("Processing options"),
			}),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			handler: async (args: any) => {
				try {
					// Validate file exists
					await fs.access(args.filePath);

					// Validate format
					const ext = path.extname(args.filePath).toLowerCase();
					if (!supportedFormats.includes(ext)) {
						throw new Error(`Unsupported format: ${ext}. Supported: ${supportedFormats.join(", ")}`);
					}

					const result = await processFunction(args.filePath, args);
					if (isToolFailure(result)) return result;

					return {
						success: true,
						data: result,
						metadata: {
							inputFile: args.filePath,
							outputFile: args.outputPath,
							format: ext,
							processedAt: new Date().toISOString(),
						},
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						error_type: classifyToolError(error),
						suggestions: [
							"Check file exists and is readable",
							"Verify file format is supported",
							"Check file permissions",
						],
					};
				}
			},
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
			resources: [],
		}),

		FILE_PROCESSOR: (name: string, persona: ServerPersona, _formats: string[]) => ({
			name,
			description: `${persona.role} MCP Server`,
			persona,
			directories: ["inputs", "outputs", "analyses", "reports"],
			tools: [],
			resources: [],
		}),
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
		return Math.min(0.95, dataQuality * 0.6 + analysisDepth * 0.4);
	}

	/**
	 * Standard error response
	 */
	static createErrorResponse(
		message: string,
		details?: string[],
	): { success: false; error: string; details: string[]; timestamp: string; suggestions: string[] } {
		return {
			success: false,
			error: message,
			details: details || [],
			timestamp: new Date().toISOString(),
			suggestions: [
				"Check input parameters",
				"Verify data format and quality",
				"Review error details for specific issues",
			],
		};
	}

	/**
	 * Standard success response
	 */
	static createSuccessResponse(
		data: Record<string, unknown>,
		metadata?: Record<string, unknown>,
	): { success: true; data: Record<string, unknown>; metadata: Record<string, unknown> } {
		return {
			success: true,
			data,
			metadata: {
				timestamp: new Date().toISOString(),
				...metadata,
			},
		};
	}
}

export default ServerFactory;
