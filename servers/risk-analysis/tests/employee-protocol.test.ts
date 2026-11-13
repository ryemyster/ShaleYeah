import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { localBindingFixture } from "./fixtures/local-binding.js";
import { ref } from "./fixtures/risk.js";

test("generic MCP client and separate enrolled operator inspect, revise and recover exact risk review", async () => {
	const f = await localBindingFixture({ liveClock: true });
	let client: Client | undefined;
	const env = { PATH: process.env.PATH ?? "", RISK_ANALYSIS_CONFIG_FILE: f.file };
	let sequence = 0;
	const call = (name: string, args: Record<string, unknown>) =>
		client!.callTool({
			name,
			arguments: args,
			_meta: {
				"org.shaleyeah/correlation": {
					context: {
						scope: f.current.task.scope,
						taskRevision: "r1",
						...f.config.correlation,
						qualification: "fixture",
					},
					parentEventId: `generic-call-${++sequence}`,
					spanId: sequence.toString(16).padStart(16, "0"),
				},
			},
		});
	async function connected() {
		const instance = new Client(
			{ name: "independent-risk", version: "1" },
			{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
		);
		await instance.connect(
			new StdioClientTransport({
				command: process.execPath,
				args: [path.resolve("dist/index.js")],
				cwd: f.root,
				env,
				stderr: "pipe",
			}),
		);
		return instance;
	}
	const human = (args: string[]) =>
		spawnSync(process.execPath, [path.resolve("examples/review.mjs"), ...args], {
			env,
			encoding: "utf8",
			timeout: 15000,
		});
	try {
		client = await connected();
		const names = (await client.listTools()).tools.map((tool) => tool.name);
		assert.ok(names.includes("record_risk_assessment") && names.includes("calculate_risk"));
		assert.ok(!names.some((name) => /decide|approve/.test(name)));
		const read = await call("read_risk_inputs", { taskRef: ref });
		assert.equal(read.isError, false, JSON.stringify(read));
		assert.equal(
			(read.structuredContent as { analysis: { sourceArtifacts: unknown[] } }).analysis.sourceArtifacts.length,
			3,
		);
		const calculation = await call("calculate_risk", {
			taskRef: ref,
			modelRef: { id: "joint.fixture", revision: "r1" },
		});
		assert.equal(calculation.isError, false, JSON.stringify(calculation));
		const actual = calculation.structuredContent as { analysis: { risk: { summary: { expectedLoss: number } } } };
		assert.equal(actual.analysis.risk.summary.expectedLoss, 80);
		const draft = await call("draft_risk", {
			taskRef: ref,
			modelRef: { id: "joint.fixture", revision: "r1" },
			revision: "r1",
		});
		const product = (draft.structuredContent as { analysis: { work: Record<string, unknown>; risk: unknown } })
			.analysis;
		const candidate = {
			work: product.work,
			risk: product.risk,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.risk-analyst",
				revision: "r1",
				scope: f.current.task.scope,
				taskRevision: "r1",
				contextPolicy: f.config.review.policy.contextPolicy,
				selectedEvidence: product.work.evidence,
				workingArtifactRefs: [product.work.artifact],
				sharedKnowledge: [],
				assembledAt: new Date().toISOString(),
				retention: { policy: f.config.review.policy.retentionPolicy, expiresAt: f.config.review.policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.risk-analyst", revision: "r1", result: "fixture", failures: [] }],
		};
		const prepared = await call("prepare_risk_review", { candidate, expectedHead: null });
		assert.equal(prepared.isError, false);
		const receipt = (prepared.structuredContent as { analysis: { reviewId: string; packetDigest: string } }).analysis;
		const previewFile = path.join(f.root, "human-preview.json");
		const inspected = human(["inspect", receipt.reviewId, previewFile]);
		assert.equal(inspected.status, 0, inspected.stderr);
		const preview = JSON.parse(await fs.readFile(previewFile, "utf8"));
		assert.equal(preview.packet.sources.length, 3);
		assert.ok(preview.packet.sources.some((source: { text: string }) => source.text.includes("maxExpectedLoss")));
		const reasonFile = path.join(f.root, "review-reason.json");
		await fs.writeFile(reasonFile, JSON.stringify({ reason: "Clarify the joint-scenario basis" }), { mode: 0o600 });
		const changed = human(["decide", receipt.reviewId, receipt.packetDigest, "request_changes", reasonFile]);
		assert.equal(changed.status, 0, changed.stderr);
		await client.close();
		client = await connected();
		const restored = await call("risk_review_status", { reviewId: receipt.reviewId });
		assert.equal((restored.structuredContent as { analysis: { state: string } }).analysis.state, "changes-requested");
		const forged = await call("record_risk_assessment", { ...receipt, grantId: "forged" });
		assert.equal(forged.isError, true);
		f.config.sourceGrant.revoked = true;
		await f.write();
		const denied = await call("read_risk_inputs", { taskRef: ref });
		assert.equal(denied.isError, true);
	} finally {
		await client?.close();
		await f.close();
	}
});
