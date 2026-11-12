import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { loadLegalBinding } from "../src/configuration.js";
import { ref } from "./fixtures/legal.js";
import { localBindingFixture } from "./fixtures/local-binding.js";

const execute = promisify(execFile);
async function prepared() {
	const f = await localBindingFixture({ liveClock: true });
	const binding = await loadLegalBinding(f.file);
	const draft = await binding.service.draft(ref, f.proposal, "r1", binding.localPrincipal);
	const policy = f.config.review.policy;
	const pending = await binding.reviewWorkflow!.prepare(
		{
			work: draft.work,
			legal: draft.legal,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.legal-analyst",
				revision: "r1",
				scope: draft.work.scope,
				taskRevision: draft.work.taskRevision,
				contextPolicy: policy.contextPolicy,
				selectedEvidence: draft.work.evidence,
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [],
				assembledAt: new Date().toISOString(),
				retention: { policy: policy.retentionPolicy, expiresAt: policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.legal-analyst", revision: "r1", result: "fixture", failures: [] }],
		},
		binding.localPrincipal,
		null,
	);
	const run = (args: string[]) =>
		execute(process.execPath, ["examples/review.mjs", ...args], {
			env: { ...process.env, LEGAL_CONFIG_FILE: f.file },
			timeout: 30000,
		});
	return { ...f, binding, pending, run };
}

test("the enrolled human CLI inspects exact private bytes and requests changes without exposing source text on stdout", async () => {
	const f = await prepared();
	try {
		const packetFile = path.join(f.root, "inspected.json");
		const inspected = await f.run(["inspect", f.pending.reviewId, packetFile]);
		assert.equal(JSON.parse(inspected.stdout).packetDigest, f.pending.packetDigest);
		assert.ok(!inspected.stdout.includes("Café"));
		const packetHandle = await fs.open(packetFile, constants.O_RDONLY | constants.O_NOFOLLOW);
		try {
			assert.equal((await packetHandle.stat()).mode & 0o077, 0);
			const packet = JSON.parse(await packetHandle.readFile("utf8"));
			assert.equal(packet.packet.sources.length, 3);
			assert.equal(packet.packet.legal.legalClearance, false);
		} finally {
			await packetHandle.close();
		}
		const reason = path.join(f.root, "reason.json");
		await fs.writeFile(
			reason,
			JSON.stringify({ reason: "Clarify the declared territorial exception", humanReviewSeconds: 12, corrections: 1 }),
			{ mode: 0o600 },
		);
		const changed = await f.run(["decide", f.pending.reviewId, f.pending.packetDigest, "request_changes", reason]);
		assert.equal(JSON.parse(changed.stdout).state, "changes-requested");
		assert.equal(
			(await f.binding.reviewWorkflow!.status(f.pending.reviewId, f.binding.localPrincipal)).state,
			"changes-requested",
		);
	} finally {
		f.binding.close();
		await f.close();
	}
});

test("human CLI cannot overwrite an existing packet, invent a review digest or approve without installed qualification", async () => {
	const f = await prepared();
	try {
		const target = path.join(f.root, "existing.json");
		await fs.writeFile(target, "preserve", { mode: 0o600 });
		await assert.rejects(f.run(["inspect", f.pending.reviewId, target]));
		assert.equal(await fs.readFile(target, "utf8"), "preserve");
		const reason = path.join(f.root, "reason.json");
		await fs.writeFile(reason, JSON.stringify({ reason: "Exact advisory record reviewed" }), { mode: 0o600 });
		for (const digest of ["0".repeat(64), f.pending.packetDigest])
			await assert.rejects(f.run(["decide", f.pending.reviewId, digest, "approve", reason]));
		assert.equal(
			(await f.binding.reviewWorkflow!.status(f.pending.reviewId, f.binding.localPrincipal)).state,
			"awaiting-review",
		);
	} finally {
		f.binding.close();
		await f.close();
	}
});
