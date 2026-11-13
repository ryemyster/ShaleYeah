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
import { buildLegalMemo, legalProvisionApplicability, legalRefSchema, parseLegalInputs } from "./legal-memo.js";

export { legalRefSchema } from "./legal-memo.js";

const provisionSchema = z.object({ documentRef: legalRefSchema, sectionId: legalRefSchema.shape.id }).strict();
const configSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		matterSourceRef: legalRefSchema,
		corpusSourceRef: legalRefSchema,
		policySourceRef: legalRefSchema,
	})
	.strict();
export interface LegalSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface LegalServiceOptions {
	/** Trusted current task, source bindings and authority revision; reread at final delivery. */
	current: () => Promise<unknown>;
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<LegalSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class LegalServiceError extends Error {
	constructor(public readonly code: string) {
		super(`Legal source work blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new LegalServiceError(code);
}
const sameRef = (a: { id: string; revision: string }, b: { id: string; revision: string }) =>
	a.id === b.id && a.revision === b.revision;
const same = (a: unknown, b: unknown) => reviewJson(a) === reviewJson(b);
const provisionKey = (value: z.infer<typeof provisionSchema>) =>
	JSON.stringify([value.documentRef.id, value.documentRef.revision, value.sectionId]);
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
	// The client never needs to count UTF-16 code units or split a surrogate pair.
	const points = Array.from(text);
	return {
		text: points.slice(offset, offset + maxChars).join(""),
		offset,
		offsetUnit: "unicode-code-points" as const,
		nextOffset: offset + maxChars < points.length ? offset + maxChars : null,
	};
}

/** Current operator material and scoped rights precede every useful analysis or private draft. */
export class LegalMemoService {
	constructor(private readonly options: LegalServiceOptions) {
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
		const refs = [config.matterSourceRef, config.corpusSourceRef, config.policySourceRef];
		if (
			task.inputs.length !== 3 ||
			new Set(task.inputs.map((r) => r.id)).size !== 3 ||
			new Set(refs.map((r) => r.id)).size !== 3 ||
			refs.some((r) => !task.inputs.some((i) => sameRef(i, r)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(config: Awaited<ReturnType<LegalMemoService["configuration"]>>, signal?: AbortSignal) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<LegalMemoService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (
			who.customerId !== config.task.scope.customerId ||
			who.employeeId !== config.task.scope.employeeId ||
			!who.scopes.includes("legal:read") ||
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
		if (source.kind !== "source-artifact" || source.format !== "json" || !same(source.artifact, reference))
			deny("source_binding_mismatch");
		if (!(fetched.bytes instanceof Uint8Array)) deny("source_binding_mismatch");
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
		const ref = legalRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<LegalMemoService["fetchBound"]>>[] = [];
		let size = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			if ((size += snapshot.bytes.byteLength) > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const text = (ref: { id: string; revision: string }) =>
			snapshots.find((s) => sameRef(s.source.artifact, ref))!.text;
		const parsed = parseLegalInputs(
			json(text(config.matterSourceRef)),
			json(text(config.corpusSourceRef)),
			json(text(config.policySourceRef)),
		);
		const applicability = legalProvisionApplicability(parsed.matter, parsed.corpus);
		await this.assertCurrent(config, signal);
		return {
			config,
			snapshots,
			matter: parsed.matter,
			corpus: parsed.corpus,
			scopePolicy: parsed.policy,
			applicability,
			applicabilityIndex: new Map(applicability.map((row) => [provisionKey(row), row])),
		};
	}
	private publicPacket(packet: Awaited<ReturnType<LegalMemoService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((s) => sameRef(s.source.artifact, packet.config.corpusSourceRef))!.source,
			sourceArtifacts: packet.snapshots.map((s) => s.source),
		};
	}
	private async deliver<T>(packet: Awaited<ReturnType<LegalMemoService["load"]>>, value: T, signal?: AbortSignal) {
		if ((await this.options.contentGuard(reviewJson(value))) !== true) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots) this.fresh(snapshot.source.evidence.asOf);
		return value;
	}
	private provision(packet: Awaited<ReturnType<LegalMemoService["load"]>>, reference: unknown) {
		const ref = provisionSchema.parse(reference);
		const document = packet.corpus.documents.find((d) => sameRef(d.documentRef, ref.documentRef));
		const section = document?.sections.find((s) => s.sectionId === ref.sectionId);
		if (!document || !section) deny("provision_unavailable");
		const applicability = packet.applicabilityIndex.get(provisionKey(ref))!;
		return { document, section, applicability };
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				matter: packet.matter,
				policy: packet.scopePolicy,
				documents: packet.corpus.documents.map((d) => ({
					documentRef: d.documentRef,
					title: d.title,
					sourceKind: d.sourceKind,
					sourceUri: d.sourceUri,
					sections: d.sections.map((s) => ({ sectionId: s.sectionId, byteLength: Buffer.byteLength(s.text, "utf8") })),
				})),
				applicability: packet.applicability,
				reviewStatus: "unreviewed",
				legalClearance: false,
			},
			signal,
		);
	}
	async compare(reference: unknown, selections: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = z.array(provisionSchema).min(1).max(32).parse(selections);
		if (new Set(selected.map(provisionKey)).size !== selected.length) deny("duplicate_selection");
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				provisions: selected.map((ref) => {
					const { document, section, applicability } = this.provision(packet, ref);
					return {
						documentRef: document.documentRef,
						sectionId: section.sectionId,
						title: document.title,
						sourceKind: document.sourceKind,
						sourceUri: document.sourceUri,
						byteLength: Buffer.byteLength(section.text, "utf8"),
						applicability,
					};
				}),
				reviewStatus: "unreviewed",
				legalClearance: false,
			},
			signal,
		);
	}
	async readProvision(
		reference: unknown,
		selected: unknown,
		who: SourcePrincipal,
		offset = 0,
		maxChars = 16000,
		signal?: AbortSignal,
	) {
		pageBounds(offset, maxChars);
		const selection = provisionSchema.parse(selected);
		const packet = await this.load(reference, who, "read", signal);
		const { document, section, applicability } = this.provision(packet, selection);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				documentRef: document.documentRef,
				sectionId: section.sectionId,
				sourceKind: document.sourceKind,
				sourceUri: document.sourceUri,
				applicability,
				...page(section.text, offset, maxChars),
			},
			signal,
		);
	}
	async cite(reference: unknown, selection: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = provisionSchema
			.extend({ quote: z.string().min(1).max(8192), occurrence: z.number().int().min(0).max(4096).optional() })
			.strict()
			.parse(selection);
		const packet = await this.load(reference, who, "read", signal);
		const { section, applicability } = this.provision(packet, {
			documentRef: selected.documentRef,
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
		const citation = {
			documentRef: selected.documentRef,
			sectionId: selected.sectionId,
			startByte: start,
			endByte: start + quote.byteLength,
			quote: selected.quote,
			sha256: createHash("sha256").update(quote).digest("hex"),
		};
		return this.deliver(packet, { ...this.publicPacket(packet), citation, applicability }, signal);
	}
	async draft(reference: unknown, proposal: unknown, revision: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const workRevision = legalRefSchema.shape.revision.parse(revision),
			packet = await this.load(reference, who, "export", signal);
		const legal = buildLegalMemo(packet.matter, packet.corpus, packet.scopePolicy, proposal);
		const evidenceIds = packet.snapshots.map((s) => s.source.evidence.id);
		const identity = createHash("sha256").update(reviewJson(packet.config.task.scope)).digest("hex");
		const assumptionId = `assumption.legal.${identity}`;
		const blockers = [
			...(legal.coverage.missingQuestionRefs.length
				? [{ code: "missing_input", message: "Required legal questions are not covered", references: [] }]
				: []),
			...(legal.coverage.missingSources.length
				? [
						{
							code: "missing_input",
							message: "Required cited sources or eligible source anchors are missing",
							references: [],
						},
					]
				: []),
			...(legal.coverage.missingConflictRefs.length
				? [
						{
							code: "conflicting_evidence",
							message: "Declared source conflicts are not retained for counsel",
							references: [],
						},
					]
				: []),
		];
		const work = validateContract({
			contractVersion: "0.1.0",
			kind: "work-product",
			scope: packet.config.task.scope,
			taskRevision: packet.config.task.revision,
			artifact: {
				id: `work.legal.${identity}`,
				revision: workRevision,
				uri: `urn:shaleyeah:legal:${identity}:${encodeURIComponent(workRevision)}`,
			},
			status: blockers.length ? "blocked" : "ready_for_review",
			inputs: packet.config.task.inputs,
			evidence: packet.snapshots.map((s) => s.source.evidence),
			findings: legal.issues.map((issue) => ({
				id: `finding.legal.${createHash("sha256").update(reviewJson(issue.issueRef)).digest("hex")}`,
				basis: "assumed",
				value: issue.statement,
				unit: "proposed-legal-issue",
				evidenceIds,
				assumptionIds: [assumptionId],
				reason: `${issue.kind}: an unreviewed proposal; exact provisions remain in the legal memo`,
			})),
			assumptions: [
				{
					id: assumptionId,
					statement:
						"Source scope and dates are operator-declared. Proposed legal interpretations require qualified human review; citation validity is not legal clearance.",
					evidenceIds,
				},
			],
			uncertainty:
				"A source-backed private issue memo for counsel. No legal clearance, contract approval, redline/signature/filing/waiver authority, compliance certification or capital commitment is granted.",
			blockers,
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		return this.deliver(packet, { ...this.publicPacket(packet), work, legal }, signal);
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = legalRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((i) => sameRef(i, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		await this.assertCurrent(config, signal);
		this.fresh(snapshot.source.evidence.asOf);
		return snapshot;
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		pageBounds(offset, maxChars);
		const snapshot = await this.source(reference, "read", who, signal);
		const result = { sourceArtifact: snapshot.source, ...page(snapshot.text, offset, maxChars) };
		this.fresh(snapshot.source.evidence.asOf);
		return result;
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		z.enum(["read", "export"]).parse(operation);
		return { sourceArtifact: (await this.source(reference, operation, who, signal)).source, operation };
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		const config = await this.configuration(),
			input = config.task.inputs.find((i) => i.id === id);
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
