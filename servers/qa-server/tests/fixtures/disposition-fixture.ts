import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { type QualificationInput, reviewJson } from "@shaleyeah/sdk";
import { deriveQADisposition } from "../../src/qa-disposition.js";
import { QADispositionWorkflow } from "../../src/review-workflow.js";
import { qaProfileSchema } from "../../src/tools/qa-rules.js";
import { fixture as observedFixture } from "./qa-fixture.js";

export async function fixture(native = false) {
	const f = observedFixture();
	if (native) {
		f.setTime(new Date().toISOString());
		f.ref.revision = f.source.snapshot.evidence.hash.value;
		f.ref.uri = `urn:sha256:${f.ref.revision}`;
		f.source.snapshot.evidence.revision = f.ref.revision;
		f.source.snapshot.evidence.uri = f.ref.uri;
		f.source.snapshot.evidence.asOf = new Date().toISOString();
		f.source.grant.expiresAt = new Date(Date.now() + 3600000).toISOString();
		f.grant.expiresAt = f.source.grant.expiresAt;
	}
	f.profile.rules[0].field = "missingField";
	f.grant.profileHash = createHash("sha256")
		.update(reviewJson(qaProfileSchema.parse(f.profile)))
		.digest("hex");
	const run = await f.service.run(f.request, f.principal);
	const report = await f.service.report(run.resultRef, f.principal);
	const requester = { ...f.principal, scopes: [...f.principal.scopes, "qa:review", "qa:disposition"] };
	const reviewer = { ...requester, subjectId: "human-owner", scopes: ["qa:human-review"] };
	const records = JSON.parse(readFileSync(new URL("employee.json", import.meta.url), "utf8"));
	const context = {
		...records.context,
		scope: f.task.scope,
		taskRevision: f.task.revision,
		selectedEvidence: report.work.evidence,
		workingArtifactRefs: [],
		sharedKnowledge: [],
		assembledAt: native ? new Date().toISOString() : "2026-10-13T00:00:00Z",
		retention: { ...records.context.retention, expiresAt: f.source.grant.expiresAt },
	};
	const policy = {
		version: "0.1.0",
		id: "review.qa",
		revision: "r1",
		qualification: "fixture",
		task: f.task,
		requester,
		reviewerIds: [reviewer.subjectId],
		operation: "record_disposition",
		destination: "private-qa-dispositions",
		expiresAt: f.source.grant.expiresAt,
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [f.source.snapshot.evidence.usagePolicy],
		contextPolicy: context.contextPolicy,
		retentionPolicy: context.retention.policy,
		revoked: false,
	};
	const dispositionPolicy = {
		version: "0.1.0",
		id: "disposition.qa",
		revision: "r1",
		allowedActions: ["defer", "request_repair", "accept_exception"],
		repairOwners: ["data-owner"],
		maxTtlSeconds: 600,
		allowCriticalExceptions: true,
	};
	const options = {
		service: f.service,
		inputs: f.options.inputs,
		currentPolicy: async () => policy,
		currentDispositionPolicy: async () => dispositionPolicy,
		contentGuard: async () => true,
		clock: f.options.clock,
		// Exact-bound trusted double for workflow tests; installed evaluation receipts are tested separately.
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
	const candidate = () => ({
		...deriveQADisposition(
			report,
			{
				action: "accept_exception",
				reason: "A bounded owner exception; original failure retained",
				repairOwner: "data-owner",
				expiresAt: native ? new Date(Date.now() + 300000).toISOString() : "2026-10-13T00:05:00Z",
			},
			"r1",
			dispositionPolicy,
		),
		context,
		evaluations: [{ id: "eval.qa", revision: "r1", result: "fixture", failures: [] }],
	});
	const directory = path.join(f.directory, "review");
	const workflow = new QADispositionWorkflow(directory, options);
	return {
		...f,
		directory,
		workflow,
		options,
		policy,
		dispositionPolicy,
		requester,
		reviewer,
		report,
		candidate,
		close: () => {
			workflow.close();
			f.close();
		},
	};
}
