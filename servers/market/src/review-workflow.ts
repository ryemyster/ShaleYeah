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
import { marketProposalSchema, marketRefSchema } from "./market-scenario.js";
import { type MarketScenarioService, MarketServiceError } from "./market-service.js";

export const marketCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		market: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: marketRefSchema.shape.id,
						revision: marketRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const marketReviewAdapter: ReviewRoleAdapter = {
	id: "market",
	operation: "record_market_scenarios",
	destination: "private-market-scenarios",
	humanScope: "market:human-review",
	employeeScopes: ["market:review", "market:record"],
	packetVersion: "market-review-0.1.0",
	payloadKey: "market",
	requestedDecision:
		"Review the exact mandate, source revisions, observation periods, frequency, region, native and normalized units, heat-content factors, commercial scenario assumptions, proposed interpretation, work, context and evaluations before recording this private scenario packet. Enrollment is operator-attested commercial review authority. This record grants no trading, contract, bid or capital authority.",
	parseCandidate: (input) => marketCandidateSchema.parse(input),
	payload: (candidate) => marketCandidateSchema.parse(candidate).market,
	sourceId: (candidate) => (marketCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
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
export function parseMarketReviewPolicy(value: unknown) {
	const policy = parseEmployeeReviewPolicy(value, marketReviewAdapter);
	const required = ["no-blockers", "evidence-present", "eval-present"] as const;
	if (policy.requiredGates.length !== required.length || required.some((gate) => !policy.requiredGates.includes(gate)))
		throw new ReviewError("required_gates");
	return policy;
}
export type MarketReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: MarketScenarioService };

/** Reuses durable review transitions while recalculating the exact proposed packet from current sources. */
export class MarketReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: MarketReviewOptions) {
		super(
			directory,
			{
				...options,
				currentPolicy: async () => parseMarketReviewPolicy(await options.currentPolicy()),
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...marketReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = marketCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					let actual: Awaited<ReturnType<MarketScenarioService["draft"]>>;
					try {
						// The model proposes interpretation and references; source arithmetic and authority stay host-owned.
						const proposal = marketProposalSchema.parse(candidate.market.proposal);
						actual = await options.service.draft(
							{ id: policy.task.id, revision: policy.task.revision },
							proposal,
							work.artifact.revision,
							policy.requester,
						);
					} catch (error) {
						if (
							error instanceof z.ZodError ||
							(error instanceof MarketServiceError && error.code === "invalid_arguments")
						)
							throw new ReviewError("source_fidelity_mismatch");
						throw error;
					}
					if (
						reviewJson(actual.work) !== reviewJson(work) ||
						reviewJson(actual.market) !== reviewJson(candidate.market)
					)
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
