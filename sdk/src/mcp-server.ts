/**
 * Production MCP Server Base Class
 * Standards-compliant MCP server implementation for SHALE YEAH domain experts.
 */

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { type CallToolResult, McpServer, type ToolAnnotations } from "@modelcontextprotocol/server";
import { type StdioServerHandle, serveStdio } from "@modelcontextprotocol/server/stdio";
import type { z } from "zod";
import { classifyToolError, isToolFailure } from "./errors.js";
import { EventExportError } from "./events.js";
import { FileIntegrationManager } from "./file-integration.js";
import { type BoundMCPEvents, MCPCorrelationError, type MCPEventBinding } from "./mcp-events.js";
import { type MCPExecutionContext, MCPHttpAccess } from "./mcp-http-access.js";
import { type MCPHttpOptions, MCPHttpRequests } from "./mcp-http-requests.js";

export type {
	MCPExecutionContext,
	MCPHttpAccessConfig,
	MCPHttpSecurityEvent,
	MCPPrincipal,
	VerifiedMCPIdentity,
} from "./mcp-http-access.js";

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
	http?: MCPHttpOptions;
	/** Host-installed task binding; client metadata is correlation, never authority. */
	events?: MCPEventBinding;
}

export interface MCPTool {
	name: string;
	description: string;
	title?: string;
	inputSchema: z.ZodObject<z.ZodRawShape>;
	/** Describes the successful handler result, before any legacy compatibility wrapping. */
	outputSchema?: z.ZodObject<z.ZodRawShape>;
	annotations?: ToolAnnotations;
	_meta?: Record<string, unknown>;
	handler: (args: any, context?: MCPExecutionContext, signal?: AbortSignal) => Promise<any>;
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
	handler: (uri: URL, context?: MCPExecutionContext) => Promise<any>;
}

/**
 * Base MCP Server - All domain experts inherit from this
 */
export abstract class MCPServer {
	protected server: McpServer;
	private _stdio?: StdioServerHandle;
	private _httpServer?: http.Server;
	private _httpRequests?: MCPHttpRequests;
	private _httpAccess?: MCPHttpAccess;
	private _port?: number;
	private readonly _events?: MCPEventBinding;
	private readonly tools: MCPTool[] = [];
	private readonly resources: MCPResource[] = [];
	public config: MCPServerConfig;
	public dataPath: string;
	public fileManager: FileIntegrationManager;
	protected initialized = false;

	constructor(config: MCPServerConfig) {
		// Credential/verifier configuration stays inside the executing access adapter, not the public server view.
		this.config = {
			...config,
			events: undefined,
			http: config.http ? { ...config.http, access: undefined } : undefined,
		};
		this._events = config.events;
		this.dataPath = config.dataPath || path.join("./data", config.name.toLowerCase());
		this.fileManager = new FileIntegrationManager();

		this.server = new McpServer({
			name: config.name,
			version: config.version,
		});

		const portEnv = process.env.PORT;
		if (portEnv) {
			this._port = Number(portEnv);
			if (!Number.isInteger(this._port) || this._port < 0 || this._port > 65535) {
				throw new Error("PORT must be an integer between 0 and 65535");
			}
			this._httpAccess = new MCPHttpAccess(config.http?.access, { name: config.name, version: config.version });
			this._httpRequests = new MCPHttpRequests(() => this.createProtocolServer(), config.http, this._httpAccess);
			this._httpServer = http.createServer((req, res) => {
				void this._httpRequests!.handleRequest(req, res);
			});
		}

		this.setupCapabilities();
	}

	private createProtocolServer(): McpServer {
		const server = new McpServer({ name: this.config.name, version: this.config.version });
		for (const tool of this.tools) this.installTool(server, tool);
		for (const resource of this.resources) this.installResource(server, resource);
		return server;
	}

	/** Returns true when the server is running in HTTP mode (PORT env var was set at construction). */
	public isHttpMode(): boolean {
		return this._port !== undefined;
	}

	/** Returns the HTTP port if in HTTP mode, undefined otherwise. */
	public httpPort(): number | undefined {
		return this._port;
	}

	protected abstract setupCapabilities(): void;
	protected abstract setupDataDirectories(): Promise<void>;

	async initialize(): Promise<void> {
		try {
			await fs.mkdir(this.dataPath, { recursive: true });
			await this.setupDataDirectories();
			if (!this._httpServer) this._stdio = serveStdio(() => this.createProtocolServer(), { legacy: "reject" });

			if (this._httpServer && this._port !== undefined) {
				this._httpRequests!.open();
				await new Promise<void>((resolve, reject) => {
					const onError = (error: Error) => {
						this._httpServer!.off("listening", onListen);
						reject(error);
					};
					const onListen = () => {
						this._httpServer!.off("error", onError);
						const address = this._httpServer!.address();
						if (address && typeof address !== "string") this._port = address.port;
						console.error(`MCP HTTP transport listening on port ${this._port}`);
						resolve();
					};
					this._httpServer!.once("error", onError);
					this._httpServer!.listen(this._port, this._httpAccess!.bindHost, onListen);
				});
			}

			this.initialized = true;
			console.error("MCP server initialized");
		} catch (error) {
			await this._httpRequests?.close();
			await this._stdio?.close();
			console.error("MCP server initialization failed");
			throw error;
		}
	}

	async start(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
		console.error("MCP server ready");
		await new Promise(() => {});
	}

	async stop(): Promise<void> {
		try {
			// Drain protocol streams before closing the listener; otherwise open SSE streams keep close() pending.
			await this._httpRequests?.close();
			await this._stdio?.close();
			if (this._httpServer?.listening) {
				this._httpServer.closeAllConnections();
				await new Promise<void>((resolve, reject) => {
					this._httpServer!.close((err) => (err ? reject(err) : resolve()));
				});
			}
			await this.server.close();
			this.initialized = false;
			console.error("MCP server stopped");
		} catch (error) {
			console.error("MCP server stop failed");
			throw error;
		}
	}

	public registerTool(tool: MCPTool): void {
		this.installTool(this.server, tool);
		this.tools.push(tool);
	}

	private installTool(server: McpServer, tool: MCPTool): void {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				outputSchema: tool.outputSchema,
				annotations: tool.annotations,
				_meta: tool._meta,
			},
			async (args: any, extra) => {
				let binding: BoundMCPEvents | undefined;
				let dispatched = false;
				const started = performance.now();
				const details = () => ({
					toolName: tool.name,
					parentEventId: binding!.parentEventId,
					spanId: binding!.spanId,
					versions: { runtime: { id: "mcp-node", version: process.versions.node } },
					measurements: { toolLatencyMs: performance.now() - started },
				});
				try {
					const context = this._httpAccess?.currentContext();
					if (this.isHttpMode() && !context) throw new Error("Verified MCP execution context required");
					binding = this._events?.(context, extra.mcpReq._meta?.["org.shaleyeah/correlation"]);
					if (binding) await binding.emitter.emit("tool", "started", details());
					const validatedArgs = tool.inputSchema.parse(args);
					dispatched = true;
					const result = await tool.handler(validatedArgs, context, extra.mcpReq.signal);
					const hasOutcome = result !== null && typeof result === "object" && typeof result.success === "boolean";
					const failed = isToolFailure(result);
					if (!failed && tool.outputSchema) await tool.outputSchema.parseAsync(result);
					const payload =
						tool.outputSchema || hasOutcome || failed ? result : this.formatResult(result, tool.detailLevel);
					const response = this.toolResult(payload, failed, Boolean(tool.outputSchema));
					if (binding)
						await binding.emitter.emit("tool", failed ? "failed" : "succeeded", {
							...details(),
							...(failed ? { errorCode: "tool_failed" } : {}),
						});
					return response;
				} catch (error) {
					let failure = error;
					if (binding && !(error instanceof EventExportError)) {
						try {
							await binding.emitter.emit("tool", dispatched ? "failed" : "blocked", {
								...details(),
								errorCode: "tool_failed",
								effectUnknown: dispatched,
							});
						} catch (recordingError) {
							failure = recordingError;
						}
					}
					console.error("MCP tool failed");
					return this.toolResult(this.formatError(tool.name, failure, dispatched), true, Boolean(tool.outputSchema));
				}
			},
		);
	}

	private toolResult(payload: unknown, isError: boolean, hasOutputSchema: boolean): CallToolResult {
		if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
			throw new Error("Structured MCP tool output must be a JSON object");
		}
		// One serialized value prevents a compatibility client from seeing different evidence.
		const text = JSON.stringify(payload);
		// The pinned generic client validates any structuredContent against the success schema, including failures.
		if (isError && hasOutputSchema) return { content: [{ type: "text", text }], isError };
		const structuredContent = JSON.parse(text) as Record<string, unknown>;
		return { content: [{ type: "text", text }], structuredContent, isError };
	}

	public registerResource(resource: MCPResource): void {
		this.installResource(this.server, resource);
		this.resources.push(resource);
	}

	private installResource(server: McpServer, resource: MCPResource): void {
		server.registerResource(
			resource.name,
			resource.uri,
			{ description: resource.description, mimeType: resource.mimeType },
			async (uri: URL) => {
				try {
					const context = this._httpAccess?.currentContext();
					if (this.isHttpMode() && !context) throw new Error("Verified MCP execution context required");
					console.error("MCP resource read started");
					const result = await resource.handler(uri, context);
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
					console.error("MCP resource read failed");
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
			},
		);
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

	protected formatError(operation: string, error: any, effectUnknown = false): any {
		const auditFailure = error instanceof EventExportError;
		const correlationFailure = error instanceof MCPCorrelationError;
		return {
			success: false,
			error: {
				operation,
				message: "MCP operation failed; inspect error_type and error_code",
				error_type: auditFailure || correlationFailure ? "user_action" : classifyToolError(error),
				error_code: auditFailure ? "audit_unavailable" : correlationFailure ? "correlation_rejected" : "tool_failed",
				effectUnknown,
				server: this.config.name,
				persona: this.config.persona.name,
				timestamp: new Date().toISOString(),
			},
		};
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
				console.error("MCP server shutting down");
				await server.stop();
			} catch (_error) {
				// Ignore shutdown errors to prevent EPIPE
			} finally {
				process.exit(0);
			}
		});

		process.on("SIGTERM", async () => {
			try {
				console.error("MCP server shutting down");
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
	} catch {
		console.error("MCP server start failed");
		process.exit(1);
	}
}
