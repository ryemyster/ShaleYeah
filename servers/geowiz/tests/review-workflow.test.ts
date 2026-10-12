import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";
import { GeowizServer } from "../src/index.js";
import { createQualificationGuard } from "../src/qualification-config.js";
import { loadReviewBinding } from "../src/review-config.js";
import { type QualificationInput, ReviewError, ReviewWorkflow, reviewJson } from "../src/review-workflow.js";
import { sourceConfig } from "./fixtures/source-config.mjs";

const executeRequest = (receipt: { reviewId: string; packetDigest: string }, grantId: string | undefined) => ({
	reviewId: receipt.reviewId,
	packetDigest: receipt.packetDigest,
	grantId,
});

export async function reviewFixture() {
	const directory = mkdtempSync(path.join(os.tmpdir(), "geowiz-review-"));
	const records = JSON.parse(
		readFileSync(new URL("../../../contracts/fixtures/records.json", import.meta.url), "utf8"),
	);
	const requester = {
		subjectId: "employee-run",
		customerId: "operator-demo",
		employeeId: "employee.geologist",
		scopes: ["source:read", "geowiz:review", "geowiz:save"],
	};
	const reviewer = { ...requester, subjectId: "human-owner", scopes: ["geowiz:human-review"] };
	const config = await sourceConfig(new URL("sample-files/sample.las", import.meta.url).pathname, requester);
	const sources = createConnectorRuntime(config, {
		installedAdapters: [operatorFileAdapter],
		audit: async () => {},
		currentGrant: async () => config.grant,
	});
	const fetched = await sources.fetch(sources.request(config.sources[0].evidence.id), requester);
	const task = { ...records.task, scope: config.scope, inputs: [fetched.artifact.artifact] };
	const policy = {
		version: "0.1.0",
		id: "review.geologist",
		revision: "r1",
		task,
		requester,
		reviewerIds: [reviewer.subjectId],
		operation: "save_finding",
		destination: "private-reviewed-findings",
		expiresAt: config.grant.expiresAt,
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [fetched.artifact.evidence.usagePolicy],
		contextPolicy: records.context.contextPolicy,
		retentionPolicy: records.context.retention.policy,
		revoked: false,
	};
	const candidate = {
		work: {
			...records.work,
			scope: config.scope,
			inputs: task.inputs,
			evidence: [fetched.artifact.evidence],
			blockers: [],
			review: { status: "unreviewed", decisionRefs: [] },
		},
		context: {
			...records.context,
			scope: config.scope,
			selectedEvidence: [fetched.artifact.evidence],
			workingArtifactRefs: [],
			sharedKnowledge: [],
			assembledAt: new Date().toISOString(),
			retention: { ...records.context.retention, expiresAt: config.grant.expiresAt },
			blockers: [],
		},
		evaluations: [
			{ id: "eval.geologist", revision: "r1", failures: ["domain accuracy is not qualified"], result: "reported" },
		],
		finding: {
			findingType: "formation",
			title: "Observed LAS",
			summary: "Review actual inputs and stated assumptions",
			confidence: 0.1,
			dataSource: fetched.artifact.evidence.id,
		},
	};
	let now = Date.now();
	let fail: string | undefined;
	const options = {
		// Explicit trusted offline verifier double; real producer/CLI qualification is tested separately.
		qualificationGuard: async (input: QualificationInput) => ({
			schemaVersion: "0.1.0",
			kind: "qualification-decision",
			status: "passed",
			promotionAllowed: true,
			qualification: input.qualification,
			codeRevision: "a".repeat(40),
			profileHash: "b".repeat(64),
			policyHash: "c".repeat(64),
			expiresAt: policy.expiresAt,
			promotionBinding: {
				packetDigest: input.packetDigest,
				workHash: createHash("sha256").update(reviewJson(input.workProduct)).digest("hex"),
				scope: input.workProduct.scope,
				taskRevision: input.workProduct.taskRevision,
				productRef: { id: input.workProduct.artifact.id, revision: input.workProduct.artifact.revision },
				reportHash: "d".repeat(64),
			},
		}),
		sources,
		currentPolicy: async () => structuredClone(policy),
		contentGuard: async (text: string) => !text.includes("fixture-secret-value"),
		clock: () => new Date(now),
		beforeCommit: (stage: string) => {
			if (fail === stage) throw new Error("simulated interruption");
		},
	};
	const workflow = new ReviewWorkflow(directory, options);
	return {
		directory,
		requester,
		reviewer,
		config,
		policy,
		candidate,
		options,
		workflow,
		advance: (seconds: number) => {
			now += seconds * 1000;
		},
		failAt: (stage?: string) => {
			fail = stage;
		},
		close: () => {
			workflow.close();
			rmSync(directory, { recursive: true, force: true });
		},
	};
}

test("exact review, restart, and concurrent retries commit one finding with durable audit", async () => {
	const f = await reviewFixture();
	let reopened: ReviewWorkflow | undefined;
	try {
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		assert.equal((await f.workflow.status(undefined, f.requester)).reviewId, pending.reviewId);
		const packet = await f.workflow.inspect(pending.reviewId, f.reviewer);
		assert.equal(packet.state, "awaiting-review");
		assert.equal(packet.packet.work.assumptions.length, 1);
		assert.ok(packet.packet.sources[0].text.includes("~"));
		assert.deepEqual(packet.packet.evaluations, f.candidate.evaluations);
		assert.equal(packet.packet.action.destination, f.policy.destination);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Reviewed for this bounded local save",
			f.reviewer,
			{ humanReviewSeconds: 0, corrections: 0 },
		);
		assert.equal(approved.state, "approved");
		const reviewEvent = f.workflow
			.auditRecords()
			.find((entry) => entry.eventType === "review" && entry.status === "approved");
		assert.ok(reviewEvent);
		assert.deepEqual(reviewEvent.measurements, { humanReviewSeconds: 0, corrections: 0, reworkCount: 0 });
		f.workflow.close();
		reopened = new ReviewWorkflow(f.directory, f.options);
		const checkpoint = await reopened.status(pending.reviewId, f.requester);
		const request = {
			reviewId: checkpoint.reviewId,
			packetDigest: checkpoint.packetDigest,
			grantId: checkpoint.grantId,
		};
		const results = await Promise.all([reopened.execute(request, f.requester), reopened.execute(request, f.requester)]);
		assert.deepEqual(results[0], results[1]);
		assert.equal(results[0].stored, true);
		assert.equal(reopened.findingCount(), 1);
		assert.equal((await reopened.status(pending.reviewId, f.requester)).state, "completed");
		assert.ok(reopened.auditRecords().some((entry) => entry.outcome === "completed"));
		assert.equal(JSON.stringify(reopened.auditRecords()).includes(f.candidate.finding.summary), false);
	} finally {
		reopened?.close();
		f.close();
	}
});

for (const decision of ["reject", "request_changes"] as const)
	test(`${decision} is durable and confers no grant`, async () => {
		const f = await reviewFixture();
		try {
			const pending = await f.workflow.prepare(f.candidate, f.requester, null);
			const result = await f.workflow.decide(
				pending.reviewId,
				pending.packetDigest,
				decision,
				"Resolve assumptions",
				f.reviewer,
			);
			assert.equal(result.state, decision === "reject" ? "rejected" : "changes-requested");
			assert.equal(result.grantId, undefined);
			await assert.rejects(f.workflow.execute(executeRequest(pending, "forged"), f.requester), {
				code: "approval_required",
			});
			assert.equal(f.workflow.findingCount(), 0);
		} finally {
			f.close();
		}
	});

test("foreign identity, boolean approval, changed packet, policy and expired grants fail closed", async () => {
	const f = await reviewFixture();
	try {
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		await assert.rejects(
			f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "forged", f.requester),
			ReviewError,
		);
		await assert.rejects(f.workflow.inspect(pending.reviewId, { ...f.reviewer, customerId: "foreign" }), ReviewError);
		await assert.rejects(
			f.workflow.decide(pending.reviewId, "wrong-digest", "approve", "old view", f.reviewer),
			ReviewError,
		);
		await assert.rejects(
			f.workflow.execute({ ...executeRequest(pending, "forged"), approved: true }, f.requester),
			ReviewError,
		);
		const approved = await f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Reviewed", f.reviewer);
		const execution = { reviewId: pending.reviewId, packetDigest: pending.packetDigest, grantId: approved.grantId };
		await assert.rejects(f.workflow.execute(execution, { ...f.requester, subjectId: "another-agent" }), ReviewError);
		f.policy.revision = "r2";
		await assert.rejects(f.workflow.execute(execution, f.requester), ReviewError);
		f.policy.revision = "r1";
		f.policy.task.id = "other-task";
		f.policy.task.scope.taskId = "other-task";
		await assert.rejects(f.workflow.execute(execution, f.requester), { code: "revision_mismatch" });
		f.policy.task.id = "task-geology-1";
		f.policy.task.scope.taskId = "task-geology-1";
		f.advance(601);
		await assert.rejects(f.workflow.execute(execution, f.requester), ReviewError);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("new assumptions need a new immutable revision and invalidate the prior approval", async () => {
	const f = await reviewFixture();
	try {
		const old = await f.workflow.prepare(f.candidate, f.requester, null);
		const approved = await f.workflow.decide(old.reviewId, old.packetDigest, "approve", "Reviewed", f.reviewer);
		const revised = structuredClone(f.candidate);
		revised.work.assumptions[0].statement = "Use a revised datum";
		await assert.rejects(f.workflow.prepare(revised, f.requester, old.packetDigest), ReviewError);
		revised.work.artifact.revision = "r2";
		const next = await f.workflow.prepare(revised, f.requester, old.packetDigest);
		assert.notEqual(next.packetDigest, old.packetDigest);
		await assert.rejects(f.workflow.execute(executeRequest(old, approved.grantId), f.requester), {
			code: "revision_mismatch",
		});
		await assert.rejects(f.workflow.prepare(f.candidate, f.requester, old.packetDigest), ReviewError);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("revoked source authority and secrets block inspection and execution", async () => {
	const f = await reviewFixture();
	try {
		const secret = structuredClone(f.candidate);
		secret.finding.summary = "fixture-secret-value";
		await assert.rejects(f.workflow.prepare(secret, f.requester, null), ReviewError);
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		const approved = await f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Reviewed", f.reviewer);
		f.config.grant.revoked = true;
		await assert.rejects(f.workflow.inspect(pending.reviewId, f.reviewer), ReviewError);
		await assert.rejects(f.workflow.execute(executeRequest(pending, approved.grantId), f.requester), ReviewError);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("interruption at the local write rolls back audit, grant consumption and finding together", async () => {
	const f = await reviewFixture();
	try {
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		const approved = await f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Reviewed", f.reviewer);
		f.failAt("execute");
		const action = executeRequest(pending, approved.grantId);
		await assert.rejects(f.workflow.execute(action, f.requester), ReviewError);
		assert.equal(f.workflow.findingCount(), 0);
		assert.equal((await f.workflow.status(pending.reviewId, f.requester)).state, "approved");
		f.failAt();
		assert.equal((await f.workflow.execute(action, f.requester)).stored, true);
		assert.equal(f.workflow.findingCount(), 1);
	} finally {
		f.close();
	}
});

test("real MCP command cannot bypass the separately enrolled local human review CLI", { timeout: 20000 }, async () => {
	const f = await reviewFixture();
	const token = randomUUID();
	const privateWrite = (name: string, body: string) => {
		const file = path.join(f.directory, name);
		writeFileSync(file, body, { mode: 0o600 });
		return file;
	};
	const sourceFile = privateWrite("sources.json", JSON.stringify(f.config));
	const tokenFile = privateWrite("worker-token", token);
	const evidenceDirectory = path.join(f.directory, "qualification");
	const qualificationConfigFile = privateWrite(
		"qualification.json",
		JSON.stringify({
			schemaVersion: "0.1.0",
			pythonExecutable: new URL("../../../evaluations/.venv/bin/python", import.meta.url).pathname,
			evidenceDirectory,
			policyFile: path.join(evidenceDirectory, "policy.json"),
			codeRevision: "a".repeat(40),
			caseId: "control",
		}),
	);
	const configFile = privateWrite(
		"review.json",
		JSON.stringify({
			directory: f.directory,
			sourceConfigFile: sourceFile,
			sourceAuditFile: path.join(f.directory, "sources-audit.jsonl"),
			policy: f.policy,
			qualificationConfigFile,
			localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			sensitiveFiles: [tokenFile],
		}),
	);
	const previousPort = process.env.PORT;
	process.env.PORT = "0";
	const protectedWorkflow = new ReviewWorkflow(f.directory, {
		...f.options,
		qualificationGuard: createQualificationGuard(qualificationConfigFile),
	});
	const server = new GeowizServer({
		reviewWorkflow: protectedWorkflow,
		dataPath: path.join(f.directory, "tools"),
		http: {
			access: {
				mode: "local",
				accessToken: token,
				allowedHosts: ["127.0.0.1"],
				principal: { ...f.requester, scopes: [...f.requester.scopes, "mcp:connect"] },
				policy: {
					id: "local.review",
					version: "r1",
					connectionScopes: ["mcp:connect"],
					toolScopes: {
						prepare_review: ["geowiz:review"],
						get_review_status: ["geowiz:review"],
						save_finding: ["geowiz:save"],
					},
					resourceScopes: {},
				},
				audit: async () => {},
			},
		},
	});
	if (previousPort === undefined) delete process.env.PORT;
	else process.env.PORT = previousPort;
	const client = new Client({ name: "direct-mcp-fixture", version: "1" });
	let binding: Awaited<ReturnType<typeof loadReviewBinding>> | undefined;
	try {
		await server.initialize();
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.httpPort()}/mcp`), {
				requestInit: { headers: { Authorization: `Bearer ${token}` } },
			}),
		);
		assert.ok(!(await client.listTools()).tools.some((tool) => /decide|approve|inspect_review/.test(tool.name)));
		const prepared = await client.callTool({
			name: "prepare_review",
			arguments: { candidate: f.candidate, expectedHead: null },
		});
		assert.equal(prepared.isError, false);
		const pending = prepared.structuredContent!.analysis as { reviewId: string; packetDigest: string };
		const denied = await client.callTool({ name: "save_finding", arguments: executeRequest(pending, "forged") });
		assert.equal(denied.isError, true);
		assert.equal(f.workflow.findingCount(), 0);
		binding = await loadReviewBinding(configFile);
		assert.equal((await binding.reviewer()).subjectId, f.reviewer.subjectId);
		binding.workflow.close();
		binding = undefined;
		const command = promisify(execFile);
		const cli = new URL("../examples/review.mjs", import.meta.url).pathname;
		const packetFile = path.join(f.directory, "human-packet.json");
		await command(process.execPath, [cli, "inspect", pending.reviewId, packetFile], {
			env: { ...process.env, GEOWIZ_REVIEW_CONFIG_FILE: configFile },
		});
		const preview = JSON.parse(readFileSync(packetFile, "utf8"));
		assert.equal(preview.packetDigest, pending.packetDigest);
		assert.ok(preview.packet.sources[0].text.includes("~"));
		await command("uv", [
			"run",
			"--project",
			new URL("../../../evaluations", import.meta.url).pathname,
			"--frozen",
			"python",
			new URL("fixtures/qualification_fixture.py", import.meta.url).pathname,
			packetFile,
			evidenceDirectory,
			new URL("../../../agents/geologist/tests/eval/performance_profile.json", import.meta.url).pathname,
		]);
		const reasonFile = privateWrite(
			"reason.txt",
			"I reviewed inputs, assumptions, reported eval limitations and the local save",
		);
		const measurementsFile = privateWrite(
			"measurements.json",
			JSON.stringify({ humanReviewSeconds: 17, corrections: 0 }),
		);
		await command(
			process.execPath,
			[cli, "decide", pending.reviewId, preview.packetDigest, "approve", reasonFile, measurementsFile],
			{
				env: { ...process.env, GEOWIZ_REVIEW_CONFIG_FILE: configFile },
			},
		);
		const checkpoint = await client.callTool({ name: "get_review_status", arguments: { reviewId: pending.reviewId } });
		const approved = checkpoint.structuredContent!.analysis as {
			reviewId: string;
			packetDigest: string;
			grantId: string;
		};
		assert.ok(approved.grantId);
		const saved = await client.callTool({
			name: "save_finding",
			arguments: executeRequest(approved, approved.grantId),
		});
		assert.equal(saved.isError, false);
		assert.equal((saved.structuredContent!.analysis as { stored: boolean }).stored, true);
		assert.equal(f.workflow.findingCount(), 1);
		assert.deepEqual(f.workflow.auditRecords().find((entry) => entry.eventType === "review")?.measurements, {
			humanReviewSeconds: 17,
			corrections: 0,
			reworkCount: 0,
		});
	} finally {
		binding?.workflow.close();
		await client.close();
		await server.stop();
		protectedWorkflow.close();
		f.close();
	}
});

test("required gates, immutable action fields, store limits and retention cleanup stay fail closed", async () => {
	const f = await reviewFixture();
	try {
		const missing = structuredClone(f.candidate);
		missing.evaluations = [];
		const pending = await f.workflow.prepare(missing, f.requester, null);
		await assert.rejects(
			f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Attempt missing eval", f.reviewer),
			{ code: "required_gate_failed" },
		);
		await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"request_changes",
			"Provide reported eval evidence",
			f.reviewer,
		);
		f.policy.maxRecords = 1;
		await assert.rejects(f.workflow.prepare(f.candidate, f.requester, pending.packetDigest), { code: "store_limit" });
		f.advance(601);
		const purged = await f.workflow.purgeExpired(f.reviewer);
		assert.equal(purged, 1);
		await assert.rejects(f.workflow.inspect(pending.reviewId, f.reviewer), { code: "expired" });
		const bytes = readFileSync(path.join(f.directory, "review.sqlite"));
		assert.equal(bytes.includes(Buffer.from(f.candidate.finding.summary)), false);
	} finally {
		f.close();
	}
});

test("operator config rechecks enrolled OS user, secret files and binding changes", async () => {
	const f = await reviewFixture();
	let binding: Awaited<ReturnType<typeof loadReviewBinding>> | undefined;
	try {
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		const sourceFile = path.join(f.directory, "sources.json");
		const secretFile = path.join(f.directory, "secret");
		const configFile = path.join(f.directory, "config.json");
		writeFileSync(sourceFile, JSON.stringify(f.config), { mode: 0o600 });
		writeFileSync(secretFile, "fixture-secret-value", { mode: 0o600 });
		const config = {
			directory: f.directory,
			sourceConfigFile: sourceFile,
			sourceAuditFile: path.join(f.directory, "source-audit.jsonl"),
			policy: f.policy,
			localReviewer: { uid: process.getuid!(), subjectId: f.reviewer.subjectId },
			sensitiveFiles: [secretFile],
		};
		const update = () => writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
		update();
		binding = await loadReviewBinding(configFile);
		const human = await binding.reviewer();
		assert.equal((await binding.workflow.inspect(pending.reviewId, human)).packetDigest, pending.packetDigest);
		await assert.rejects(
			binding.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "fixture-secret-value", human),
			{ code: "unsafe_content" },
		);
		config.localReviewer.uid += 1;
		update();
		await assert.rejects(binding.reviewer(), { code: "authority_denied" });
		config.localReviewer.uid -= 1;
		config.sourceConfigFile = "different-owned-binding";
		update();
		await assert.rejects(binding.workflow.inspect(pending.reviewId, human), { code: "configuration_changed" });
	} finally {
		binding?.workflow.close();
		f.close();
	}
});

test("cancelled protected continuation leaves the approved finding unwritten", async () => {
	const f = await reviewFixture();
	try {
		const pending = await f.workflow.prepare(f.candidate, f.requester, null);
		const approved = await f.workflow.decide(pending.reviewId, pending.packetDigest, "approve", "Reviewed", f.reviewer);
		const cancellation = new AbortController();
		cancellation.abort();
		await assert.rejects(
			f.workflow.execute(executeRequest(pending, approved.grantId), f.requester, cancellation.signal),
			{ code: "cancelled" },
		);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("a timezone-formatted expired context cannot extend its retention", async () => {
	const f = await reviewFixture();
	try {
		f.candidate.context.assembledAt = new Date(Date.now() - 2 * 3600_000).toISOString();
		f.candidate.context.retention.expiresAt = new Date(Date.now() + 7 * 3600_000).toISOString().replace("Z", "+08:00");
		await assert.rejects(f.workflow.prepare(f.candidate, f.requester, null), { code: "unverified_inputs" });
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("approval cannot waive absent qualification through ordinary review settings", async () => {
	const f = await reviewFixture();
	let guarded: ReviewWorkflow | undefined;
	try {
		f.policy.requiredGates = [];
		guarded = new ReviewWorkflow(path.join(f.directory, "unqualified"), {
			...f.options,
			qualificationGuard: undefined,
		});
		const pending = await guarded.prepare(f.candidate, f.requester, null);
		await assert.rejects(
			guarded.decide(pending.reviewId, pending.packetDigest, "approve", "reported scores pass", f.reviewer),
			{ code: "qualification_required" },
		);
		assert.equal(guarded.findingCount(), 0);
	} finally {
		guarded?.close();
		f.close();
	}
});

test("a changed or foreign qualification cannot continue an approved save", async () => {
	const f = await reviewFixture();
	let guarded: ReviewWorkflow | undefined;
	let changed = false;
	try {
		const verifier = async (input: QualificationInput) => {
			const receipt = await f.options.qualificationGuard(input);
			return changed ? { ...receipt, profileHash: "e".repeat(64) } : receipt;
		};
		guarded = new ReviewWorkflow(path.join(f.directory, "verified"), { ...f.options, qualificationGuard: verifier });
		const pending = await guarded.prepare(f.candidate, f.requester, null);
		const approved = await guarded.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Reviewed verified evidence",
			f.reviewer,
		);
		changed = true;
		await assert.rejects(guarded.execute(executeRequest(pending, approved.grantId), f.requester), {
			code: "qualification_changed",
		});
		assert.equal(guarded.findingCount(), 0);
	} finally {
		guarded?.close();
		f.close();
	}
});

test("private qualification process bounds failures, output, configuration and cancellation", async () => {
	const f = await reviewFixture();
	try {
		const executable = path.join(f.directory, "verifier");
		const configuration = path.join(f.directory, "verifier.json");
		const settings = {
			schemaVersion: "0.1.0",
			pythonExecutable: executable,
			evidenceDirectory: f.directory,
			policyFile: path.join(f.directory, "policy.json"),
			codeRevision: "a".repeat(40),
			caseId: "control",
		};
		const configure = () => writeFileSync(configuration, JSON.stringify(settings), { mode: 0o600 });
		const script = (body: string) => writeFileSync(executable, `#!${process.execPath}\n${body}`, { mode: 0o700 });
		configure();
		const guard = createQualificationGuard(configuration);
		const input = { packetDigest: "d".repeat(64), workProduct: f.candidate.work, qualification: "fixture" as const };
		script(
			'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(JSON.stringify({status:"passed"})))',
		);
		assert.deepEqual(await guard(input), { status: "passed" });
		script(
			'process.stdin.resume(); process.stdin.on("end", () => {process.stderr.write("private-detail"); process.exit(1)})',
		);
		await assert.rejects(guard(input), /qualification_blocked/);
		script('process.stdin.resume(); process.stdin.on("end", () => process.stdout.write("bad-json"))');
		await assert.rejects(guard(input), /qualification_invalid/);
		script('process.stdout.write("x".repeat(70000)); setInterval(()=>{}, 1000)');
		await assert.rejects(guard(input), /qualification_limit/);
		script('process.stderr.write("x".repeat(17000)); setInterval(()=>{}, 1000)');
		await assert.rejects(guard(input), /qualification_limit/);
		script("process.stdin.resume(); setInterval(()=>{}, 1000)");
		const controller = new AbortController();
		const pending = guard(input, controller.signal);
		setTimeout(() => controller.abort(), 20);
		await assert.rejects(pending, /cancelled/);
		await assert.rejects(guard(input, controller.signal), /cancelled/);
		settings.pythonExecutable = path.join(f.directory, "absent");
		configure();
		await assert.rejects(guard(input), /qualification_unavailable/);
		settings.pythonExecutable = "relative-python";
		configure();
		await assert.rejects(guard(input), /qualification_configuration/);
		settings.pythonExecutable = executable;
		configure();
		await assert.rejects(guard({ ...input, packetDigest: "invalid" }), /qualification_configuration/);
		chmodSync(f.directory, 0o755);
		await assert.rejects(guard(input), /qualification_configuration/);
		chmodSync(f.directory, 0o700);
	} finally {
		f.close();
	}
});
