import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type QualificationInput, reviewJson } from "@shaleyeah/sdk";
import { assembleReport } from "../../src/report-assembly.js";
import { ReportReviewWorkflow } from "../../src/review-workflow.js";
import { ReviewedSources } from "../../src/reviewed-sources.js";

const records = JSON.parse(readFileSync(new URL("employee.json", import.meta.url), "utf8"));
export function fixture() {
	const directory = mkdtempSync(path.join(os.tmpdir(), "reporter-review-"));
	const scope = { ...records.task.scope, employeeId: "employee.reporter" };
	const requester = {
		subjectId: "reporter-run",
		customerId: scope.customerId,
		employeeId: scope.employeeId,
		scopes: ["reporter:sources", "reporter:review", "reporter:release"],
	};
	const reviewer = { ...requester, subjectId: "human-owner", scopes: ["reporter:human-review"] };
	const receipt = {
		work: structuredClone(records.finalWork),
		task: records.task,
		request: records.reviewRequest,
		decision: records.approveDecision,
		recipientScope: scope,
		current: true,
		expiresAt: "2026-11-01T00:00:00Z",
		operations: ["read", "export"],
		subjectId: requester.subjectId,
		usagePolicy: { id: "policy.reviewed-business-artifact", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
	};
	const task = { ...records.task, scope, inputs: [receipt.work.artifact] };
	let requirements = {
		audience: "Owner",
		purpose: "Review",
		templateId: "private-review-v1",
		disclosures: ["Fixture; not certification"],
	};
	const sources = new ReviewedSources({
		scope,
		current: async () => receipt,
		contentGuard: async () => true,
		clock: () => new Date("2026-10-13T00:00:00Z"),
		maxSourceAgeSeconds: 31536000,
	});
	const policy = {
		version: "0.1.0",
		id: "review.reporter",
		revision: "r1",
		task,
		requester,
		reviewerIds: [reviewer.subjectId],
		operation: "release_report",
		destination: "private-reviewed-reports",
		expiresAt: receipt.expiresAt,
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [receipt.usagePolicy],
		contextPolicy: records.context.contextPolicy,
		retentionPolicy: records.context.retention.policy,
		revoked: false,
	};
	// A trusted verifier double exercises the state machine; the installed eval producer has a separate qualification test.
	const options = {
		sources,
		currentPolicy: async () => policy,
		currentRequirements: async () => requirements,
		contentGuard: async () => true,
		clock: () => new Date("2026-10-13T00:00:00Z"),
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
	const candidate = () => {
		const result = assembleReport(task, [receipt.work], requirements);
		return {
			work: result.work,
			context: {
				...records.context,
				scope,
				selectedEvidence: result.work.evidence,
				workingArtifactRefs: [],
				assembledAt: "2026-10-13T00:00:00Z",
				retention: { ...records.context.retention, expiresAt: receipt.expiresAt },
			},
			evaluations: [{ id: "eval.reporter", revision: "r1", result: "fixture", failures: [] }],
			publication: { markdown: result.markdown, requirements, dataSource: result.work.evidence[0].id },
		};
	};
	const workflow = new ReportReviewWorkflow(directory, options);
	return {
		directory,
		workflow,
		options,
		requester,
		reviewer,
		receipt,
		candidate,
		edit: () => {
			requirements = { ...requirements, purpose: "Revised review" };
		},
		close: () => {
			workflow.close();
			rmSync(directory, { recursive: true });
		},
	};
}
