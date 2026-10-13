import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createQualificationGuard } from "@shaleyeah/sdk";
import { ReportReviewWorkflow } from "../src/review-workflow.js";
import { ReviewedSources } from "../src/reviewed-sources.js";
import { ReporterServer } from "../src/server.js";
import { fixture } from "./fixtures/review-fixture.js";

test("actual independent MCP client cannot approve; enrolled operator CLI requests changes on the exact packet", async () => {
	const f = fixture();
	f.workflow.close();
	const policy = await f.options.currentPolicy();
	policy.expiresAt = new Date(Date.now() + 3600_000).toISOString();
	f.receipt.expiresAt = policy.expiresAt;
	const metadataGrant = {
		workRef: f.receipt.work.artifact,
		evidence: f.receipt.work.evidence[0],
		subjectId: f.requester.subjectId,
		recipientScope: f.receipt.recipientScope,
		operations: ["read", "export"],
		current: true,
		expiresAt: f.receipt.expiresAt,
	};
	f.options.sources = new ReviewedSources({
		scope: policy.task.scope,
		current: async () => f.receipt,
		currentMetadata: async () => metadataGrant,
		contentGuard: async () => true,
		maxSourceAgeSeconds: 31536000,
	});
	const qualificationFile = path.join(f.directory, "qualification-settings.json");
	const workflow = new ReportReviewWorkflow(f.directory, {
		...f.options,
		clock: () => new Date(),
		qualificationGuard: createQualificationGuard(qualificationFile),
	});
	const token = randomBytes(32).toString("hex");
	const previous = process.env.PORT;
	process.env.PORT = "0";
	const server = new ReporterServer({
		...f.options,
		currentTask: async () => policy.task,
		localPrincipal: f.requester,
		reviewWorkflow: workflow,
		dataPath: path.join(f.directory, "data"),
		http: {
			access: {
				mode: "local",
				principal: f.requester,
				accessToken: token,
				bindHost: "127.0.0.1",
				allowedHosts: ["127.0.0.1"],
				allowedOrigins: [],
				policy: {
					id: "access.reporter",
					version: "r1",
					connectionScopes: ["reporter:sources"],
					toolScopes: {
						get_reviewed_source: ["reporter:sources"],
						get_context_source_metadata: ["reporter:sources"],
						draft_report: ["reporter:sources"],
						prepare_review: ["reporter:review"],
						get_review_status: ["reporter:review"],
						release_report: ["reporter:release"],
					},
					resourceScopes: {},
				},
				audit: async () => {},
			},
		},
	});
	if (previous === undefined) delete process.env.PORT;
	else process.env.PORT = previous;
	const client = new Client({ name: "independent-reporter-client", version: "r1" });
	try {
		await server.initialize();
		const endpoint = new URL(`http://127.0.0.1:${server.httpPort()}/mcp`);
		const denied = await fetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "anonymous", version: "r1" } },
			}),
		});
		assert.equal(denied.status, 401);
		await client.connect(
			new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
			}),
		);
		assert.equal(
			(await client.listTools()).tools.some((tool) => /approve|decide/.test(tool.name)),
			false,
		);
		const report = await client.callTool({
			name: "draft_report",
			arguments: { sourceIds: [f.receipt.work.artifact.id], requirements: await f.options.currentRequirements() },
		});
		assert.equal(report.isError, false);
		assert.ok(!JSON.stringify(report).includes(token));
		const pending = await client.callTool({
			name: "prepare_review",
			arguments: { candidate: f.candidate(), expectedHead: null },
		});
		assert.equal(pending.isError, false);
		const receipt = (pending.structuredContent as { analysis: { reviewId: string; packetDigest: string } }).analysis;
		const tokenFile = path.join(f.directory, "employee-token");
		writeFileSync(tokenFile, token, { mode: 0o600 });
		let nativeContext: { sharedKnowledge: unknown[] } | undefined;
		for (const provider of ["gemini", "anthropic"]) {
			const input = path.join(f.directory, `context-${provider}.json`),
				output = path.join(f.directory, `manifest-${provider}.json`);
			writeFileSync(
				input,
				JSON.stringify({
					task: policy.task,
					mode: "pair",
					requirements: await f.options.currentRequirements(),
					subjectId: f.requester.subjectId,
					provider,
					tokenFile,
					contextDirectory: path.join(f.directory, `state-${provider}`),
					contextPolicy: policy.contextPolicy,
					retentionPolicy: policy.retentionPolicy,
					expiresAt: policy.expiresAt,
				}),
				{ mode: 0o600 },
			);
			await promisify(execFile)(
				process.env.REPORTER_TEST_PYTHON ?? path.resolve("../../agents/reporter-agent/.venv/bin/python"),
				[
					"-I",
					process.env.REPORTER_CONTEXT_STEP ??
						path.resolve("../../agents/reporter-agent/tests/fixtures/context-step.py"),
					input,
					output,
					endpoint.href,
				],
			);
			const generated = JSON.parse(readFileSync(output, "utf8"));
			assert.deepEqual(generated.work, f.candidate().work);
			nativeContext = generated.context;
		}
		const forged = await client.callTool({
			name: "release_report",
			arguments: { reviewId: receipt.reviewId, packetDigest: receipt.packetDigest, grantId: "grant.forged" },
		});
		assert.equal(forged.isError, true);
		const configFile = path.join(f.directory, "operator.json"),
			reasonFile = path.join(f.directory, "reason.json");
		writeFileSync(
			configFile,
			JSON.stringify({
				version: "0.1.0",
				sourceAuthority: "operator-attested-export",
				directory: f.directory,
				policy,
				requirements: await f.options.currentRequirements(),
				sources: [f.receipt],
				localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
				sensitiveFiles: [],
				contextMetadataGrants: [metadataGrant],
				qualificationConfigFile: qualificationFile,
			}),
			{ mode: 0o600 },
		);
		writeFileSync(
			reasonFile,
			JSON.stringify({ reason: "Clarify the report purpose before publication", corrections: 1 }),
			{
				mode: 0o600,
			},
		);
		const result = await promisify(execFile)(
			process.execPath,
			["examples/review.mjs", "decide", receipt.reviewId, receipt.packetDigest, "request_changes", reasonFile],
			{ env: { ...process.env, REPORTER_CONFIG_FILE: configFile } },
		);
		assert.equal(JSON.parse(result.stdout).state, "changes-requested");
		const status = await client.callTool({ name: "get_review_status", arguments: { reviewId: receipt.reviewId } });
		assert.equal((status.structuredContent as { analysis: { state: string } }).analysis.state, "changes-requested");
		f.edit();
		const updated = JSON.parse(readFileSync(configFile, "utf8"));
		updated.requirements = await f.options.currentRequirements();
		writeFileSync(configFile, JSON.stringify(updated));
		// The edited work's source-backed context comes from its durable native catalog after restart.
		const revisedCandidate = f.candidate();
		const input = path.join(f.directory, "context-revised.json"),
			output = path.join(f.directory, "manifest-revised.json");
		writeFileSync(
			input,
			JSON.stringify({
				task: policy.task,
				mode: "pair",
				requirements: await f.options.currentRequirements(),
				subjectId: f.requester.subjectId,
				provider: "gemini",
				tokenFile,
				contextDirectory: path.join(f.directory, "state-revised"),
				contextPolicy: policy.contextPolicy,
				retentionPolicy: policy.retentionPolicy,
				expiresAt: policy.expiresAt,
			}),
			{ mode: 0o600 },
		);
		await promisify(execFile)(
			process.env.REPORTER_TEST_PYTHON ?? path.resolve("../../agents/reporter-agent/.venv/bin/python"),
			[
				"-I",
				process.env.REPORTER_CONTEXT_STEP ?? path.resolve("../../agents/reporter-agent/tests/fixtures/context-step.py"),
				input,
				output,
				endpoint.href,
			],
		);
		const generated = JSON.parse(readFileSync(output, "utf8"));
		assert.deepEqual(generated.work, revisedCandidate.work);
		revisedCandidate.context = generated.context;
		assert.equal(nativeContext?.sharedKnowledge.length, 1);
		const revised = await client.callTool({
			name: "prepare_review",
			arguments: { candidate: revisedCandidate, expectedHead: receipt.packetDigest },
		});
		assert.equal(revised.isError, false);
		const revisedReceipt = (revised.structuredContent as { analysis: { reviewId: string; packetDigest: string } })
			.analysis;
		const packetFile = path.join(f.directory, "packet.json"),
			evidenceDirectory = path.join(f.directory, "qualification");
		await promisify(execFile)(
			process.execPath,
			["examples/review.mjs", "inspect", revisedReceipt.reviewId, packetFile],
			{ env: { ...process.env, REPORTER_CONFIG_FILE: configFile } },
		);
		const python = process.env.REPORTER_TEST_PYTHON ?? path.resolve("../../agents/reporter-agent/.venv/bin/python");
		await promisify(execFile)(python, [
			process.env.REPORTER_QUALIFICATION_SCRIPT ??
				path.resolve("../../agents/reporter-agent/tests/eval/run_fixture_evals.py"),
			"--packet",
			packetFile,
			"--evidence-directory",
			evidenceDirectory,
			"--output",
			path.join(f.directory, "qualification.json"),
			"--code-revision",
			process.env.REPORTER_TEST_CODE_REVISION ?? "a".repeat(40),
		]);
		writeFileSync(
			qualificationFile,
			JSON.stringify({
				schemaVersion: "0.1.0",
				pythonExecutable: python,
				evidenceDirectory,
				policyFile: path.join(evidenceDirectory, "policy.json"),
				codeRevision: process.env.REPORTER_TEST_CODE_REVISION ?? "a".repeat(40),
				caseId: "control_source_faithful",
			}),
			{ mode: 0o600 },
		);
		const approve = await promisify(execFile)(
			process.execPath,
			["examples/review.mjs", "decide", revisedReceipt.reviewId, revisedReceipt.packetDigest, "approve", reasonFile],
			{ env: { ...process.env, REPORTER_CONFIG_FILE: configFile } },
		);
		assert.equal(JSON.parse(approve.stdout).state, "approved");
		const approved = await client.callTool({
			name: "get_review_status",
			arguments: { reviewId: revisedReceipt.reviewId },
		});
		const grant = (approved.structuredContent as { analysis: { grantId: string } }).analysis.grantId;
		const resumedInput = JSON.parse(readFileSync(input, "utf8"));
		resumedInput.mode = "resume";
		resumedInput.work = revisedCandidate.work;
		resumedInput.reviewId = revisedReceipt.reviewId;
		writeFileSync(input, JSON.stringify(resumedInput));
		const completedFile = path.join(f.directory, "native-completed.json");
		await promisify(execFile)(python, [
			"-I",
			process.env.REPORTER_CONTEXT_STEP ?? path.resolve("../../agents/reporter-agent/tests/fixtures/context-step.py"),
			input,
			completedFile,
			endpoint.href,
		]);
		const completed = JSON.parse(readFileSync(completedFile, "utf8"));
		assert.equal(completed.state, "completed");
		assert.equal(completed.outcome.stored, true);
		f.receipt.current = false;
		const replay = await client.callTool({
			name: "release_report",
			arguments: { reviewId: revisedReceipt.reviewId, packetDigest: revisedReceipt.packetDigest, grantId: grant },
		});
		assert.equal(replay.isError, true);
		const revokedInput = JSON.parse(readFileSync(input, "utf8"));
		revokedInput.mode = "revoked";
		writeFileSync(input, JSON.stringify(revokedInput));
		await promisify(execFile)(
			process.env.REPORTER_TEST_PYTHON ?? path.resolve("../../agents/reporter-agent/.venv/bin/python"),
			[
				"-I",
				process.env.REPORTER_CONTEXT_STEP ?? path.resolve("../../agents/reporter-agent/tests/fixtures/context-step.py"),
				input,
				path.join(f.directory, "denied.json"),
				endpoint.href,
			],
		);
	} finally {
		await client.close();
		await server.stop();
		workflow.close();
		f.close();
	}
});
