/**
 * SHALE YEAH Agent OS - Session & Context Management
 *
 * Manages user sessions, identity anchoring, and context injection.
 * Implements Arcade patterns:
 * - Identity Anchor (user identity tied to every session)
 * - Context Injection (automatic context provided to tool calls)
 * - Context Boundary (session isolation)
 * - Resource Referencing (results stored and referenced by key)
 */

import { randomUUID } from "node:crypto";
import type { InjectedContext, Permission, SessionInfo, ToolResponse, UserIdentity, UserPreferences } from "./types.js";

// ==========================================
// Default Identity
// ==========================================

/** Default identity for demo mode — analyst with read-only access */
export const DEMO_IDENTITY: UserIdentity = {
	userId: "demo",
	role: "analyst",
	permissions: ["read:analysis"] as Permission[],
	organization: "SHALE YEAH Demo",
	displayName: "Demo Analyst",
};

// ==========================================
// Session
// ==========================================

/**
 * A single user session — holds identity, preferences, and analysis results.
 * Each session is an isolated context boundary.
 */
export class Session {
	public readonly id: string;
	public readonly identity: UserIdentity;
	public readonly createdAt: string;
	public lastActivity: string;
	public preferences: UserPreferences;

	private results: Map<string, ToolResponse> = new Map();

	constructor(identity: UserIdentity, preferences?: UserPreferences) {
		this.id = randomUUID();
		this.identity = identity;
		this.createdAt = new Date().toISOString();
		this.lastActivity = this.createdAt;
		this.preferences = preferences ?? {};
	}

	/**
	 * Store an analysis result for later reference by other tools.
	 */
	storeResult(key: string, response: ToolResponse): void {
		this.results.set(key, response);
		this.touch();
	}

	/**
	 * Retrieve a previously stored analysis result.
	 */
	getResult(key: string): ToolResponse | undefined {
		this.touch();
		return this.results.get(key);
	}

	/**
	 * List all available result keys.
	 */
	get availableResults(): string[] {
		return Array.from(this.results.keys());
	}

	/**
	 * Get the number of stored results.
	 */
	get resultCount(): number {
		return this.results.size;
	}

	/**
	 * Build the context object that gets injected into tool calls.
	 */
	getInjectedContext(): InjectedContext {
		this.touch();
		return {
			userId: this.identity.userId,
			role: this.identity.role,
			sessionId: this.id,
			timestamp: new Date().toISOString(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			defaultBasin: this.preferences.defaultBasin,
			riskTolerance: this.preferences.riskTolerance,
			availableResults: this.availableResults,
		};
	}

	/**
	 * Get session info suitable for discovery tool responses.
	 */
	toSessionInfo(): SessionInfo {
		return {
			id: this.id,
			identity: this.identity,
			createdAt: this.createdAt,
			lastActivity: this.lastActivity,
			availableResults: this.availableResults,
		};
	}

	/**
	 * Update lastActivity timestamp.
	 */
	private touch(): void {
		this.lastActivity = new Date().toISOString();
	}
}

// ==========================================
// SessionManager
// ==========================================

/**
 * Manages the lifecycle of all sessions.
 * Provides creation, retrieval, and destruction of isolated session contexts.
 */
export class SessionManager {
	private sessions: Map<string, Session> = new Map();

	/**
	 * Create a new session with the given identity (defaults to demo identity).
	 */
	createSession(identity?: UserIdentity, preferences?: UserPreferences): Session {
		const session = new Session(identity ?? DEMO_IDENTITY, preferences);
		this.sessions.set(session.id, session);
		return session;
	}

	/**
	 * Retrieve a session by ID.
	 */
	getSession(id: string): Session | undefined {
		return this.sessions.get(id);
	}

	/**
	 * Destroy a session and release its resources.
	 */
	destroySession(id: string): boolean {
		return this.sessions.delete(id);
	}

	/**
	 * List all active sessions.
	 */
	listSessions(): SessionInfo[] {
		return Array.from(this.sessions.values()).map((s) => s.toSessionInfo());
	}

	/**
	 * Get the number of active sessions.
	 */
	get sessionCount(): number {
		return this.sessions.size;
	}
}
