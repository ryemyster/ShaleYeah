/**
 * SecretsStore — Kernel Secret Injection (Arcade: Secret Injection pattern)
 *
 * Manages API keys and credentials for all 14 MCP servers.
 *
 * ## Why this exists
 * Without injection, every server calls `process.env.ANTHROPIC_API_KEY` directly.
 * That means: no audit trail of which server accessed which key, no way to swap
 * keys per session or tenant, and no way to inject test keys without polluting
 * the real environment.
 *
 * ## How it works
 * 1. At startup, the kernel loads secrets from config (static values or async resolvers)
 * 2. Optionally loads a .env file for local dev (no prod dependency on dotenv)
 * 3. resolve(key) checks the store first, then falls back to process.env
 * 4. Every resolve() call is logged with the key name only — never the value
 *
 * ## Dev bypass
 * Set `secrets.envFile: ".env.local"` in KernelConfig to load a local .env file.
 * This lets devs keep their ANTHROPIC_API_KEY in a file instead of exporting it.
 * In CI and prod, this field is omitted — secrets come from the environment.
 */

import fs from "node:fs";
import type { SecretsConfig, SecretValue } from "./types.js";

/**
 * A single access log entry — key name only, never the value.
 * Kept in memory; the kernel's audit middleware writes these to disk.
 */
export interface SecretAccessEntry {
	key: string;
	timestamp: string;
	/** "store" = found in the injected store; "env" = fell back to process.env */
	source: "store" | "env";
}

export class SecretsStore {
	/** Injected secret values or async resolvers */
	private store = new Map<string, SecretValue>();

	/** In-memory access log — key names only, never values */
	private _accessLog: SecretAccessEntry[] = [];

	/**
	 * Pre-load secrets from a config object.
	 * Called by the kernel at initialize() time.
	 */
	load(config: SecretsConfig): void {
		for (const [key, value] of Object.entries(config)) {
			this.store.set(key, value);
		}
	}

	/**
	 * Load secrets from a .env file (key=value lines, # comments ignored).
	 * Silently skips if the file does not exist — this is a dev convenience,
	 * not a hard requirement.
	 *
	 * Values from the file are only loaded for keys not already in the store,
	 * so explicit config.values always wins over the file.
	 */
	loadEnvFile(filePath: string): void {
		if (!fs.existsSync(filePath)) return;

		const lines = fs.readFileSync(filePath, "utf-8").split("\n");
		for (const raw of lines) {
			const line = raw.trim();
			// Skip blank lines and comments
			if (!line || line.startsWith("#")) continue;

			const eqIdx = line.indexOf("=");
			if (eqIdx === -1) continue;

			const key = line.substring(0, eqIdx).trim();
			// Strip surrounding quotes from the value if present
			const rawVal = line.substring(eqIdx + 1).trim();
			const value = rawVal.replace(/^["']|["']$/g, "");

			// Only set if not already in store — explicit values take priority
			if (key && value && !this.store.has(key)) {
				this.store.set(key, value);
			}
		}
	}

	/**
	 * Register a single secret — static string or async resolver.
	 * Use this in tests to inject fake credentials without touching process.env.
	 */
	set(key: string, value: SecretValue): void {
		this.store.set(key, value);
	}

	/**
	 * Resolve a secret by name.
	 * Order: injected store → process.env → throws.
	 *
	 * Logs key name and source to the in-memory access log on every call.
	 * The value itself is never logged.
	 *
	 * MA-COMPAT: Managed Agents stores OAuth tokens in an external vault and routes tool calls
	 * through a proxy that authenticates using session-associated credentials — tokens never
	 * reach the sandbox. This method already follows that pattern (store → resolve, never expose).
	 * The gap: no expiration metadata on stored entries. When integrating with a vault backend
	 * (see #285), add { value: string, expiresAt?: Date } to SecretValue so stale tokens are
	 * detected and the dynamic resolver (() => Promise<string>) is called to refresh them.
	 */
	async resolve(key: string): Promise<string> {
		if (this.store.has(key)) {
			const entry = this.store.get(key)!;
			// Dynamic resolver — call fresh each time (supports vault rotation)
			const value = typeof entry === "function" ? await entry() : entry;
			this._accessLog.push({ key, timestamp: new Date().toISOString(), source: "store" });
			return value;
		}

		// Fall back to process.env — covers the default dev/CI case
		const envValue = process.env[key];
		if (envValue !== undefined) {
			this._accessLog.push({ key, timestamp: new Date().toISOString(), source: "env" });
			return envValue;
		}

		throw new Error(
			`Secret "${key}" is not set. ` +
				`Add it to the kernel secrets config, a .env file, or set the ${key} environment variable.`,
		);
	}

	/**
	 * Returns true if the key is registered in the store (not checking env).
	 * Used by tests to verify injection without resolving the value.
	 */
	has(key: string): boolean {
		return this.store.has(key);
	}

	/**
	 * Returns all registered key names — never values.
	 * Safe to log or display; useful for debugging what secrets are loaded.
	 */
	list(): string[] {
		return Array.from(this.store.keys());
	}

	/**
	 * The in-memory access log — key names and sources, never values.
	 * The kernel's audit middleware drains this periodically.
	 */
	get accessLog(): readonly SecretAccessEntry[] {
		return this._accessLog;
	}

	/**
	 * Drain and return all pending access log entries.
	 * Called by the audit middleware to flush entries to the audit trail.
	 */
	drainAccessLog(): SecretAccessEntry[] {
		const entries = [...this._accessLog];
		this._accessLog = [];
		return entries;
	}

	/**
	 * Prevent values from leaking via JSON.stringify().
	 * Only exposes the registered key names — never values.
	 */
	toJSON(): { registeredKeys: string[] } {
		return { registeredKeys: this.list() };
	}
}
