/**
 * SHALE YEAH Agent OS - Resilience Middleware
 *
 * Classifies errors, generates recovery guides, and handles graceful degradation.
 * Implements Arcade patterns:
 * - Error Classification (categorize errors by recoverability)
 * - Recovery Guide (actionable recovery steps per error type)
 * - Graceful Degradation (partial results when some servers fail)
 * - Fallback Tool (suggest alternatives when a tool fails)
 */

import type { DegradedResponse, ErrorDetail, RecoveryGuide, ToolResponse } from "../types.js";
import { ErrorType } from "../types.js";

// ==========================================
// Alternative tool mapping
// ==========================================

/**
 * Maps servers to overlapping-capability alternatives.
 * If server X fails, these are reasonable fallback suggestions.
 */
const ALTERNATIVE_TOOLS: Record<string, string[]> = {
	geowiz: ["research.analyze"],
	econobot: ["market.analyze", "research.analyze"],
	"curve-smith": ["econobot.analyze"],
	"risk-analysis": ["econobot.analyze", "research.analyze"],
	market: ["econobot.analyze", "research.analyze"],
	research: ["market.analyze"],
	legal: ["title.analyze"],
	title: ["legal.analyze"],
	drilling: ["development.analyze", "infrastructure.analyze"],
	infrastructure: ["development.analyze", "drilling.analyze"],
	development: ["drilling.analyze", "infrastructure.analyze"],
	test: [],
	reporter: [],
	decision: ["reporter.analyze"],
};

// ==========================================
// Error classification patterns
// ==========================================

/** Patterns that indicate a retryable/transient error */
const RETRYABLE_PATTERNS = [
	/rate.?limit/i,
	/too many requests/i,
	/429/,
	/timeout/i,
	/timed?\s*out/i,
	/ETIMEDOUT/,
	/ECONNRESET/,
	/ECONNREFUSED/,
	/ECONNABORTED/,
	/ENOTFOUND/,
	/ENETUNREACH/,
	/socket hang up/i,
	/network/i,
	/temporarily unavailable/i,
	/service unavailable/i,
	/503/,
	/502/,
	/504/,
	/retry/i,
];

/** Patterns that indicate an auth-related error */
const AUTH_PATTERNS = [
	/unauthorized/i,
	/forbidden/i,
	/401/,
	/403/,
	/api.?key/i,
	/authentication/i,
	/credentials/i,
	/access.?denied/i,
	/permission/i,
	/token.?expired/i,
];

/** Patterns that indicate user action is needed */
const USER_ACTION_PATTERNS = [
	/file.?not.?found/i,
	/no.?such.?file/i,
	/ENOENT/,
	/missing.?data/i,
	/missing.?file/i,
	/missing.?input/i,
	/no.?data/i,
	/not.?provided/i,
	/upload/i,
	/please.?provide/i,
];

/** Patterns that indicate a permanent/validation error */
const PERMANENT_PATTERNS = [
	/invalid/i,
	/validation/i,
	/schema/i,
	/zod/i,
	/parse.?error/i,
	/malformed/i,
	/unsupported/i,
	/not.?found/i,
	/does.?not.?exist/i,
	/unknown.?tool/i,
	/400/,
];

// ==========================================
// ResilienceMiddleware
// ==========================================

/**
 * Middleware for error intelligence and graceful degradation.
 */
export class ResilienceMiddleware {
	/**
	 * Classify an error string into an ErrorType.
	 * Checks patterns in priority order: auth > user_action > retryable > permanent.
	 */
	classifyError(error: string | Error, _toolName?: string): ErrorType {
		const msg = error instanceof Error ? error.message : String(error);

		// Auth errors take highest priority
		if (AUTH_PATTERNS.some((p) => p.test(msg))) return ErrorType.AUTH_REQUIRED;

		// User-action errors next (file not found, missing data)
		if (USER_ACTION_PATTERNS.some((p) => p.test(msg))) return ErrorType.USER_ACTION;

		// Retryable/transient errors
		if (RETRYABLE_PATTERNS.some((p) => p.test(msg))) return ErrorType.RETRYABLE;

		// Permanent/validation errors
		if (PERMANENT_PATTERNS.some((p) => p.test(msg))) return ErrorType.PERMANENT;

		// Default: retryable (optimistic — retry is safer than giving up)
		return ErrorType.RETRYABLE;
	}

	/**
	 * Build a full RecoveryGuide for a failed tool invocation.
	 */
	addRecoveryGuide(error: string | Error, toolName: string): RecoveryGuide {
		const msg = error instanceof Error ? error.message : String(error);
		const errorType = this.classifyError(msg, toolName);
		const serverName = toolName.split(".")[0];

		return {
			errorType,
			message: msg,
			reason: this.reasonForType(errorType),
			recoverySteps: this.recoveryStepsForType(errorType, toolName),
			alternativeTools: ALTERNATIVE_TOOLS[serverName] ?? [],
			retryAfterMs: errorType === ErrorType.RETRYABLE ? this.suggestRetryDelay(msg) : undefined,
		};
	}

	/**
	 * Classify an ErrorDetail in-place, enriching it with recovery guidance.
	 */
	classifyErrorDetail(errorDetail: ErrorDetail, toolName: string): ErrorDetail {
		const guide = this.addRecoveryGuide(errorDetail.message, toolName);
		return {
			...errorDetail,
			type: guide.errorType,
			reason: guide.reason,
			recoverySteps: guide.recoverySteps,
			alternativeTools: guide.alternativeTools,
			retryAfterMs: guide.retryAfterMs,
		};
	}

	/**
	 * Assess a set of gathered results for graceful degradation.
	 * Returns a DegradedResponse describing what succeeded, what's missing,
	 * and whether the partial result is still useful.
	 */
	handleDegradation(results: Map<string, ToolResponse>, expectedTools: string[]): DegradedResponse {
		const successful: ToolResponse[] = [];
		const missingAnalyses: string[] = [];

		for (const tool of expectedTools) {
			const resp = results.get(tool);
			if (resp?.success) {
				successful.push(resp);
			} else {
				missingAnalyses.push(tool);
			}
		}

		const totalExpected = expectedTools.length;
		const completeness = totalExpected > 0 ? Math.round((successful.length / totalExpected) * 100) : 100;

		const _isUseful = completeness >= 50;

		const suggestions = this.degradationSuggestions(missingAnalyses, completeness);

		const degradationReason =
			missingAnalyses.length === 0
				? "All analyses completed successfully."
				: `${missingAnalyses.length} of ${totalExpected} analyses failed or were unavailable.`;

		return {
			partialResults: successful,
			completeness,
			missingAnalyses,
			degradationReason,
			suggestions,
		};
	}

	// ==========================================
	// Internal helpers
	// ==========================================

	private reasonForType(errorType: ErrorType): string {
		switch (errorType) {
			case ErrorType.RETRYABLE:
				return "Transient failure — the request may succeed if retried.";
			case ErrorType.PERMANENT:
				return "The request is invalid and must be corrected before retrying.";
			case ErrorType.AUTH_REQUIRED:
				return "Authentication or authorization is missing or expired.";
			case ErrorType.USER_ACTION:
				return "Required data or input is missing — user action needed.";
		}
	}

	private recoveryStepsForType(errorType: ErrorType, toolName: string): string[] {
		const serverName = toolName.split(".")[0];

		switch (errorType) {
			case ErrorType.RETRYABLE:
				return [
					"Wait briefly and retry the request.",
					"Check network connectivity and server status.",
					`If ${serverName} remains unavailable, consider alternative tools.`,
				];
			case ErrorType.PERMANENT:
				return [
					"Review the request parameters for correctness.",
					"Check the tool's input schema for required fields.",
					`Refer to ${serverName} documentation for valid input formats.`,
				];
			case ErrorType.AUTH_REQUIRED:
				return [
					"Verify API key or credentials are configured.",
					"Check that the current role has permission for this operation.",
					"Re-authenticate if the session has expired.",
				];
			case ErrorType.USER_ACTION:
				return [
					"Provide the required input data or files.",
					"Check that referenced files exist and are accessible.",
					`Ensure ${serverName} has the data it needs to perform analysis.`,
				];
		}
	}

	private suggestRetryDelay(msg: string): number {
		// Rate limit → longer delay
		if (/rate.?limit|429|too many requests/i.test(msg)) return 5000;
		// Timeout → moderate delay
		if (/timeout|timed?\s*out/i.test(msg)) return 2000;
		// Connection errors → short delay
		return 1000;
	}

	private degradationSuggestions(missing: string[], completeness: number): string[] {
		const suggestions: string[] = [];

		if (missing.length === 0) return suggestions;

		if (completeness >= 50) {
			suggestions.push("Partial results are available and may be sufficient for initial assessment.");
		} else {
			suggestions.push("Insufficient data for reliable analysis — consider retrying failed servers.");
		}

		// Suggest alternatives for each missing tool
		for (const tool of missing) {
			const server = tool.split(".")[0];
			const alts = ALTERNATIVE_TOOLS[server];
			if (alts && alts.length > 0) {
				suggestions.push(`${server} failed — try ${alts.join(" or ")} as alternative.`);
			}
		}

		return suggestions;
	}
}
