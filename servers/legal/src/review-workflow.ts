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
import { LegalMemoError, legalRefSchema } from "./legal-memo.js";
import type { LegalMemoService } from "./legal-service.js";

export const legalCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		legal: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: legalRefSchema.shape.id,
						revision: legalRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const legalReviewAdapter: ReviewRoleAdapter = {
	id: "legal",
	operation: "record_legal_memo",
	destination: "private-legal-memos",
	humanScope: "legal:human-review",
	employeeScopes: ["legal:review", "legal:record"],
	packetVersion: "legal-review-0.1.0",
	payloadKey: "legal",
	requestedDecision:
		"Review the exact questions, source provisions/revisions, declared jurisdiction/territory/activity and legal as-of date, exceptions, conflicts, proposed analysis, work, context and evaluations before recording this private advisory memo. Enrollment is operator-attested legal review authority. This record grants no legal clearance, professional certification, signature, waiver, filing, settlement or capital authority.",
	parseCandidate: (input) => legalCandidateSchema.parse(input),
	payload: (candidate) => legalCandidateSchema.parse(candidate).legal,
	sourceId: (candidate) => (legalCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
	validateContext: (context, work) => {
		const ordered = (values: unknown[]) => reviewJson(values.map(reviewJson).sort());
		if (
			context.sharedKnowledge.length ||
			new Set(context.selectedEvidence.map((item) => item.id)).size !== context.selectedEvidence.length ||
			ordered(context.selectedEvidence) !== ordered(work.evidence) ||
			context.workingArtifactRefs.length !== 1 ||
			reviewJson(context.workingArtifactRefs[0]) !== reviewJson(work.artifact)
		)
			throw new ReviewError("context_binding_mismatch");
	},
};

/** Operator configuration cannot remove the executing trust gates. */
export function parseLegalReviewPolicy(value: unknown) {
	const policy = parseEmployeeReviewPolicy(value, legalReviewAdapter);
	const required = ["no-blockers", "evidence-present", "eval-present"] as const;
	if (policy.requiredGates.length !== required.length || required.some((gate) => !policy.requiredGates.includes(gate)))
		throw new ReviewError("required_gates");
	return policy;
}
export type LegalReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: LegalMemoService };

/** Shared durable transitions; current source assertions validate an actual proposed memo. */
export class LegalReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: LegalReviewOptions) {
		super(
			directory,
			{
				...options,
				currentPolicy: async () => parseLegalReviewPolicy(await options.currentPolicy()),
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...legalReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = legalCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					// Accept the agent's proposed interpretation, not its claimed applicability or authority.
					const proposal = {
						version: candidate.legal.version,
						title: candidate.legal.title,
						issues: candidate.legal.issues,
					};
					let actual: Awaited<ReturnType<LegalMemoService["draft"]>>;
					try {
						actual = await options.service.draft(
							{ id: policy.task.id, revision: policy.task.revision },
							proposal,
							work.artifact.revision,
							policy.requester,
						);
					} catch (error) {
						if (error instanceof z.ZodError || error instanceof LegalMemoError)
							throw new ReviewError("source_fidelity_mismatch");
						throw error;
					}
					if (reviewJson(actual.work) !== reviewJson(work) || reviewJson(actual.legal) !== reviewJson(candidate.legal))
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
