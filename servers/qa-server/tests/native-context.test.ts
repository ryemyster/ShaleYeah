import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { QAServer } from "../src/server.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("own native Gemini/Anthropic employee reads actual protected FAIL, resumes source-backed context and rejects revoked source", async () => {
	const f = await fixture(true),
		token = randomBytes(32).toString("hex");
	const before = process.env.PORT;
	process.env.PORT = "0";
	const server = new QAServer({
		service: f.service,
		reviewWorkflow: f.workflow,
		localPrincipal: f.requester,
		dataPath: path.join(f.directory, "transport"),
		http: {
			access: {
				mode: "local",
				principal: f.requester,
				accessToken: token,
				bindHost: "127.0.0.1",
				allowedHosts: ["127.0.0.1"],
				allowedOrigins: [],
				policy: {
					id: "access.qa",
					version: "r1",
					connectionScopes: ["qa:read"],
					resourceScopes: {},
					toolScopes: {
						get_qa_status: ["qa:read"],
						run_quality_tests: ["qa:run"],
						generate_quality_report: ["qa:report"],
						triage_quality_result: ["qa:report"],
						get_context_source_metadata: ["qa:report"],
						draft_disposition: ["qa:review"],
						prepare_review: ["qa:review"],
						get_review_status: ["qa:review"],
						record_disposition: ["qa:disposition"],
					},
				},
				audit: async () => {},
			},
		},
	});
	if (before === undefined) delete process.env.PORT;
	else process.env.PORT = before;
	try {
		await server.initialize();
		const tokenFile = path.join(f.directory, "token");
		writeFileSync(tokenFile, token, { mode: 0o600 });
		const sourceArtifact = {
			kind: "source-artifact",
			contractVersion: "0.2.0",
			scope: f.task.scope,
			taskRevision: f.task.revision,
			connectorRef: { id: "connector.qa", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			evidence: f.source.snapshot.evidence,
			artifact: f.ref,
			retrievedAt: new Date().toISOString(),
			format: "json",
			parserRef: { id: "normalized-qa-data", version: "0.1.0" },
			jurisdiction: "US-TX",
			units: [],
			byteLength: f.source.snapshot.bytes.length,
			accessNotes: "Fixture only",
			licenseNotes: "Authored fixture",
			revisionOrigin: "operator-declared",
		};
		let expectedHead: string | null = null;
		for (const provider of ["gemini", "anthropic"]) {
			const input = path.join(f.directory, `${provider}.json`),
				output = path.join(f.directory, `${provider}-out.json`);
			const settings = {
				task: f.task,
				sourceArtifact,
				candidate: f.candidate(),
				subjectId: f.requester.subjectId,
				provider,
				tokenFile,
				contextDirectory: path.join(f.directory, `${provider}-context`),
				contextPolicy: f.policy.contextPolicy,
				retentionPolicy: f.policy.retentionPolicy,
				expiresAt: f.policy.expiresAt,
				resultRef: f.report.resultRef,
				expectedHead,
			};
			writeFileSync(input, JSON.stringify(settings), { mode: 0o600 });
			const execute = () =>
				promisify(execFile)(
					process.env.QA_TEST_PYTHON ?? path.resolve("../../agents/quality-assurance/.venv/bin/python"),
					[
						"-I",
						process.env.QA_CONTEXT_STEP ??
							path.resolve("../../agents/quality-assurance/tests/fixtures/context-step.py"),
						input,
						output,
						`http://127.0.0.1:${server.httpPort()}/mcp`,
					],
				);
			await execute();
			const actual = JSON.parse(readFileSync(output, "utf8"));
			assert.deepEqual(actual.work, settings.candidate.work);
			assert.equal(actual.pending.state, "awaiting-review");
			expectedHead = actual.pending.packetDigest;
			assert.equal(actual.observedStatus, "FAIL");
			assert.equal(actual.context.selectedEvidence.length, 1);
			assert.ok(!JSON.stringify(actual).includes(token));
			f.source.grant.current = false;
			writeFileSync(input, JSON.stringify({ ...settings, mode: "revoked" }));
			await execute();
			f.source.grant.current = true;
		}
	} finally {
		await server.stop();
		f.close();
	}
});
