import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";
import type { MCPHttpAccessConfig, ModelRuntime } from "@shaleyeah/sdk";
import { GeowizServer } from "../src/index.js";
import { sourceConfig } from "./fixtures/source-config.mjs";

const sample = fileURLToPath(new URL("sample-files/sample.las", import.meta.url));

test("protected Geowiz denies a readable source without a server-owned data grant before synthesis", async () => {
	let calls = 0;
	const runtime = {
		publicProfile: () => ({ owner: { customerId: "operator-demo", employeeId: "employee.geologist" } }),
		generate: async () => {
			calls++;
			return {
				output: { note: "Fixture requires review", evidenceIds: ["curve:RHOB"] },
				metadata: { provider: "gemini", model: "fixture" },
			};
		},
	} as unknown as ModelRuntime;
	const token = randomBytes(32).toString("base64url");
	const access: MCPHttpAccessConfig = {
		mode: "local",
		accessToken: token,
		allowedHosts: ["127.0.0.1"],
		principal: {
			subjectId: "operator",
			customerId: "operator-demo",
			employeeId: "employee.geologist",
			scopes: ["mcp:connect", "geowiz:analyze", "source:read"],
		},
		policy: {
			id: "fixture",
			version: "r1",
			connectionScopes: ["mcp:connect"],
			toolScopes: { analyze_formation: ["geowiz:analyze"] },
			resourceScopes: {},
		},
		audit: () => {},
	};
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-source-boundary-"));
	const prior = process.env.PORT;
	process.env.PORT = "0";
	const server = new GeowizServer({ dataPath: directory, modelRuntime: runtime, http: { access } });
	if (prior === undefined) delete process.env.PORT;
	else process.env.PORT = prior;
	const client = new Client(
		{ name: "source-control", version: "0.1.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	try {
		await server.initialize();
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
				requestInit: { headers: { Authorization: `Bearer ${token}` } },
			}),
		);
		const result = await client.callTool({ name: "analyze_formation", arguments: { filePath: sample } });
		assert.equal(result.isError, true, "a valid model grant must not also grant access to arbitrary source files");
		assert.equal(calls, 0);
		assert.ok(!JSON.stringify(result).includes(sample));
	} finally {
		await client.close();
		await server.stop();
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test("actual Geowiz binds LAS analysis and discovery to source bytes and denies changes, writes and revocation", async () => {
	let calls = 0;
	const principal = {
		subjectId: "operator",
		customerId: "operator-demo",
		employeeId: "employee.geologist",
		scopes: ["mcp:connect", "geowiz:analyze", "source:read"],
	};
	const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-source-approved-")));
	const input = path.join(directory, "approved.las");
	await fs.copyFile(sample, input);
	const config = await sourceConfig(input, principal);
	const sources = createConnectorRuntime(config, {
		audit: async () => {},
		installedAdapters: [operatorFileAdapter],
		currentGrant: async () => config.grant,
	});
	const runtime = {
		publicProfile: () => ({ owner: { customerId: principal.customerId, employeeId: principal.employeeId } }),
		generate: async () => {
			calls++;
			return {
				output: { note: "Review fixture", evidenceIds: ["curve:RHOB"] },
				metadata: { provider: "gemini", model: "fixture" },
			};
		},
	} as unknown as ModelRuntime;
	const token = randomBytes(32).toString("base64url");
	const access: MCPHttpAccessConfig = {
		mode: "local",
		accessToken: token,
		allowedHosts: ["127.0.0.1"],
		principal,
		policy: {
			id: "fixture",
			version: "r1",
			connectionScopes: ["mcp:connect"],
			toolScopes: Object.fromEntries(
				[
					"analyze_formation",
					"process_well_logs",
					"assess_quality",
					"process_document",
					"fetch_source",
					"get_source_status",
				].map((name) => [name, ["geowiz:analyze"]]),
			),
			resourceScopes: {},
		},
		audit: () => {},
	};
	const prior = process.env.PORT;
	process.env.PORT = "0";
	const server = new GeowizServer({
		dataPath: path.join(directory, "data"),
		modelRuntime: runtime,
		sourceRuntime: sources,
		http: { access },
	});
	if (prior === undefined) delete process.env.PORT;
	else process.env.PORT = prior;
	const client = new Client(
		{ name: "source-contract", version: "0.1.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	try {
		await server.initialize();
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
				requestInit: { headers: { Authorization: `Bearer ${token}` } },
			}),
		);
		for (const name of ["analyze_formation", "process_well_logs", "assess_quality"]) {
			const result = await client.callTool({
				name,
				arguments: { filePath: input, ...(name === "assess_quality" ? { dataType: "las" } : {}) },
			});
			assert.equal(result.isError, false, JSON.stringify(result.structuredContent));
			const artifact = (result.structuredContent?.analysis as Record<string, unknown>).sourceArtifact as typeof config;
			assert.equal(artifact.evidence.hash.value, config.sources[0].evidence.hash.value);
			const analysis = result.structuredContent?.analysis as Record<string, unknown>;
			const review = analysis.inputReview as { input: { contentHash: { value: string } }; review: { status: string } };
			assert.equal(review.input.contentHash.value, artifact.evidence.hash.value);
			assert.equal(review.review.status, "unreviewed");
			assert.deepEqual(artifact.scope, config.scope);
			assert.ok(!JSON.stringify(result).includes(directory));
			assert.ok(!JSON.stringify(result).includes("shaleyeah-source-"));
		}
		for (const name of ["fetch_source", "get_source_status"])
			assert.equal(
				(await client.callTool({ name, arguments: { sourceId: config.sources[0].evidence.id } })).isError,
				false,
			);
		const baseline = calls;
		for (const args of [{ filePath: sample }, { filePath: input, outputPath: path.join(directory, "unapproved.json") }])
			assert.equal((await client.callTool({ name: "analyze_formation", arguments: args })).isError, true);
		assert.equal((await client.callTool({ name: "process_document", arguments: { filePath: input } })).isError, true);
		await fs.appendFile(input, "0 1 2 3 4 5 6\n");
		const changed = await client.callTool({ name: "analyze_formation", arguments: { filePath: input } });
		assert.equal(changed.isError, true);
		assert.equal((changed.structuredContent?.sourceError as { code: string }).code, "revision_mismatch");
		config.grant.revoked = true;
		const denied = await client.callTool({ name: "analyze_formation", arguments: { filePath: input } });
		assert.equal(denied.isError, true);
		assert.equal(denied.structuredContent?.error_type, "auth_required");
		assert.equal(calls, baseline);
		await assert.rejects(fs.stat(path.join(directory, "unapproved.json")));
	} finally {
		await client.close();
		await server.stop();
		await fs.rm(directory, { recursive: true, force: true });
	}
});
