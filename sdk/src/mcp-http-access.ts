import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface MCPPrincipal {
	readonly subjectId: string;
	readonly customerId: string;
	readonly employeeId: string;
	readonly scopes: readonly string[];
}

/** Produced by a trusted verifier after signature/introspection and issuer validation. */
export interface VerifiedMCPIdentity extends MCPPrincipal {
	issuer: string;
	audience: string;
	/** Unix epoch seconds, matching the MCP access-token convention. */
	expiresAt: number;
}

export interface MCPExecutionContext {
	readonly principal: MCPPrincipal;
	readonly policyId: string;
	readonly policyVersion: string;
	readonly requestId: string;
}

export interface MCPHttpSecurityEvent {
	timestamp: string;
	requestId: string;
	policyId: string;
	policyVersion: string;
	decision: "allow" | "deny";
	reason: string;
	operation: string;
	principalRef?: string;
	targetRef?: string;
}

interface AccessPolicy {
	id: string;
	version: string;
	connectionScopes: readonly string[];
	toolScopes: Record<string, readonly string[]>;
	resourceScopes: Record<string, readonly string[]>;
}

interface BaseAccess {
	bindHost?: string;
	/** Exact hostnames, without ports. No wildcard or forwarded-header trust. */
	allowedHosts: readonly string[];
	/** An absent list denies every supplied Origin; native clients may omit it. */
	allowedOrigins?: readonly string[];
	policy: AccessPolicy;
	audit: (event: MCPHttpSecurityEvent) => void | Promise<void>;
	verificationTimeoutMs?: number;
	auditTimeoutMs?: number;
}

export type MCPHttpAccessConfig = BaseAccess &
	(
		| { mode: "local"; principal: MCPPrincipal; accessToken: string }
		| {
				mode: "remote";
				issuer: string;
				resource: string;
				authorizationServers: readonly string[];
				customerId: string;
				employeeId: string;
				verifyBearer: (token: string, signal: AbortSignal) => Promise<VerifiedMCPIdentity>;
		  }
	);

export interface AuthorizedMCPRequest {
	context: MCPExecutionContext;
	owner: string;
	expiresAt?: number;
}

const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);
const protocolMethods = new Set([
	"initialize",
	"ping",
	"notifications/initialized",
	"notifications/cancelled",
	"notifications/progress",
	"tools/list",
	"resources/list",
	"resources/templates/list",
]);

function identifier(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9_.:/-]+$/.test(value);
}

function scopes(value: unknown): value is readonly string[] {
	return Array.isArray(value) && value.length > 0 && value.length <= 256 && value.every(identifier);
}

function principal(value: MCPPrincipal): MCPPrincipal {
	if (
		!value ||
		!identifier(value.subjectId) ||
		!identifier(value.customerId) ||
		!identifier(value.employeeId) ||
		!scopes(value.scopes)
	) {
		throw new Error("Invalid verified MCP principal");
	}
	return Object.freeze({
		subjectId: value.subjectId,
		customerId: value.customerId,
		employeeId: value.employeeId,
		scopes: Object.freeze([...value.scopes]),
	});
}

function safeUrl(value: string): URL {
	const url = new URL(value);
	if (
		(url.protocol !== "https:" && !(url.protocol === "http:" && loopback.has(url.hostname))) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error("MCP identity URLs require HTTPS or explicit development loopback HTTP");
	}
	return url;
}

function timeout(value: number | undefined, fallback: number): number {
	const result = value ?? fallback;
	if (!Number.isSafeInteger(result) || result <= 0 || result > 120_000)
		throw new Error("MCP access timeout must be between 1 and 120000 ms");
	return result;
}

async function bounded<T>(action: (signal: AbortSignal) => Promise<T> | T, milliseconds: number): Promise<T> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Promise.resolve().then(() => action(controller.signal)),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error("MCP access adapter timed out"));
				}, milliseconds);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

/** Authentication and operation policy belong to the HTTP boundary, before protocol dispatch. */
export class MCPHttpAccess {
	readonly bindHost: string;
	private readonly config: MCPHttpAccessConfig;
	private readonly storage = new AsyncLocalStorage<AuthorizedMCPRequest>();
	private readonly verificationTimeoutMs: number;
	private readonly auditTimeoutMs: number;

	constructor(
		config: MCPHttpAccessConfig | undefined,
		private readonly info: { name: string; version: string },
	) {
		if (!config || (config.mode !== "local" && config.mode !== "remote"))
			throw new Error("HTTP requires an explicit local or remote access trust mode");
		if (
			!identifier(config.policy?.id) ||
			!identifier(config.policy.version) ||
			!scopes(config.policy.connectionScopes) ||
			typeof config.audit !== "function"
		) {
			throw new Error("HTTP access requires a scoped policy and audit sink");
		}
		if (
			!config.allowedHosts?.length ||
			config.allowedHosts.some((host) => !host || host.length > 253 || new URL(`http://${host}`).hostname !== host)
		) {
			throw new Error("HTTP access requires exact allowed hostnames");
		}
		for (const origin of config.allowedOrigins ?? []) {
			if (safeUrl(origin).origin !== origin || (config.mode === "local" && !loopback.has(new URL(origin).hostname)))
				throw new Error("Invalid allowed MCP Origin");
		}
		const copyMap = (entries: Record<string, readonly string[]>) => {
			if (!entries || typeof entries !== "object" || Array.isArray(entries))
				throw new Error("Explicit MCP operation scope maps are required");
			const result: Record<string, readonly string[]> = Object.create(null);
			for (const [name, required] of Object.entries(entries)) {
				if (name.length === 0 || name.length > 512 || !scopes(required))
					throw new Error("Invalid MCP operation scope declaration");
				result[name] = Object.freeze([...required]);
			}
			return Object.freeze(result);
		};
		this.bindHost = config.bindHost ?? "127.0.0.1";
		if (config.mode === "local") {
			if (
				!loopback.has(this.bindHost === "::1" ? "[::1]" : this.bindHost) ||
				config.allowedHosts.some((host) => !loopback.has(host))
			) {
				throw new Error("Local MCP access must bind to and allow only loopback");
			}
			principal(config.principal);
			if (
				typeof config.accessToken !== "string" ||
				config.accessToken.length < 32 ||
				config.accessToken.length > 4096 ||
				/\s/.test(config.accessToken)
			) {
				throw new Error("Local MCP access requires a dedicated credential of 32 to 4096 characters");
			}
		} else {
			safeUrl(config.issuer);
			safeUrl(config.resource);
			if (
				!config.authorizationServers?.length ||
				!identifier(config.customerId) ||
				!identifier(config.employeeId) ||
				typeof config.verifyBearer !== "function"
			)
				throw new Error("Remote MCP access requires a trusted verifier and ownership policy");
			for (const url of config.authorizationServers) safeUrl(url);
		}
		this.verificationTimeoutMs = timeout(config.verificationTimeoutMs, 5000);
		this.auditTimeoutMs = timeout(config.auditTimeoutMs, 1000);
		this.config = Object.freeze({
			...config,
			...(config.mode === "local"
				? { principal: principal(config.principal) }
				: { authorizationServers: Object.freeze([...config.authorizationServers]) }),
			allowedHosts: Object.freeze([...config.allowedHosts]),
			allowedOrigins: Object.freeze([...(config.allowedOrigins ?? [])]),
			policy: Object.freeze({
				...config.policy,
				connectionScopes: Object.freeze([...config.policy.connectionScopes]),
				toolScopes: copyMap(config.policy.toolScopes),
				resourceScopes: copyMap(config.policy.resourceScopes),
			}),
		});
	}

	private event(
		requestId: string,
		decision: "allow" | "deny",
		reason: string,
		operation: string,
		authorized?: AuthorizedMCPRequest,
		target?: string,
	): MCPHttpSecurityEvent {
		return {
			timestamp: new Date().toISOString(),
			requestId,
			policyId: this.config.policy.id,
			policyVersion: this.config.policy.version,
			decision,
			reason,
			operation,
			...(authorized ? { principalRef: createHash("sha256").update(authorized.owner).digest("hex") } : {}),
			...(target ? { targetRef: createHash("sha256").update(target).digest("hex") } : {}),
		};
	}

	private async audit(event: MCPHttpSecurityEvent): Promise<boolean> {
		try {
			await bounded(() => this.config.audit(Object.freeze(event)), this.auditTimeoutMs);
			return true;
		} catch {
			return false;
		}
	}

	private respond(res: ServerResponse, status: number, required?: readonly string[]): void {
		if (res.writableEnded || res.destroyed) return;
		if (status === 401 || status === 403) {
			const metadata =
				this.config.mode === "remote"
					? `, resource_metadata="${new URL("/.well-known/oauth-protected-resource", this.config.resource).href}"`
					: "";
			res.setHeader(
				"WWW-Authenticate",
				`Bearer error="${status === 401 ? "invalid_token" : "insufficient_scope"}"${metadata}${required ? `, scope="${required.join(" ")}"` : ""}`,
			);
		}
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32000,
					message:
						status === 401
							? "Unauthorized MCP request"
							: status === 403
								? "Forbidden MCP request"
								: "MCP access unavailable",
				},
			}),
		);
	}

	async deny(
		res: ServerResponse,
		requestId: string,
		status: number,
		reason: string,
		authorized?: AuthorizedMCPRequest,
		required?: readonly string[],
	): Promise<void> {
		const recorded = await this.audit(this.event(requestId, "deny", reason, "ingress", authorized));
		this.respond(res, recorded ? status : 503, required);
	}

	async authenticate(req: IncomingMessage, res: ServerResponse): Promise<AuthorizedMCPRequest | undefined> {
		const requestId = randomUUID();
		let host: URL;
		try {
			const raw = req.headers.host;
			if (!raw || raw.length > 260 || req.headersDistinct.host?.length !== 1) throw new Error("Invalid Host");
			host = new URL(`http://${raw}`);
			if (
				host.username ||
				host.password ||
				host.pathname !== "/" ||
				host.search ||
				host.hash ||
				!this.config.allowedHosts.includes(host.hostname)
			)
				throw new Error("Invalid Host");
			if (
				this.config.mode === "local" &&
				(Number(host.port || 80) !== req.socket.localPort ||
					!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? ""))
			)
				throw new Error("Nonlocal request");
		} catch {
			await this.deny(res, requestId, 403, "host_denied");
			return;
		}
		if (
			req.headers.origin !== undefined &&
			(req.headersDistinct.origin?.length !== 1 || !this.config.allowedOrigins!.includes(req.headers.origin))
		) {
			await this.deny(res, requestId, 403, "origin_denied");
			return;
		}
		if (req.method === "GET" && req.url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", server: this.info.name, version: this.info.version }));
			return;
		}
		if (
			this.config.mode === "remote" &&
			req.method === "GET" &&
			["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"].includes(req.url ?? "")
		) {
			const supported = [
				...new Set([
					...this.config.policy.connectionScopes,
					...Object.values(this.config.policy.toolScopes).flat(),
					...Object.values(this.config.policy.resourceScopes).flat(),
				]),
			];
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					resource: this.config.resource,
					authorization_servers: this.config.authorizationServers,
					scopes_supported: supported,
					bearer_methods_supported: ["header"],
				}),
			);
			return;
		}
		if (req.url !== "/mcp" || !["POST", "GET", "DELETE"].includes(req.method ?? "")) {
			await this.deny(res, requestId, 404, "route_denied");
			return;
		}
		const header = req.headers.authorization;
		const token =
			typeof header === "string" && header.length <= 4103 && header.slice(0, 7).toLowerCase() === "bearer "
				? header.slice(7)
				: undefined;
		if (!token || /\s/.test(token) || req.headersDistinct.authorization?.length !== 1) {
			await this.deny(res, requestId, 401, "identity_missing");
			return;
		}
		let verified: MCPPrincipal;
		let expiresAt: number | undefined;
		try {
			if (this.config.mode === "local") {
				const expected = Buffer.from(this.config.accessToken);
				const presented = Buffer.from(token);
				if (expected.length !== presented.length || !timingSafeEqual(expected, presented))
					throw new Error("Invalid credential");
				verified = this.config.principal;
			} else {
				const claims = await bounded(
					(signal) => (this.config.mode === "remote" ? this.config.verifyBearer(token, signal) : Promise.reject()),
					this.verificationTimeoutMs,
				);
				if (
					!claims ||
					claims.issuer !== this.config.issuer ||
					claims.audience !== this.config.resource ||
					!Number.isFinite(claims.expiresAt) ||
					claims.expiresAt <= Date.now() / 1000
				)
					throw new Error("Invalid identity");
				verified = principal(claims);
				expiresAt = claims.expiresAt;
				if (verified.customerId !== this.config.customerId || verified.employeeId !== this.config.employeeId) {
					await this.deny(res, requestId, 403, "ownership_denied");
					return;
				}
			}
		} catch {
			await this.deny(res, requestId, 401, "identity_invalid");
			return;
		}
		const authorized: AuthorizedMCPRequest = {
			context: Object.freeze({
				principal: verified,
				policyId: this.config.policy.id,
				policyVersion: this.config.policy.version,
				requestId,
			}),
			owner: JSON.stringify([
				this.config.mode === "remote" ? this.config.issuer : "local",
				verified.subjectId,
				verified.customerId,
				verified.employeeId,
			]),
			expiresAt,
		};
		if (!this.config.policy.connectionScopes.every((scope) => verified.scopes.includes(scope))) {
			await this.deny(res, requestId, 403, "connection_scope_denied", authorized, this.config.policy.connectionScopes);
			return;
		}
		return authorized;
	}

	async authorize(
		req: IncomingMessage,
		res: ServerResponse,
		authorized: AuthorizedMCPRequest,
		body: unknown,
	): Promise<boolean> {
		const { requestId, principal } = authorized.context;
		if (authorized.expiresAt !== undefined && authorized.expiresAt <= Date.now() / 1000) {
			await this.deny(res, requestId, 401, "identity_expired", authorized);
			return false;
		}
		let required: readonly string[] = [];
		let operation = `session/${req.method}`;
		let target: string | undefined;
		if (req.method === "POST") {
			if (!body || typeof body !== "object" || Array.isArray(body)) {
				await this.deny(res, requestId, 400, "message_invalid", authorized);
				return false;
			}
			const message = body as {
				method?: unknown;
				params?: { name?: unknown; uri?: unknown };
				id?: unknown;
				result?: unknown;
				error?: unknown;
			};
			if (message.method === "tools/call" || message.method === "resources/read") {
				const key = message.method === "tools/call" ? message.params?.name : message.params?.uri;
				const map = message.method === "tools/call" ? this.config.policy.toolScopes : this.config.policy.resourceScopes;
				if (typeof key !== "string" || !Object.hasOwn(map, key)) {
					await this.deny(res, requestId, 403, "operation_unclassified", authorized);
					return false;
				}
				required = map[key];
				operation = message.method;
				target = key;
			} else if (typeof message.method === "string" && protocolMethods.has(message.method)) operation = message.method;
			else if (message.method === undefined && message.id !== undefined && ("result" in message || "error" in message))
				operation = "protocol/response";
			else {
				await this.deny(res, requestId, 403, "operation_unclassified", authorized);
				return false;
			}
		}
		if (!required.every((scope) => principal.scopes.includes(scope))) {
			await this.deny(res, requestId, 403, "operation_scope_denied", authorized, required);
			return false;
		}
		if (!(await this.audit(this.event(requestId, "allow", "authorized", operation, authorized, target)))) {
			this.respond(res, 503);
			return false;
		}
		// Audit/verifier adapters can consume time; never dispatch an expired principal afterward.
		if (authorized.expiresAt !== undefined && authorized.expiresAt <= Date.now() / 1000) {
			await this.deny(res, requestId, 401, "identity_expired", authorized);
			return false;
		}
		return true;
	}

	run<T>(authorized: AuthorizedMCPRequest, action: () => T): T {
		return this.storage.run(authorized, action);
	}
	currentContext(): MCPExecutionContext | undefined {
		const current = this.storage.getStore();
		return current && (current.expiresAt === undefined || current.expiresAt > Date.now() / 1000)
			? current.context
			: undefined;
	}
}
