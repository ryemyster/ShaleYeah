/**
 * Tool error hierarchy — lets callers distinguish transient failures (worth retrying)
 * from permanent failures (bad input, not found, auth) without parsing error strings.
 * Implements Arcade pattern #40: Error Classification.
 */

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
