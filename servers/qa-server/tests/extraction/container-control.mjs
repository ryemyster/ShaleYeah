// Executed on stdin in the read-only production container, as its non-root user.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadQABinding } from "@shaleyeah/server-qa/dist/configuration.js";

const directory = "/tmp/qa-fixture";
const entry = "/opt/qa/tool/node_modules/@shaleyeah/server-qa/dist/index.js";
const file = execFileSync(process.execPath, ["node_modules/@shaleyeah/server-qa/examples/create-fixture.mjs", directory], { encoding: "utf8" }).trim();
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const meta = { "org.shaleyeah/correlation": { context: { ...config.correlation, scope: config.task.scope, taskRevision: "r1", qualification: "fixture" }, parentEventId: "container.qa", spanId: "b".repeat(16) } };
const args = { taskRef: { id: config.task.id, revision: "r1" }, profileRef: { id: config.profile.id, revision: "r1" } };
async function session(action) {
	const client = new Client({ name: "container-qa-consumer", version: "r1" });
	try { await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, QA_CONFIG_FILE: file }, stderr: "pipe" })); return await action(client); }
	finally { await client.close(); }
}
const resultRef = await session(async (client) => {
	const run = await client.callTool({ name: "run_quality_tests", arguments: args, _meta: meta });
	assert.equal(run.isError, false, JSON.stringify(run));
	assert.equal(run.structuredContent.analysis.payload.counts.passed, 8);
	return run.structuredContent.analysis.resultRef;
});
await session(async (client) => {
	assert.equal((await client.callTool({ name: "generate_quality_report", arguments: { resultRef }, _meta: meta })).isError, false);
	const denied = await client.callTool({ name: "run_quality_tests", arguments: { ...args, approved: true, outputPath: "/tmp/forged" }, _meta: meta });
	assert.equal(denied.isError, true);
});
const binding = await loadQABinding(file);
try {
	await assert.rejects(() => binding.service.report(resultRef, { ...binding.localPrincipal, customerId: "foreign" }));
	config.sources[0].grant.current = false; fs.writeFileSync(file, JSON.stringify(config));
	await assert.rejects(() => binding.service.report(resultRef, binding.localPrincipal));
} finally { binding.close(); }
assert.equal(process.getuid(), 10001);
assert.equal(process.platform, "linux");
assert.ok(!fs.existsSync("node_modules/@shaleyeah/server-qa/src"));
assert.ok(!fs.readFileSync(config.auditFile, "utf8").includes("netPay"));
console.log(JSON.stringify({ status: "passed", qualification: "fixture", professionalAcceptance: false, platform: process.platform, architecture: process.arch, uid: process.getuid(), node: process.versions.node, controls: ["generic-mcp", "eight-observed-rules", "restart-report", "scope-denial", "self-waiver-denial", "source-revocation", "metadata-only-audit", "installed-production-code"] }));
