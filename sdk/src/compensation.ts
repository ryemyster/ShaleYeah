/**
 * Arcade Pattern #27 — Compensation Handler
 *
 * When a transactional tool fails permanently, the registry is consulted for a registered
 * undo function. If found, it runs before the rollback message is pushed to LLM history,
 * giving the agent a chance to delete or revert any partially-written state.
 *
 * Usage:
 *   CompensationRegistry.register("agent.save_x", async (args) => {
 *     await callTool("agent.delete_x", { id: args.id });
 *   });
 *
 * executeLoop calls this automatically for any tool where toolManifest.transactional === true.
 */

/** Function that attempts to undo a partially-applied write. */
export type CompensationFn = (args: Record<string, unknown>) => Promise<void>;

class CompensationRegistryImpl {
	private readonly registry = new Map<string, CompensationFn>();

	register(toolName: string, fn: CompensationFn): void {
		this.registry.set(toolName, fn);
	}

	get(toolName: string): CompensationFn | undefined {
		return this.registry.get(toolName);
	}

	/** Remove all registered handlers — used in tests to isolate each case. */
	clear(): void {
		this.registry.clear();
	}
}

export const CompensationRegistry = new CompensationRegistryImpl();
