import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type QualificationInput, reviewJson } from "@shaleyeah/sdk";
import { LegalReviewWorkflow } from "../../src/review-workflow.js";
import { legalFixture, now, ref, who } from "./legal.js";

export async function reviewFixture() {
	const f = legalFixture();
	const directory = mkdtempSync(path.join(os.tmpdir(), "legal-review-"));
	const reviewer = { ...who, subjectId: "human-legal-reviewer", scopes: ["legal:human-review"] };
	const policy = {
		version: "0.1.0",
		id: "review.legal-analyst",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: [reviewer.subjectId],
		operation: "record_legal_memo",
		destination: "private-legal-memos",
		expiresAt: "2026-11-12T13:00:00Z",
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [{ id: "policy.operator-data", version: "r1" }],
		contextPolicy: { id: "policy.employee-context", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
		revoked: false,
	};
	const options = {
		service: f.service,
		currentPolicy: async () => policy,
		contentGuard: async () => true,
		clock: () => now,
		// Workflow unit double only. Installed job qualification is a separate acceptance gate.
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
	};
	const workflow = new LegalReviewWorkflow(directory, options);
	const candidate = async (revision = "r1") => {
		const draft = await f.service.draft({ id: ref.id, revision: f.current.task.revision }, f.proposal, revision, who);
		return {
			work: draft.work,
			legal: draft.legal,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.legal-analyst",
				revision,
				scope: f.current.task.scope,
				taskRevision: f.current.task.revision,
				contextPolicy: policy.contextPolicy,
				selectedEvidence: structuredClone(draft.work.evidence),
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [],
				assembledAt: now.toISOString(),
				retention: { policy: policy.retentionPolicy, expiresAt: policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.legal-analyst", revision: "r1", result: "fixture", failures: [] }],
		};
	};
	return {
		...f,
		directory,
		workflow,
		options,
		policy,
		reviewer,
		candidate,
		close: () => {
			workflow.close();
			rmSync(directory, { recursive: true, force: true });
		},
	};
}
