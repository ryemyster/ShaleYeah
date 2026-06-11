/**
 * Drilling MCP client — thin wrapper that connects to the drilling Tier 1 server over HTTP,
 * calls a single tool, and closes the connection.
 * One-shot per call: simpler than managing a persistent connection for a standalone agent
 * that may not run co-located with the drilling server at all times.
 *
 * Implements Arcade patterns:
 *   #28 Timeout Boundary — configurable timeoutMs, default 30s
 *   #39 Recovery Guide   — error messages include tool name and cause
 *   #40 Error Classification — RetryableToolError vs PermanentToolError
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";

export async function callDrillingTool(
	url: string,
	toolName: string,
	args: Record<string, unknown>,
	options: { timeoutMs?: number } = {},
): Promise<unknown> {
	const timeoutMs = options.timeoutMs ?? 30_000;

	// Race the actual call against a timeout. If the timeout fires first, the MCP
	// client continues in the background until its own connection handling cleans up.
	const timeoutPromise = new Promise<never>((_, reject) =>
		setTimeout(
			() => reject(new RetryableToolError(`Tool call to ${toolName} timed out after ${timeoutMs}ms`)),
			timeoutMs,
		),
	);

	const callPromise = (async () => {
		const transport = new StreamableHTTPClientTransport(new URL(url));
		const client = new Client({ name: "drilling-engineer", version: "0.1.0" });
		await client.connect(transport);
		try {
			const result = await client.callTool({ name: toolName, arguments: args });
			return result.content;
		} finally {
			await client.close().catch(() => {});
		}
	})();

	try {
		return await Promise.race([callPromise, timeoutPromise]);
	} catch (err) {
		// Preserve already-classified errors from the timeout promise.
		if (err instanceof RetryableToolError || err instanceof PermanentToolError) throw err;

		const msg = err instanceof Error ? err.message : String(err);

		// Network-level failures are transient — the server may be starting or briefly overloaded.
		if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|fetch failed/i.test(msg)) {
			throw new RetryableToolError(`Network error calling ${toolName}: ${msg}`, err instanceof Error ? err : undefined);
		}

		// Everything else (bad tool name, invalid args, auth, file not found) is permanent.
		throw new PermanentToolError(`Tool call to ${toolName} failed: ${msg}`, err instanceof Error ? err : undefined);
	}
}
