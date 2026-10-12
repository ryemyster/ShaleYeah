/** Installed third-party MCP client, with no agent or server implementation imports. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.argv[3]);
assert.ok(
	endpoint.protocol === "http:" &&
		endpoint.hostname === "127.0.0.1" &&
		Number(endpoint.port) >= 1 &&
		Number(endpoint.port) <= 65535 &&
		!endpoint.username &&
		!endpoint.password &&
		endpoint.pathname === "/mcp" &&
		!endpoint.search &&
		!endpoint.hash,
	"Fixture requires an explicit loopback MCP endpoint",
);
const settings = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const credential = (await fs.readFile(settings.tokenFile, "utf8")).trim();
const anonymous = await fetch(endpoint, {
	method: "POST",
	redirect: "error",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2025-11-25",
			capabilities: {},
			clientInfo: { name: "external-fixture", version: "r1" },
		},
	}),
});
assert.equal(anonymous.status, 401);
const client = new Client({ name: "generic-extracted-client", version: "r1" });
try {
	await client.connect(
		new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${credential}` }, redirect: "error" },
		}),
	);
	const tools = (await client.listTools()).tools;
	assert.ok(tools.some((tool) => tool.name === "prepare_review"));
	assert.ok(!tools.some((tool) => /approve|decide/.test(tool.name)));
	const result = await client.callTool({
		name: "assess_quality",
		arguments: { filePath: settings.sourceFile, dataType: "las" },
	});
	assert.equal(result.isError, false, JSON.stringify(result));
	assert.equal(result.structuredContent.analysis.dataType, "las");
	const denied = await client.callTool({
		name: "save_finding",
		arguments: { reviewId: "review.forged", packetDigest: "a".repeat(64), grantId: "grant.forged" },
	});
	assert.equal(denied.isError, true);
	assert.ok(!JSON.stringify(result).includes(credential));
	if (settings.outputSourceFile) {
		const source = await client.callTool({ name: "fetch_source", arguments: { sourceId: settings.sourceId } });
		assert.equal(source.isError, false);
		await fs.writeFile(settings.outputSourceFile, JSON.stringify(source.structuredContent.analysis), { mode: 0o600 });
	}
} finally {
	await client.close();
}
console.log("Generic installed MCP client controls pass");
