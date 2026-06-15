/**
 * Arcade pattern #9 — Mutual Exclusivity
 *
 * Utilities for enforcing XOR parameter constraints at the MCP tool-call layer.
 * When a tool accepts two ways to identify a resource (e.g. formationName OR
 * formationId) providing both is ambiguous. These helpers detect and report that
 * condition so the LLM receives a clear, non-retryable error telling it which
 * param to drop.
 */

/**
 * Check whether any group in `groups` has more than one param present in `args`.
 * Returns an error message string on the first violation, or null if all groups pass.
 *
 * A param counts as "present" only when its value is neither undefined nor null —
 * this matches Zod's .optional() semantics.
 */
export function checkMutualExclusivity(args: Record<string, unknown>, groups: string[][]): string | null {
	for (const group of groups) {
		const provided = group.filter((k) => args[k] !== undefined && args[k] !== null);
		if (provided.length > 1) {
			return (
				`Mutual exclusivity violation: ${provided.join(" and ")} cannot both be provided. ` + `Use one or the other.`
			);
		}
	}
	return null;
}

export interface MutualExclusivityError {
	error_type: "permanent";
	error: string;
	hint: string;
}

/**
 * Build the structured error payload to return to the LLM when an XOR constraint
 * is violated. error_type is always "permanent" — the same call with the same
 * args will never succeed, so the LLM must not retry without changing them.
 */
export function buildMutualExclusivityError(group: string[], provided: string[]): MutualExclusivityError {
	const [first, second] = provided;
	return {
		error_type: "permanent",
		error:
			`Mutual exclusivity violation: ${provided.join(" and ")} cannot both be provided. ` + `Use one or the other.`,
		hint:
			`Remove ${first} and use ${second} for precise lookup, or ` +
			`remove ${second} and use ${first} for ${group.length > provided.length ? "the other option" : "name-based lookup"}.`,
	};
}
