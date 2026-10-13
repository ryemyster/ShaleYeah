import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import QAServer, { evaluateQARules } from "../src/index.js";

test("public entry exports the real engine and unconfigured stdio supports discovery but blocks evaluation", async () => {
	assert.equal(typeof QAServer, "function");
	assert.equal(typeof evaluateQARules, "function");
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-cli-"));
	const entry = path.resolve(process.env.QA_TEST_ENTRY ?? "dist/index.js");
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([name, value]) => value !== undefined && !/^(PORT|QA_CONFIG_FILE)$/.test(name)),
	) as Record<string, string>;
	const client = new Client({ name: "generic-qa-stdio", version: "r1" });
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [entry],
		cwd: directory,
		env,
		stderr: "pipe",
	});
	try {
		await client.connect(transport);
		const status = await client.callTool({ name: "get_qa_status", arguments: {} });
		assert.equal((status.structuredContent as { analysis: { configured: boolean } }).analysis.configured, false);
		const result = await client.callTool({
			name: "run_quality_tests",
			arguments: { taskRef: { id: "task", revision: "r1" }, profileRef: { id: "profile", revision: "r1" } },
		});
		assert.equal(result.isError, true);
		assert.throws(() =>
			execFileSync(process.execPath, [entry], {
				cwd: directory,
				env: { ...env, QA_CONFIG_FILE: path.join(directory, "missing.json") },
				stdio: "pipe",
			}),
		);
	} finally {
		await client.close();
		rmSync(directory, { recursive: true });
	}
});

test("private configured stdio bootstrap runs eight checks and exports their recorded report through a generic client", async () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-bootstrap-"));
	const file = execFileSync(process.execPath, ["examples/create-fixture.mjs", directory], { encoding: "utf8" }).trim();
	const config = JSON.parse(readFileSync(file, "utf8"));
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([name, value]) => value !== undefined && name !== "PORT"),
	) as Record<string, string>;
	const client = new Client({ name: "qa-private-bootstrap", version: "r1" });
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [path.resolve(process.env.QA_TEST_ENTRY ?? "dist/index.js")],
		cwd: directory,
		env: { ...env, QA_CONFIG_FILE: file },
		stderr: "pipe",
	});
	try {
		await client.connect(transport);
		const meta = {
			"org.shaleyeah/correlation": {
				context: { ...config.correlation, scope: config.task.scope, taskRevision: "r1", qualification: "fixture" },
				parentEventId: "bootstrap.qa",
				spanId: "b".repeat(16),
			},
		};
		const run = await client.callTool({
			name: "run_quality_tests",
			arguments: {
				taskRef: { id: config.task.id, revision: "r1" },
				profileRef: { id: config.profile.id, revision: "r1" },
			},
			_meta: meta,
		});
		assert.equal(run.isError, false, JSON.stringify(run));
		const result = (
			run.structuredContent as {
				analysis: { resultRef: { id: string; revision: string }; payload: { counts: { passed: number } } };
			}
		).analysis;
		assert.equal(result.payload.counts.passed, 8);
		const report = await client.callTool({
			name: "generate_quality_report",
			arguments: { resultRef: result.resultRef },
			_meta: meta,
		});
		assert.equal(report.isError, false);
		const note = await client.callTool({
			name: "triage_quality_result",
			arguments: { resultRef: result.resultRef },
			_meta: meta,
		});
		assert.equal((note.structuredContent as { analysis: { status: string } }).analysis.status, "UNAVAILABLE");
		const events = readFileSync(config.auditFile, "utf8");
		assert.ok(events.includes('"parentEventId":"bootstrap.qa"'));
		assert.ok(events.includes('"kind":"evaluation"'));
		assert.ok(!events.includes("netPay"));
	} finally {
		await client.close();
		rmSync(directory, { recursive: true });
	}
});
