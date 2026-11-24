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
import { DrillingPacketError, drillingRefSchema } from "./drilling-packet.js";
import type { DrillingPacketService } from "./drilling-service.js";

export const drillingCandidateSchema = z
	.object({
		work: z.unknown(),
		context: z.unknown(),
		drilling: z.record(z.string(), z.unknown()),
		evaluations: z
			.array(
				z
					.object({
						id: drillingRefSchema.shape.id,
						revision: drillingRefSchema.shape.revision,
						result: z.string().min(1).max(128),
						failures: z.array(z.string().max(2048)).max(128),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export const drillingReviewAdapter: ReviewRoleAdapter = {
	id: "drilling",
	operation: "record_drilling_packet",
	destination: "private-drilling-packets",
	humanScope: "drilling:human-review",
	employeeScopes: ["drilling:review", "drilling:record"],
	packetVersion: "drilling-review-0.1.0",
	payloadKey: "drilling",
	requestedDecision:
		"Inspect exact well/design/evidence revisions, MD/TVD/datum and units, supplied casing/mud/completion references, quoted scope, schedule basis, hazards and offset applicability, exceptions, proposed observations, work/context and installed qualification before recording this private packet. Enrollment is operator-attested engineer review authority. No spud, AFE/capital commitment, field operations, well-control, safety certification or professional engineering acceptance is granted.",
	parseCandidate: (input) => drillingCandidateSchema.parse(input),
	payload: (candidate) => drillingCandidateSchema.parse(candidate).drilling,
	sourceId: (candidate) => (drillingCandidateSchema.parse(candidate).work as WorkProduct).evidence[0]?.id ?? "",
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

export function parseDrillingReviewPolicy(value: unknown) {
	const policy = parseEmployeeReviewPolicy(value, drillingReviewAdapter);
	const required = ["no-blockers", "evidence-present", "eval-present"] as const;
	if (policy.requiredGates.length !== required.length || required.some((gate) => !policy.requiredGates.includes(gate)))
		throw new ReviewError("required_gates");
	return policy;
}
export type DrillingReviewOptions = Omit<EmployeeReviewOptions, "sources"> & { service: DrillingPacketService };

/** Shared durable review transitions; the role only binds canonical source facts and proposed observations. */
export class DrillingReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: DrillingReviewOptions) {
		super(
			directory,
			{
				...options,
				currentPolicy: async () => parseDrillingReviewPolicy(await options.currentPolicy()),
				sources: {
					request: (id) => id,
					fetch: async (request, who, signal) => {
						if (typeof request !== "string") throw new ReviewError("source_unavailable");
						return options.service.reviewSource(request, who, signal);
					},
				},
			},
			{
				...drillingReviewAdapter,
				validateCandidate: async (input, policy) => {
					const candidate = drillingCandidateSchema.parse(input),
						work = candidate.work as WorkProduct;
					const proposal = {
						version: candidate.drilling.version,
						summary: candidate.drilling.summary,
						observations: candidate.drilling.observations,
					};
					let actual: Awaited<ReturnType<DrillingPacketService["draft"]>>;
					try {
						actual = await options.service.draft(
							{ id: policy.task.id, revision: policy.task.revision },
							proposal,
							work.artifact.revision,
							policy.requester,
						);
					} catch (error) {
						if (error instanceof z.ZodError || error instanceof DrillingPacketError)
							throw new ReviewError("source_fidelity_mismatch");
						throw error;
					}
					if (
						reviewJson(actual.work) !== reviewJson(work) ||
						reviewJson(actual.drilling) !== reviewJson(candidate.drilling)
					)
						throw new ReviewError("source_fidelity_mismatch");
				},
			},
		);
	}
}
