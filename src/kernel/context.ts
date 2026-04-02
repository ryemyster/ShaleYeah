/**
 * SHALE YEAH Agent OS - Session & Context Management
 *
 * Manages user sessions, identity anchoring, and context injection.
 * Implements Arcade patterns:
 * - Identity Anchor (user identity tied to every session)
 * - Context Injection (automatic context provided to tool calls)
 * - Context Boundary (session isolation)
 * - Resource Referencing (results stored and referenced by key)
 *
 * Session Persistence (Issue #114):
 * - SessionStorageBackend interface for pluggable backends
 * - FileSessionStorage: JSON-file-per-session, configurable directory
 * - SessionManager accepts optional backend; persistence is best-effort
 * - recoverSessions() reloads all sessions from backend on startup
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
// Session Storage Backend
// ==========================================

/** Serialized form of a Session for storage */
export interface SerializedSession {
	id: string;
	identity: UserIdentity;
	preferences: UserPreferences;
	createdAt: string;
	lastActivity: string;
	results: Record<string, ToolResponse>;
}

/** Pluggable backend for session persistence */
export interface SessionStorageBackend {
	/** Persist a session (upsert) */
	save(session: Session): Promise<void>;
	/** Load a session by ID, or undefined if not found */
	load(id: string): Promise<Session | undefined>;
	/** Load all persisted sessions */
	loadAll(): Promise<Session[]>;
	/** Remove a session from storage */
	delete(id: string): Promise<void>;
}

// ==========================================
// FileSessionStorage
// ==========================================

/**
 * File-based session storage backend.
 * Persists one JSON file per session in the configured directory.
 * Creates the directory on first use if it does not exist.
 */
export class FileSessionStorage implements SessionStorageBackend {
	private readonly dir: string;

	constructor(dir: string) {
		// Resolve to an absolute path at construction time so all subsequent
		// path operations are anchored to a known, canonical root.
		this.dir = resolve(dir);
	}

	private ensureDir(): void {
		mkdirSync(this.dir, { recursive: true });
	}

	/**
	 * Build the file path for a session and verify it stays within this.dir.
	 * Throws if the resolved path would escape the storage directory.
	 */
	private filePath(id: string): string {
		const resolved = resolve(join(this.dir, `${id}.json`));
		if (!resolved.startsWith(`${this.dir}/`) && resolved !== this.dir) {
			throw new Error(`Invalid session id — path escapes storage directory: ${id}`);
		}
		return resolved;
	}

	async save(session: Session): Promise<void> {
		this.ensureDir();
		const data: SerializedSession = {
			id: session.id,
			identity: session.identity,
			preferences: session.preferences,
			createdAt: session.createdAt,
			lastActivity: session.lastActivity,
			results: session.exportResults(),
		};
		writeFileSync(this.filePath(session.id), JSON.stringify(data, null, 2), "utf-8");
	}

	async load(id: string): Promise<Session | undefined> {
		const path = this.filePath(id);
		try {
			const raw = readFileSync(path, "utf-8");
			const data = JSON.parse(raw) as SerializedSession;
			return Session.fromSerialized(data);
		} catch {
			return undefined;
		}
	}

	async loadAll(): Promise<Session[]> {
		this.ensureDir();
		const sessions: Session[] = [];
		let files: string[];
		try {
			files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
		} catch {
			return [];
		}
		for (const file of files) {
			try {
				const raw = readFileSync(join(this.dir, file), "utf-8");
				const data = JSON.parse(raw) as SerializedSession;
				sessions.push(Session.fromSerialized(data));
			} catch {
				// Skip corrupt files
			}
		}
		return sessions;
	}

	async delete(id: string): Promise<void> {
		try {
			rmSync(this.filePath(id));
		} catch {
			// Already gone — safe to ignore
		}
	}
}

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

	constructor(identity: UserIdentity, preferences?: UserPreferences, _serialized?: SerializedSession) {
		if (_serialized) {
			this.id = _serialized.id;
			this.identity = _serialized.identity;
			this.preferences = _serialized.preferences;
			this.createdAt = _serialized.createdAt;
			this.lastActivity = _serialized.lastActivity;
			for (const [key, response] of Object.entries(_serialized.results)) {
				this.results.set(key, response);
			}
		} else {
			this.id = randomUUID();
			this.identity = identity;
			this.createdAt = new Date().toISOString();
			this.lastActivity = this.createdAt;
			this.preferences = preferences ?? {};
		}
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
	 * Export results as a plain object for serialization.
	 */
	exportResults(): Record<string, ToolResponse> {
		const out: Record<string, ToolResponse> = {};
		for (const [k, v] of this.results) {
			out[k] = v;
		}
		return out;
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
	 * Reconstruct a Session from its serialized form.
	 */
	static fromSerialized(data: SerializedSession): Session {
		return new Session(data.identity, data.preferences, data);
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
 *
 * Accepts an optional SessionStorageBackend for persistence. When provided:
 * - createSession() fires a best-effort save after creating the session
 * - destroySession() fires a best-effort delete after removing from memory
 * - recoverSessions() loads all sessions from storage into memory
 *
 * Without a backend, behavior is identical to the original in-memory implementation.
 */
export class SessionManager {
	private sessions: Map<string, Session> = new Map();
	private readonly backend?: SessionStorageBackend;

	constructor(backend?: SessionStorageBackend) {
		this.backend = backend;
	}

	/**
	 * Create a new session with the given identity (defaults to demo identity).
	 * If a storage backend is configured, the session is saved asynchronously.
	 */
	createSession(identity?: UserIdentity, preferences?: UserPreferences): Session {
		const session = new Session(identity ?? DEMO_IDENTITY, preferences);
		this.sessions.set(session.id, session);
		if (this.backend) {
			this.backend.save(session).catch(() => {
				// Best-effort — don't crash on storage failure
			});
		}
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
	 * If a storage backend is configured, the session is deleted asynchronously.
	 */
	destroySession(id: string): boolean {
		const existed = this.sessions.delete(id);
		if (existed && this.backend) {
			this.backend.delete(id).catch(() => {
				// Best-effort — don't crash on storage failure
			});
		}
		return existed;
	}

	/**
	 * Reload all sessions from the storage backend into memory.
	 * Call this on kernel startup to recover sessions from a previous run.
	 * No-op if no backend is configured.
	 */
	async recoverSessions(): Promise<void> {
		if (!this.backend) return;
		const sessions = await this.backend.loadAll();
		for (const session of sessions) {
			this.sessions.set(session.id, session);
		}
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
