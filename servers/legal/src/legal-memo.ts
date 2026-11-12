/** Source-backed draft issues. Declared scope metadata is not a legal opinion or clearance. */
import { createHash } from "node:crypto";
import { z } from "zod";

export const legalRefSchema = z
	.object({
		id: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[A-Za-z0-9_.:/-]+$/),
		revision: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[A-Za-z0-9_.:/-]+$/),
	})
	.strict();
const identifier = legalRefSchema.shape.id;
const description = z.string().min(1).max(2048);
const date = z.iso.date();
const provision = z.object({ documentRef: legalRefSchema, sectionId: identifier }).strict();
export const legalMatterSchema = z
	.object({
		version: z.literal("0.1.0"),
		matterRef: legalRefSchema,
		jurisdictionId: identifier,
		territoryId: identifier,
		activityId: identifier,
		asOfDate: date,
		questions: z
			.array(z.object({ questionRef: legalRefSchema, prompt: description }).strict())
			.min(1)
			.max(32),
	})
	.strict();
export const legalCorpusSchema = z
	.object({
		version: z.literal("0.1.0"),
		documents: z
			.array(
				z
					.object({
						documentRef: legalRefSchema,
						title: description,
						sourceKind: z.enum(["contract", "primary-law", "guidance", "counsel-note"]),
						sourceUri: z.string().min(1).max(4096),
						sections: z
							.array(
								z
									.object({
										sectionId: identifier,
										text: z.string().min(1).max(128000),
										jurisdictionIds: z.array(identifier).min(1).max(32),
										territoryIds: z.array(identifier).min(1).max(32),
										activityIds: z.array(identifier).min(1).max(32),
										effectiveFrom: date.nullable(),
										effectiveUntilExclusive: date.nullable(),
										sourceStatus: z.enum(["operator-reviewed", "unverified"]),
									})
									.strict(),
							)
							.min(1)
							.max(128),
					})
					.strict(),
			)
			.min(1)
			.max(64),
	})
	.strict();
export const legalScopePolicySchema = z
	.object({
		version: z.literal("0.1.0"),
		policyRef: legalRefSchema,
		questions: z
			.array(
				z
					.object({
						questionRef: legalRefSchema,
						requiredDocumentRefs: z.array(legalRefSchema).min(1).max(16),
					})
					.strict(),
			)
			.min(1)
			.max(32),
		conflicts: z
			.array(
				z
					.object({
						conflictRef: legalRefSchema,
						questionRef: legalRefSchema,
						provisions: z.array(provision).min(2).max(16),
					})
					.strict(),
			)
			.max(64),
	})
	.strict();
export const legalCitationSchema = provision
	.extend({
		startByte: z.number().int().min(0).max(512000),
		endByte: z.number().int().min(1).max(512000),
		quote: z.string().min(1).max(8192),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
export const legalProposalSchema = z
	.object({
		version: z.literal("0.1.0"),
		title: description,
		issues: z
			.array(
				z
					.object({
						issueRef: legalRefSchema,
						questionRef: legalRefSchema,
						kind: z.enum(["requirement", "exception", "question", "conflict"]),
						statement: description,
						citations: z.array(legalCitationSchema).max(16),
					})
					.strict(),
			)
			.max(128),
	})
	.strict();
export type LegalMatter = z.infer<typeof legalMatterSchema>;
export type LegalCorpus = z.infer<typeof legalCorpusSchema>;
export type LegalScopePolicy = z.infer<typeof legalScopePolicySchema>;
export type LegalProposal = z.infer<typeof legalProposalSchema>;
type Ref = z.infer<typeof legalRefSchema>;

export class LegalMemoError extends Error {
	constructor(public readonly code: string) {
		super(`Legal memo blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new LegalMemoError(code);
}
const same = (a: Ref, b: Ref) => a.id === b.id && a.revision === b.revision;
const refKey = (value: Ref) => JSON.stringify([value.id, value.revision]);
const unique = (values: string[]) => new Set(values).size === values.length;
const key = (value: z.infer<typeof provision>) =>
	JSON.stringify([value.documentRef.id, value.documentRef.revision, value.sectionId]);
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const ordered = (values: Ref[]) =>
	values.sort((a, b) => compareText(a.id, b.id) || compareText(a.revision, b.revision));
function parsed<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
	try {
		return schema.parse(structuredClone(value));
	} catch {
		return deny(code);
	}
}

/** Verify finite, versioned source assertions; never infer a jurisdiction hierarchy or a missing date. */
export function parseLegalInputs(matterInput: unknown, corpusInput: unknown, policyInput: unknown) {
	const matter = parsed(legalMatterSchema, matterInput, "invalid_inputs");
	const corpus = parsed(legalCorpusSchema, corpusInput, "invalid_inputs");
	const policy = parsed(legalScopePolicySchema, policyInput, "invalid_inputs");
	if (
		!unique(matter.questions.map((q) => q.questionRef.id)) ||
		!unique(corpus.documents.map((d) => refKey(d.documentRef))) ||
		!unique(policy.questions.map((q) => q.questionRef.id)) ||
		!unique(policy.conflicts.map((c) => c.conflictRef.id)) ||
		policy.questions.length !== matter.questions.length ||
		policy.questions.some((q) => !matter.questions.some((m) => same(m.questionRef, q.questionRef)))
	)
		deny("invalid_inputs");
	for (const document of corpus.documents) {
		if (!unique(document.sections.map((s) => s.sectionId))) deny("invalid_inputs");
		for (const section of document.sections) {
			if (
				!unique(section.jurisdictionIds) ||
				!unique(section.territoryIds) ||
				!unique(section.activityIds) ||
				(section.effectiveFrom &&
					section.effectiveUntilExclusive &&
					section.effectiveUntilExclusive <= section.effectiveFrom) ||
				Buffer.from(section.text, "utf8").toString("utf8") !== section.text
			)
				deny("invalid_inputs");
		}
	}
	for (const question of policy.questions)
		if (!unique(question.requiredDocumentRefs.map(refKey))) deny("invalid_inputs");
	for (const conflict of policy.conflicts)
		if (
			!matter.questions.some((q) => same(q.questionRef, conflict.questionRef)) ||
			!unique(conflict.provisions.map(key))
		)
			deny("invalid_inputs");
	return { matter, corpus, policy };
}

/** A provision can have a different territorial or date scope from its neighboring paragraph. */
export function legalProvisionApplicability(matter: LegalMatter, corpus: LegalCorpus) {
	return corpus.documents.flatMap((document) =>
		document.sections.map((section) => {
			const reasons: string[] = [];
			if (!section.jurisdictionIds.includes(matter.jurisdictionId)) reasons.push("wrong-jurisdiction");
			if (!section.territoryIds.includes(matter.territoryId)) reasons.push("wrong-territory");
			if (!section.activityIds.includes(matter.activityId)) reasons.push("wrong-activity");
			if (section.sourceStatus !== "operator-reviewed") reasons.push("unverified-source");
			if (!section.effectiveFrom) reasons.push("unknown-effective-date");
			else if (matter.asOfDate < section.effectiveFrom) reasons.push("not-yet-effective");
			if (section.effectiveUntilExclusive && matter.asOfDate >= section.effectiveUntilExclusive)
				reasons.push("expired");
			return {
				documentRef: document.documentRef,
				sectionId: section.sectionId,
				sourceKind: document.sourceKind,
				basis: "operator-declared-source-metadata" as const,
				status: reasons.length ? ("ineligible" as const) : ("eligible-for-draft" as const),
				reasons: reasons.sort(),
			};
		}),
	);
}

/** Construct a reviewable issue memo from actual proposed analysis and current supplied source text. */
export function buildLegalMemo(
	matterInput: unknown,
	corpusInput: unknown,
	policyInput: unknown,
	proposalInput: unknown,
) {
	const { matter, corpus, policy } = parseLegalInputs(matterInput, corpusInput, policyInput);
	const proposal = parsed(legalProposalSchema, proposalInput, "invalid_proposal");
	if (
		!unique(proposal.issues.map((i) => i.issueRef.id)) ||
		proposal.issues.some((i) => !matter.questions.some((q) => same(q.questionRef, i.questionRef)))
	)
		deny("invalid_proposal");
	const applicability = legalProvisionApplicability(matter, corpus);
	const index = new Map(applicability.map((row) => [key(row), row]));
	for (const issue of proposal.issues) {
		if (
			(["requirement", "exception"].includes(issue.kind) && !issue.citations.length) ||
			!unique(issue.citations.map((c) => JSON.stringify([key(c), c.startByte, c.endByte])))
		)
			deny("invalid_citation");
		if (issue.kind === "conflict" && new Set(issue.citations.map(key)).size < 2) deny("invalid_proposal");
		for (const citation of issue.citations) {
			const document = corpus.documents.find((d) => same(d.documentRef, citation.documentRef));
			const section = document?.sections.find((s) => s.sectionId === citation.sectionId);
			if (!section) deny("invalid_citation");
			const bytes = Buffer.from(section.text, "utf8");
			if (citation.startByte >= citation.endByte || citation.endByte > bytes.byteLength) deny("invalid_citation");
			let quote: string;
			try {
				quote = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(citation.startByte, citation.endByte));
			} catch {
				return deny("invalid_citation");
			}
			if (
				quote !== citation.quote ||
				createHash("sha256").update(bytes.subarray(citation.startByte, citation.endByte)).digest("hex") !==
					citation.sha256
			)
				deny("invalid_citation");
			if (["requirement", "exception"].includes(issue.kind) && index.get(key(citation))!.reasons.length)
				deny("invalid_applicability");
		}
	}
	const coveredQuestionRefs = matter.questions
		.filter((q) => proposal.issues.some((i) => same(i.questionRef, q.questionRef)))
		.map((q) => q.questionRef);
	const missingQuestionRefs = matter.questions
		.filter((q) => !coveredQuestionRefs.some((r) => same(r, q.questionRef)))
		.map((q) => q.questionRef);
	const missingSources = policy.questions.flatMap((q) => {
		const citations = proposal.issues.filter((i) => same(i.questionRef, q.questionRef)).flatMap((i) => i.citations);
		const missingDocumentRefs = q.requiredDocumentRefs.filter(
			(ref) => !citations.some((c) => same(c.documentRef, ref)),
		);
		// Historical clauses can explain a conflict; they cannot be the only
		// source anchor for a question about the declared jurisdiction/date.
		const applicableSourceMissing = !citations.some(
			(c) => q.requiredDocumentRefs.some((r) => same(r, c.documentRef)) && index.get(key(c))!.reasons.length === 0,
		);
		return missingDocumentRefs.length || applicableSourceMissing
			? [{ questionRef: q.questionRef, documentRefs: ordered(missingDocumentRefs), applicableSourceMissing }]
			: [];
	});
	const missingConflictRefs = policy.conflicts
		.filter(
			(conflict) =>
				!proposal.issues.some(
					(issue) =>
						issue.kind === "conflict" &&
						same(issue.questionRef, conflict.questionRef) &&
						conflict.provisions.every((p) => issue.citations.some((c) => key(c) === key(p))),
				),
		)
		.map((c) => c.conflictRef);
	const blocked = missingQuestionRefs.length > 0 || missingSources.length > 0 || missingConflictRefs.length > 0;
	return {
		version: "0.1.0" as const,
		matterRef: matter.matterRef,
		title: proposal.title,
		jurisdictionId: matter.jurisdictionId,
		territoryId: matter.territoryId,
		activityId: matter.activityId,
		asOfDate: matter.asOfDate,
		issues: proposal.issues,
		applicability,
		coverage: {
			requiredQuestionRefs: ordered(matter.questions.map((q) => q.questionRef)),
			coveredQuestionRefs: ordered(coveredQuestionRefs),
			missingQuestionRefs: ordered(missingQuestionRefs),
			missingSources,
			missingConflictRefs: ordered(missingConflictRefs),
			status: blocked ? ("needs-input" as const) : ("passed" as const),
		},
		status: blocked ? ("needs-input" as const) : ("ready-for-review" as const),
		reviewStatus: "unreviewed" as const,
		legalClearance: false as const,
		professionalAcceptance: false as const,
	};
}
