import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import {
	type ArtifactRef,
	type JsonSourceArtifact,
	validateContract,
	validateSourceContract,
} from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { buildTitlePacket, parseTitleInputs, reconcileTitle, titleRefSchema } from "./title-packet.js";

const selectionSchema = z.object({ instrumentRef: titleRefSchema, sectionId: titleRefSchema.shape.id }).strict();
const configSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		examinationSourceRef: titleRefSchema,
		corpusSourceRef: titleRefSchema,
		policySourceRef: titleRefSchema,
	})
	.strict();
export interface TitleSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface TitleServiceOptions {
	current: () => Promise<unknown>;
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<TitleSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class TitleServiceError extends Error {
	constructor(public readonly code: string) {
		super(`Title source work blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new TitleServiceError(code);
}
const sameRef = (a: { id: string; revision: string }, b: { id: string; revision: string }) =>
	a.id === b.id && a.revision === b.revision;
const same = (a: unknown, b: unknown) => reviewJson(a) === reviewJson(b);
function json(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return deny("invalid_content");
	}
}
function pageBounds(offset: number, maxChars: number) {
	if (
		!Number.isSafeInteger(offset) ||
		offset < 0 ||
		!Number.isSafeInteger(maxChars) ||
		maxChars < 1 ||
		maxChars > 32000
	)
		deny("invalid_pagination");
}
function page(text: string, offset: number, maxChars: number) {
	pageBounds(offset, maxChars);
	const points = Array.from(text);
	return {
		text: points.slice(offset, offset + maxChars).join(""),
		offset,
		offsetUnit: "unicode-code-points" as const,
		nextOffset: offset + maxChars < points.length ? offset + maxChars : null,
	};
}

/** Current source bytes and read/export rights precede every useful Title result. */
export class TitlePacketService {
	constructor(private readonly options: TitleServiceOptions) {
		if (
			!Number.isSafeInteger(options.maxSourceAgeSeconds) ||
			options.maxSourceAgeSeconds < 1 ||
			options.maxSourceAgeSeconds > 31536000 ||
			[options.current, options.fetchSource, options.contentGuard].some((fn) => typeof fn !== "function")
		)
			deny("configuration");
	}
	private fresh(asOf: string) {
		const age = (this.options.clock?.() ?? new Date()).getTime() - Date.parse(asOf);
		if (!Number.isFinite(age) || age < 0 || age > this.options.maxSourceAgeSeconds * 1000) deny("stale_source");
	}
	private async configuration() {
		const config = configSchema.parse(structuredClone(await this.options.current()));
		const task = validateContract(config.task);
		if (task.kind !== "task-assignment" || ["completed", "cancelled", "failed"].includes(task.status))
			deny("task_unavailable");
		const refs = [config.examinationSourceRef, config.corpusSourceRef, config.policySourceRef];
		if (
			task.inputs.length !== 3 ||
			new Set(task.inputs.map((r) => r.id)).size !== 3 ||
			new Set(refs.map((r) => r.id)).size !== 3 ||
			refs.some((r) => !task.inputs.some((i) => sameRef(i, r)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(config: Awaited<ReturnType<TitlePacketService["configuration"]>>, signal?: AbortSignal) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<TitlePacketService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (
			who.customerId !== config.task.scope.customerId ||
			who.employeeId !== config.task.scope.employeeId ||
			!who.scopes.includes("title:read") ||
			!who.scopes.includes("source:read")
		)
			deny("access_denied");
		const fetched = await this.options.fetchSource(
			{ id: reference.id, revision: reference.revision },
			who,
			operation,
			signal,
		);
		const source = validateSourceContract(structuredClone(fetched.artifact), {
			expectedScope: config.task.scope,
			expectedTaskRevision: config.task.revision,
		});
		if (
			source.kind !== "source-artifact" ||
			source.format !== "json" ||
			!same(source.artifact, reference) ||
			!(fetched.bytes instanceof Uint8Array)
		)
			deny("source_binding_mismatch");
		const bytes = Uint8Array.from(fetched.bytes);
		if (
			bytes.byteLength > 8_000_000 ||
			bytes.byteLength !== source.byteLength ||
			createHash("sha256").update(bytes).digest("hex") !== source.evidence.hash.value
		)
			deny("source_binding_mismatch");
		let text: string;
		try {
			text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch {
			return deny("invalid_content");
		}
		if (
			(await this.options.contentGuard(text)) !== true ||
			(await this.options.contentGuard(reviewJson(source))) !== true
		)
			deny("unsafe_content");
		this.fresh(source.evidence.asOf);
		if (signal?.aborted) deny("cancelled");
		return { source, bytes, text };
	}
	private async load(reference: unknown, who: SourcePrincipal, operation: "read" | "export", signal?: AbortSignal) {
		if (signal?.aborted) deny("cancelled");
		const ref = titleRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<TitlePacketService["fetchBound"]>>[] = [];
		let size = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			if ((size += snapshot.bytes.byteLength) > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const text = (ref: { id: string; revision: string }) =>
			snapshots.find((s) => sameRef(s.source.artifact, ref))!.text;
		const inputs = parseTitleInputs(
			json(text(config.examinationSourceRef)),
			json(text(config.corpusSourceRef)),
			json(text(config.policySourceRef)),
		);
		await this.assertCurrent(config, signal);
		return { config, snapshots, ...inputs };
	}
	private publicPacket(packet: Awaited<ReturnType<TitlePacketService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((s) => sameRef(s.source.artifact, packet.config.corpusSourceRef))!.source,
			sourceArtifacts: packet.snapshots.map((s) => s.source),
		};
	}
	private async deliver<T>(packet: Awaited<ReturnType<TitlePacketService["load"]>>, value: T, signal?: AbortSignal) {
		if ((await this.options.contentGuard(reviewJson(value))) !== true) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots) this.fresh(snapshot.source.evidence.asOf);
		return value;
	}
	private instrument(packet: Awaited<ReturnType<TitlePacketService["load"]>>, input: unknown) {
		const ref = selectionSchema.parse(input);
		const documents = packet.corpus.documents.filter((d) => sameRef(d.instrumentRef, ref.instrumentRef));
		const section =
			documents.length === 1 ? documents[0].sections.find((s) => s.sectionId === ref.sectionId) : undefined;
		if (!section) deny("instrument_unavailable");
		return { document: documents[0], section };
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				examination: packet.examination,
				policy: packet.policy,
				instruments: packet.corpus.documents.map((d) => ({
					instrumentRef: d.instrumentRef,
					tractRef: d.tractRef,
					jurisdictionId: d.jurisdictionId,
					recordingId: d.recordingId,
					effectiveDate: d.effectiveDate,
					recordedDate: d.recordedDate,
					declaredSequence: d.sequence,
					sourceStatus: d.sourceStatus,
					sections: d.sections.map((s) => ({ sectionId: s.sectionId, byteLength: Buffer.byteLength(s.text, "utf8") })),
				})),
				reviewStatus: "unreviewed" as const,
				titleClearance: false as const,
			},
			signal,
		);
	}
	async calculate(reference: unknown, view: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = z.enum(["ownership", "chain", "burdens", "lease"]).parse(view);
		const packet = await this.load(reference, who, "read", signal);
		const title = reconcileTitle(packet.examination, packet.corpus, packet.policy);
		const common = {
			version: title.version,
			examinationRef: title.examinationRef,
			tractRef: title.tractRef,
			jurisdictionId: title.jurisdictionId,
			asOfDate: title.asOfDate,
			basis: title.basis,
			status: title.status,
			reviewStatus: title.reviewStatus,
			titleClearance: title.titleClearance,
			professionalAcceptance: title.professionalAcceptance,
			coverage: title.coverage,
			exceptions: title.exceptions,
		};
		const fields =
			selected === "ownership"
				? { holdings: title.holdings, netRevenue: title.netRevenue }
				: selected === "chain"
					? { chain: title.chain }
					: selected === "burdens"
						? {
								netRevenue: title.netRevenue,
								burdens: packet.corpus.documents
									.filter((doc) => title.chain.some((row) => sameRef(row.instrumentRef, doc.instrumentRef)))
									.flatMap((doc) => doc.burdens.map((value) => ({ ...value, instrumentRef: doc.instrumentRef }))),
							}
						: { leaseTerms: title.leaseTerms };
		return this.deliver(
			packet,
			{ ...this.publicPacket(packet), view: selected, title: { ...common, ...fields } },
			signal,
		);
	}
	async readInstrument(
		reference: unknown,
		selection: unknown,
		who: SourcePrincipal,
		offset = 0,
		maxChars = 16000,
		signal?: AbortSignal,
	) {
		pageBounds(offset, maxChars);
		const selected = selectionSchema.parse(selection),
			packet = await this.load(reference, who, "read", signal);
		const { document, section } = this.instrument(packet, selected);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				instrumentRef: document.instrumentRef,
				tractRef: document.tractRef,
				jurisdictionId: document.jurisdictionId,
				recordingId: document.recordingId,
				sectionId: section.sectionId,
				sourceStatus: document.sourceStatus,
				...page(section.text, offset, maxChars),
			},
			signal,
		);
	}
	async cite(reference: unknown, selection: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = selectionSchema
			.extend({
				quote: z.string().min(1).max(8192),
				occurrence: z.number().int().min(0).max(4096).optional(),
			})
			.strict()
			.parse(selection);
		const packet = await this.load(reference, who, "read", signal);
		const { section } = this.instrument(packet, {
			instrumentRef: selected.instrumentRef,
			sectionId: selected.sectionId,
		});
		const bytes = Buffer.from(section.text, "utf8"),
			quote = Buffer.from(selected.quote, "utf8");
		if (quote.toString("utf8") !== selected.quote) deny("invalid_quote");
		let start = bytes.indexOf(quote);
		if (start < 0) deny("quote_unavailable");
		if (selected.occurrence === undefined && bytes.indexOf(quote, start + 1) >= 0) deny("ambiguous_quote");
		for (let index = 0; index < (selected.occurrence ?? 0); index++) {
			start = bytes.indexOf(quote, start + 1);
			if (start < 0) deny("quote_unavailable");
		}
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				citation: {
					instrumentRef: selected.instrumentRef,
					sectionId: selected.sectionId,
					startByte: start,
					endByte: start + quote.byteLength,
					quote: selected.quote,
					sha256: createHash("sha256").update(quote).digest("hex"),
				},
			},
			signal,
		);
	}
	async draft(reference: unknown, proposal: unknown, revision: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const workRevision = titleRefSchema.shape.revision.parse(revision);
		const packet = await this.load(reference, who, "export", signal);
		const title = buildTitlePacket(packet.examination, packet.corpus, packet.policy, proposal);
		const evidenceIds = packet.snapshots.map((s) => s.source.evidence.id);
		const identity = createHash("sha256").update(reviewJson(packet.config.task.scope)).digest("hex");
		const assumptionId = `assumption.title.${identity}`;
		const finding = (key: unknown, value: string, unit: string, reason: string) => ({
			id: `finding.title.${createHash("sha256").update(reviewJson(key)).digest("hex")}`,
			basis: "assumed",
			value,
			unit,
			evidenceIds,
			assumptionIds: [assumptionId],
			reason,
		});
		const work = validateContract({
			contractVersion: "0.1.0",
			kind: "work-product",
			scope: packet.config.task.scope,
			taskRevision: packet.config.task.revision,
			artifact: {
				id: `work.title.${identity}`,
				revision: workRevision,
				uri: `urn:shaleyeah:title:${identity}:${encodeURIComponent(workRevision)}`,
			},
			status: title.status === "ready-for-review" ? "ready_for_review" : "blocked",
			inputs: packet.config.task.inputs,
			evidence: packet.snapshots.map((s) => s.source.evidence),
			findings: [
				...title.holdings.map((row) =>
					finding(
						["holding", row.interestKind, row.bandId, row.partyId],
						row.share,
						"supplied-whole-interest-fraction",
						"Exact arithmetic under supplied opening/transfer claims; not verified legal ownership",
					),
				),
				...title.netRevenue.map((row) =>
					finding(
						["nri", row.bandId, row.partyId],
						row.netRevenueInterest,
						"supplied-whole-interest-fraction",
						"Exact arithmetic under supplied WI/whole burden bases; no regional default",
					),
				),
				...title.observations.map((row) =>
					finding(
						["observation", row.observationRef],
						row.statement,
						"proposed-title-observation",
						`${row.kind}: unreviewed proposed analysis with exact instrument citations`,
					),
				),
			],
			assumptions: [
				{
					id: assumptionId,
					statement:
						"Normalized instruments, opening holdings, order, scope and burden bases are operator-attested. Arithmetic and byte citations do not verify legal validity, complete record coverage or marketable title.",
					evidenceIds,
				},
			],
			uncertainty:
				"A private supplied-instrument ownership/exception packet. No title clearance, legal opinion, curative execution, filing, transfer, lease acceptance or capital authority.",
			blockers: title.exceptions.map((exception) => ({
				code: /conflict|duplicate|overallocated|over_conveyance|over_burdened/.test(exception.code)
					? "conflicting_evidence"
					: "missing_input",
				message: `Title input or proposed coverage requires fresh review: ${exception.code}`,
				references: [],
			})),
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		return this.deliver(packet, { ...this.publicPacket(packet), work, title }, signal);
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = titleRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((r) => sameRef(r, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		await this.assertCurrent(config, signal);
		this.fresh(snapshot.source.evidence.asOf);
		return snapshot;
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		pageBounds(offset, maxChars);
		const snapshot = await this.source(reference, "read", who, signal);
		return { sourceArtifact: snapshot.source, ...page(snapshot.text, offset, maxChars) };
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		z.enum(["read", "export"]).parse(operation);
		return { sourceArtifact: (await this.source(reference, operation, who, signal)).source, operation };
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		const config = await this.configuration(),
			input = config.task.inputs.find((r) => r.id === id);
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.source({ id: input.id, revision: input.revision }, "export", who, signal);
		return {
			artifact: {
				artifact: snapshot.source.artifact,
				evidence: snapshot.source.evidence,
				retrievedAt: snapshot.source.retrievedAt,
			},
			bytes: snapshot.bytes,
		};
	}
}
