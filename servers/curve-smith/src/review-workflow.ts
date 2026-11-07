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
import { forecastRefSchema, type ProductionForecastService } from "./forecast-service.js";

export const forecastCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		forecast: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: forecastRefSchema.shape.id,
						revision: forecastRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const forecastReviewAdapter: ReviewRoleAdapter = {
	id: "reservoir",
	operation: "record_forecast",
	destination: "private-production-forecasts",
	humanScope: "reservoir:human-review",
	employeeScopes: ["reservoir:review", "reservoir:forecast"],
	packetVersion: "forecast-review-0.1.0",
	payloadKey: "forecast",
	requestedDecision:
		"Review exact production sources, operating basis, fixed-b assumptions, observed diagnostics, context and forecast revision before recording this private advisory work. No reserves certification, field operation or capital commitment.",
	parseCandidate: (input) => forecastCandidateSchema.parse(input),
	payload: (candidate) => forecastCandidateSchema.parse(candidate).forecast,
	sourceId: (candidate) => (forecastCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
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
export const parseForecastReviewPolicy = (value: unknown) => parseEmployeeReviewPolicy(value, forecastReviewAdapter);
export type ForecastReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: ProductionForecastService };

/** Shared durable review transitions with role-local source/numerical truth rederived at execution. */
export class ProductionForecastWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: ForecastReviewOptions) {
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
				...forecastReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = forecastCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					const actual = await options.service.draft(
						{ id: policy.task.id, revision: policy.task.revision },
						candidate.forecast.forecastIds,
						work.artifact.revision,
						policy.requester,
					);
					if (
						reviewJson(actual.work) !== reviewJson(work) ||
						reviewJson(actual.forecast) !== reviewJson(candidate.forecast)
					)
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
