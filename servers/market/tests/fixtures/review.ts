import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SharedKnowledgeRef } from "@shaleyeah/contracts";
import { type QualificationInput, reviewJson } from "@shaleyeah/sdk";
import { MarketReviewWorkflow } from "../../src/index.js";
import type { MarketReviewOptions } from "../../src/review-workflow.js";
import { employeeFixture, now, who } from "./employee.js";

export async function reviewFixture() {
	const f = employeeFixture();
	const directory = mkdtempSync(path.join(os.tmpdir(), "market-review-"));
	const reviewer = { ...who, subjectId: "human-commercial-owner", scopes: ["market:human-review"] };
	const policy = {
		version: "0.1.0",
		id: "review.market-analyst",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: [reviewer.subjectId],
		operation: "record_market_scenarios",
		destination: "private-market-scenarios",
		expiresAt: "2026-11-13T13:00:00Z",
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [{ id: "policy.operator-data", version: "r1" }],
		contextPolicy: { id: "policy.employee-context", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
		revoked: false,
	};
	let clock = () => now;
	const options: MarketReviewOptions = {
		service: f.service,
		currentPolicy: async () => policy,
		contentGuard: async () => true,
		clock: () => clock(),
		// Unit double only; installed job qualification remains a separate acceptance gate.
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
	const workflow = new MarketReviewWorkflow(directory, options);
	const candidate = async (revision = "r1") => {
		const draft = await f.service.draft(f.ref(), f.proposal, revision, who);
		return {
			work: draft.work,
			market: draft.market,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.market-analyst",
				revision,
				scope: f.current.task.scope,
				taskRevision: f.current.task.revision,
				contextPolicy: policy.contextPolicy,
				selectedEvidence: structuredClone(draft.work.evidence),
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [] as SharedKnowledgeRef[],
				assembledAt: now.toISOString(),
				retention: { policy: policy.retentionPolicy, expiresAt: policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.market-analyst", revision: "r1", result: "fixture", failures: [] }],
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
		setReviewClock: (value: typeof clock) => {
			clock = value;
		},
		close: () => {
			workflow.close();
			rmSync(directory, { recursive: true, force: true });
		},
	};
}
