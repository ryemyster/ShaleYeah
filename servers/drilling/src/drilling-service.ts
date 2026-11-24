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
import { buildDrillingPacket, drillingRefSchema, parseDrillingInputs, reconcileDrilling } from "./drilling-packet.js";

const selectionSchema = z.object({ evidenceRef: drillingRefSchema, sectionId: drillingRefSchema.shape.id }).strict();
const configSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		designSourceRef: drillingRefSchema,
		corpusSourceRef: drillingRefSchema,
		policySourceRef: drillingRefSchema,
	})
	.strict();
export interface DrillingSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface DrillingServiceOptions {
	current: () => Promise<unknown>;
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<DrillingSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class DrillingServiceError extends Error {
	constructor(public readonly code: string) {
		super(`Drilling source work blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new DrillingServiceError(code);
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

/** Current source bytes and read/export rights precede every useful Drilling result. */
export class DrillingPacketService {
	constructor(private readonly options: DrillingServiceOptions) {
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
		const refs = [config.designSourceRef, config.corpusSourceRef, config.policySourceRef];
		if (
			task.inputs.length !== 3 ||
			new Set(task.inputs.map((r) => r.id)).size !== 3 ||
			new Set(refs.map((r) => r.id)).size !== 3 ||
			refs.some((r) => !task.inputs.some((i) => sameRef(i, r)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(
		config: Awaited<ReturnType<DrillingPacketService["configuration"]>>,
		signal?: AbortSignal,
	) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<DrillingPacketService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (
			who.customerId !== config.task.scope.customerId ||
			who.employeeId !== config.task.scope.employeeId ||
			!who.scopes.includes("drilling:read") ||
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
		const ref = drillingRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<DrillingPacketService["fetchBound"]>>[] = [];
		let size = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			if ((size += snapshot.bytes.byteLength) > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const text = (ref: { id: string; revision: string }) =>
			snapshots.find((s) => sameRef(s.source.artifact, ref))!.text;
		const inputs = parseDrillingInputs(
			json(text(config.designSourceRef)),
			json(text(config.corpusSourceRef)),
			json(text(config.policySourceRef)),
		);
		await this.assertCurrent(config, signal);
		return { config, snapshots, ...inputs };
	}
	private publicPacket(packet: Awaited<ReturnType<DrillingPacketService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((s) => sameRef(s.source.artifact, packet.config.corpusSourceRef))!.source,
			sourceArtifacts: packet.snapshots.map((s) => s.source),
		};
	}
	private async deliver<T>(packet: Awaited<ReturnType<DrillingPacketService["load"]>>, value: T, signal?: AbortSignal) {
		if ((await this.options.contentGuard(reviewJson(value))) !== true) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots) this.fresh(snapshot.source.evidence.asOf);
		return value;
	}
	private evidence(packet: Awaited<ReturnType<DrillingPacketService["load"]>>, input: unknown) {
		const ref = selectionSchema.parse(input);
		const documents = packet.corpus.documents.filter((d) => sameRef(d.evidenceRef, ref.evidenceRef));
		const section =
			documents.length === 1 ? documents[0].sections.find((s) => s.sectionId === ref.sectionId) : undefined;
		if (!section) deny("evidence_unavailable");
		return { document: documents[0], section };
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				design: packet.design,
				policy: packet.policy,
				evidence: packet.corpus.documents.map((d) => ({
					evidenceRef: d.evidenceRef,
					wellRef: d.wellRef,
					designRef: d.designRef,
					formationRef: d.formationRef,
					asOfDate: d.asOfDate,
					sourceStatus: d.sourceStatus,
					kind: d.kind,
					sections: d.sections.map((s) => ({ sectionId: s.sectionId, byteLength: Buffer.byteLength(s.text) })),
				})),
				reviewStatus: "unreviewed" as const,
				operationalApproval: false as const,
			},
			signal,
		);
	}
	async calculate(reference: unknown, view: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = z.enum(["program", "costs", "risks"]).parse(view),
			packet = await this.load(reference, who, "read", signal),
			drilling = reconcileDrilling(packet.design, packet.corpus, packet.policy);
		const common = {
			version: drilling.version,
			designRef: drilling.designRef,
			wellRef: drilling.wellRef,
			formationRef: drilling.formationRef,
			asOfDate: drilling.asOfDate,
			basis: drilling.basis,
			status: drilling.status,
			reviewStatus: drilling.reviewStatus,
			operationalApproval: drilling.operationalApproval,
			professionalAcceptance: drilling.professionalAcceptance,
			coverage: drilling.coverage,
			exceptions: drilling.exceptions,
		};
		const fields =
			selected === "program"
				? {
						targetMdMetres: drilling.targetMdMetres,
						targetTvdMetres: drilling.targetTvdMetres,
						datumId: drilling.datumId,
						programs: drilling.programs,
					}
				: selected === "costs"
					? { costs: drilling.costs, schedules: drilling.schedules }
					: { hazards: drilling.hazards, offsets: drilling.offsets };
		return this.deliver(
			packet,
			{ ...this.publicPacket(packet), view: selected, drilling: { ...common, ...fields } },
			signal,
		);
	}
	async readEvidence(
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
		const { document, section } = this.evidence(packet, selected);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				evidenceRef: document.evidenceRef,
				wellRef: document.wellRef,
				formationRef: document.formationRef,
				designRef: document.designRef,
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
		const { section } = this.evidence(packet, {
			evidenceRef: selected.evidenceRef,
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
					evidenceRef: selected.evidenceRef,
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
		const workRevision = drillingRefSchema.shape.revision.parse(revision);
		const packet = await this.load(reference, who, "export", signal);
		const drilling = buildDrillingPacket(packet.design, packet.corpus, packet.policy, proposal);
		const evidenceIds = packet.snapshots.map((s) => s.source.evidence.id);
		const identity = createHash("sha256").update(reviewJson(packet.config.task.scope)).digest("hex");
		const assumptionId = `assumption.drilling.${identity}`;
		const finding = (key: unknown, value: string, unit: string, reason: string) => ({
			id: `finding.drilling.${createHash("sha256").update(reviewJson(key)).digest("hex")}`,
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
				id: `work.drilling.${identity}`,
				revision: workRevision,
				uri: `urn:shaleyeah:drilling:${identity}:${encodeURIComponent(workRevision)}`,
			},
			status: drilling.status === "ready-for-review" ? "ready_for_review" : "blocked",
			inputs: packet.config.task.inputs,
			evidence: packet.snapshots.map((s) => s.source.evidence),
			findings: [
				...drilling.costs
					.filter((row) => row.totalExact !== null)
					.map((row) =>
						finding(
							["quoted-cost", row.optionRef],
							row.totalExact!,
							row.currency,
							"Exact sum of supplied required quoted line amounts; not total well cost or an AFE",
						),
					),
				...drilling.schedules
					.filter((row) => row.totalDays !== null)
					.map((row) =>
						finding(
							["schedule", row.optionRef],
							row.totalDays!,
							"day",
							"Exact sum of supplied sequential phases; not an execution schedule or drilling-speed prediction",
						),
					),
				...drilling.observations.map((row) =>
					finding(
						["observation", row.observationRef],
						row.statement,
						"proposed-drilling-observation",
						`${row.kind}: unreviewed proposed analysis with exact evidence citations`,
					),
				),
			],
			assumptions: [
				{
					id: assumptionId,
					statement:
						"Supplied design/component references, offsets, quoted scope, sequential phases, hazards and mitigation reviews are operator-attested. Exact arithmetic and byte citations do not verify engineering sufficiency, safe operations or complete well costs.",
					evidenceIds,
				},
			],
			uncertainty:
				"Private supplied drilling options and evidence packet. No spud, AFE, capital commitment, field operations, well-control, safety certification or professional engineering acceptance.",
			blockers: drilling.exceptions.map((exception) => ({
				code: /conflict|duplicate|overallocated|over_conveyance|over_burdened/.test(exception.code)
					? "conflicting_evidence"
					: "missing_input",
				message: `Drilling input or proposed coverage requires fresh review: ${exception.code}`,
				references: [],
			})),
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		return this.deliver(packet, { ...this.publicPacket(packet), work, drilling }, signal);
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = drillingRefSchema.parse(reference),
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
