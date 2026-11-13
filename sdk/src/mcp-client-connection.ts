import type { Tool } from "@modelcontextprotocol/server";
import { PermanentToolError } from "./errors.js";
import { readPrivateText } from "./private-json.js";

async function boundedMCPFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
	const response = await fetch(input, { ...init, redirect: "manual" });
	if (response.status >= 300 && response.status < 400) {
		await response.body?.cancel();
		throw new PermanentToolError("MCP endpoint redirect denied");
	}
	if (!response.body) return response;
	const reader = response.body.getReader();
	let bytes = 0;
	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const chunk = await reader.read();
				if (chunk.done) {
					controller.close();
					return;
				}
				bytes += chunk.value.byteLength;
				if (bytes > 1_048_576) {
					await reader.cancel();
					controller.error(new PermanentToolError("MCP response exceeds the configured byte limit"));
					return;
				}
				controller.enqueue(chunk.value);
			} catch (error) {
				controller.error(error);
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
	return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** Host-owned setup for existing callers; never derive a credential from model arguments. */
export async function loadMCPClientConnection(
	endpoint: string,
	prefix: string,
): Promise<{
	url: URL;
	requestInit: RequestInit;
	fetch: typeof fetch;
}> {
	let url: URL;
	try {
		if (
			typeof prefix !== "string" ||
			!/^[A-Z][A-Z0-9_]{0,63}$/.test(prefix) ||
			typeof endpoint !== "string" ||
			endpoint.length > 2048
		)
			throw new Error();
		if ([...endpoint].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) >= 127)) throw new Error();
		url = new URL(endpoint);
		if (
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			endpoint.includes("?") ||
			endpoint.includes("#") ||
			(url.protocol !== "https:" &&
				!(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
		)
			throw new Error();
		if (url.pathname === "/") url.pathname = "/mcp";
	} catch {
		throw new PermanentToolError("Invalid MCP endpoint configuration");
	}
	try {
		const reference = process.env[`${prefix}_MCP_ACCESS_TOKEN_FILE`];
		if (!reference) throw new Error();
		const token = (await readPrivateText(reference, 4096)).trim();
		if (!/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error();
		return {
			url,
			requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
			fetch: boundedMCPFetch,
		};
	} catch {
		throw new PermanentToolError("MCP authentication requires a valid dedicated private credential file");
	}
}

/** A complete current catalog prevents ambiguous selection and post-dispatch SDK refresh/replay. */
export async function discoverMCPTool(
	peer: {
		listTools(
			params?: { cursor?: string },
			options?: { signal?: AbortSignal },
		): Promise<{ tools: Tool[]; nextCursor?: string }>;
	},
	name: string,
	signal?: AbortSignal,
): Promise<Tool> {
	let selected: Tool | undefined;
	let cursor: string | undefined;
	const seen = new Set<string>();
	for (let page = 0; page < 32; page++) {
		const result = await peer.listTools(cursor ? { cursor } : undefined, { signal });
		const matches = result.tools.filter((tool) => tool.name === name);
		if (matches.length > 1 || (matches.length && selected)) throw new PermanentToolError("Ambiguous MCP tool catalog");
		if (matches.length) selected = matches[0];
		cursor = result.nextCursor;
		if (cursor === undefined) {
			if (!selected) throw new PermanentToolError("Requested tool is absent from the current catalog");
			return selected;
		}
		if (typeof cursor !== "string" || !cursor || cursor.length > 512 || seen.has(cursor))
			throw new PermanentToolError("Invalid bounded MCP tool catalog");
		seen.add(cursor);
	}
	throw new PermanentToolError("MCP tool discovery exceeded its page budget");
}

/** SDK error codes can preserve diagnostics without copying untrusted messages or response data. */
export function mcpCommandFailure(error: unknown): PermanentToolError {
	const code = error instanceof Error && "code" in error ? error.code : undefined;
	if (code === "UNSUPPORTED_RESULT_TYPE")
		return new PermanentToolError("Unsupported MCP response after dispatch; input_required needs reviewed input");
	if (code === -32602)
		return new PermanentToolError("MCP input/output schema validation failed after dispatch; inspect the result");
	return new PermanentToolError("MCP call failed after dispatch; inspect the result before retrying");
}
