/**
 * Identifier normalization and fuzzy matching for MCP tool inputs — Arcade #42.
 *
 * LLMs pass natural identifiers like "Permian Basin #1A", "Permian-Basin-1a",
 * and "Permian Basin No. 1-A" to refer to the same entity. This module provides
 * normalization (collapse to a canonical slug) and fuzzy matching (Levenshtein
 * similarity ratio) so tools can recover from case/punctuation mismatches instead
 * of silently returning empty results.
 */

/**
 * Collapse a natural identifier to a lowercase hyphen-separated slug.
 * "Permian Basin #1A" → "permian-basin-1a"
 */
export function normalizeIdentifier(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Levenshtein edit distance between two strings.
 * Used internally by fuzzyMatch to compute similarity ratios.
 */
export function editDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	// dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	);
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1];
			} else {
				dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
			}
		}
	}
	return dp[m][n];
}

/**
 * Return candidates whose similarity to query meets or exceeds threshold.
 *
 * Similarity is 1 - editDistance(a, b) / max(len(a), len(b)), ranging from
 * 0 (completely different) to 1 (identical). Results are sorted by score
 * descending. Both query and candidates are compared as-is — normalize them
 * first if you want case/punctuation-insensitive matching.
 */
export function fuzzyMatch(
	query: string,
	candidates: string[],
	threshold = 0.8,
): Array<{ value: string; score: number }> {
	const results: Array<{ value: string; score: number }> = [];
	for (const candidate of candidates) {
		const maxLen = Math.max(query.length, candidate.length);
		// Empty strings are identical by convention.
		const score = maxLen === 0 ? 1 : 1 - editDistance(query, candidate) / maxLen;
		if (score >= threshold) {
			results.push({ value: candidate, score });
		}
	}
	return results.sort((a, b) => b.score - a.score);
}
