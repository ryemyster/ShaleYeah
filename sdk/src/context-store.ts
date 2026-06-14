/**
 * In-process context store for agent memory namespaces (Phase 1 of #395).
 *
 * Each agent writes synthesized findings to its namespace after each run and reads
 * prior findings before building the system prompt. This is a process-level singleton —
 * findings persist across runXxxTask() calls within the same process but are lost on
 * restart. Phase 2 will swap this backing store for Supabase pgvector (#405).
 *
 * Namespaces are isolated: geologist cannot read economist findings.
 */
const store = new Map<string, string[]>();

export const ContextStore = {
	/** Returns concatenated prior findings, or empty string if none. */
	read(namespace: string): string {
		const entries = store.get(namespace);
		if (!entries || entries.length === 0) return "";
		return entries.join("\n\n");
	},

	/** Appends a finding to the namespace. No-ops on blank strings. */
	write(namespace: string, finding: string): void {
		if (!finding.trim()) return;
		const entries = store.get(namespace) ?? [];
		entries.push(finding.trim());
		store.set(namespace, entries);
	},

	/** Clears one namespace — used in tests to prevent cross-test leakage. */
	clear(namespace: string): void {
		store.delete(namespace);
	},

	/** Clears all namespaces — used in test suite teardown. */
	clearAll(): void {
		store.clear();
	},
};
