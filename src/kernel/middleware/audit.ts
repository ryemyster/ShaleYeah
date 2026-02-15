/**
 * SHALE YEAH Agent OS - Audit Middleware
 *
 * Append-only audit trail for all tool invocations.
 * Implements Arcade patterns:
 * - Audit Trail (structured logging of all tool calls)
 * - Secret Injection (redaction of sensitive values)
 */

import fs from "node:fs";
import path from "node:path";
import type { AuditEntry } from "../types.js";

// ==========================================
// Sensitive key patterns for redaction
// ==========================================

const SENSITIVE_PATTERNS = /key|token|secret|password|credential|auth|bearer|api.?key/i;

/** Redaction placeholder */
const REDACTED = "[REDACTED]";

// ==========================================
// AuditMiddleware
// ==========================================

/**
 * Append-only audit trail middleware.
 * Logs tool requests, responses, errors, and denials as JSONL.
 * When disabled, all log methods are no-ops.
 */
export class AuditMiddleware {
	private enabled: boolean;
	private auditPath: string;

	constructor(options?: { enabled?: boolean; auditPath?: string }) {
		this.enabled = options?.enabled ?? process.env.KERNEL_AUDIT_ENABLED !== "false";
		this.auditPath = options?.auditPath ?? (process.env.KERNEL_AUDIT_PATH || "data/audit");
	}

	/**
	 * Log a tool request (before execution).
	 */
	logRequest(entry: AuditEntry): void {
		this.writeEntry({ ...entry, action: "request" });
	}

	/**
	 * Log a tool response (after successful execution).
	 */
	logResponse(entry: AuditEntry): void {
		this.writeEntry({ ...entry, action: "response" });
	}

	/**
	 * Log an error (after failed execution).
	 */
	logError(entry: AuditEntry): void {
		this.writeEntry({ ...entry, action: "error" });
	}

	/**
	 * Log a denied request (auth gate blocked).
	 */
	logDenial(entry: AuditEntry): void {
		this.writeEntry({ ...entry, action: "denied" });
	}

	/**
	 * Redact sensitive values from a parameters object.
	 * Any key matching /key|token|secret|password|credential|auth|bearer|api.?key/i is replaced.
	 */
	redactSensitive(params: Record<string, unknown>): Record<string, unknown> {
		const redacted: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(params)) {
			if (SENSITIVE_PATTERNS.test(key)) {
				redacted[key] = REDACTED;
			} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				redacted[key] = this.redactSensitive(value as Record<string, unknown>);
			} else {
				redacted[key] = value;
			}
		}
		return redacted;
	}

	/**
	 * Build a standard audit entry from tool call context.
	 */
	buildEntry(
		tool: string,
		action: AuditEntry["action"],
		params: Record<string, unknown>,
		userId: string,
		sessionId: string,
		role: string,
		extra?: Partial<AuditEntry>,
	): AuditEntry {
		return {
			tool,
			action,
			parameters: this.redactSensitive(params),
			userId,
			sessionId,
			role,
			timestamp: new Date().toISOString(),
			...extra,
		};
	}

	/**
	 * Get all entries for a given date (for testing/inspection).
	 * Returns parsed AuditEntry objects.
	 */
	getEntries(date?: string): AuditEntry[] {
		if (!this.enabled) return [];

		const dateStr = date ?? new Date().toISOString().slice(0, 10);
		const filePath = path.join(this.auditPath, `${dateStr}.jsonl`);

		try {
			const content = fs.readFileSync(filePath, "utf-8");
			return content
				.trim()
				.split("\n")
				.filter((line) => line.length > 0)
				.map((line) => JSON.parse(line) as AuditEntry);
		} catch {
			return [];
		}
	}

	/**
	 * Whether audit logging is currently enabled.
	 */
	get isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get the configured audit path.
	 */
	get path(): string {
		return this.auditPath;
	}

	// ==========================================
	// Internal
	// ==========================================

	private writeEntry(entry: AuditEntry): void {
		if (!this.enabled) return;

		// Ensure parameters are redacted
		entry.parameters = this.redactSensitive(entry.parameters);

		const dateStr = new Date().toISOString().slice(0, 10);
		const filePath = path.join(this.auditPath, `${dateStr}.jsonl`);

		try {
			fs.mkdirSync(this.auditPath, { recursive: true });
			fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
		} catch {
			// Audit failures should not break execution — silently skip
		}
	}
}
