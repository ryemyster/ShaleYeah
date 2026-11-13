import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type QualificationInput, reviewJson } from "@shaleyeah/sdk";
import { ProductionForecastWorkflow } from "../../src/review-workflow.js";
import { forecastFixture, now, ref, who } from "./forecast.js";

export async function reviewFixture() {
	const f = forecastFixture();
	const directory = mkdtempSync(path.join(os.tmpdir(), "reservoir-review-"));
	const reviewer = { ...who, subjectId: "human-owner", scopes: ["reservoir:human-review"] };
	const policy = {
		version: "0.1.0",
		id: "review.reservoir-engineer",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: [reviewer.subjectId],
		operation: "record_forecast",
		destination: "private-production-forecasts",
		expiresAt: "2026-01-02T13:00:00Z",
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
		// Workflow unit double only; installed job qualification is a separate acceptance gate.
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
	const workflow = new ProductionForecastWorkflow(directory, options);
	const candidate = async (revision = "r1") => {
		const draft = await f.service.draft({ id: ref.id, revision: f.current.task.revision }, ["base"], revision, who);
		return {
			work: draft.work,
			forecast: draft.forecast,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.reservoir-engineer",
				revision,
				scope: f.current.task.scope,
				taskRevision: f.current.task.revision,
				contextPolicy: policy.contextPolicy,
				selectedEvidence: draft.work.evidence,
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [],
				assembledAt: now.toISOString(),
				retention: { policy: policy.retentionPolicy, expiresAt: policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.reservoir-engineer", revision: "r1", result: "fixture", failures: [] }],
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
