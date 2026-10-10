import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, isJSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import type { MCPHttpAccess, MCPHttpAccessConfig } from "./mcp-http-access.js";

export interface MCPHttpOptions {
	access?: MCPHttpAccessConfig;
	sessionIdleTimeoutMs?: number;
	requestTimeoutMs?: number;
	maxSessions?: number;
}

interface Session {
	owner: string;
	server: McpServer;
	transport: StreamableHTTPServerTransport;
	id?: string;
	idleTimer?: ReturnType<typeof setTimeout>;
	activePosts: number;
	disposed: boolean;
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

function positiveLimit(value: number | undefined, envName: string, fallback: number): number {
	const configured = value ?? (process.env[envName] === undefined ? fallback : Number(process.env[envName]));
	if (!Number.isSafeInteger(configured) || configured <= 0 || configured > 2_147_483_647) {
		throw new Error(`${envName} must be a finite positive integer no greater than 2147483647`);
	}
	return configured;
}

/** Protocol/transport state belongs to one connection; domain handlers remain registered by the owning server. */
export class MCPHttpSessions {
	readonly requestTimeoutMs: number;
	private readonly idleTimeoutMs: number;
	private readonly maxSessions: number;
	private readonly sessions = new Map<string, Session>();
	private readonly entries = new Set<Session>();
	private accepting = true;

	constructor(
		private readonly createServer: () => McpServer,
		options: MCPHttpOptions = {},
		private readonly access: MCPHttpAccess,
	) {
		this.idleTimeoutMs = positiveLimit(options.sessionIdleTimeoutMs, "MCP_HTTP_SESSION_IDLE_TIMEOUT_MS", 900_000);
		this.requestTimeoutMs = positiveLimit(options.requestTimeoutMs, "MCP_HTTP_REQUEST_TIMEOUT_MS", 120_000);
		this.maxSessions = positiveLimit(options.maxSessions, "MCP_HTTP_MAX_SESSIONS", 128);
	}

	open(): void {
		this.accepting = true;
	}

	forEachServer(register: (server: McpServer) => void): void {
		for (const entry of this.entries) if (!entry.disposed) register(entry.server);
	}

	private forget(entry: Session): void {
		if (entry.disposed) return;
		entry.disposed = true;
		clearTimeout(entry.idleTimer);
		if (entry.id) this.sessions.delete(entry.id);
		this.entries.delete(entry);
	}

	private async dispose(entry: Session): Promise<void> {
		if (entry.disposed) return;
		this.forget(entry);
		await entry.server.close();
	}

	private refreshIdle(entry: Session): void {
		clearTimeout(entry.idleTimer);
		if (entry.disposed || entry.activePosts > 0) return;
		entry.idleTimer = setTimeout(() => {
			void this.dispose(entry).catch(() => {});
		}, this.idleTimeoutMs);
		entry.idleTimer.unref();
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
				clearTimeout(timer);
				req.off("data", data);
				req.off("end", end);
				req.off("error", fail);
				req.off("aborted", aborted);
			};
			const fail = (error: Error) => {
				cleanup();
				reject(error);
			};
			const aborted = () => fail(new RequestFailure(400, -32700, "Request body interrupted"));
			const data = (chunk: Buffer) => {
				size += chunk.length;
				if (size > 1_048_576) {
					req.pause();
					fail(new RequestFailure(413, -32600, "MCP request body exceeds 1 MiB"));
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
			const timer = setTimeout(() => {
				req.pause();
				fail(new RequestFailure(408, -32000, "MCP request body timed out"));
			}, this.requestTimeoutMs);
			timer.unref();
			req.on("data", data);
			req.once("end", end);
			req.once("error", fail);
			req.once("aborted", aborted);
		});
	}

	async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const authorized = await this.access.authenticate(req, res);
		if (!authorized) return;
		if (!this.accepting) {
			this.error(res, 503, -32000, "MCP server is stopping");
			return;
		}
		let entry: Session | undefined;
		let created = false;
		let body: unknown;
		try {
			const sessionId = req.headers["mcp-session-id"];
			if (sessionId !== undefined) {
				entry = typeof sessionId === "string" ? this.sessions.get(sessionId) : undefined;
				if (!entry) {
					await this.access.deny(res, authorized.context.requestId, 404, "session_unknown", authorized);
					return;
				}
				if (entry.owner !== authorized.owner) {
					await this.access.deny(res, authorized.context.requestId, 403, "session_owner_denied", authorized);
					return;
				}
			}
			if (req.method === "POST") body = await this.readBody(req);
			if (!(await this.access.authorize(req, res, authorized, body))) return;
			if (!this.accepting) {
				this.error(res, 503, -32000, "MCP server is stopping");
				return;
			}
			if (!entry) {
				if (req.method !== "POST" || !isInitializeRequest(body)) {
					this.error(res, 400, -32000, "A valid initialize request without a session ID is required");
					return;
				}
				if (this.entries.size >= this.maxSessions) {
					this.error(res, 503, -32000, "MCP session capacity reached");
					return;
				}
				const server = this.createServer();
				const transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					onsessioninitialized: (id) => {
						if (!entry || entry.disposed) return;
						entry.id = id;
						this.sessions.set(id, entry);
					},
				});
				entry = { server, transport, owner: authorized.owner, activePosts: 0, disposed: false };
				const session = entry;
				transport.onclose = () => this.forget(session);
				this.entries.add(entry);
				created = true;
				await server.connect(transport);
			}
			if (entry.disposed) {
				this.error(res, 404, -32001, "Session not found");
				return;
			}
			const session = entry;
			if (req.method === "POST") {
				clearTimeout(session.idleTimer);
				session.activePosts++;
				const deadline = setTimeout(() => {
					void (async () => {
						try {
							if (isJSONRPCRequest(body)) {
								await session.transport.send({
									jsonrpc: "2.0",
									id: body.id,
									error: { code: -32000, message: "MCP request timed out" },
								});
							}
						} catch {
							/* A disconnected stream cannot receive the timeout result. */
						} finally {
							await this.dispose(session).catch(() => {});
							if (!res.writableEnded) res.destroy();
						}
					})();
				}, this.requestTimeoutMs);
				deadline.unref();
				let finished = false;
				const finish = () => {
					if (finished) return;
					finished = true;
					clearTimeout(deadline);
					session.activePosts--;
					if (created && !session.server.server.getClientVersion()) {
						void this.dispose(session).catch(() => {});
					} else this.refreshIdle(session);
				};
				res.once("finish", finish);
				res.once("close", finish);
			} else this.refreshIdle(session);
			await this.access.run(authorized, () => session.transport.handleRequest(req, res, body));
		} catch (error) {
			if (created && entry) await this.dispose(entry).catch(() => {});
			if (error instanceof RequestFailure) {
				if (error.status === 408 || error.status === 413) {
					res.setHeader("Connection", "close");
					res.once("finish", () => req.destroy());
				}
				this.error(res, error.status, error.code, error.message);
			} else this.error(res, 500, -32603, "MCP request failed");
		}
	}

	async close(): Promise<void> {
		this.accepting = false;
		await Promise.all([...this.entries].map((entry) => this.dispose(entry)));
	}
}
