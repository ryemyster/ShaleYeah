import type { IncomingMessage, ServerResponse } from "node:http";
import { type NodeMcpRequestHandler, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type McpHttpHandler, type McpServer } from "@modelcontextprotocol/server";
import type { MCPHttpAccess, MCPHttpAccessConfig } from "./mcp-http-access.js";

export interface MCPHttpOptions {
	access?: MCPHttpAccessConfig;
	requestTimeoutMs?: number;
	maxConcurrentRequests?: number;
	maxRequestBodyBytes?: number;
}

class RequestFailure extends Error {
	constructor(
		readonly status: number,
		readonly code: number,
		message: string,
	) {
		super(message);
	}
}

function limit(value: number | undefined, env: string, fallback: number, maximum: number): number {
	const result = value ?? (process.env[env] === undefined ? fallback : Number(process.env[env]));
	if (!Number.isSafeInteger(result) || result <= 0 || result > maximum) {
		throw new Error(`${env} must be an integer between 1 and ${maximum}`);
	}
	return result;
}

/** Every HTTP exchange has its own SDK instance and independently verified authority. */
export class MCPHttpRequests {
	readonly requestTimeoutMs: number;
	private readonly maxConcurrentRequests: number;
	private readonly maxRequestBodyBytes: number;
	private readonly active = new Set<ServerResponse>();
	private handler?: McpHttpHandler;
	private nodeHandler?: NodeMcpRequestHandler;
	private accepting = false;

	constructor(
		private readonly createServer: () => McpServer,
		options: MCPHttpOptions = {},
		private readonly access: MCPHttpAccess,
	) {
		this.requestTimeoutMs = limit(options.requestTimeoutMs, "MCP_HTTP_REQUEST_TIMEOUT_MS", 120_000, 120_000);
		this.maxConcurrentRequests = limit(options.maxConcurrentRequests, "MCP_HTTP_MAX_CONCURRENT_REQUESTS", 128, 1024);
		this.maxRequestBodyBytes = limit(
			options.maxRequestBodyBytes,
			"MCP_HTTP_MAX_REQUEST_BODY_BYTES",
			1_048_576,
			1_048_576,
		);
	}

	open(): void {
		if (this.accepting) return;
		this.handler = createMcpHandler(this.createServer, {
			legacy: "reject",
			maxRequestBodySize: this.maxRequestBodyBytes,
			onerror: () => console.error("MCP protocol request rejected"),
		});
		this.nodeHandler = toNodeHandler(this.handler, {
			maxRequestBodySize: this.maxRequestBodyBytes,
			onerror: () => console.error("MCP HTTP request failed"),
		});
		this.accepting = true;
	}

	private error(res: ServerResponse, status: number, code: number, message: string): void {
		if (res.writableEnded || res.destroyed) return;
		if (res.headersSent) {
			res.destroy();
			return;
		}
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }));
	}

	private readBody(req: IncomingMessage): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			let size = 0;
			const cleanup = () => {
				req.off("data", data);
				req.off("end", end);
				req.off("error", fail);
				req.off("aborted", aborted);
			};
			const fail = (error: Error) => {
				cleanup();
				reject(error);
			};
			const aborted = () => fail(new RequestFailure(400, -32700, "MCP request interrupted"));
			const data = (chunk: Buffer) => {
				size += chunk.length;
				if (size > this.maxRequestBodyBytes) {
					req.pause();
					fail(new RequestFailure(413, -32600, "MCP request body exceeds configured limit"));
				} else chunks.push(chunk);
			};
			const end = () => {
				cleanup();
				try {
					resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
				} catch {
					reject(new RequestFailure(400, -32700, "Invalid JSON request body"));
				}
			};
			req.on("data", data);
			req.once("end", end);
			req.once("error", fail);
			req.once("aborted", aborted);
		});
	}

	async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const authorized = await this.access.authenticate(req, res);
		if (!authorized) return;
		if (!this.accepting || !this.nodeHandler) {
			this.error(res, 503, -32000, "MCP server is stopping");
			return;
		}
		if (req.headers["mcp-session-id"] !== undefined) {
			await this.access.deny(res, authorized.context.requestId, 400, "transport_session_unsupported", authorized);
			return;
		}
		if (this.active.size >= this.maxConcurrentRequests) {
			this.error(res, 503, -32000, "MCP request capacity reached");
			return;
		}
		this.active.add(res);
		let bodyRead = req.method !== "POST";
		const deadline = setTimeout(() => {
			if (!bodyRead) {
				req.pause();
				res.setHeader("Connection", "close");
				res.once("finish", () => req.destroy());
				this.error(res, 408, -32000, "MCP request body timed out");
				return;
			}
			this.error(res, 504, -32000, "MCP request timed out");
			// Node's SDK adapter maps response closure to this exchange's abort signal.
			res.destroy();
			req.destroy();
		}, this.requestTimeoutMs);
		deadline.unref();
		const finish = () => {
			clearTimeout(deadline);
			this.active.delete(res);
			res.off("finish", finish);
			res.off("close", finish);
		};
		res.once("finish", finish);
		res.once("close", finish);
		try {
			const body = req.method === "POST" ? await this.readBody(req) : undefined;
			bodyRead = true;
			if (!(await this.access.authorize(req, res, authorized, body))) return;
			if (!this.accepting || res.destroyed || res.writableEnded) return;
			await this.access.run(authorized, () => this.nodeHandler!(req, res, body));
		} catch (error) {
			if (res.destroyed || res.writableEnded) return;
			if (error instanceof RequestFailure) {
				res.setHeader("Connection", "close");
				res.once("finish", () => req.destroy());
				this.error(res, error.status, error.code, error.message);
			} else this.error(res, 500, -32603, "MCP request failed");
		}
	}

	async close(): Promise<void> {
		this.accepting = false;
		for (const response of this.active) response.destroy();
		await this.handler?.close();
		this.handler = undefined;
		this.nodeHandler = undefined;
	}
}
