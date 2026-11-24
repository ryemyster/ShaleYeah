/** Supplied drilling options and evidence checks. This module cannot authorize well operations. */
import { createHash } from "node:crypto";
import { z } from "zod";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9_.:/-]+$/);
const text = z.string().min(1).max(8192);
const decimal = z.string().regex(/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/);
export const drillingRefSchema = z.object({ id, revision: id }).strict();
type Ref = z.infer<typeof drillingRefSchema>;
const depth = z
	.object({ value: decimal, unit: z.enum(["ft", "m", "ft-us"]).nullable(), datumId: id.nullable() })
	.strict();
const basis = { evidenceRef: drillingRefSchema, sectionId: id };
export const drillingDesignSchema = z
	.object({
		version: z.literal("0.1.0"),
		designRef: drillingRefSchema,
		wellRef: drillingRefSchema,
		formationRef: drillingRefSchema,
		asOfDate: z.iso.date(),
		targetMd: depth,
		targetTvd: depth.nullable(),
		basis: z.object(basis).strict(),
		requiredEvidenceRefs: z.array(drillingRefSchema).min(1).max(64),
		options: z
			.array(
				z
					.object({
						optionRef: drillingRefSchema,
						label: text,
						casingDesignRef: drillingRefSchema.nullable(),
						mudDesignRef: drillingRefSchema.nullable(),
						completionDesignRef: drillingRefSchema.nullable(),
						sections: z
							.array(
								z
									.object({
										sectionId: id,
										topMd: depth,
										bottomMd: depth,
										bottomTvd: depth.nullable(),
										diameter: z.object({ value: decimal, unit: z.enum(["in", "mm"]) }).strict(),
									})
									.strict(),
							)
							.min(1)
							.max(64),
					})
					.strict(),
			)
			.min(1)
			.max(16),
		questions: z
			.array(z.object({ id, prompt: text }).strict())
			.min(1)
			.max(32),
	})
	.strict();
export const drillingCorpusSchema = z
	.object({
		version: z.literal("0.1.0"),
		corpusRef: drillingRefSchema,
		documents: z
			.array(
				z
					.object({
						evidenceRef: drillingRefSchema,
						wellRef: drillingRefSchema,
						designRef: drillingRefSchema,
						formationRef: drillingRefSchema,
						asOfDate: z.iso.date(),
						sourceStatus: z.enum(["operator-attested", "unverified"]),
						kind: z.enum(["design", "offset", "quote", "hazard", "schedule", "policy"]),
						sections: z
							.array(z.object({ sectionId: id, text }).strict())
							.min(1)
							.max(128),
					})
					.strict(),
			)
			.min(1)
			.max(64),
		costs: z
			.array(
				z
					.object({
						costId: id,
						optionRef: drillingRefSchema,
						quantity: decimal,
						unit: id,
						rate: decimal,
						perUnit: id,
						currency: z.string().regex(/^[A-Z]{3}$/),
						...basis,
					})
					.strict(),
			)
			.max(256),
		schedules: z
			.array(
				z
					.object({
						scheduleId: id,
						optionRef: drillingRefSchema,
						durationDays: decimal,
						sequence: z.number().int().min(0).max(255),
						...basis,
					})
					.strict(),
			)
			.max(256),
		offsets: z
			.array(
				z
					.object({
						offsetWellRef: drillingRefSchema,
						applicability: z.enum(["operator-reviewed", "unknown"]),
						...basis,
					})
					.strict(),
			)
			.max(128),
		hazards: z
			.array(
				z
					.object({
						hazardId: id,
						optionRef: drillingRefSchema,
						status: z.enum(["identified", "not-observed", "unknown"]),
						severity: z.enum(["operator-low", "operator-moderate", "operator-high", "unknown"]),
						mitigationDesignRef: drillingRefSchema.nullable(),
						reviewStatus: z.enum(["engineer-reviewed", "unreviewed"]),
						...basis,
					})
					.strict(),
			)
			.max(256),
	})
	.strict();
export const drillingPolicySchema = z
	.object({
		version: z.literal("0.1.0"),
		policyRef: drillingRefSchema,
		wellRef: drillingRefSchema,
		designRef: drillingRefSchema,
		currency: z.string().regex(/^[A-Z]{3}$/),
		costRounding: z.literal("half-up-cents"),
		requiredOffsetRefs: z.array(drillingRefSchema).min(1).max(128),
		requiredHazardIds: z.array(id).min(1).max(128),
		requirements: z
			.array(
				z
					.object({
						optionRef: drillingRefSchema,
						requiredCostIds: z.array(id).min(1).max(256),
						requiredScheduleIds: z.array(id).min(1).max(256),
					})
					.strict(),
			)
			.min(1)
			.max(16),
		declaredConflicts: z
			.array(
				z
					.object({
						conflictRef: drillingRefSchema,
						evidenceRefs: z.array(drillingRefSchema).min(1).max(64),
						statement: text,
					})
					.strict(),
			)
			.max(64),
	})
	.strict();
export type DrillingDesign = z.infer<typeof drillingDesignSchema>;
export type DrillingCorpus = z.infer<typeof drillingCorpusSchema>;
export type DrillingPolicy = z.infer<typeof drillingPolicySchema>;
export class DrillingPacketError extends Error {
	constructor(public readonly code: string) {
		super(`Drilling packet blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new DrillingPacketError(code);
}
const key = (r: Ref) => JSON.stringify([r.id, r.revision]);
const same = (a: Ref, b: Ref) => key(a) === key(b);
const unique = (v: string[]) => new Set(v).size === v.length;

/** Exact input decimals; no floating-point currency or depth arithmetic. */
class Fraction {
	readonly n: bigint;
	readonly d: bigint;
	constructor(n: bigint, d = 1n) {
		if (n < 0n || d <= 0n) deny("invalid_arithmetic");
		let a = n,
			b = d;
		while (b) [a, b] = [b, a % b];
		this.n = n / a;
		this.d = d / a;
		if (this.n.toString().length > 96 || this.d.toString().length > 96) deny("arithmetic_limit");
	}
	static read(v: string) {
		const [a, b = ""] = v.split(".");
		return new Fraction(BigInt(a + b), 10n ** BigInt(b.length));
	}
	add(v: Fraction) {
		return new Fraction(this.n * v.d + v.n * this.d, this.d * v.d);
	}
	mul(v: Fraction) {
		return new Fraction(this.n * v.n, this.d * v.d);
	}
	cmp(v: Fraction) {
		const n = this.n * v.d - v.n * this.d;
		return n < 0n ? -1 : n > 0n ? 1 : 0;
	}
	cents() {
		const n = this.n * 100n,
			q = n / this.d;
		return (q + (2n * (n % this.d) >= this.d ? 1n : 0n)).toString();
	}
	toString() {
		return `${this.n}/${this.d}`;
	}
}
export function parseDrillingInputs(design: unknown, corpus: unknown, policy: unknown) {
	let d: DrillingDesign, c: DrillingCorpus, p: DrillingPolicy;
	try {
		d = drillingDesignSchema.parse(structuredClone(design));
		c = drillingCorpusSchema.parse(structuredClone(corpus));
		p = drillingPolicySchema.parse(structuredClone(policy));
	} catch {
		return deny("invalid_inputs");
	}
	if (
		!unique(d.options.map((v) => key(v.optionRef))) ||
		!unique(d.questions.map((v) => v.id)) ||
		!unique(d.requiredEvidenceRefs.map(key)) ||
		!unique(p.requiredOffsetRefs.map(key)) ||
		!unique(p.requiredHazardIds) ||
		!unique(p.requirements.map((v) => key(v.optionRef))) ||
		p.requirements.some((v) => !unique(v.requiredCostIds) || !unique(v.requiredScheduleIds)) ||
		!unique(p.declaredConflicts.map((v) => key(v.conflictRef)))
	)
		deny("invalid_inputs");
	let bytes = 0;
	for (const doc of c.documents) {
		if (!unique(doc.sections.map((v) => v.sectionId))) deny("invalid_inputs");
		for (const s of doc.sections) {
			if (Buffer.from(s.text).toString("utf8") !== s.text) deny("invalid_inputs");
			bytes += Buffer.byteLength(s.text);
		}
	}
	if (bytes > 8_000_000 || c.costs.length + c.schedules.length + c.offsets.length + c.hazards.length > 512)
		deny("source_limit");
	return { design: d, corpus: c, policy: p };
}
export function reconcileDrilling(design: unknown, corpus: unknown, policy: unknown) {
	return reconcileParsed(parseDrillingInputs(design, corpus, policy));
}
function reconcileParsed({ design: d, corpus: c, policy: p }: ReturnType<typeof parseDrillingInputs>) {
	const exceptions: { code: string; evidenceRefs: Ref[]; optionId?: string }[] = [];
	const issue = (code: string, refs: Ref[] = [], optionId?: string) =>
		exceptions.push({ code, evidenceRefs: refs, ...(optionId ? { optionId } : {}) });
	if (!same(p.wellRef, d.wellRef)) issue("wrong_well");
	if (!same(p.designRef, d.designRef)) issue("wrong_design");
	for (const conflict of p.declaredConflicts) issue("declared_conflict", conflict.evidenceRefs);
	const documents: DrillingCorpus["documents"] = [];
	for (const doc of c.documents) {
		let valid = true;
		const reject = (code: string) => {
			issue(code, [doc.evidenceRef]);
			valid = false;
		};
		if (c.documents.filter((x) => same(x.evidenceRef, doc.evidenceRef)).length !== 1) reject("duplicate_evidence");
		if (!same(doc.wellRef, d.wellRef)) reject("wrong_well");
		if (!same(doc.designRef, d.designRef)) reject("wrong_design");
		if (!same(doc.formationRef, d.formationRef)) reject("wrong_formation");
		if (doc.asOfDate > d.asOfDate) reject("future_evidence");
		if (doc.sourceStatus !== "operator-attested") reject("unverified_evidence");
		if (valid) documents.push(doc);
	}
	const usable = (row: { evidenceRef: Ref; sectionId: string }, kind?: string) => {
		const matches = documents.filter((v) => same(v.evidenceRef, row.evidenceRef));
		if (
			matches.length !== 1 ||
			!matches[0].sections.some((v) => v.sectionId === row.sectionId) ||
			(kind && matches[0].kind !== kind)
		) {
			issue("missing_evidence_basis", [row.evidenceRef]);
			return false;
		}
		return true;
	};
	const missingEvidenceRefs = d.requiredEvidenceRefs.filter((r) => !documents.some((v) => same(v.evidenceRef, r)));
	for (const r of missingEvidenceRefs) issue("missing_evidence", [r]);
	usable(d.basis, "design");
	const metres = (v: z.infer<typeof depth> | null): Fraction | null => {
		if (v === null) {
			issue("missing_tvd");
			return null;
		}
		if (v.unit === null) {
			issue("unknown_depth_unit");
			return null;
		}
		if (v.unit === "ft-us") {
			issue("unsupported_depth_unit");
			return null;
		}
		if (v.datumId === null) {
			issue("unknown_datum");
			return null;
		}
		if (v.datumId !== d.targetMd.datumId) {
			issue("datum_mismatch");
			return null;
		}
		const value = Fraction.read(v.value);
		return v.unit === "ft" ? value.mul(new Fraction(381n, 1250n)) : value;
	};
	const md = metres(d.targetMd),
		tvd = metres(d.targetTvd);
	if ((md && md.n === 0n) || (tvd && tvd.n === 0n)) issue("invalid_target_depth");
	if (md && tvd && tvd.cmp(md) > 0) issue("tvd_exceeds_md");
	const optionIds = new Set(d.options.map((v) => key(v.optionRef)));
	for (const row of [...c.costs, ...c.schedules, ...c.hazards, ...p.requirements])
		if (!optionIds.has(key(row.optionRef))) issue("unknown_option", [], row.optionRef.id);
	const programs = d.options.map((option) => {
		if ([option.casingDesignRef, option.mudDesignRef, option.completionDesignRef].some((v) => v === null))
			issue("missing_program_basis", [], option.optionRef.id);
		if (!unique(option.sections.map((v) => v.sectionId))) issue("duplicate_section", [], option.optionRef.id);
		let bottom = new Fraction(0n);
		let previousTvd = new Fraction(0n);
		const sections = option.sections.map((s) => {
			const top = metres(s.topMd),
				end = metres(s.bottomMd),
				vertical = metres(s.bottomTvd);
			if (top && end && (top.cmp(bottom) !== 0 || end.cmp(top) <= 0))
				issue("section_coverage", [], option.optionRef.id);
			if (end) bottom = end;
			if (end && vertical && (vertical.cmp(end) > 0 || vertical.cmp(previousTvd) < 0))
				issue("tvd_exceeds_md", [], option.optionRef.id);
			if (vertical) previousTvd = vertical;
			if (Fraction.read(s.diameter.value).n === 0n) issue("invalid_diameter", [], option.optionRef.id);
			return {
				...s,
				topMdMetres: top?.toString() ?? null,
				bottomMdMetres: end?.toString() ?? null,
				bottomTvdMetres: vertical?.toString() ?? null,
			};
		});
		if (md && bottom.cmp(md) !== 0) issue("section_coverage", [], option.optionRef.id);
		if (tvd && previousTvd.cmp(tvd) !== 0) issue("section_tvd_mismatch", [], option.optionRef.id);
		return { ...option, sections, engineeringValidation: "not-performed" as const };
	});
	const costs = d.options.map((option) => {
		const required = p.requirements.find((v) => same(v.optionRef, option.optionRef));
		let valid = Boolean(required),
			total = new Fraction(0n);
		const reject = (code: string) => {
			issue(code, [], option.optionRef.id);
			valid = false;
		};
		if (!required) reject("missing_option_requirements");
		const rows = c.costs.filter((v) => same(v.optionRef, option.optionRef));
		for (const costId of required?.requiredCostIds ?? [])
			if (rows.filter((v) => v.costId === costId).length !== 1) reject("missing_cost");
		const lines = rows.map((row) => {
			let accepted = true;
			const bad = (code: string) => {
				reject(code);
				accepted = false;
			};
			if (rows.filter((v) => v.costId === row.costId).length !== 1) bad("duplicate_cost");
			if (!required?.requiredCostIds.includes(row.costId)) bad("undeclared_cost");
			if (row.currency !== p.currency) bad("currency_mismatch");
			if (row.unit !== row.perUnit) bad("rate_unit_mismatch");
			if (!usable(row, "quote")) {
				valid = false;
				accepted = false;
			}
			const amount = Fraction.read(row.quantity).mul(Fraction.read(row.rate));
			if (accepted) total = total.add(amount);
			return {
				...row,
				amountExact: accepted ? amount.toString() : null,
				amountCents: accepted ? amount.cents() : null,
			};
		});
		return {
			optionRef: option.optionRef,
			currency: p.currency,
			scope: "supplied-required-quoted-lines-only" as const,
			rounding: p.costRounding,
			lines,
			totalExact: valid ? total.toString() : null,
			totalCents: valid ? total.cents() : null,
		};
	});
	const schedules = d.options.map((option) => {
		const required = p.requirements.find((v) => same(v.optionRef, option.optionRef));
		let valid = Boolean(required),
			total = new Fraction(0n);
		const reject = (code: string) => {
			issue(code, [], option.optionRef.id);
			valid = false;
		};
		if (!required) reject("missing_option_requirements");
		const rows = c.schedules.filter((v) => same(v.optionRef, option.optionRef)).sort((a, b) => a.sequence - b.sequence);
		for (const sid of required?.requiredScheduleIds ?? [])
			if (rows.filter((v) => v.scheduleId === sid).length !== 1) reject("missing_schedule");
		for (const [index, row] of rows.entries()) {
			if (rows.filter((v) => v.scheduleId === row.scheduleId).length !== 1) reject("duplicate_schedule");
			if (row.sequence !== index) reject("schedule_sequence");
			if (!required?.requiredScheduleIds.includes(row.scheduleId)) reject("undeclared_schedule");
			if (!usable(row, "schedule")) valid = false;
			total = total.add(Fraction.read(row.durationDays));
		}
		return {
			optionRef: option.optionRef,
			basis: "supplied-sequential-phases" as const,
			phases: rows,
			totalDays: valid ? total.toString() : null,
		};
	});
	const missingOffsetRefs = p.requiredOffsetRefs.filter(
		(r) => c.offsets.filter((v) => same(v.offsetWellRef, r)).length !== 1,
	);
	for (const r of missingOffsetRefs) issue("missing_offset", [r]);
	for (const row of c.offsets) {
		usable(row, "offset");
		if (row.applicability !== "operator-reviewed") issue("unknown_offset_applicability", [row.evidenceRef]);
		if (!p.requiredOffsetRefs.some((r) => same(r, row.offsetWellRef))) issue("undeclared_offset", [row.evidenceRef]);
	}
	const missingHazardIds: string[] = [];
	for (const option of d.options)
		for (const hazardId of p.requiredHazardIds)
			if (c.hazards.filter((v) => same(v.optionRef, option.optionRef) && v.hazardId === hazardId).length !== 1) {
				missingHazardIds.push(hazardId);
				issue("missing_hazard", [], option.optionRef.id);
			}
	for (const row of c.hazards) {
		usable(row, "hazard");
		if (!p.requiredHazardIds.includes(row.hazardId)) issue("undeclared_hazard", [row.evidenceRef]);
		if (row.status === "unknown" || row.severity === "unknown") issue("unknown_hazard", [row.evidenceRef]);
		if (row.reviewStatus !== "engineer-reviewed") issue("unreviewed_hazard", [row.evidenceRef]);
		if (row.status === "identified" && !row.mitigationDesignRef) issue("missing_mitigation_basis", [row.evidenceRef]);
	}
	const sourceWitnesses = documents.flatMap((doc) =>
		doc.sections.map((s) => ({
			evidenceRef: doc.evidenceRef,
			sectionId: s.sectionId,
			startByte: 0,
			endByte: Buffer.byteLength(s.text),
			quote: s.text,
			sha256: createHash("sha256").update(Buffer.from(s.text)).digest("hex"),
		})),
	);
	const distinct = [...new Map(exceptions.map((v) => [JSON.stringify(v), v])).values()].sort((a, b) =>
		JSON.stringify(a).localeCompare(JSON.stringify(b), "en"),
	);
	return {
		version: "0.1.0" as const,
		designRef: d.designRef,
		wellRef: d.wellRef,
		formationRef: d.formationRef,
		asOfDate: d.asOfDate,
		basis: "operator-attested-normalized-design-evidence" as const,
		targetMdMetres: md?.toString() ?? null,
		targetTvdMetres: tvd?.toString() ?? null,
		datumId: d.targetMd.datumId,
		programs,
		costs,
		schedules,
		offsets: c.offsets,
		hazards: c.hazards,
		sourceWitnesses,
		coverage: {
			requiredEvidenceRefs: d.requiredEvidenceRefs,
			missingEvidenceRefs,
			requiredOffsetRefs: p.requiredOffsetRefs,
			missingOffsetRefs,
			requiredHazardIds: p.requiredHazardIds,
			missingHazardIds: [...new Set(missingHazardIds)].sort(),
		},
		exceptions: distinct,
		status: distinct.length ? ("needs-input" as const) : ("ready-for-review" as const),
		reviewStatus: "unreviewed" as const,
		operationalApproval: false as const,
		professionalAcceptance: false as const,
	};
}
export const drillingCitationSchema = z
	.object({
		evidenceRef: drillingRefSchema,
		sectionId: id,
		startByte: z.number().int().min(0).max(512000),
		endByte: z.number().int().min(1).max(512000),
		quote: text,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
export const drillingProposalSchema = z
	.object({
		version: z.literal("0.1.0"),
		summary: text,
		observations: z
			.array(
				z
					.object({
						observationRef: drillingRefSchema,
						questionId: id,
						kind: z.enum(["observation", "exception", "question"]),
						statement: text,
						citations: z.array(drillingCitationSchema).max(16),
					})
					.strict(),
			)
			.min(1)
			.max(128),
	})
	.strict();
export type DrillingProposal = z.infer<typeof drillingProposalSchema>;
export function validateDrillingCitation(corpus: DrillingCorpus, input: unknown) {
	let citation: z.infer<typeof drillingCitationSchema>;
	try {
		citation = drillingCitationSchema.parse(structuredClone(input));
	} catch {
		return deny("invalid_citation");
	}
	const docs = corpus.documents.filter((v) => same(v.evidenceRef, citation.evidenceRef)),
		section = docs.length === 1 ? docs[0].sections.find((v) => v.sectionId === citation.sectionId) : undefined;
	if (!section) return deny("invalid_citation");
	const bytes = Buffer.from(section.text),
		quote = Buffer.from(citation.quote);
	if (
		citation.endByte <= citation.startByte ||
		citation.endByte > bytes.byteLength ||
		quote.toString("utf8") !== citation.quote ||
		!bytes.subarray(citation.startByte, citation.endByte).equals(quote) ||
		createHash("sha256").update(quote).digest("hex") !== citation.sha256
	)
		deny("invalid_citation");
	return citation;
}
export function buildDrillingPacket(design: unknown, corpus: unknown, policy: unknown, proposalInput: unknown) {
	const parsed = parseDrillingInputs(design, corpus, policy),
		core = reconcileParsed(parsed);
	let proposal: DrillingProposal;
	try {
		proposal = drillingProposalSchema.parse(structuredClone(proposalInput));
	} catch {
		return deny("invalid_proposal");
	}
	if (
		!unique(proposal.observations.map((v) => key(v.observationRef))) ||
		proposal.observations.some((v) => !parsed.design.questions.some((q) => q.id === v.questionId))
	)
		deny("invalid_proposal");
	for (const row of proposal.observations)
		for (const cite of row.citations) validateDrillingCitation(parsed.corpus, cite);
	const coveredQuestionIds = [
		...new Set(proposal.observations.filter((v) => v.citations.length).map((v) => v.questionId)),
	].sort();
	const missingQuestionIds = parsed.design.questions
		.map((q) => q.id)
		.filter((v) => !coveredQuestionIds.includes(v))
		.sort();
	const citations = proposal.observations.flatMap((v) => v.citations),
		missingCitedEvidenceRefs = parsed.design.requiredEvidenceRefs.filter(
			(r) => !citations.some((v) => same(v.evidenceRef, r)),
		);
	const exceptions = [
		...core.exceptions,
		...(missingQuestionIds.length ? [{ code: "missing_question_coverage", evidenceRefs: [] }] : []),
		...(missingCitedEvidenceRefs.length
			? [{ code: "missing_evidence_citation", evidenceRefs: missingCitedEvidenceRefs }]
			: []),
	];
	return {
		...core,
		summary: proposal.summary,
		observations: proposal.observations,
		coverage: {
			...core.coverage,
			requiredQuestionIds: parsed.design.questions.map((q) => q.id).sort(),
			coveredQuestionIds,
			missingQuestionIds,
			missingCitedEvidenceRefs,
		},
		exceptions,
		status: exceptions.length ? ("needs-input" as const) : ("ready-for-review" as const),
	};
}
