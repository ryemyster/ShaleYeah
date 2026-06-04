/**
 * Production MCP Server Base Class
 * Standards-compliant MCP server implementation for SHALE YEAH domain experts.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import { FileIntegrationManager } from "./file-integration.js";

export interface MCPServerConfig {
	name: string;
	version: string;
	description: string;
	persona: {
		name: string;
		role: string;
		expertise: string[];
	};
	dataPath?: string;
}

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: z.ZodObject<z.ZodRawShape>;
	handler: (args: any) => Promise<any>;
	/** Tool classification: query (read-only), command (side effects), discovery (meta) */
	type?: "query" | "command" | "discovery";
	/** Supported response detail levels */
	detailLevel?: "summary" | "standard" | "full";
	/**
	 * Fully-qualified tool names that must complete before this tool can run.
	 * Format: "serverName.toolName" (e.g. "geowiz.analyze").
	 * Omit or leave empty for tools with no prerequisites.
	 */
	dependsOn?: string[];
	/**
	 * Fully-qualified tool names that can consume this tool's output.
	 * Inverse of dependsOn — for documentation and graph traversal.
	 */
	providesFor?: string[];
}

export interface MCPResource {
	name: string;
	uri: string;
	description: string;
	mimeType?: string;
	handler: (uri: URL) => Promise<any>;
}

/**
 * Base MCP Server - All domain experts inherit from this
 */
export abstract class MCPServer {
	protected server: McpServer;
	protected transport: StdioServerTransport;
	public config: MCPServerConfig;
	public dataPath: string;
	public fileManager: FileIntegrationManager;
	protected initialized = false;

	constructor(config: MCPServerConfig) {
		this.config = config;
		this.dataPath = config.dataPath || path.join("./data", config.name.toLowerCase());
		this.fileManager = new FileIntegrationManager();

		this.server = new McpServer({
			name: config.name,
			version: config.version,
		});

		this.transport = new StdioServerTransport();
		this.setupCapabilities();
	}

	protected abstract setupCapabilities(): void;
	protected abstract setupDataDirectories(): Promise<void>;

	async initialize(): Promise<void> {
		try {
			await fs.mkdir(this.dataPath, { recursive: true });
			await this.setupDataDirectories();
			await this.server.connect(this.transport);
			this.initialized = true;
			console.log(`✅ ${this.config.name} v${this.config.version} initialized`);
		} catch (error) {
			console.error(`❌ Failed to initialize ${this.config.name}:`, error);
			throw error;
		}
	}

	async start(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
		console.log(`🚀 ${this.config.persona.name} ready`);
		await new Promise(() => {});
	}

	async stop(): Promise<void> {
		try {
			await this.server.close();
			this.initialized = false;
			console.log(`✅ ${this.config.name} stopped`);
		} catch (error) {
			console.error(`❌ Error stopping ${this.config.name}:`, error);
			throw error;
		}
	}

	public registerTool(tool: MCPTool): void {
		this.server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args: any) => {
			try {
				console.log(`🔧 ${this.config.persona.name}: ${tool.name}`);
				const validatedArgs = tool.inputSchema.parse(args);
				const result = await tool.handler(validatedArgs);
				console.log(`✅ ${tool.name} completed`);
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(this.formatResult(result), null, 2),
						},
					],
				};
			} catch (error) {
				console.error(`❌ ${tool.name} failed:`, error);
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(this.formatError(tool.name, error), null, 2),
						},
					],
				};
			}
		});
	}

	public registerResource(resource: MCPResource): void {
		this.server.resource(resource.name, resource.uri, async (uri: URL) => {
			try {
				console.log(`📄 ${this.config.persona.name}: ${resource.name}`);
				const result = await resource.handler(uri);
				return {
					contents: [
						{
							uri: uri.toString(),
							mimeType: resource.mimeType || "application/json",
							text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				console.error(`❌ Resource ${resource.name} failed:`, error);
				return {
					contents: [
						{
							uri: uri.toString(),
							mimeType: "application/json",
							text: JSON.stringify(this.formatError(resource.name, error), null, 2),
						},
					],
				};
			}
		});
	}

	protected formatResult(data: any, detailLevel?: "summary" | "standard" | "full"): any {
		return {
			success: true,
			data,
			...(detailLevel ? { detailLevel } : {}),
			metadata: {
				server: this.config.name,
				persona: this.config.persona.name,
				timestamp: new Date().toISOString(),
				version: this.config.version,
			},
		};
	}

	protected formatError(operation: string, error: any): any {
		const message = String(error);
		return {
			success: false,
			error: {
				operation,
				message,
				error_type: this.classifyErrorType(message),
				server: this.config.name,
				persona: this.config.persona.name,
				timestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Basic error type classification for MCP server responses.
	 * The kernel's ResilienceMiddleware provides more detailed classification.
	 */
	private classifyErrorType(message: string): string {
		if (/unauthorized|forbidden|api.?key|401|403/i.test(message)) return "auth_required";
		if (/file.?not.?found|missing.?data|ENOENT/i.test(message)) return "user_action";
		if (/timeout|rate.?limit|ECONNREFUSED|429|503/i.test(message)) return "retryable";
		if (/invalid|validation|schema|zod/i.test(message)) return "permanent";
		return "retryable";
	}

	protected async saveResult(filename: string, data: any): Promise<string> {
		const filepath = path.join(this.dataPath, filename);
		await fs.writeFile(filepath, JSON.stringify(data, null, 2));
		return filepath;
	}

	protected async loadResult(filename: string): Promise<any> {
		const filepath = path.join(this.dataPath, filename);
		const data = await fs.readFile(filepath, "utf-8");
		return JSON.parse(data);
	}

	getInfo(): any {
		return {
			name: this.config.name,
			version: this.config.version,
			description: this.config.description,
			persona: this.config.persona,
			initialized: this.initialized,
			dataPath: this.dataPath,
		};
	}
}

export async function runMCPServer(server: MCPServer): Promise<void> {
	try {
		process.on("SIGINT", async () => {
			try {
				console.log("\n📡 Shutting down...");
				await server.stop();
			} catch (_error) {
				// Ignore shutdown errors to prevent EPIPE
			} finally {
				process.exit(0);
			}
		});

		process.on("SIGTERM", async () => {
			try {
				console.log("\n📡 Shutting down...");
				await server.stop();
			} catch (_error) {
				// Ignore shutdown errors to prevent EPIPE
			} finally {
				process.exit(0);
			}
		});

		// Handle EPIPE errors gracefully
		process.stdout.on("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EPIPE") {
				process.exit(0);
			}
		});

		process.stderr.on("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EPIPE") {
				process.exit(0);
			}
		});

		await server.start();
	} catch (error) {
		console.error("❌ Failed to start MCP server:", error);
		process.exit(1);
	}
}
