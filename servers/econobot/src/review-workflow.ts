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
import { type EconomicScenarioService, economicRefSchema } from "./scenario-service.js";

export const economicCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		scenario: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: economicRefSchema.shape.id,
						revision: economicRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();
export const economicReviewAdapter: ReviewRoleAdapter = {
	id: "economics",
	operation: "record_scenario",
	destination: "private-economic-scenarios",
	humanScope: "economics:human-review",
	employeeScopes: ["economics:review", "economics:scenario"],
	packetVersion: "economic-review-0.1.0",
	payloadKey: "scenario",
	requestedDecision:
		"Review the exact financial sources, assumptions and scenario revision before recording this private advisory work. No capital commitment, bid submission or professional certification.",
	parseCandidate: (input) => economicCandidateSchema.parse(input),
	payload: (candidate) => economicCandidateSchema.parse(candidate).scenario,
	sourceId: (candidate) => (economicCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
	validateContext: (context, work) => {
		// Catalog ranking and operator source order may differ. Compare complete
		// canonical evidence records, never IDs alone or a partially selected set.
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
export const parseEconomicReviewPolicy = (value: unknown) => parseEmployeeReviewPolicy(value, economicReviewAdapter);
export type EconomicReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: EconomicScenarioService };

/** The shared review store owns transitions. This adapter rederives role-specific financial truth. */
export class EconomicScenarioWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: EconomicReviewOptions) {
		super(
			directory,
			{
				...options,
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...economicReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = economicCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					const actual = await options.service.draft(
						{ id: policy.task.id, revision: policy.task.revision },
						candidate.scenario.scenarioIds,
						work.artifact.revision,
						policy.requester,
					);
					if (
						reviewJson(actual.work) !== reviewJson(work) ||
						reviewJson(actual.scenario) !== reviewJson(candidate.scenario)
					)
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
