/**
 * QA Server MCP client — thin wrapper that connects to the qa-server Tier 1 server over HTTP,
 * calls a single tool, and closes the connection.
 *
 * One-shot per call: simpler than managing a persistent connection for a standalone agent
 * that may not run co-located with qa-server at all times.
 */

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
	discoverMCPTool,
	loadMCPClientConnection,
	mcpCommandFailure,
	PermanentToolError,
	RetryableToolError,
} from "@shaleyeah/sdk";

export async function callQAServerTool(
	url: string,
	toolName: string,
	args: Record<string, unknown>,
	options: { timeoutMs?: number } = {},
): Promise<unknown> {
	const timeoutMs = options.timeoutMs ?? 30_000;
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000)
		throw new PermanentToolError("Invalid bounded MCP call timeout");
	let dispatched = false;
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => {
			controller.abort();
			reject(
				dispatched
					? new PermanentToolError("MCP call timed out after dispatch; outcome is unknown and requires inspection")
					: new RetryableToolError("MCP connection timed out before command dispatch"),
			);
		}, timeoutMs);
	});
	const callPromise = (async () => {
		const connection = await loadMCPClientConnection(url, "QA_SERVER");
		const transport = new StreamableHTTPClientTransport(connection.url, {
			requestInit: { ...connection.requestInit, signal: controller.signal },
			fetch: connection.fetch,
		});
		const client = new Client(
			{ name: "quality-assurance", version: "0.1.0" },
			{ versionNegotiation: { mode: { pin: "2026-07-28" } }, inputRequired: { autoFulfill: false } },
		);
		try {
			await client.connect(transport);
			const toolDefinition = await discoverMCPTool(client, toolName, controller.signal);
			controller.signal.throwIfAborted();
			dispatched = true;
			const result = await client.callTool(
				{ name: toolName, arguments: args },
				{ toolDefinition, signal: controller.signal },
			);
			if (result.isError)
				throw new PermanentToolError(
					"MCP tool returned a failed result after dispatch; inspect the result before retrying",
				);
			return result.content;
		} finally {
			await client.close().catch(() => {});
		}
	})();
	try {
		return await Promise.race([callPromise, timeoutPromise]);
	} catch (error) {
		if (error instanceof PermanentToolError || error instanceof RetryableToolError) throw error;
		if (dispatched) throw mcpCommandFailure(error);
		if (error instanceof TypeError) throw new RetryableToolError("MCP connection failed before command dispatch");
		throw new PermanentToolError("MCP connection or discovery failed before command dispatch");
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}
