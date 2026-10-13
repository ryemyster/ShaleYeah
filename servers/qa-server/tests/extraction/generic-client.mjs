/** Independent protocol client for the offline container fixture, with no employee/server imports. */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const [settingsFile, endpointInput] = process.argv.slice(2);
let client;
try {
	const endpoint = new URL(endpointInput);
	assert.ok(
		endpoint.protocol === "http:" &&
			endpoint.hostname === "127.0.0.1" &&
			endpoint.port &&
			endpoint.pathname === "/mcp" &&
			!endpoint.username &&
			!endpoint.password &&
			!endpoint.search &&
			!endpoint.hash,
		"An explicit loopback MCP endpoint is required",
	);
	const settings = JSON.parse(await fs.readFile(settingsFile, "utf8"));
	const token = (await fs.readFile(settings.tokenFile, "utf8")).trim();
	client = new Client(
		{ name: "qa-container-protocol-client", version: "r1" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	await client.connect(
		new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
		}),
	);
	const tools = (await client.listTools()).tools;
	assert.ok(!tools.some((tool) => /approve|decide/.test(tool.name)));
	const result = await client.callTool({ name: settings.name, arguments: settings.arguments });
	assert.equal(result.isError === true, settings.expectError === true);
	assert.ok(!JSON.stringify(result).includes(token));
	const file = await fs.open(
		settings.outputFile,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		0o600,
	);
	try {
		await file.writeFile(`${JSON.stringify(result)}\n`);
		await file.sync();
	} finally {
		await file.close();
	}
} catch (error) {
	const name = error instanceof Error && /^[A-Za-z]+Error$/.test(error.name) ? error.name : "Error";
	const code = error && typeof error === "object" && "code" in error && /^[-A-Z0-9_]{1,64}$/.test(String(error.code))
		? String(error.code)
		: "unclassified";
	console.error(`Fixture client blocked: ${name}/${code}`);
	process.exitCode = 1;
} finally {
	await client?.close();
}
