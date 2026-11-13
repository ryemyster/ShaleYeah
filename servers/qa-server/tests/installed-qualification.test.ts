import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { createQualificationGuard } from "@shaleyeah/sdk";
import { QADispositionWorkflow } from "../src/review-workflow.js";
import { fixture } from "./fixtures/disposition-fixture.js";

test("enrolled operator CLI and installed verifier qualify one exact disposition without converting FAIL to PASS", async () => {
	const f = await fixture(true);
	f.workflow.close();
	const python = process.env.QA_TEST_PYTHON ?? path.resolve("../../agents/quality-assurance/.venv/bin/python");
	const configFile = path.join(f.directory, "qa.json"),
		settingsFile = path.join(f.directory, "qualification.json");
	const directory = path.dirname(f.directory);
	const config = {
		version: "0.1.0",
		sourceAuthority: "operator-attested-export",
		qualification: "fixture",
		correlation: { runId: "qa.native", traceId: "a".repeat(32) },
		directory,
		auditFile: path.join(directory, "events.jsonl"),
		task: f.task,
		profile: f.profile,
		grant: f.grant,
		sources: [
			{
				snapshot: {
					...f.source.snapshot,
					bytes: undefined,
					bytesBase64: Buffer.from(f.source.snapshot.bytes).toString("base64"),
				},
				grant: f.source.grant,
			},
		],
		localOperator: { uid: process.getuid!(), subjectId: f.requester.subjectId },
		sensitiveFiles: [],
		review: {
			policy: f.policy,
			dispositionPolicy: f.dispositionPolicy,
			localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			qualificationConfigFile: settingsFile,
		},
	};
	writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
	const workflow = new QADispositionWorkflow(f.directory, {
		...f.options,
		qualificationGuard: createQualificationGuard(settingsFile),
	});
	try {
		const prepared = await workflow.prepare(f.candidate(), f.requester, null);
		const packetFile = path.join(f.directory, "packet.json");
		await promisify(execFile)(process.execPath, ["examples/review.mjs", "inspect", prepared.reviewId, packetFile], {
			env: { ...process.env, QA_CONFIG_FILE: configFile },
		});
		const evidenceDirectory = path.join(f.directory, "evidence");
		const code = process.env.QA_TEST_CODE_REVISION ?? "a".repeat(40);
		try {
			await promisify(execFile)(python, [
				"-I",
				process.env.QA_QUALIFICATION_SCRIPT ??
					path.resolve("../../agents/quality-assurance/tests/eval/run_fixture_evals.py"),
				"--packet",
				packetFile,
				"--evidence-directory",
				evidenceDirectory,
				"--output",
				path.join(f.directory, "decision.json"),
				"--code-revision",
				code,
			]);
		} catch (error) {
			if (!existsSync(path.join(f.directory, "decision.json"))) throw error;
			const decision = JSON.parse(readFileSync(path.join(f.directory, "decision.json"), "utf8"));
			const bundle = JSON.parse(readFileSync(path.join(evidenceDirectory, `${prepared.packetDigest}.json`), "utf8"));
			throw new Error(
				JSON.stringify({
					failures: decision.failures,
					cases: bundle.evidence.map((record: { report: { caseId: string; hardFailures: string[] } }) => ({
						id: record.report.caseId,
						failures: record.report.hardFailures,
					})),
				}),
				{ cause: error },
			);
		}
		const decision = JSON.parse(readFileSync(path.join(f.directory, "decision.json"), "utf8"));
		assert.equal(decision.status, "passed");
		assert.equal(decision.professionalAcceptance, false);
		writeFileSync(
			settingsFile,
			JSON.stringify({
				schemaVersion: "0.1.0",
				pythonExecutable: python,
				evidenceDirectory,
				policyFile: path.join(evidenceDirectory, "policy.json"),
				codeRevision: code,
				caseId: "control_observed_pass",
			}),
			{ mode: 0o600 },
		);
		const reasonFile = path.join(f.directory, "reason.json");
		writeFileSync(
			reasonFile,
			JSON.stringify({ reason: "Reviewed exact bounded exception; failed input remains failed" }),
			{ mode: 0o600 },
		);
		const approval = await promisify(execFile)(
			process.execPath,
			["examples/review.mjs", "decide", prepared.reviewId, prepared.packetDigest, "approve", reasonFile],
			{ env: { ...process.env, QA_CONFIG_FILE: configFile } },
		);
		assert.equal(JSON.parse(approval.stdout).state, "approved");
		const status = await workflow.status(prepared.reviewId, f.requester);
		const result = await workflow.execute(
			{ reviewId: status.reviewId, packetDigest: status.packetDigest, grantId: status.grantId },
			f.requester,
		);
		assert.equal(result.stored, true);
		assert.equal((await f.service.report(f.report.resultRef, f.principal)).summary.status, "FAIL");
		const policy = JSON.parse(readFileSync(path.join(evidenceDirectory, "policy.json"), "utf8"));
		policy.revision = "r2";
		writeFileSync(path.join(evidenceDirectory, "policy.json"), JSON.stringify(policy));
		await assert.rejects(
			() =>
				workflow.execute(
					{ reviewId: status.reviewId, packetDigest: status.packetDigest, grantId: status.grantId },
					f.requester,
				),
			/qualification/,
		);
	} finally {
		workflow.close();
		f.close();
	}
});
