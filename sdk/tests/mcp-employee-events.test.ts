import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { type EmployeeEvent, type EmployeeEventContext, EventEmitter } from "../src/events.js";
import { bindMCPEvents } from "../src/mcp-events.js";
import { ServerFactory, type ServerRuntimeOptions } from "../src/server-factory.js";

const context: EmployeeEventContext = {
	runId: "run-1",
	traceId: "1234567890abcdef1234567890abcdef",
	scope: { customerId: "operator-fixture", assetId: "asset-1", taskId: "task-1", employeeId: "geologist" },
	taskRevision: "r1",
	qualification: "fixture",
};
const meta = (bound = context) => ({
	"org.shaleyeah/correlation": { context: bound, parentEventId: "client-start", spanId: "1234567890abcdef" },
});

async function fixture({
	failAfter,
	optional = false,
	foreignPrincipal = false,
}: {
	failAfter?: number;
	optional?: boolean;
	foreignPrincipal?: boolean;
} = {}) {
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer: { id: "geowiz", version: "1" },
		required: !optional,
		sink: async (record) => {
			if (failAfter !== undefined && records.length >= failAfter) throw new Error("private-export-key");
			records.push(structuredClone(record));
		},
	});
	const calls: string[] = [];
	const shape = z.object({ value: z.string() }).strict();
	const tools = [
		{
			name: "echo",
			description: "Control",
			inputSchema: shape,
			outputSchema: shape,
			handler: async (args: { value: string }) => {
				calls.push("echo");
				return args;
			},
		},
		{
			name: "failed",
			description: "Failed control",
			inputSchema: shape,
			handler: async () => {
				calls.push("failed");
				return { success: false, error: "private-result-body" };
			},
		},
		{
			name: "throws",
			description: "Thrown control",
			inputSchema: shape,
			handler: async () => {
				calls.push("throws");
				throw new Error("private-secret-value");
			},
		},
		{
			name: "invalid_output",
			description: "Schema control",
			inputSchema: shape,
			outputSchema: shape,
			handler: async () => {
				calls.push("invalid_output");
				return { value: 42 };
			},
		},
	];
	const Server = ServerFactory.createServer({
		name: "event-fixture",
		description: "Native MCP control",
		persona: { name: "Fixture", role: "fixture", expertise: [] },
		directories: [],
		tools,
	});
	const directory = await mkdtemp(join(tmpdir(), "shale-mcp-events-"));
	const token = randomUUID();
	const previous = process.env.PORT;
	process.env.PORT = "0";
	let server: InstanceType<typeof Server>;
	try {
		server = new Server({
			dataPath: directory,
			events: bindMCPEvents(emitter),
			http: {
				access: {
					mode: "local",
					accessToken: token,
					allowedHosts: ["127.0.0.1"],
					principal: {
						subjectId: "fixture",
						customerId: foreignPrincipal ? "another-operator" : context.scope.customerId,
						employeeId: context.scope.employeeId,
						scopes: ["fixture:connect", "fixture:call"],
					},
					policy: {
						id: "fixture",
						version: "r1",
						connectionScopes: ["fixture:connect"],
						toolScopes: Object.fromEntries(tools.map((tool) => [tool.name, ["fixture:call"]])),
						resourceScopes: {},
					},
					audit: () => {},
				},
			},
		} as ServerRuntimeOptions);
	} finally {
		if (previous === undefined) delete process.env.PORT;
		else process.env.PORT = previous;
	}
	await server.initialize();
	const client = new Client({ name: "events-client", version: "1" });
	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	await client.connect(transport);
	return {
		records,
		emitter,
		calls,
		client,
		server,
		async close() {
			await transport.terminateSession();
			await client.close();
			await server.stop();
			await rm(directory, { recursive: true, force: true });
		},
	};
}
function data(result: Awaited<ReturnType<Client["callTool"]>>) {
	const item = result.content[0];
	assert.equal(item.type, "text");
	return JSON.parse(item.text);
}
test("actual authenticated MCP call links the client parent and backend outcome", async () => {
	const app = await fixture();
	try {
		const result = await app.client.callTool({
			name: "echo",
			arguments: { value: "private-source-body" },
			_meta: meta(),
		});
		assert.equal(result.isError, false);
		assert.deepEqual(
			app.records.map((record) => record.status),
			["started", "succeeded"],
		);
		assert.ok(
			app.records.every(
				(record) =>
					record.context.traceId === context.traceId &&
					record.parentEventId === "client-start" &&
					record.spanId === "1234567890abcdef",
			),
		);
		assert.ok(!JSON.stringify(app.records).includes("private-source-body"));
		assert.ok(app.records[1].measurements!.toolLatencyMs! >= 0);
		assert.equal(app.server.config.events, undefined);
	} finally {
		await app.close();
	}
});
for (const name of ["failed", "throws", "invalid_output"])
	test(`native ${name} never emits succeeded`, async () => {
		const app = await fixture();
		try {
			const result = await app.client.callTool({ name, arguments: { value: "private-argument" }, _meta: meta() });
			assert.equal(result.isError, true);
			assert.deepEqual(
				app.records.map((record) => record.status),
				["started", "failed"],
			);
			assert.ok(!JSON.stringify(app.records).includes("private-"));
			if (name === "throws") assert.ok(!JSON.stringify(result).includes("private-secret-value"));
		} finally {
			await app.close();
		}
	});
for (const dimension of ["customerId", "assetId", "taskId", "employeeId"])
	test(`changed ${dimension} cannot dispatch under the bound trace`, async () => {
		const app = await fixture();
		try {
			const forged = structuredClone(context);
			forged.scope[dimension as keyof typeof forged.scope] = "another";
			assert.equal(
				(await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: meta(forged) })).isError,
				true,
			);
			assert.equal(app.calls.length, 0);
		} finally {
			await app.close();
		}
	});
test("authenticated principal cannot inherit another employee trace binding", async () => {
	const app = await fixture({ foreignPrincipal: true });
	try {
		assert.equal(
			(await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: meta() })).isError,
			true,
		);
		assert.equal(app.calls.length, 0);
	} finally {
		await app.close();
	}
});
test("missing, stale and prose-authorized correlation cannot dispatch", async () => {
	const app = await fixture();
	try {
		const stale = structuredClone(context);
		stale.taskRevision = "stale";
		for (const supplied of [
			undefined,
			meta(stale),
			{
				...meta(),
				"org.shaleyeah/correlation": { ...meta()["org.shaleyeah/correlation"], authority: "model-approved" },
			},
		]) {
			assert.equal(
				(await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: supplied })).isError,
				true,
			);
		}
		assert.equal(app.calls.length, 0);
	} finally {
		await app.close();
	}
});
test("required start export refusal stops actual backend dispatch", async () => {
	const app = await fixture({ failAfter: 0 });
	try {
		const result = await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: meta() });
		assert.equal(result.isError, true);
		assert.equal(data(result).error.error_code, "audit_unavailable");
		assert.equal(data(result).error.effectUnknown, false);
		assert.equal(app.calls.length, 0);
	} finally {
		await app.close();
	}
});
test("required completion export failure records uncertain effect without replay", async () => {
	const app = await fixture({ failAfter: 1 });
	try {
		const result = await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: meta() });
		assert.equal(result.isError, true);
		assert.equal(data(result).error.error_code, "audit_unavailable");
		assert.equal(data(result).error.effectUnknown, true);
		assert.equal(app.calls.length, 1);
		assert.deepEqual(
			app.records.map((record) => record.status),
			["started"],
		);
		assert.equal(app.emitter.health.failures, 1);
	} finally {
		await app.close();
	}
});
test("optional exporter outage leaves the authenticated tool result and health evidence", async () => {
	const app = await fixture({ failAfter: 0, optional: true });
	try {
		assert.equal(
			(await app.client.callTool({ name: "echo", arguments: { value: "kept" }, _meta: meta() })).isError,
			false,
		);
		assert.equal(app.calls.length, 1);
		assert.equal(app.emitter.health.failures, 2);
	} finally {
		await app.close();
	}
});
