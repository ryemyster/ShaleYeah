import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fixture } from "./fixtures/review-fixture.js";

test("installed HTTP launcher requires complete audit settings and serves scoped tools with private configuration", async () => {
	const f = fixture();
	let child: ReturnType<typeof spawn> | undefined;
	const client = new Client({ name: "reporter-bootstrap-client", version: "r1" });
	try {
		const policy = await f.options.currentPolicy();
		const token = randomBytes(32).toString("hex");
		const tokenFile = path.join(f.directory, "token"),
			reporterFile = path.join(f.directory, "reporter.json"),
			eventFile = path.join(f.directory, "event.json"),
			httpFile = path.join(f.directory, "http.json");
		const owned = (file: string, value: unknown) =>
			writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value), { mode: 0o600 });
		owned(tokenFile, token);
		owned(reporterFile, {
			version: "0.1.0",
			sourceAuthority: "operator-attested-export",
			directory: path.join(f.directory, "service"),
			policy,
			requirements: await f.options.currentRequirements(),
			sources: [f.receipt],
			localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			sensitiveFiles: [tokenFile],
		});
		const events = {
			version: "0.1.0",
			required: true,
			context: {
				runId: "bootstrap-fixture",
				traceId: "1".repeat(32),
				scope: policy.task.scope,
				taskRevision: policy.task.revision,
				qualification: "fixture",
			},
			producer: { id: "reporter", version: "0.1.0" },
			jsonlFile: path.join(f.directory, "events.jsonl"),
		};
		owned(eventFile, events);
		owned(httpFile, {
			reporterConfigFile: reporterFile,
			eventConfigFile: eventFile,
			accessTokenFile: tokenFile,
			dataPath: path.join(f.directory, "data"),
		});
		const launch = () =>
			spawn(process.execPath, ["examples/local-http.mjs"], {
				env: { ...process.env, PORT: "0", REPORTER_HTTP_CONFIG_FILE: httpFile },
				stdio: ["ignore", "pipe", "pipe"],
			});
		child = launch();
		let output = "";
		for (const stream of [child.stdout!, child.stderr!])
			stream.on("data", (bytes) => {
				output += bytes.toString();
			});
		assert.equal(await new Promise((resolve) => child!.once("close", resolve)), 1);
		assert.ok(!output.includes(token));
		owned(eventFile, { ...events, timeoutMs: 5000 });
		child = launch();
		const endpoint = await new Promise<URL>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("Reporter bootstrap deadline")), 10000);
			child!.once("error", (error) => {
				clearTimeout(timer);
				reject(error);
			});
			child!.once("close", () => {
				clearTimeout(timer);
				reject(new Error("Reporter exited before readiness"));
			});
			for (const stream of [child!.stdout!, child!.stderr!])
				stream.on("data", (bytes) => {
					const match = /HTTP transport listening on port (\d+)/.exec(bytes.toString());
					if (match) {
						clearTimeout(timer);
						resolve(new URL(`http://127.0.0.1:${match[1]}/mcp`));
					}
				});
		});
		await client.connect(
			new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
			}),
		);
		const result = await client.callTool({
			name: "draft_report",
			arguments: { sourceIds: [f.receipt.work.artifact.id], requirements: await f.options.currentRequirements() },
		});
		assert.equal(result.isError, false);
		assert.ok(!JSON.stringify(result).includes(token));
	} finally {
		await client.close();
		if (child && child.exitCode === null) {
			const closed = new Promise((resolve) => child!.once("close", resolve));
			child.kill("SIGTERM");
			await closed;
		}
		f.close();
	}
});
