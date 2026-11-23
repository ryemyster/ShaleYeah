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
import { TitlePacketError, titleRefSchema } from "./title-packet.js";
import type { TitlePacketService } from "./title-service.js";

export const titleCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		title: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: titleRefSchema.shape.id,
						revision: titleRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const titleReviewAdapter: ReviewRoleAdapter = {
	id: "title",
	operation: "record_title_packet",
	destination: "private-title-packets",
	humanScope: "title:human-review",
	employeeScopes: ["title:review", "title:record"],
	packetVersion: "title-review-0.1.0",
	payloadKey: "title",
	requestedDecision:
		"Inspect the exact tract, instrument revisions, source text, declared opening holdings/order/depth, share and burden bases, unresolved exceptions, proposed observations, work/context and installed qualification before recording this private packet. Enrollment is operator-attested title review authority. This record grants no title clearance, marketability certification, legal opinion, curative execution, filing, external transfer, lease acceptance or capital authority.",
	parseCandidate: (input) => titleCandidateSchema.parse(input),
	payload: (candidate) => titleCandidateSchema.parse(candidate).title,
	sourceId: (candidate) => (titleCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
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

export function parseTitleReviewPolicy(value: unknown) {
	const policy = parseEmployeeReviewPolicy(value, titleReviewAdapter);
	const required = ["no-blockers", "evidence-present", "eval-present"] as const;
	if (policy.requiredGates.length !== required.length || required.some((gate) => !policy.requiredGates.includes(gate)))
		throw new ReviewError("required_gates");
	return policy;
}
export type TitleReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: TitlePacketService };

/** Shared durable review transitions; the role only binds canonical source facts and proposed observations. */
export class TitleReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: TitleReviewOptions) {
		super(
			directory,
			{
				...options,
				currentPolicy: async () => parseTitleReviewPolicy(await options.currentPolicy()),
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...titleReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = titleCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					const proposal = {
						version: candidate.title.version,
						title: candidate.title.title,
						observations: candidate.title.observations,
					};
					let actual: Awaited<ReturnType<TitlePacketService["draft"]>>;
					try {
						actual = await options.service.draft(
							{ id: policy.task.id, revision: policy.task.revision },
							proposal,
							work.artifact.revision,
							policy.requester,
						);
					} catch (error) {
						if (error instanceof z.ZodError || error instanceof TitlePacketError)
							throw new ReviewError("source_fidelity_mismatch");
						throw error;
					}
					if (reviewJson(actual.work) !== reviewJson(work) || reviewJson(actual.title) !== reviewJson(candidate.title))
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
