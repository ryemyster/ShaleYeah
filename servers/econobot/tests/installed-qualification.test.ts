import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { loadEconomicBinding } from "../src/configuration.js";
import { localBindingFixture } from "./fixtures/local-binding.js";
import { ref } from "./fixtures/scenario.js";

test("separate human CLI and installed financial verifier gate exact private scenario storage", async () => {
	const f = await localBindingFixture({ liveClock: true });
	const python = process.env.ECONOMIST_TEST_PYTHON ?? path.resolve("../../agents/economist/.venv/bin/python");
	const settingsFile = path.join(f.root, "qualification.json"),
		evidenceDirectory = path.join(f.root, "evidence");
	const codeRevision = process.env.ECONOMIST_TEST_CODE_REVISION ?? "a".repeat(40);
	Object.assign(f.config.review, { qualificationConfigFile: settingsFile });
	await f.write();
	let binding = await loadEconomicBinding(f.file);
	const human = (args: string[]) =>
		promisify(execFile)(process.execPath, [path.resolve("examples/review.mjs"), ...args], {
			env: { PATH: process.env.PATH ?? "", ECONOBOT_CONFIG_FILE: f.file },
			timeout: 30000,
		});
	try {
		const draft = await binding.service.draft(ref, ["base"], "r1", binding.localPrincipal);
		const candidate = {
			work: draft.work,
			scenario: draft.scenario,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.economist",
				revision: "r1",
				scope: draft.work.scope,
				taskRevision: draft.work.taskRevision,
				contextPolicy: f.config.review.policy.contextPolicy,
				selectedEvidence: draft.work.evidence,
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [],
				assembledAt: new Date().toISOString(),
				retention: { policy: f.config.review.policy.retentionPolicy, expiresAt: f.config.review.policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.economist", revision: "r2", result: "fixture", failures: [] }],
		};
		const prepared = await binding.reviewWorkflow!.prepare(candidate, binding.localPrincipal, null);
		await assert.rejects(
			binding.reviewWorkflow!.decide(
				prepared.reviewId,
				prepared.packetDigest,
				"approve",
				"An evaluation label alone is insufficient",
				await binding.reviewer!(),
			),
			/verification_unavailable/,
		);
		assert.equal(
			(await binding.reviewWorkflow!.status(prepared.reviewId, binding.localPrincipal)).state,
			"awaiting-review",
		);
		const packetFile = path.join(f.root, "packet.json"),
			observedFile = path.join(f.root, "observed.json");
		await human(["inspect", prepared.reviewId, packetFile]);
		await fs.writeFile(observedFile, JSON.stringify(draft), { mode: 0o600 });
		const decisionFile = path.join(f.root, "decision.json");
		await promisify(execFile)(
			python,
			[
				"-I",
				process.env.ECONOMIST_QUALIFICATION_SCRIPT ??
					path.resolve("../../agents/economist/tests/eval/run_fixture_evals.py"),
				"--packet",
				packetFile,
				"--observed",
				observedFile,
				"--evidence-directory",
				evidenceDirectory,
				"--output",
				decisionFile,
				"--code-revision",
				codeRevision,
			],
			{ timeout: 30000 },
		);
		const decision = JSON.parse(await fs.readFile(decisionFile, "utf8"));
		assert.equal(decision.status, "passed");
		assert.equal(decision.professionalAcceptance, false);
		await fs.writeFile(
			settingsFile,
			JSON.stringify({
				schemaVersion: "0.1.0",
				pythonExecutable: python,
				evidenceDirectory,
				policyFile: path.join(evidenceDirectory, "policy.json"),
				codeRevision,
				caseId: "control_base",
			}),
			{ mode: 0o600 },
		);
		const reasonFile = path.join(f.root, "reason.json");
		await fs.writeFile(
			reasonFile,
			JSON.stringify({ reason: "Reviewed exact synthetic net-entity financial basis; no capital commitment" }),
			{ mode: 0o600 },
		);
		const approved = await human(["decide", prepared.reviewId, prepared.packetDigest, "approve", reasonFile]);
		assert.equal(JSON.parse(approved.stdout).state, "approved");
		const status = await binding.reviewWorkflow!.status(prepared.reviewId, binding.localPrincipal);
		const execution = { reviewId: status.reviewId, packetDigest: status.packetDigest, grantId: status.grantId };
		const stored = await binding.reviewWorkflow!.execute(execution, binding.localPrincipal);
		assert.equal(stored.stored, true);
		assert.equal(binding.reviewWorkflow!.findingCount(), 1);
		binding.close();
		binding = await loadEconomicBinding(f.file);
		assert.deepEqual(await binding.reviewWorkflow!.execute(execution, binding.localPrincipal), stored);
		assert.equal(binding.reviewWorkflow!.findingCount(), 1);
		const policyFile = path.join(evidenceDirectory, "policy.json");
		const policy = JSON.parse(await fs.readFile(policyFile, "utf8"));
		policy.revision = "unreviewed-change";
		await fs.writeFile(policyFile, JSON.stringify(policy));
		await assert.rejects(binding.reviewWorkflow!.execute(execution, binding.localPrincipal), /qualification/);
	} finally {
		binding.close();
		await f.close();
	}
});
