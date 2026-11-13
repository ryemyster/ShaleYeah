import type { ConnectorRuntime } from "@shaleyeah/connectors";
import type { SourceFetchRequest } from "@shaleyeah/contracts";
import {
	type EmployeeReviewOptions,
	EmployeeReviewWorkflow,
	parseEmployeeReviewPolicy,
	type ReviewRoleAdapter,
} from "@shaleyeah/sdk";
import { z } from "zod";

export type { ReviewPolicy } from "@shaleyeah/sdk";
export { type QualificationInput, ReviewError, reviewExecutionSchema, reviewJson } from "@shaleyeah/sdk";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9_.:/-]+$/);
export const reviewCandidateSchema = z
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
						failures: z.array(z.string().min(1).max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
		finding: z
			.object({
				findingType: z.enum(["formation", "well-log", "quality-assessment", "seismic", "document", "general"]),
				title: z.string().min(1).max(256),
				summary: z.string().min(1).max(16384),
				confidence: z.number().min(0).max(1),
				dataSource: id,
				metadata: z.record(z.string(), z.unknown()).optional(),
			})
			.strict(),
	})
	.strict();

export const geowizReviewAdapter: ReviewRoleAdapter = {
	id: "geowiz",
	operation: "save_finding",
	destination: "private-reviewed-findings",
	humanScope: "geowiz:human-review",
	employeeScopes: ["geowiz:review", "geowiz:save"],
	packetVersion: "geowiz-review-0.1.0",
	payloadKey: "finding",
	requestedDecision:
		"Save the exact reviewed draft finding to private-reviewed-findings; no external commitment or shared promotion",
	parseCandidate: (input) => reviewCandidateSchema.parse(input),
	payload: (candidate) => reviewCandidateSchema.parse(candidate).finding,
	sourceId: (candidate) => reviewCandidateSchema.parse(candidate).finding.dataSource,
};
export const parseReviewPolicy = (value: unknown) => parseEmployeeReviewPolicy(value, geowizReviewAdapter);
export class ReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: Omit<EmployeeReviewOptions, "sources"> & { sources: ConnectorRuntime }) {
		super(
			directory,
			{
				...options,
				sources: {
					request: (id) => options.sources.request(id),
					fetch: (request, principal, signal) =>
						options.sources.fetch(request as SourceFetchRequest, principal, signal),
				},
			},
			geowizReviewAdapter,
		);
	}
}
