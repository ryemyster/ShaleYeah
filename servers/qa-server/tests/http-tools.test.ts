import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { bindMCPEvents, type EmployeeEvent, EventEmitter } from "@shaleyeah/sdk";
import { QAServer } from "../src/server.js";
import { fixture } from "./fixtures/qa-fixture.js";

test("generic HTTP MCP client executes real rules with verified identity, correlation and current source rights", async () => {
	const f = fixture(),
		token = randomBytes(32).toString("hex"),
		foreign = randomBytes(32).toString("hex");
	const records: EmployeeEvent[] = [],
		security: unknown[] = [];
	const context = {
		runId: "run.qa.fixture",
		traceId: "a".repeat(32),
		scope: f.task.scope,
		taskRevision: "r1",
		qualification: "fixture" as const,
	};
	const emitter = new EventEmitter({
		context,
		producer: { id: "qa", version: "0.1.0" },
		sink: async (event) => {
			records.push(event);
		},
	});
	const previous = process.env.PORT;
	process.env.PORT = "0";
	const server = new QAServer({
		service: f.service,
		localPrincipal: f.principal,
		dataPath: path.join(f.directory, "transport"),
		events: bindMCPEvents(emitter),
		http: {
			access: {
				mode: "remote",
				issuer: "https://identity.example.test",
				resource: "https://qa.example.test/mcp",
				authorizationServers: ["https://identity.example.test"],
				customerId: f.principal.customerId,
				employeeId: f.principal.employeeId,
				bindHost: "127.0.0.1",
				allowedHosts: ["127.0.0.1"],
				allowedOrigins: [],
				policy: {
					id: "access.qa",
					version: "r1",
					connectionScopes: ["qa:read"],
					toolScopes: {
						get_qa_status: ["qa:read"],
						run_quality_tests: ["qa:run"],
						generate_quality_report: ["qa:report"],
						triage_quality_result: ["qa:report"],
					},
					resourceScopes: {},
				},
				verifyBearer: async (presented) => {
					if (![token, foreign].includes(presented)) throw new Error("denied");
					return {
						...f.principal,
						customerId: presented === foreign ? "foreign" : f.principal.customerId,
						issuer: "https://identity.example.test",
						audience: "https://qa.example.test/mcp",
						expiresAt: Date.now() / 1000 + 3600,
					};
				},
				audit: async (event) => {
					security.push(event);
				},
			},
		},
	});
	if (previous === undefined) delete process.env.PORT;
	else process.env.PORT = previous;
	const client = new Client(
		{ name: "external-qa-client", version: "0.1.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	try {
		await server.initialize();
		const endpoint = new URL(`http://127.0.0.1:${server.httpPort()}/mcp`);
		const request = async (credential?: string) =>
			fetch(endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(credential ? { Authorization: `Bearer ${credential}` } : {}),
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "probe", version: "r1" } },
				}),
			});
		assert.equal((await request()).status, 401);
		assert.equal((await request(foreign)).status, 403);
		await client.connect(
			new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
		);
		assert.deepEqual(
			new Set((await client.listTools()).tools.map((tool) => tool.name)),
			new Set(["get_qa_status", "run_quality_tests", "generate_quality_report", "triage_quality_result"]),
		);
		const meta = { "org.shaleyeah/correlation": { context, parentEventId: "parent.qa", spanId: "b".repeat(16) } };
		assert.equal((await client.callTool({ name: "run_quality_tests", arguments: f.request })).isError, true);
		const run = await client.callTool({ name: "run_quality_tests", arguments: f.request, _meta: meta });
		assert.equal(run.isError, false, JSON.stringify(run));
		const analysis = (
			run.structuredContent as {
				analysis: { resultRef: { id: string; revision: string }; payload: { status: string } };
			}
		).analysis;
		assert.equal(analysis.payload.status, "PASS");
		const report = await client.callTool({
			name: "generate_quality_report",
			arguments: { resultRef: analysis.resultRef },
			_meta: meta,
		});
		assert.equal(report.isError, false);
		assert.equal(
			(
				await client.callTool({
					name: "run_quality_tests",
					arguments: { ...f.request, approved: true, outputPath: "/tmp/forbidden" },
					_meta: meta,
				})
			).isError,
			true,
		);
		f.source.grant.current = false;
		assert.equal(
			(
				await client.callTool({
					name: "generate_quality_report",
					arguments: { resultRef: analysis.resultRef },
					_meta: meta,
				})
			).isError,
			true,
		);
		assert.ok(records.some((event) => event.status === "succeeded" && event.parentEventId === "parent.qa"));
		assert.ok(records.some((event) => event.status === "failed"));
		const audit = JSON.stringify({ records, security });
		assert.ok(!audit.includes(token) && !audit.includes(foreign) && !audit.includes("netPay"));
	} finally {
		await client.close();
		await server.stop();
		f.close();
	}
});
