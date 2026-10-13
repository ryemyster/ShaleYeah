import { createHash } from "node:crypto";
import { validateContract, type WorkProduct } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { qaRefSchema } from "./qa-inputs.js";
import type { QAService } from "./qa-service.js";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9._:-]+$/);
export const qaDispositionProposalSchema = z
	.object({
		action: z.enum(["request_repair", "defer", "accept_exception"]),
		reason: z.string().trim().min(1).max(2000),
		repairOwner: id,
		expiresAt: z.iso.datetime({ offset: true }),
	})
	.strict();
export type QAObservedReport = Awaited<ReturnType<QAService["report"]>>;

/** Derive a separate proposal. The recorded observed work/result is never edited or reclassified. */
export function deriveQADisposition(report: QAObservedReport, input: unknown, revision = "r1", policy?: unknown) {
	const proposal = qaDispositionProposalSchema.parse(input);
	id.parse(revision);
	const original = validateContract(report.work);
	if (
		original.kind !== "work-product" ||
		report.schemaVersion !== "0.1.0" ||
		report.kind !== "qa-observed-report" ||
		report.review !== "unreviewed" ||
		!["PASS", "FAIL", "UNTESTED", "ERROR", "NOT_APPLICABLE"].includes(report.summary.status)
	)
		throw new Error("invalid_observed_report");
	qaRefSchema.parse(report.resultRef);
	// Serialization rejects unsupported values; fresh backend comparison binds all observations.
	const observedReport = JSON.parse(reviewJson(report)) as QAObservedReport;
	const disposition = {
		version: "0.1.0" as const,
		proposal,
		...(policy === undefined ? {} : { policy }),
		observedReport,
		approvalAllowed: false as const,
		professionalCertification: false as const,
		sourceCorrection: false as const,
	};
	const digest = createHash("sha256").update(reviewJson(disposition)).digest("hex");
	const work: WorkProduct = {
		...structuredClone(original),
		artifact: { id: `product.qa-disposition.${digest.slice(0, 40)}`, revision, uri: `urn:qa:disposition:${digest}` },
		status: "ready_for_review",
		blockers: [],
		uncertainty: `Proposed ${proposal.action}; original observed QA status ${report.summary.status} remains unchanged. Exact owner review required. No repaired data, certification or release approval.`,
		review: { status: "unreviewed", decisionRefs: [] },
	};
	validateContract(work);
	return { work, disposition };
}
