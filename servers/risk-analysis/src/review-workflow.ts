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
import { type RiskAssessmentService, riskRefSchema } from "./risk-service.js";

export const riskCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		risk: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: riskRefSchema.shape.id,
						revision: riskRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const riskReviewAdapter: ReviewRoleAdapter = {
	id: "risk",
	operation: "record_risk_assessment",
	destination: "private-risk-assessments",
	humanScope: "risk:human-review",
	employeeScopes: ["risk:review", "risk:assess"],
	packetVersion: "risk-review-0.1.0",
	payloadKey: "risk",
	requestedDecision:
		"Review the exact register, operator policy, complete joint-scenario assumptions, dependence, limitations, work, context and evaluation revisions before this private advisory record. The enrolled human owns residual risk acceptance; no capital, legal or operational action is authorized.",
	parseCandidate: (input) => riskCandidateSchema.parse(input),
	payload: (candidate) => riskCandidateSchema.parse(candidate).risk,
	sourceId: (candidate) => (riskCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
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

/** These trust gates cannot be relaxed through an operator review config or model prose. */
export function parseRiskReviewPolicy(value: unknown) {
	const policy = parseEmployeeReviewPolicy(value, riskReviewAdapter);
	const required = ["no-blockers", "evidence-present", "eval-present"] as const;
	if (policy.requiredGates.length !== required.length || required.some((gate) => !policy.requiredGates.includes(gate)))
		throw new ReviewError("required_gates");
	return policy;
}
export type RiskReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: RiskAssessmentService };

/** Shared durable transitions; the executing backend rederives current source and numerical truth. */
export class RiskReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: RiskReviewOptions) {
		super(
			directory,
			{
				...options,
				currentPolicy: async () => parseRiskReviewPolicy(await options.currentPolicy()),
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...riskReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = riskCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					const definition = z.object({ modelRef: riskRefSchema }).passthrough().parse(candidate.risk.definition);
					const actual = await options.service.draft(
						{ id: policy.task.id, revision: policy.task.revision },
						definition.modelRef,
						work.artifact.revision,
						policy.requester,
					);
					if (reviewJson(actual.work) !== reviewJson(work) || reviewJson(actual.risk) !== reviewJson(candidate.risk))
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
