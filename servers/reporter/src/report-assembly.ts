import { createHash } from "node:crypto";
import { validateContract, type WorkProduct } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { businessEvidence } from "./reviewed-sources.js";

export const reportRequirementsSchema = z
	.object({
		audience: z.string().min(1).max(256),
		purpose: z.string().min(1).max(2048),
		templateId: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[a-z][a-z0-9._:-]*$/),
		disclosures: z.array(z.string().min(1).max(4096)).min(1).max(32),
	})
	.strict();
export type ReportRequirements = z.infer<typeof reportRequirementsSchema>;
export class ReportError extends Error {
	constructor(public readonly code: string) {
		super(`Reporter blocked: ${code}`);
	}
}
const literal = (value: unknown) =>
	String(value).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("\n", " ").replaceAll("\r", " ");
const hash = (value: unknown) => createHash("sha256").update(reviewJson(value)).digest("hex");

/** Format already authenticated upstream snapshots; this pure transform grants no access. */
export function assembleReport(
	taskInput: unknown,
	sourceInputs: unknown[],
	requirementsInput: unknown,
	revision = "r1",
) {
	const task = validateContract(taskInput);
	if (task.kind !== "task-assignment") throw new ReportError("task_scope");
	const parsed = reportRequirementsSchema.safeParse(requirementsInput);
	if (!parsed.success) throw new ReportError("invalid_requirements");
	const requirements = parsed.data;
	if (!sourceInputs.length || sourceInputs.length > 32) throw new ReportError("missing_sources");
	const sources = sourceInputs.map((source) => {
		const work = validateContract(source);
		if (
			work.kind !== "work-product" ||
			work.status !== "final" ||
			work.review.status !== "approved" ||
			!work.review.decisionRefs.length
		)
			throw new ReportError("approval_required");
		if (work.scope.customerId !== task.scope.customerId || work.scope.assetId !== task.scope.assetId)
			throw new ReportError("source_scope");
		return work;
	});
	if (new Set(sources.map((work) => work.artifact.id)).size !== sources.length)
		throw new ReportError("duplicate_source");
	if (JSON.stringify(sources.map((work) => work.artifact)) !== JSON.stringify(task.inputs))
		throw new ReportError("task_inputs");
	const findings: WorkProduct["findings"] = [];
	const assumptions: WorkProduct["assumptions"] = [];
	const evidence: WorkProduct["evidence"] = [];
	const blockers: WorkProduct["blockers"] = [];
	const lines = [
		`# Evidence review`,
		`Audience: ${literal(requirements.audience)}`,
		`Purpose: ${literal(requirements.purpose)}`,
		`Template: ${literal(requirements.templateId)}`,
		"Publication: unreviewed; human approval required",
		"",
		"## Disclosures",
		...requirements.disclosures.map((text) => `- ${literal(text)}`),
	];
	const values = new Map<string, Set<string>>();
	for (const source of sources) {
		const sourceEvidence = businessEvidence(source);
		const evidenceId = sourceEvidence.id;
		evidence.push(sourceEvidence);
		if (!source.evidence.length) throw new ReportError("missing_evidence");
		lines.push(
			"",
			`## Source: ${literal(source.artifact.id)}`,
			`Revision: ${literal(source.artifact.revision)}`,
			`Reference: ${literal(source.artifact.uri)}`,
			`Source confidence: ${source.confidence === undefined ? "unavailable" : `${source.confidence} (fraction)`}`,
			`Uncertainty: ${literal(source.uncertainty)}`,
		);
		for (const finding of source.findings) {
			const rendered =
				finding.basis === "unknown"
					? `unavailable (${literal(finding.reason)})`
					: finding.id.toLowerCase().includes("irr") && finding.unit === "fraction" && typeof finding.value === "number"
						? `${Number((finding.value * 100).toPrecision(12))}% (source: ${finding.value} fraction; ${finding.basis})`
						: `${literal(finding.value)} ${literal(finding.unit)} (${finding.basis})`;
			lines.push(`- ${literal(finding.id)}: ${rendered}`);
			findings.push({
				...finding,
				id: `finding.report.${hash([source.artifact, finding.id]).slice(0, 40)}`,
				evidenceIds: finding.basis === "measured" ? [evidenceId] : [],
				assumptionIds: finding.assumptionIds.map(
					(id) => `assumption.report.${hash([source.artifact, id]).slice(0, 40)}`,
				),
			});
			if (finding.basis !== "unknown") {
				const existing = values.get(finding.id) ?? new Set();
				existing.add(JSON.stringify({ value: finding.value, unit: finding.unit }));
				values.set(finding.id, existing);
			}
		}
		for (const assumption of source.assumptions) {
			assumptions.push({
				...assumption,
				id: `assumption.report.${hash([source.artifact, assumption.id]).slice(0, 40)}`,
				evidenceIds: [evidenceId],
			});
			lines.push(`- Assumption ${literal(assumption.id)}: ${literal(assumption.statement)}`);
		}
		for (const blocker of source.blockers) {
			blockers.push(structuredClone(blocker));
			lines.push(`- Blocker: ${literal(blocker.message)}`);
		}
	}
	for (const [id, variants] of values)
		if (variants.size > 1) {
			const conflict = `Conflicting findings: ${id}`;
			blockers.push({
				code: "conflicting_evidence",
				message: conflict,
				references: sources.map((source) => ({ id: source.artifact.id, revision: source.artifact.revision })),
			});
			lines.push(`- ${literal(conflict)}`);
		}
	const markdown = `${lines.join("\n")}\n`;
	const work: WorkProduct = {
		contractVersion: "0.1.0",
		kind: "work-product",
		scope: task.scope,
		taskRevision: task.revision,
		artifact: {
			id: `product.report.${hash({ task, sources, requirements }).slice(0, 24)}`,
			revision,
			uri: `urn:reporter:draft:${hash(markdown)}`,
		},
		status: blockers.length ? "blocked" : "ready_for_review",
		inputs: sources.map((source) => source.artifact),
		evidence,
		findings,
		assumptions,
		uncertainty: sources.map((source) => `${source.artifact.id}: ${source.uncertainty}`).join("; "),
		blockers,
		review: { status: "unreviewed", decisionRefs: [] },
	};
	validateContract(work);
	return {
		work,
		markdown,
		requirements,
		sourceIndex: sources.map((source) => ({ artifact: source.artifact, review: source.review, hash: hash(source) })),
	};
}
