/** Reconcile supplied instrument claims; arithmetic and citations do not establish legal title. */
import { createHash } from "node:crypto";
import { z } from "zod";

export const titleRefSchema = z
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
const id = titleRefSchema.shape.id;
const text = z.string().min(1).max(8192);
const ratio = z.string().regex(/^(0|[1-9][0-9]{0,8})[/][1-9][0-9]{0,8}$/);
const depthFields = {
	top: z.number().int().min(0).max(1000000),
	bottom: z.number().int().min(1).max(1000000),
	unit: z.enum(["ft", "m"]),
};
const depthSchema = z
	.object(depthFields)
	.strict()
	.refine((d) => d.bottom > d.top);
const bandSchema = z
	.object({ ...depthFields, id })
	.strict()
	.refine((d) => d.bottom > d.top);
const interestKind = z.enum(["record-title", "operating-rights"]);
const factFields = { sectionId: id, depth: depthSchema };
export const titleExaminationSchema = z
	.object({
		version: z.literal("0.1.0"),
		examinationRef: titleRefSchema,
		tractRef: titleRefSchema,
		jurisdictionId: id,
		asOfDate: z.iso.date(),
		parties: z
			.array(z.object({ id, name: text }).strict())
			.min(1)
			.max(128),
		depthBands: z.array(bandSchema).min(1).max(16),
		requiredInstrumentRefs: z.array(titleRefSchema).min(1).max(64),
		questions: z
			.array(z.object({ id, prompt: text }).strict())
			.min(1)
			.max(32),
	})
	.strict();
export const titleCorpusSchema = z
	.object({
		version: z.literal("0.1.0"),
		corpusRef: titleRefSchema,
		documents: z
			.array(
				z
					.object({
						instrumentRef: titleRefSchema,
						recordingId: id,
						tractRef: titleRefSchema,
						jurisdictionId: id,
						effectiveDate: z.iso.date(),
						recordedDate: z.iso.date(),
						sequence: z.number().int().min(0).max(1000000),
						predecessorRefs: z.array(titleRefSchema).max(64),
						sourceStatus: z.enum(["operator-attested", "unverified"]),
						sections: z
							.array(z.object({ sectionId: id, text }).strict())
							.min(1)
							.max(128),
						openingPositions: z
							.array(
								z
									.object({
										...factFields,
										positionId: id,
										partyId: id,
										interestKind,
										share: ratio,
									})
									.strict(),
							)
							.max(128),
						transfers: z
							.array(
								z
									.object({
										...factFields,
										transferId: id,
										grantorId: id,
										granteeId: id,
										interestKind,
										share: ratio,
										basis: z.enum(["fraction-of-grantor", "fraction-of-whole"]).nullable(),
									})
									.strict(),
							)
							.max(128),
						burdens: z
							.array(
								z
									.object({
										...factFields,
										burdenRef: titleRefSchema,
										partyId: id,
										kind: z.enum(["royalty", "overriding-royalty"]),
										share: ratio,
										basis: z.enum(["working-interest", "whole"]).nullable(),
									})
									.strict(),
							)
							.max(128),
						leaseTerms: z
							.array(
								z
									.object({
										leaseRef: titleRefSchema,
										primaryTermEnd: z.iso.date(),
										holdingStatus: z.enum(["unknown", "operator-reports-holding", "operator-reports-no-holding"]),
										sectionId: id,
									})
									.strict(),
							)
							.max(32),
					})
					.strict(),
			)
			.min(1)
			.max(64),
	})
	.strict();
export const titlePolicySchema = z
	.object({
		version: z.literal("0.1.0"),
		policyRef: titleRefSchema,
		nriRequests: z
			.array(
				z
					.object({
						partyId: id,
						bandId: id,
						requiredBurdenRefs: z.array(titleRefSchema).max(128),
						coverage: z.enum(["operator-attested-supplied-schedule", "unknown"]),
					})
					.strict(),
			)
			.max(128),
		requiredLeaseRefs: z.array(titleRefSchema).max(64),
		declaredConflicts: z
			.array(
				z
					.object({
						conflictRef: titleRefSchema,
						instrumentRefs: z.array(titleRefSchema).min(1).max(64),
						statement: text,
					})
					.strict(),
			)
			.max(64),
	})
	.strict();
export type TitleExamination = z.infer<typeof titleExaminationSchema>;
export type TitleCorpus = z.infer<typeof titleCorpusSchema>;
export type TitlePolicy = z.infer<typeof titlePolicySchema>;
type Ref = z.infer<typeof titleRefSchema>;
type Instrument = TitleCorpus["documents"][number];
type Interest = z.infer<typeof interestKind>;

export class TitlePacketError extends Error {
	constructor(public readonly code: string) {
		super(`Title packet blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new TitlePacketError(code);
}
const refKey = (ref: Ref) => JSON.stringify([ref.id, ref.revision]);
const sameRef = (a: Ref, b: Ref) => refKey(a) === refKey(b);
const unique = (values: string[]) => new Set(values).size === values.length;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Exact ratios avoid binary rounding and make the supplied burden basis explicit. */
class Fraction {
	readonly n: bigint;
	readonly d: bigint;
	constructor(n: bigint, d: bigint = 1n) {
		if (d <= 0n || n < 0n) deny("invalid_fraction");
		let a = n,
			b = d;
		while (b) [a, b] = [b, a % b];
		this.n = n / a;
		this.d = d / a;
		if (this.n.toString().length > 96 || this.d.toString().length > 96) deny("arithmetic_limit");
	}
	static read(value: string) {
		const [n, d] = value.split("/").map(BigInt);
		const result = new Fraction(n, d);
		if (result.cmp(new Fraction(1n)) > 0) deny("invalid_fraction");
		return result;
	}
	add(other: Fraction) {
		return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d);
	}
	sub(other: Fraction) {
		return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d);
	}
	mul(other: Fraction) {
		return new Fraction(this.n * other.n, this.d * other.d);
	}
	cmp(other: Fraction) {
		const n = this.n * other.d - other.n * this.d;
		return n < 0n ? -1 : n > 0n ? 1 : 0;
	}
	toString() {
		return `${this.n}/${this.d}`;
	}
}
const zero = () => new Fraction(0n);
const one = () => new Fraction(1n);

export function parseTitleInputs(examination: unknown, corpus: unknown, policy: unknown) {
	let e: TitleExamination, c: TitleCorpus, p: TitlePolicy;
	try {
		e = titleExaminationSchema.parse(structuredClone(examination));
		c = titleCorpusSchema.parse(structuredClone(corpus));
		p = titlePolicySchema.parse(structuredClone(policy));
	} catch {
		return deny("invalid_inputs");
	}
	if (
		!unique(e.parties.map((v) => v.id)) ||
		!unique(e.depthBands.map((v) => v.id)) ||
		!unique(e.questions.map((v) => v.id)) ||
		!unique(e.requiredInstrumentRefs.map(refKey)) ||
		!unique(p.requiredLeaseRefs.map(refKey)) ||
		!unique(p.declaredConflicts.map((v) => refKey(v.conflictRef))) ||
		!unique(p.nriRequests.map((v) => JSON.stringify([v.partyId, v.bandId]))) ||
		p.nriRequests.some((v) => !unique(v.requiredBurdenRefs.map(refKey)))
	)
		deny("invalid_inputs");
	let count = 0,
		bytes = 0;
	for (const doc of c.documents) {
		if (!unique(doc.sections.map((s) => s.sectionId)) || !unique(doc.predecessorRefs.map(refKey)))
			deny("invalid_inputs");
		for (const section of doc.sections) {
			if (Buffer.from(section.text, "utf8").toString("utf8") !== section.text) deny("invalid_inputs");
			bytes += Buffer.byteLength(section.text);
		}
		const facts = [...doc.openingPositions, ...doc.transfers, ...doc.burdens, ...doc.leaseTerms];
		count += facts.length;
		if (facts.some((v) => !doc.sections.some((s) => s.sectionId === v.sectionId))) deny("missing_source_section");
	}
	if (count > 512 || bytes > 8_000_000) deny("source_limit");
	return { examination: e, corpus: c, policy: p };
}

export function reconcileTitle(examinationInput: unknown, corpusInput: unknown, policyInput: unknown) {
	return reconcileParsed(parseTitleInputs(examinationInput, corpusInput, policyInput));
}

function reconcileParsed({ examination: e, corpus: c, policy: p }: ReturnType<typeof parseTitleInputs>) {
	const exceptions: { code: string; instrumentRefs: Ref[]; bandId?: string; partyId?: string }[] = [];
	const issue = (code: string, doc?: Instrument, extra: { bandId?: string; partyId?: string } = {}) => {
		exceptions.push({ code, instrumentRefs: doc ? [doc.instrumentRef] : [], ...extra });
	};
	const parties = new Set(e.parties.map((v) => v.id));
	const duplicate = <T>(rows: T[], key: (row: T) => string, value: T) =>
		rows.filter((row) => key(row) === key(value)).length !== 1;
	for (const band of e.depthBands)
		if (
			e.depthBands.some(
				(other) =>
					other.id !== band.id && (other.unit !== band.unit || (other.top < band.bottom && band.top < other.bottom)),
			)
		)
			issue("ambiguous_depth_bands", undefined, { bandId: band.id });
	const documents: Instrument[] = [];
	for (const doc of [...c.documents].sort(
		(a, b) => a.sequence - b.sequence || compare(refKey(a.instrumentRef), refKey(b.instrumentRef)),
	)) {
		let valid = true;
		const reject = (code: string) => {
			issue(code, doc);
			valid = false;
		};
		if (duplicate(c.documents, (d) => refKey(d.instrumentRef), doc)) reject("duplicate_instrument");
		if (duplicate(c.documents, (d) => d.recordingId, doc)) reject("duplicate_recording");
		if (duplicate(c.documents, (d) => String(d.sequence), doc)) reject("ambiguous_instrument_order");
		if (!sameRef(doc.tractRef, e.tractRef) || doc.jurisdictionId !== e.jurisdictionId) reject("wrong_tract");
		if (doc.sourceStatus !== "operator-attested") reject("unverified_instrument");
		if (doc.effectiveDate > e.asOfDate || doc.recordedDate > e.asOfDate) reject("future_instrument");
		if (doc.predecessorRefs.some((r) => !documents.some((prior) => sameRef(prior.instrumentRef, r))))
			reject("missing_predecessor");
		if (doc.openingPositions.length && doc.predecessorRefs.length) reject("ambiguous_opening");
		if (valid) documents.push(doc);
	}
	const missingInstrumentRefs = e.requiredInstrumentRefs.filter(
		(r) => !documents.some((d) => sameRef(d.instrumentRef, r)),
	);
	for (const ref of missingInstrumentRefs) exceptions.push({ code: "missing_instrument", instrumentRefs: [ref] });
	for (const conflict of p.declaredConflicts)
		exceptions.push({ code: "declared_conflict", instrumentRefs: conflict.instrumentRefs });

	const bands = (scope: z.infer<typeof depthSchema>, doc: Instrument) => {
		if (e.depthBands.some((b) => b.unit !== scope.unit)) {
			issue("depth_unit", doc);
			return [];
		}
		const overlaps = e.depthBands.filter((b) => b.top < scope.bottom && scope.top < b.bottom);
		if (!overlaps.length) {
			issue("wrong_depth", doc);
			return [];
		}
		if (overlaps.some((b) => scope.top > b.top || scope.bottom < b.bottom)) {
			issue("partial_depth_scope", doc);
			return [];
		}
		return overlaps;
	};
	const ledger = new Map<string, Fraction>();
	const key = (kind: Interest, bandId: string, partyId: string) => JSON.stringify([kind, bandId, partyId]);
	const positions = documents.flatMap((doc) => doc.openingPositions.map((value) => ({ doc, value })));
	for (const { doc, value } of positions) {
		if (!parties.has(value.partyId)) {
			issue("unknown_party", doc);
			continue;
		}
		if (positions.filter((r) => r.value.positionId === value.positionId).length !== 1) {
			issue("duplicate_opening_position", doc);
			continue;
		}
		for (const band of bands(value.depth, doc)) {
			const id = key(value.interestKind, band.id, value.partyId);
			if (ledger.has(id)) {
				issue("conflicting_opening", doc, { bandId: band.id, partyId: value.partyId });
				continue;
			}
			ledger.set(id, Fraction.read(value.share));
		}
	}
	// An omitted opening share has an unknown holder; it cannot become a fabricated owner or a complete schedule.
	for (const kind of ["record-title", "operating-rights"] as const)
		for (const band of e.depthBands) {
			let total = zero();
			for (const party of e.parties) total = total.add(ledger.get(key(kind, band.id, party.id)) ?? zero());
			if (total.cmp(one()) !== 0)
				issue(total.cmp(one()) > 0 ? "overallocated_opening" : "incomplete_opening", undefined, { bandId: band.id });
		}
	const transfers = documents.flatMap((doc) => doc.transfers.map((value) => ({ doc, value })));
	for (const { doc, value } of transfers) {
		if (!parties.has(value.grantorId) || !parties.has(value.granteeId)) {
			issue("unknown_party", doc);
			continue;
		}
		if (value.grantorId === value.granteeId) {
			issue("self_transfer", doc);
			continue;
		}
		if (transfers.filter((r) => r.value.transferId === value.transferId).length !== 1) {
			issue("duplicate_transfer", doc);
			continue;
		}
		if (value.basis === null) {
			issue("unknown_share_basis", doc);
			continue;
		}
		for (const band of bands(value.depth, doc)) {
			const from = key(value.interestKind, band.id, value.grantorId),
				to = key(value.interestKind, band.id, value.granteeId);
			const available = ledger.get(from);
			if (!available) {
				issue("missing_grantor_interest", doc, { bandId: band.id, partyId: value.grantorId });
				continue;
			}
			const share = Fraction.read(value.share);
			const amount = value.basis === "fraction-of-grantor" ? available.mul(share) : share;
			if (amount.cmp(available) > 0) {
				issue("over_conveyance", doc, { bandId: band.id, partyId: value.grantorId });
				continue;
			}
			ledger.set(from, available.sub(amount));
			ledger.set(to, (ledger.get(to) ?? zero()).add(amount));
		}
	}
	const burdens = documents.flatMap((doc) =>
		doc.burdens.map((value) => ({ doc, value, bands: bands(value.depth, doc) })),
	);
	const netRevenue: {
		partyId: string;
		bandId: string;
		workingInterest: string;
		royaltyBurden: string;
		overridingBurden: string;
		netRevenueInterest: string;
	}[] = [];
	for (const request of p.nriRequests) {
		let valid = true,
			royalty = zero(),
			overriding = zero();
		const reject = (code: string) => {
			issue(code, undefined, { partyId: request.partyId, bandId: request.bandId });
			valid = false;
		};
		if (!parties.has(request.partyId) || !e.depthBands.some((b) => b.id === request.bandId)) reject("nri_scope");
		if (request.coverage !== "operator-attested-supplied-schedule") reject("unknown_burden_coverage");
		const wi = ledger.get(key("operating-rights", request.bandId, request.partyId));
		if (!wi) reject("missing_working_interest");
		const applicable = burdens.filter(
			(r) => r.value.partyId === request.partyId && r.bands.some((b) => b.id === request.bandId),
		);
		for (const required of request.requiredBurdenRefs)
			if (applicable.filter((r) => sameRef(r.value.burdenRef, required)).length !== 1) reject("missing_burden");
		for (const { value } of applicable) {
			if (!request.requiredBurdenRefs.some((r) => sameRef(r, value.burdenRef))) reject("omitted_burden");
			if (burdens.filter((r) => sameRef(r.value.burdenRef, value.burdenRef)).length !== 1) reject("duplicate_burden");
			if (value.basis === null) {
				reject("unknown_burden_basis");
				continue;
			}
			if (!wi) continue;
			const amount =
				value.basis === "working-interest" ? wi.mul(Fraction.read(value.share)) : Fraction.read(value.share);
			if (value.kind === "royalty") royalty = royalty.add(amount);
			else overriding = overriding.add(amount);
		}
		if (wi && royalty.add(overriding).cmp(wi) > 0) reject("over_burdened");
		if (valid && wi)
			netRevenue.push({
				partyId: request.partyId,
				bandId: request.bandId,
				workingInterest: wi.toString(),
				royaltyBurden: royalty.toString(),
				overridingBurden: overriding.toString(),
				netRevenueInterest: wi.sub(royalty.add(overriding)).toString(),
			});
	}
	const leases = documents.flatMap((doc) => doc.leaseTerms.map((value) => ({ doc, value })));
	for (const required of p.requiredLeaseRefs) {
		const matches = leases.filter((r) => sameRef(r.value.leaseRef, required));
		if (matches.length !== 1) {
			issue(matches.length ? "duplicate_lease" : "missing_lease");
			continue;
		}
		const { doc, value } = matches[0];
		if (value.primaryTermEnd <= e.asOfDate && value.holdingStatus === "unknown") issue("unknown_lease_holding", doc);
		if (value.primaryTermEnd <= e.asOfDate && value.holdingStatus === "operator-reports-no-holding")
			issue("lease_holding_not_satisfied", doc);
	}
	const holdings = [...ledger]
		.sort(([a], [b]) => compare(a, b))
		.map(([encoded, value]) => {
			const [interestKind, bandId, partyId] = JSON.parse(encoded) as [Interest, string, string];
			return { interestKind, bandId, partyId, share: value.toString() };
		});
	const sourceWitnesses = documents.flatMap((doc) =>
		doc.sections.map((section) => {
			const bytes = Buffer.from(section.text, "utf8");
			return {
				instrumentRef: doc.instrumentRef,
				sectionId: section.sectionId,
				startByte: 0,
				endByte: bytes.byteLength,
				quote: section.text,
				sha256: createHash("sha256").update(bytes).digest("hex"),
			};
		}),
	);
	const uniqueExceptions = [...new Map(exceptions.map((item) => [JSON.stringify(item), item])).values()].sort((a, b) =>
		compare(JSON.stringify(a), JSON.stringify(b)),
	);
	return {
		version: "0.1.0" as const,
		examinationRef: e.examinationRef,
		tractRef: e.tractRef,
		jurisdictionId: e.jurisdictionId,
		asOfDate: e.asOfDate,
		basis: "operator-attested-normalized-instruments" as const,
		holdings,
		netRevenue,
		chain: documents.map((doc) => ({
			instrumentRef: doc.instrumentRef,
			recordingId: doc.recordingId,
			effectiveDate: doc.effectiveDate,
			recordedDate: doc.recordedDate,
			declaredSequence: doc.sequence,
			predecessorRefs: doc.predecessorRefs,
		})),
		leaseTerms: leases.map(({ doc, value }) => ({
			...value,
			instrumentRef: doc.instrumentRef,
			termStatus:
				e.asOfDate < value.primaryTermEnd
					? "primary-term-not-ended"
					: value.holdingStatus === "unknown"
						? "holding-unknown"
						: value.holdingStatus,
		})),
		sourceWitnesses,
		coverage: { requiredInstrumentRefs: e.requiredInstrumentRefs, missingInstrumentRefs },
		exceptions: uniqueExceptions,
		status: uniqueExceptions.length ? ("needs-input" as const) : ("ready-for-review" as const),
		reviewStatus: "unreviewed" as const,
		titleClearance: false as const,
		professionalAcceptance: false as const,
	};
}

export const titleCitationSchema = z
	.object({
		instrumentRef: titleRefSchema,
		sectionId: id,
		startByte: z.number().int().min(0).max(512000),
		endByte: z.number().int().min(1).max(512000),
		quote: text,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
export const titleProposalSchema = z
	.object({
		version: z.literal("0.1.0"),
		title: text,
		observations: z
			.array(
				z
					.object({
						observationRef: titleRefSchema,
						questionId: id,
						kind: z.enum(["observation", "exception", "question"]),
						statement: text,
						citations: z.array(titleCitationSchema).max(16),
					})
					.strict(),
			)
			.min(1)
			.max(128),
	})
	.strict();
export type TitleProposal = z.infer<typeof titleProposalSchema>;

/** Check original bytes, not model assertions about a quotation or its character count. */
export function validateTitleCitation(corpus: TitleCorpus, input: unknown) {
	let citation: z.infer<typeof titleCitationSchema>;
	try {
		citation = titleCitationSchema.parse(structuredClone(input));
	} catch {
		return deny("invalid_citation");
	}
	const documents = corpus.documents.filter((doc) => sameRef(doc.instrumentRef, citation.instrumentRef));
	const section =
		documents.length === 1 ? documents[0].sections.find((part) => part.sectionId === citation.sectionId) : undefined;
	if (!section) return deny("invalid_citation");
	const bytes = Buffer.from(section.text, "utf8"),
		quote = Buffer.from(citation.quote, "utf8");
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

/** Preserve proposed analysis separately from canonical supplied facts and non-waivable exceptions. */
export function buildTitlePacket(examination: unknown, corpus: unknown, policy: unknown, proposalInput: unknown) {
	const parsed = parseTitleInputs(examination, corpus, policy);
	const core = reconcileParsed(parsed);
	let proposal: TitleProposal;
	try {
		proposal = titleProposalSchema.parse(structuredClone(proposalInput));
	} catch {
		return deny("invalid_proposal");
	}
	if (
		!unique(proposal.observations.map((row) => refKey(row.observationRef))) ||
		proposal.observations.some((row) => !parsed.examination.questions.some((q) => q.id === row.questionId))
	)
		deny("invalid_proposal");
	for (const observation of proposal.observations)
		for (const citation of observation.citations) validateTitleCitation(parsed.corpus, citation);
	const coveredQuestionIds = [
		...new Set(proposal.observations.filter((row) => row.citations.length > 0).map((row) => row.questionId)),
	].sort(compare);
	const missingQuestionIds = parsed.examination.questions
		.map((q) => q.id)
		.filter((question) => !coveredQuestionIds.includes(question))
		.sort(compare);
	const citations = proposal.observations.flatMap((row) => row.citations);
	const missingCitedInstrumentRefs = parsed.examination.requiredInstrumentRefs.filter(
		(ref) => !citations.some((citation) => sameRef(citation.instrumentRef, ref)),
	);
	const exceptions = [
		...core.exceptions,
		...(missingQuestionIds.length ? [{ code: "missing_question_coverage", instrumentRefs: [] }] : []),
		...(missingCitedInstrumentRefs.length
			? [
					{
						code: "missing_instrument_citation",
						instrumentRefs: missingCitedInstrumentRefs,
					},
				]
			: []),
	];
	return {
		...core,
		title: proposal.title,
		observations: proposal.observations,
		coverage: {
			...core.coverage,
			requiredQuestionIds: parsed.examination.questions.map((q) => q.id).sort(compare),
			coveredQuestionIds,
			missingQuestionIds,
			missingCitedInstrumentRefs,
		},
		exceptions,
		status: exceptions.length ? ("needs-input" as const) : ("ready-for-review" as const),
	};
}
