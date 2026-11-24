/** Exercise the synthetic packet through the installed server using only plain JavaScript and MCP. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const [settingsFile, entrypoint] = process.argv.slice(2);
let client;
try {
	const settings = JSON.parse(await fs.readFile(settingsFile, "utf8"));
	client = new Client(
		{ name: "drilling-production-client", version: "r1" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	await client.connect(
		new StdioClientTransport({
			command: process.execPath,
			args: [entrypoint],
			cwd: settings.workingDirectory,
			env: { PATH: process.env.PATH ?? "", DRILLING_CONFIG_FILE: settings.configurationFile },
			stderr: "pipe",
		}),
	);
	const tools = (await client.listTools()).tools;
	assert.equal(tools.length, 12);
	assert.ok(!tools.some((tool) => /approve|decide/.test(tool.name)));
	let sequence = 0;
	async function call(name, args) {
		const result = await client.callTool({
			name,
			arguments: args,
			_meta: {
				"org.shaleyeah/correlation": {
					...settings.correlation,
					parentEventId: `${settings.correlation.parentEventId}.${++sequence}`,
				},
			},
		});
		assert.equal(result.isError, false);
		assert.equal(result.structuredContent?.success, true);
		return result.structuredContent.analysis;
	}
	const inputs = await call("read_drilling_inputs", { taskRef: settings.taskRef });
	assert.equal(inputs.sourceArtifacts.length, 3);
	const packet = await call("draft_drilling_packet", {
		taskRef: settings.taskRef,
		proposal: settings.proposal,
		revision: "production-r1",
	});
	assert.equal(packet.work.status, "ready_for_review");
	assert.equal(packet.work.review.status, "unreviewed");
	assert.equal(packet.drilling.professionalAcceptance, false);
	assert.equal(packet.drilling.operationalApproval, false);
	assert.equal(packet.drilling.costs.length, 1);
	assert.equal(packet.drilling.costs[0].totalExact, "450000/1");
	console.log(
		JSON.stringify({
			tools: tools.length,
			sources: inputs.sourceArtifacts.length,
			quotedTotal: packet.drilling.costs[0].totalExact,
			operationalApproval: packet.drilling.operationalApproval,
		}),
	);
} catch {
	console.error("Production client blocked");
	process.exitCode = 1;
} finally {
	await client?.close();
}
