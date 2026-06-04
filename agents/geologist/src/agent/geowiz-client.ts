/**
 * Geowiz MCP client — thin wrapper that connects to the geowiz Tier 1 server over HTTP,
 * calls a single tool, and closes the connection.
 *
 * One-shot per call: simpler than managing a persistent connection for a standalone agent
 * that may not run co-located with geowiz at all times.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Call a tool on the geowiz MCP server at `url` and return its result content.
 * Throws if the server is unreachable or the tool call fails.
 */
export async function callGeowizTool(url: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
	const transport = new StreamableHTTPClientTransport(new URL(url));
	const client = new Client({ name: "geologist", version: "0.1.0" });
	await client.connect(transport);
	try {
		const result = await client.callTool({ name: toolName, arguments: args });
		return result.content;
	} finally {
		await client.close();
	}
}
