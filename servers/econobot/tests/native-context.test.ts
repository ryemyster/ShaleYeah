import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { loadEconomicBinding } from "../src/configuration.js";
import { EconobotServer } from "../src/index.js";
import { localBindingFixture } from "./fixtures/local-binding.js";
import { ref } from "./fixtures/scenario.js";

test("native economists return graded work and resume exact human-approved private storage across restart and revocation", async () => {
	const f = await localBindingFixture({ liveClock: true });
	const qualificationFile = path.join(f.root, "qualification.json");
	Object.assign(f.config.review, { qualificationConfigFile: qualificationFile });
	await f.write();
	const binding = await loadEconomicBinding(f.file);
	const python = process.env.ECONOMIST_TEST_PYTHON ?? path.resolve("../../agents/economist/.venv/bin/python");
	const codeRevision = process.env.ECONOMIST_TEST_CODE_REVISION ?? "a".repeat(40);
	const human = (args: string[]) =>
		promisify(execFile)(process.execPath, [path.resolve("examples/review.mjs"), ...args], {
			env: { PATH: process.env.PATH ?? "", ECONOBOT_CONFIG_FILE: f.file },
			timeout: 30000,
		});
	const token = randomBytes(32).toString("hex");
	const previousPort = process.env.PORT;
	process.env.PORT = "0";
	const tools = [
		"read_scenario_inputs",
		"read_scenario_source",
		"get_context_source_metadata",
		"calculate_scenario",
		"compare_scenarios",
		"draft_scenario",
		"prepare_review",
		"get_review_status",
		"record_scenario",
	];
	const server = new EconobotServer({
		...binding,
		http: {
			access: {
				mode: "local",
				principal: binding.localPrincipal,
				accessToken: token,
				bindHost: "127.0.0.1",
				allowedHosts: ["127.0.0.1"],
				allowedOrigins: [],
				policy: {
					id: "access.economist",
					version: "r1",
					connectionScopes: ["economics:read"],
					resourceScopes: {},
					toolScopes: Object.fromEntries(tools.map((name) => [name, ["economics:read"]])),
				},
				audit: async () => {},
			},
		},
	});
	if (previousPort === undefined) delete process.env.PORT;
	else process.env.PORT = previousPort;
	try {
		await server.initialize();
		const tokenFile = path.join(f.root, "mcp-token");
		await fs.writeFile(tokenFile, token, { mode: 0o600 });
		let expectedHead: string | null = null;
		let storedCount = 0;
		for (const provider of ["gemini", "anthropic"]) {
			const draft = await binding.service.draft(ref, ["base"], `${provider}-r1`, binding.localPrincipal);
			const input = path.join(f.root, `${provider}.json`),
				output = path.join(f.root, `${provider}-out.json`);
			const settings = {
				provider,
				tokenFile,
				task: f.current.task,
				draft,
				subjectId: binding.localPrincipal.subjectId,
				contextDirectory: path.join(f.root, `${provider}-context`),
				contextPolicy: f.config.review.policy.contextPolicy,
				retentionPolicy: f.config.review.policy.retentionPolicy,
				expiresAt: f.config.review.policy.expiresAt,
				correlation: f.config.correlation,
				expectedHead,
			};
			await fs.writeFile(input, JSON.stringify(settings), { mode: 0o600 });
			const execute = (destination: string) =>
				promisify(execFile)(
					python,
					[
						"-I",
						process.env.ECONOMIST_CONTEXT_STEP ?? path.resolve("../../agents/economist/tests/fixtures/context-step.py"),
						input,
						destination,
						`http://127.0.0.1:${server.httpPort()}/mcp`,
					],
					{ timeout: 60000 },
				);
			const result = await execute(output);
			assert.ok(!result.stdout.includes(token) && !result.stderr.includes(token));
			const actual = JSON.parse(await fs.readFile(output, "utf8"));
			assert.deepEqual(actual.work, draft.work);
			assert.equal(actual.context.selectedEvidence.length, 7);
			assert.equal(actual.pending.state, "awaiting-review");
			assert.equal(actual.grade.status, "passed");
			assert.equal(actual.grade.candidate.model.provider, provider);
			assert.equal(binding.reviewWorkflow!.findingCount(), storedCount);
			expectedHead = actual.pending.packetDigest;
			assert.ok(
				actual.native.agent_data.turns[0].events.some(
					(event: { content?: { parts?: { function_call?: { name: string } }[] } }) =>
						event.content?.parts?.some((part) => part.function_call?.name === "draft_scenario"),
				),
			);
			assert.ok(!JSON.stringify(actual).includes(token));
			await fs.writeFile(
				input,
				JSON.stringify({ ...settings, mode: "verify_restart", reviewId: actual.pending.reviewId }),
				{
					mode: 0o600,
				},
			);
			const restoredFile = path.join(f.root, `${provider}-restored.json`);
			await execute(restoredFile);
			const restored = JSON.parse(await fs.readFile(restoredFile, "utf8"));
			assert.equal(restored.status, "ready");
			assert.equal(restored.context.selectedEvidence.length, 7);
			assert.deepEqual(restored.pendingReviewRefs, [{ id: actual.pending.reviewId, revision: "r1" }]);
			{
				const directory = process.env.ECONOMIST_TEST_TRACE_DIRECTORY ?? path.resolve("artifacts/native-traces");
				await fs.mkdir(directory, { recursive: true, mode: 0o700 });
				await fs.writeFile(
					path.join(directory, `${provider}.json`),
					JSON.stringify({
						eval_cases: [
							{
								...actual.native,
								prompt: {
									role: "user",
									parts: [{ text: "Read exact sources, draft the base scenario and prepare human review" }],
								},
								reference: {
									response: {
										role: "model",
										parts: [{ text: JSON.stringify({ work: draft.work, scenario: draft.scenario }) }],
									},
								},
							},
						],
					}),
					{ mode: 0o600 },
				);
			}
			await assert.rejects(
				binding.reviewWorkflow!.decide(
					actual.pending.reviewId,
					actual.pending.packetDigest,
					"approve",
					"Inspect exact synthetic scenario",
					await binding.reviewer!(),
				),
				/verification_unavailable|qualification/,
			);
			const packet = path.join(f.root, `${provider}-packet.json`),
				evidence = path.join(f.root, `${provider}-evidence`);
			await human(["inspect", actual.pending.reviewId, packet]);
			await promisify(execFile)(
				python,
				[
					"-I",
					process.env.ECONOMIST_QUALIFICATION_SCRIPT ??
						path.resolve("../../agents/economist/tests/eval/run_fixture_evals.py"),
					"--packet",
					packet,
					"--observed",
					output,
					"--evidence-directory",
					evidence,
					"--output",
					path.join(f.root, `${provider}-qualification.json`),
					"--code-revision",
					codeRevision,
				],
				{ timeout: 30000 },
			);
			await fs.writeFile(
				qualificationFile,
				JSON.stringify({
					schemaVersion: "0.1.0",
					pythonExecutable: python,
					evidenceDirectory: evidence,
					policyFile: path.join(evidence, "policy.json"),
					codeRevision,
					caseId: "control_base",
				}),
				{ mode: 0o600 },
			);
			const reason = path.join(f.root, `${provider}-reason.json`);
			await fs.writeFile(
				reason,
				JSON.stringify({
					reason: "Reviewed exact synthetic scenario and graded employee output; no capital commitment",
				}),
				{ mode: 0o600 },
			);
			assert.equal(
				JSON.parse(
					(await human(["decide", actual.pending.reviewId, actual.pending.packetDigest, "approve", reason])).stdout,
				).state,
				"approved",
			);
			await fs.writeFile(input, JSON.stringify({ ...settings, mode: "resume", reviewId: actual.pending.reviewId }), {
				mode: 0o600,
			});
			const resumedFile = path.join(f.root, `${provider}-resumed.json`);
			await execute(resumedFile);
			const resumed = JSON.parse(await fs.readFile(resumedFile, "utf8"));
			assert.equal(resumed.state, "completed");
			assert.equal(resumed.outcome.stored, true);
			assert.deepEqual(resumed.pendingReviewRefs, []);
			assert.equal(binding.reviewWorkflow!.findingCount(), ++storedCount);
			f.config.connectorConfiguration.grant.revoked = true;
			await f.write();
			await fs.writeFile(input, JSON.stringify({ ...settings, mode: "revoked" }), { mode: 0o600 });
			const revokedFile = path.join(f.root, `${provider}-revoked.json`);
			await execute(revokedFile);
			assert.equal(JSON.parse(await fs.readFile(revokedFile, "utf8")).status, "blocked");
			f.config.connectorConfiguration.grant.revoked = false;
			await f.write();
		}
	} finally {
		await server.stop();
		binding.close();
		await f.close();
	}
});
