import {
	type EmployeeReviewOptions,
	EmployeeReviewWorkflow,
	parseEmployeeReviewPolicy,
	ReviewError,
	type ReviewRoleAdapter,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { assembleReport, reportRequirementsSchema } from "./report-assembly.js";
import { ReviewedSourceError } from "./reviewed-sources.js";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-z][a-z0-9._:-]*$/);
export const reportCandidateSchema = z
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
		publication: z
			.object({
				markdown: z.string().min(1).max(1_000_000),
				requirements: reportRequirementsSchema,
				dataSource: id,
			})
			.strict(),
	})
	.strict();
export const reporterReviewAdapter: ReviewRoleAdapter = {
	id: "reporter",
	operation: "release_report",
	destination: "private-reviewed-reports",
	humanScope: "reporter:human-review",
	employeeScopes: ["reporter:review", "reporter:release"],
	packetVersion: "reporter-review-0.1.0",
	payloadKey: "publication",
	requestedDecision:
		"Approve the exact report revision for the configured private reviewed-reports destination; no external send or professional certification",
	parseCandidate: (input) => reportCandidateSchema.parse(input),
	payload: (candidate) => reportCandidateSchema.parse(candidate).publication,
	sourceId: (candidate) => reportCandidateSchema.parse(candidate).publication.dataSource,
	validateContext: (context, work, sources) => {
		if (!context.sharedKnowledge.length) {
			if (reviewJson(context.selectedEvidence) !== reviewJson(work.evidence))
				throw new ReviewError("context_binding_mismatch");
			return;
		}
		const shared = sources.map((source) => source.artifact.sharedKnowledge);
		const ordered = (refs: unknown[]) => refs.map(reviewJson).sort();
		if (
			shared.some((ref) => !ref) ||
			reviewJson(ordered(context.sharedKnowledge)) !== reviewJson(ordered(shared)) ||
			context.workingArtifactRefs.length !== 1 ||
			reviewJson(context.workingArtifactRefs[0]) !== reviewJson(work.artifact)
		)
			throw new ReviewError("context_binding_mismatch");
		// Native catalogs carry whole reviewed work. Separately selected evidence must belong to this exact report.
		if (
			new Set(context.selectedEvidence.map((evidence) => evidence.id)).size !== context.selectedEvidence.length ||
			context.selectedEvidence.some(
				(evidence) => !work.evidence.some((known) => reviewJson(known) === reviewJson(evidence)),
			)
		)
			throw new ReviewError("context_binding_mismatch");
	},
	validateCandidate: async (input, policy, sources) => {
		const candidate = reportCandidateSchema.parse(input);
		const work = candidate.work as { artifact: { revision: string } };
		const assembled = assembleReport(
			policy.task,
			sources.map((source) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(source.bytes))),
			candidate.publication.requirements,
			work.artifact.revision,
		);
		if (
			reviewJson(assembled.work) !== reviewJson(candidate.work) ||
			assembled.markdown !== candidate.publication.markdown
		)
			throw new ReviewError("source_fidelity_mismatch");
	},
};
export const parseReportReviewPolicy = (input: unknown) => parseEmployeeReviewPolicy(input, reporterReviewAdapter);
export class ReportReviewWorkflow extends EmployeeReviewWorkflow {
	constructor(directory: string, options: EmployeeReviewOptions & { currentRequirements: () => Promise<unknown> }) {
		super(
			directory,
			{
				...options,
				sources: {
					request: (id) => options.sources.request(id),
					fetch: async (request, principal, signal) => {
						try {
							return await options.sources.fetch(request, principal, signal);
						} catch (error) {
							if (error instanceof ReviewedSourceError) throw new ReviewError(error.code);
							throw error;
						}
					},
				},
			},
			{
				...reporterReviewAdapter,
				validateCandidate: async (candidate, policy, sources) => {
					if (
						reviewJson(reportCandidateSchema.parse(candidate).publication.requirements) !==
						reviewJson(await options.currentRequirements())
					)
						throw new ReviewError("template_mismatch");
					await reporterReviewAdapter.validateCandidate!(candidate, policy, sources);
				},
			},
		);
	}
}
