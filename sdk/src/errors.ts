/**
 * Tool error hierarchy — lets callers distinguish transient failures (worth retrying)
 * from permanent failures (bad input, not found, auth) without parsing error strings.
 * Implements Arcade pattern #40: Error Classification.
 */

import { ModelProviderError } from "./model-provider.js";

export class RetryableToolError extends Error {
	readonly retryable = true as const;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "RetryableToolError";
		if (cause instanceof Error) this.cause = cause;
	}
}

export class PermanentToolError extends Error {
	readonly retryable = false as const;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "PermanentToolError";
		if (cause instanceof Error) this.cause = cause;
	}
}

/** Preserve native error intent before using legacy message classification. */
export function classifyToolError(error: unknown): "auth_required" | "user_action" | "retryable" | "permanent" {
	if (error instanceof ModelProviderError) {
		if (error.code === "owner" || error.code === "credential") return "auth_required";
		if (error.code === "provider" || error.code === "timeout") return "retryable";
		return "permanent";
	}
	if (error instanceof PermanentToolError) return "permanent";
	if (error instanceof RetryableToolError) return "retryable";
	const message = String(error);
	if (/unauthorized|forbidden|api.?key|401|403/i.test(message)) return "auth_required";
	if (/file.?not.?found|missing.?data|ENOENT/i.test(message)) return "user_action";
	if (/timeout|rate.?limit|ECONNREFUSED|429|503/i.test(message)) return "retryable";
	if (/invalid|validation|schema|zod/i.test(message)) return "permanent";
	return "retryable";
}

/** Recognize supported handler failure records without treating arbitrary domain fields as errors. */
export function isToolFailure(value: unknown): boolean {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	if (record.success === false) return true;
	return (
		typeof record.error_type === "string" &&
		["auth_required", "user_action", "retryable", "permanent"].includes(record.error_type) &&
		(typeof record.error === "string" || (record.error !== null && typeof record.error === "object"))
	);
}
