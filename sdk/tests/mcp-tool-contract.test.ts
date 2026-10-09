import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { classifyToolError, isToolFailure, PermanentToolError, RetryableToolError } from "../src/errors.js";
import { buildMutualExclusivityError } from "../src/mutual-exclusivity.js";
import { ServerFactory, type ServerToolTemplate } from "../src/server-factory.js";

const input = z.object({ value: z.string() }).strict();
const output = z.object({ value: z.string() }).strict();

async function fixture(tools: ServerToolTemplate[]) {
	const token = randomUUID();
	const prior = process.env.PORT;
	process.env.PORT = "0";
	let server: InstanceType<ReturnType<typeof ServerFactory.createServer>>;
	try {
		const Server = ServerFactory.createServer({
			name: "contract-fixture",
			description: "Deterministic protocol control",
			directories: [],
			tools,
			persona: { name: "Fixture", role: "fixture", expertise: [] },
		});
		server = new Server({
			http: {
				access: {
					mode: "local",
					accessToken: token,
					allowedHosts: ["127.0.0.1"],
					principal: {
						subjectId: "fixture",
						customerId: "fixture",
						employeeId: "fixture",
						scopes: ["fixture:connect", "fixture:tool"],
					},
					policy: {
						id: "contract-fixture",
						version: "r1",
						connectionScopes: ["fixture:connect"],
						toolScopes: Object.fromEntries(tools.map((tool) => [tool.name, ["fixture:tool"]])),
						resourceScopes: {},
					},
					audit: () => {},
				},
			},
		});
	} finally {
		if (prior === undefined) delete process.env.PORT;
		else process.env.PORT = prior;
	}
	server.dataPath = await fs.mkdtemp(path.join(os.tmpdir(), "shale-mcp-contract-"));
	await server.initialize();
	const client = new Client({ name: "contract-client", version: "0.1.0" });
	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	await client.connect(transport);
	return {
		client,
		async close() {
			await transport.terminateSession();
			await client.close();
			await server.stop();
			await fs.rm(server.dataPath, { recursive: true, force: true });
		},
	};
}

function textData(result: Awaited<ReturnType<Client["callTool"]>>) {
	assert.ok(Array.isArray(result.content));
	const first = result.content[0];
	assert.equal(first.type, "text");
	return JSON.parse(first.text);
}

test("factory preserves declared full schemas and MCP discovery metadata", async () => {
	const tool = {
		name: "typed_echo",
		description: "Typed echo",
		title: "Echo",
		inputSchema: input,
		outputSchema: output,
		type: "query" as const,
		annotations: { readOnlyHint: true, destructiveHint: false },
		_meta: { "example.org/contract": "echo-r1" },
		handler: async ({ value }: { value: string }) => ({ value }),
	};
	const app = await fixture([tool]);
	try {
		const [declared] = (await app.client.listTools()).tools;
		assert.equal(declared.title, "Echo");
		assert.equal(declared.inputSchema.additionalProperties, false);
		assert.deepEqual(declared.outputSchema?.required, ["value"]);
		assert.equal(declared.outputSchema?.additionalProperties, false);
		assert.equal(declared.annotations?.readOnlyHint, true);
		assert.deepEqual(declared._meta, tool._meta);
	} finally {
		await app.close();
	}
});

test("typed success is structured and compatibility JSON matches the declared result", async () => {
	const app = await fixture([
		{
			name: "typed_echo",
			description: "Typed echo",
			inputSchema: input,
			outputSchema: output,
			handler: async ({ value }: { value: string }) => ({ value }),
		},
	]);
	try {
		await app.client.listTools();
		const result = await app.client.callTool({ name: "typed_echo", arguments: { value: "kept" } });
		assert.equal(result.isError, false);
		assert.deepEqual(result.structuredContent, { value: "kept" });
		assert.deepEqual(textData(result), result.structuredContent);
	} finally {
		await app.close();
	}
});

test("full strict input rejects extra fields before executing the handler", async () => {
	let calls = 0;
	const app = await fixture([
		{
			name: "strict_echo",
			description: "Strict echo",
			inputSchema: input,
			handler: async ({ value }: { value: string }) => {
				calls++;
				return { value };
			},
		},
	]);
	try {
		const result = await app.client.callTool({ name: "strict_echo", arguments: { value: "kept", extra: "reject" } });
		assert.equal(result.isError, true);
		assert.equal(calls, 0);
	} finally {
		await app.close();
	}
});

test("factory handler throws remain genuine tool failures rather than wrapped success", async () => {
	const app = await fixture([
		ServerFactory.createAnalysisTool("failing", "Fail", input, async () => {
			throw new Error("fixture calculation failed");
		}),
	]);
	try {
		const result = await app.client.callTool({ name: "failing", arguments: { value: "x" } });
		assert.equal(result.isError, true);
		assert.equal(textData(result).success, false);
		assert.match(JSON.stringify(result.structuredContent), /fixture calculation failed/);
		assert.deepEqual(textData(result), result.structuredContent);
	} finally {
		await app.close();
	}
});

test("returned analysis failure is not masked by either factory or transport", async () => {
	const failure = { success: false, error: "missing licensed input", error_type: "user_action" };
	const app = await fixture([ServerFactory.createAnalysisTool("returned_failure", "Fail", input, async () => failure)]);
	try {
		const result = await app.client.callTool({ name: "returned_failure", arguments: { value: "x" } });
		assert.equal(result.isError, true);
		assert.deepEqual(result.structuredContent, failure);
		assert.deepEqual(textData(result), failure);
	} finally {
		await app.close();
	}
});

test("unwrapped legacy analysis success preserves its existing analysis and metadata", async () => {
	const app = await fixture([
		ServerFactory.createAnalysisTool("analysis", "Analyze", input, async ({ value }) => ({ value, confidence: 0.4 })),
	]);
	try {
		const result = await app.client.callTool({ name: "analysis", arguments: { value: "x" } });
		const parsed = textData(result);
		assert.equal(result.isError, false);
		assert.equal(parsed.success, true);
		assert.deepEqual(parsed.analysis, { value: "x", confidence: 0.4 });
		assert.equal(parsed.metadata.confidence, 0.4);
		assert.equal(parsed.data, undefined);
		assert.deepEqual(parsed, result.structuredContent);
	} finally {
		await app.close();
	}
});

test("partial domain output survives without being changed to completed work", async () => {
	const partial = { status: "partial", findings: ["draft"], missingInputs: ["licensed curve"] };
	const app = await fixture([
		{
			name: "partial",
			description: "Partial",
			inputSchema: input,
			outputSchema: z.object({
				status: z.literal("partial"),
				findings: z.array(z.string()),
				missingInputs: z.array(z.string()),
			}),
			handler: async () => partial,
		},
	]);
	try {
		const result = await app.client.callTool({ name: "partial", arguments: { value: "x" } });
		assert.equal(result.isError, false);
		assert.deepEqual(result.structuredContent, partial);
		assert.deepEqual(textData(result), partial);
	} finally {
		await app.close();
	}
});

test("declared zero and percentage confidence survive the real MCP boundary", async () => {
	const app = await fixture([
		ServerFactory.createAnalysisTool(
			"zero",
			"Zero confidence control",
			input,
			async () => ({ confidence: 0, npv: -42 }),
			{
				confidenceScale: "unit_interval",
			},
		),
		ServerFactory.createAnalysisTool("percent", "Percentage control", input, async () => ({ confidence: 80 }), {
			confidenceScale: "percentage",
		}),
	]);
	try {
		for (const [name, confidence, scale] of [
			["zero", 0, "unit_interval"],
			["percent", 80, "percentage"],
		] as const) {
			const result = await app.client.callTool({ name, arguments: { value: "x" } });
			const parsed = textData(result);
			assert.equal(result.isError, false);
			assert.equal(parsed.analysis.confidence, confidence);
			assert.equal(parsed.metadata.confidence, confidence);
			assert.equal(parsed.metadata.confidenceScale, scale);
			assert.equal(parsed.metadata.confidenceStatus, "available");
			assert.deepEqual(parsed, result.structuredContent);
			if (name === "zero") assert.equal(parsed.analysis.npv, -42);
		}
	} finally {
		await app.close();
	}
});

test("unavailable, invalid and undeclared scores remain distinct after JSON serialization", async () => {
	const app = await fixture([
		ServerFactory.createAnalysisTool("missing", "Missing control", input, async () => ({ findings: [] })),
		ServerFactory.createAnalysisTool("invalid", "Non-finite control", input, async () => ({ confidence: Number.NaN }), {
			confidenceScale: "percentage",
		}),
		ServerFactory.createAnalysisTool("unscaled", "Legacy control", input, async () => ({ confidence: 85 })),
	]);
	try {
		for (const [name, confidence, scale, status] of [
			["missing", null, null, "unavailable"],
			["invalid", null, "percentage", "invalid"],
			["unscaled", 85, null, "unscaled"],
		] as const) {
			const result = await app.client.callTool({ name, arguments: { value: "x" } });
			const parsed = textData(result);
			assert.equal(parsed.metadata.confidence, confidence);
			assert.equal(parsed.metadata.confidenceScale, scale);
			assert.equal(parsed.metadata.confidenceStatus, status);
			assert.equal(parsed.metadata.approved, undefined);
			assert.deepEqual(parsed, result.structuredContent);
		}
	} finally {
		await app.close();
	}
});

test("declared invalid success output fails and is never promoted as valid structured work", async () => {
	const app = await fixture([
		{
			name: "bad_output",
			description: "Bad output",
			inputSchema: input,
			outputSchema: output,
			handler: async () => ({ value: 123 }),
		},
	]);
	try {
		await app.client.listTools();
		const result = await app.client.callTool({ name: "bad_output", arguments: { value: "x" } });
		assert.equal(result.isError, true);
	} finally {
		await app.close();
	}
});

test("failure is separate from a declared success output schema", async () => {
	const app = await fixture([
		{
			name: "typed_failure",
			description: "Typed failure",
			inputSchema: input,
			outputSchema: output,
			handler: async () => {
				throw new Error("fixture access forbidden");
			},
		},
	]);
	try {
		await app.client.listTools();
		const result = await app.client.callTool({ name: "typed_failure", arguments: { value: "x" } });
		assert.equal(result.isError, true);
		assert.equal(textData(result).success, false);
		assert.equal(textData(result).error.error_type, "auth_required");
	} finally {
		await app.close();
	}
});

test("raw tools without an output schema retain their supported legacy data envelope", async () => {
	const app = await fixture([
		{
			name: "legacy",
			description: "Legacy",
			inputSchema: input,
			handler: async ({ value }: { value: string }) => ({ value }),
		},
	]);
	try {
		const result = await app.client.callTool({ name: "legacy", arguments: { value: "x" } });
		const parsed = textData(result);
		assert.equal(result.isError, false);
		assert.equal(parsed.success, true);
		assert.deepEqual(parsed.data, { value: "x" });
		assert.equal(parsed.metadata.server, "contract-fixture");
		assert.deepEqual(result.structuredContent, parsed);
	} finally {
		await app.close();
	}
});

test("native typed errors retain their retry classification independent of message text", async () => {
	const app = await fixture([
		{
			name: "permanent",
			description: "Permanent",
			inputSchema: input,
			handler: async () => {
				throw new PermanentToolError("fixture backend failed");
			},
		},
		{
			name: "retryable",
			description: "Retryable",
			inputSchema: input,
			handler: async () => {
				throw new RetryableToolError("fixture invalid upstream response");
			},
		},
	]);
	try {
		for (const name of ["permanent", "retryable"]) {
			const result = await app.client.callTool({ name, arguments: { value: "x" } });
			assert.equal(result.isError, true);
			assert.equal(textData(result).error.error_type, name);
		}
	} finally {
		await app.close();
	}
});

test("file helper success, returned failure and thrown failure keep their genuine outcome", async () => {
	const folder = await fs.mkdtemp(path.join(os.tmpdir(), "shale-mcp-file-contract-"));
	const file = path.join(folder, "fixture.las");
	await fs.writeFile(file, "fixture-only");
	const failure = { success: false, error: "fixture processing failed", error_type: "permanent" };
	const app = await fixture([
		ServerFactory.createFileProcessingTool("file_ok", "File", [".las"], async () => ({ fixture: true })),
		ServerFactory.createFileProcessingTool("file_failure", "File", [".las"], async () => failure),
	]);
	try {
		const ok = await app.client.callTool({ name: "file_ok", arguments: { filePath: file } });
		assert.equal(ok.isError, false);
		assert.deepEqual(textData(ok).data, { fixture: true });
		const returned = await app.client.callTool({ name: "file_failure", arguments: { filePath: file } });
		assert.equal(returned.isError, true);
		assert.deepEqual(returned.structuredContent, failure);
		const missing = await app.client.callTool({
			name: "file_ok",
			arguments: { filePath: path.join(folder, "missing.las") },
		});
		assert.equal(missing.isError, true);
		assert.equal(textData(missing).success, false);
	} finally {
		await app.close();
		await fs.rm(folder, { recursive: true, force: true });
	}
});

test("exported error classifier preserves native errors and the existing string compatibility cases", () => {
	assert.equal(classifyToolError(new PermanentToolError("backend failed")), "permanent");
	assert.equal(classifyToolError(new RetryableToolError("invalid upstream response")), "retryable");
	assert.equal(classifyToolError(new Error("Unauthorized")), "auth_required");
	assert.equal(classifyToolError(new Error("ENOENT")), "user_action");
	assert.equal(classifyToolError(new Error("ECONNREFUSED")), "retryable");
	assert.equal(classifyToolError(new Error("Invalid input")), "permanent");
	assert.equal(classifyToolError("legacy failure"), "retryable");
	assert.equal(isToolFailure({ success: false, error: "failed" }), true);
	assert.equal(isToolFailure({ error_type: "permanent", error: { message: "failed" } }), true);
	for (const value of [
		null,
		[],
		"error",
		{ success: true },
		{ error: "observation" },
		{ error_type: "permanent", error: null },
	]) {
		assert.equal(isToolFailure(value), false);
	}
});

test("existing mutually exclusive input errors cannot be wrapped as successful analysis", async () => {
	const failure = buildMutualExclusivityError(["formationName", "formationId"], ["formationName", "formationId"]);
	const app = await fixture([ServerFactory.createAnalysisTool("xor", "XOR", input, async () => failure)]);
	try {
		const result = await app.client.callTool({ name: "xor", arguments: { value: "x" } });
		assert.equal(result.isError, true);
		assert.deepEqual(result.structuredContent, failure);
	} finally {
		await app.close();
	}
});
