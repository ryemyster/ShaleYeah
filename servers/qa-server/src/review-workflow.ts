import type { WorkProduct } from "@shaleyeah/contracts";
import {
	type EmployeeReviewOptions,
	EmployeeReviewWorkflow,
	parseEmployeeReviewPolicy,
	ReviewError,
	type ReviewRoleAdapter,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { deriveQADisposition, type QAObservedReport, qaDispositionProposalSchema } from "./qa-disposition.js";
import { QAError, type QAInputs, type QAPrincipal, type QARef, qaRefSchema } from "./qa-inputs.js";
import type { QAService } from "./qa-service.js";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9._:-]+$/);
export const qaDispositionPolicySchema = z
	.object({
		version: z.literal("0.1.0"),
		id,
		revision: id,
		allowedActions: z.array(qaDispositionProposalSchema.shape.action).min(1).max(3),
		repairOwners: z.array(id).min(1).max(64),
		maxTtlSeconds: z.number().int().positive().max(86400),
		allowCriticalExceptions: z.boolean(),
	})
	.strict();
export const qaDispositionCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		evaluations: z
			.array(
				z
					.object({
						id,
						revision: id,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
		disposition: z
			.object({
				version: z.literal("0.1.0"),
				proposal: qaDispositionProposalSchema,
				policy: qaDispositionPolicySchema,
				observedReport: z.unknown(),
				approvalAllowed: z.literal(false),
				professionalCertification: z.literal(false),
				sourceCorrection: z.literal(false),
			})
			.strict(),
	})
	.strict();
export const qaReviewAdapter: ReviewRoleAdapter = {
	id: "qa",
	operation: "record_disposition",
	destination: "private-qa-dispositions",
	humanScope: "qa:human-review",
	employeeScopes: ["qa:review", "qa:disposition"],
	packetVersion: "qa-review-0.1.0",
	payloadKey: "disposition", // Business packet field name, not a credential. gitleaks:allow
	requestedDecision:
		"Review this exact bounded private disposition. Original QA failures remain unchanged; no source correction, certification or organizational release.",
	parseCandidate: (input) => qaDispositionCandidateSchema.parse(input),
	payload: (candidate) => qaDispositionCandidateSchema.parse(candidate).disposition,
	sourceId: (candidate) => (qaDispositionCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
};
export const parseQAReviewPolicy = (input: unknown) => parseEmployeeReviewPolicy(input, qaReviewAdapter);
type QAReviewOptions = Omit<EmployeeReviewOptions, "sources"> & {
	service: QAService;
	inputs: QAInputs;
	currentDispositionPolicy: () => Promise<unknown>;
};

/** Role adapter around the shared exact-review state machine; QAService remains the observed truth. */
export class QADispositionWorkflow extends EmployeeReviewWorkflow {
	private readonly qaOptions: QAReviewOptions;
	constructor(directory: string, options: QAReviewOptions) {
		super(
			directory,
			{
				...options,
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						const policy = parseQAReviewPolicy(await options.currentPolicy());
						const ref = policy.task.inputs.find((ref) => ref.id === request);
						if (!ref) throw new ReviewError("source_unavailable");
						try {
							const snapshot = await options.inputs.fetch(ref, who, "export", signal);
							return {
								artifact: { artifact: ref, evidence: snapshot.evidence as WorkProduct["evidence"][number] },
								bytes: snapshot.bytes,
							};
						} catch (error) {
							if (error instanceof QAError) throw new ReviewError(error.code);
							throw error;
						}
					},
				},
			},
			{
				...qaReviewAdapter,
				validateCandidate: async (input, reviewPolicy) => {
					const candidate = qaDispositionCandidateSchema.parse(input);
					const policy = qaDispositionPolicySchema.parse(await options.currentDispositionPolicy());
					const { proposal } = candidate.disposition;
					const untrusted = candidate.disposition.observedReport as QAObservedReport;
					let report: QAObservedReport;
					try {
						report = await options.service.report(qaRefSchema.parse(untrusted?.resultRef), reviewPolicy.requester);
					} catch (error) {
						if (error instanceof QAError) throw new ReviewError(error.code);
						throw error;
					}
					checkDisposition(
						proposal,
						policy,
						reviewPolicy.expiresAt,
						report,
						(options.clock?.() ?? new Date()).getTime(),
					);
					const derived = deriveQADisposition(
						report,
						proposal,
						(candidate.work as WorkProduct).artifact.revision,
						policy,
					);
					if (
						reviewJson(derived.work) !== reviewJson(candidate.work) ||
						reviewJson(derived.disposition) !== reviewJson(candidate.disposition)
					)
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
		this.qaOptions = options;
	}
	async draft(reference: QARef, proposal: unknown, revision: string, who: QAPrincipal, signal?: AbortSignal) {
		const policy = parseQAReviewPolicy(await this.qaOptions.currentPolicy());
		if (
			policy.revoked ||
			Date.parse(policy.expiresAt) <= (this.qaOptions.clock?.() ?? new Date()).getTime() ||
			who.subjectId !== policy.requester.subjectId ||
			who.customerId !== policy.requester.customerId ||
			who.employeeId !== policy.requester.employeeId ||
			policy.requester.scopes.some((scope) => !who.scopes.includes(scope))
		)
			throw new ReviewError("authority_denied");
		const report = await this.qaOptions.service.report(reference, who, signal);
		const dispositionPolicy = qaDispositionPolicySchema.parse(await this.qaOptions.currentDispositionPolicy());
		const parsed = qaDispositionProposalSchema.parse(proposal);
		checkDisposition(
			parsed,
			dispositionPolicy,
			policy.expiresAt,
			report,
			(this.qaOptions.clock?.() ?? new Date()).getTime(),
		);
		const result = deriveQADisposition(report, proposal, revision, dispositionPolicy);
		if (!(await this.qaOptions.contentGuard(reviewJson(result)))) throw new ReviewError("unsafe_content");
		if (reviewJson(parseQAReviewPolicy(await this.qaOptions.currentPolicy())) !== reviewJson(policy))
			throw new ReviewError("revision_mismatch");
		if (signal?.aborted) throw new ReviewError("cancelled");
		return result;
	}
}

function checkDisposition(
	proposal: z.infer<typeof qaDispositionProposalSchema>,
	policy: z.infer<typeof qaDispositionPolicySchema>,
	reviewExpiry: string,
	report: QAObservedReport,
	now: number,
) {
	const expiry = Date.parse(proposal.expiresAt);
	if (expiry <= now) throw new ReviewError("expired");
	if (
		!policy.allowedActions.includes(proposal.action) ||
		!policy.repairOwners.includes(proposal.repairOwner) ||
		expiry > Date.parse(reviewExpiry) ||
		expiry > now + policy.maxTtlSeconds * 1000
	)
		throw new ReviewError("disposition_denied");
	if (
		proposal.action === "accept_exception" &&
		(report.summary.status !== "FAIL" ||
			report.results.some((result) => ["UNTESTED", "ERROR"].includes(result.status)) ||
			(!policy.allowCriticalExceptions &&
				report.results.some((result) => result.status === "FAIL" && result.severity === "critical")))
	)
		throw new ReviewError("exception_denied");
}
