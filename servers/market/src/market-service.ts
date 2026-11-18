import { createHash } from "node:crypto";
import { SourceAccessError, type SourcePrincipal } from "@shaleyeah/connectors";
import {
	type ArtifactRef,
	type JsonSourceArtifact,
	validateContract,
	validateSourceContract,
} from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import {
	buildMarketScenario,
	MarketScenarioError,
	marketAssumptionsSchema,
	marketMandateSchema,
	marketRefSchema,
	marketSeriesSchema,
	parseMarketScenarioInputs,
} from "./market-scenario.js";

const configurationSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		mandateSourceRef: marketRefSchema,
		seriesSourceRef: marketRefSchema,
		assumptionsSourceRef: marketRefSchema,
	})
	.strict();
export interface MarketSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface MarketServiceOptions {
	/** Trusted current task, source bindings and rights revision; revalidated at delivery. */
	current: () => Promise<unknown>;
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<MarketSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class MarketServiceError extends Error {
	constructor(public readonly code: string) {
		super(`Market source work blocked: ${code}`);
		this.name = "MarketServiceError";
	}
}
function deny(code: string): never {
	throw new MarketServiceError(code);
}
const same = (left: unknown, right: unknown) => reviewJson(left) === reviewJson(right);
const sameRef = (left: { id: string; revision: string }, right: { id: string; revision: string }) =>
	left.id === right.id && left.revision === right.revision;
const hash = (value: unknown) => createHash("sha256").update(reviewJson(value)).digest("hex");
function document<T>(text: string, schema: z.ZodType<T>): T {
	try {
		return schema.parse(JSON.parse(text));
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
function calculationProposal(mandate: z.infer<typeof marketMandateSchema>) {
	return {
		version: "0.1.0",
		title: "Supplied market comparison and scenarios",
		summary:
			"Arithmetic over the supplied dated observations and explicit operator scenarios. Commercial use requires human review.",
		evidenceSeriesIds: [mandate.benchmarkSeriesId, mandate.realizedSeriesId],
		scenarioIds: mandate.requiredScenarioIds,
		limitations: [],
	};
}

/** Scoped current sources and canonical work; no caller or model can supply an approval grant. */
export class MarketScenarioService {
	constructor(private readonly options: MarketServiceOptions) {
		if (
			!Number.isSafeInteger(options.maxSourceAgeSeconds) ||
			options.maxSourceAgeSeconds < 1 ||
			options.maxSourceAgeSeconds > 31536000 ||
			[options.current, options.fetchSource, options.contentGuard].some((fn) => typeof fn !== "function")
		)
			deny("configuration");
	}
	private async run<T>(action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			if (error instanceof MarketServiceError) throw error;
			if (error instanceof SourceAccessError) throw new MarketServiceError(error.code);
			throw new MarketServiceError(
				error instanceof z.ZodError || error instanceof MarketScenarioError
					? "invalid_arguments"
					: "verification_unavailable",
			);
		}
	}
	private now() {
		const value = this.options.clock?.() ?? new Date();
		if (!(value instanceof Date) || !Number.isFinite(value.getTime())) deny("configuration");
		return value.getTime();
	}
	private fresh(value: string) {
		const age = this.now() - Date.parse(value);
		if (!Number.isFinite(age) || age < 0 || age > this.options.maxSourceAgeSeconds * 1000) deny("stale_source");
	}
	private async configuration() {
		const config = configurationSchema.parse(structuredClone(await this.options.current()));
		const task = validateContract(config.task);
		if (task.kind !== "task-assignment" || ["completed", "cancelled", "failed"].includes(task.status))
			deny("task_unavailable");
		if (!task.requiredCapabilities.includes("market.scenario")) deny("capability_mismatch");
		const refs = [config.mandateSourceRef, config.seriesSourceRef, config.assumptionsSourceRef];
		if (
			task.inputs.length !== 3 ||
			new Set(task.inputs.map((item) => item.id)).size !== 3 ||
			new Set(refs.map((item) => item.id)).size !== 3 ||
			refs.some((ref) => !task.inputs.some((input) => sameRef(input, ref)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(
		config: Awaited<ReturnType<MarketScenarioService["configuration"]>>,
		signal?: AbortSignal,
	) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<MarketScenarioService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (
			who.customerId !== config.task.scope.customerId ||
			who.employeeId !== config.task.scope.employeeId ||
			!who.scopes.includes("market:read") ||
			!who.scopes.includes("source:read")
		)
			deny("access_denied");
		let fetched: MarketSource;
		try {
			fetched = await this.options.fetchSource(
				{ id: reference.id, revision: reference.revision },
				who,
				operation,
				signal,
			);
		} catch (error) {
			if (error instanceof MarketServiceError || error instanceof SourceAccessError) throw error;
			return deny("source_unavailable");
		}
		let source: ReturnType<typeof validateSourceContract>;
		try {
			source = validateSourceContract(structuredClone(fetched.artifact), {
				expectedScope: config.task.scope,
				expectedTaskRevision: config.task.revision,
			});
		} catch {
			return deny("source_binding_mismatch");
		}
		if (
			source.kind !== "source-artifact" ||
			source.format !== "json" ||
			!same(source.artifact, reference) ||
			!(fetched.bytes instanceof Uint8Array) ||
			fetched.bytes.byteLength > 8_000_000
		)
			deny("source_binding_mismatch");
		const bytes = Uint8Array.from(fetched.bytes);
		if (
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
		if (
			Date.parse(source.retrievedAt) > this.now() ||
			Date.parse(source.retrievedAt) < Date.parse(source.evidence.asOf)
		)
			deny("invalid_source_time");
		if (signal?.aborted) deny("cancelled");
		return { source, bytes, text };
	}
	private async load(reference: unknown, who: SourcePrincipal, operation: "read" | "export", signal?: AbortSignal) {
		if (signal?.aborted) deny("cancelled");
		const ref = marketRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<MarketScenarioService["fetchBound"]>>[] = [];
		let bytes = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			bytes += snapshot.bytes.byteLength;
			if (bytes > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const text = (reference: { id: string; revision: string }) =>
			snapshots.find((item) => sameRef(item.source.artifact, reference))!.text;
		const mandate = document(text(config.mandateSourceRef), marketMandateSchema);
		const series = document(text(config.seriesSourceRef), marketSeriesSchema);
		const assumptions = document(text(config.assumptionsSourceRef), marketAssumptionsSchema);
		try {
			parseMarketScenarioInputs({ mandate, series, assumptions, proposal: calculationProposal(mandate) });
		} catch {
			return deny("invalid_content");
		}
		if (Date.parse(mandate.asOf) > this.now()) deny("invalid_analysis_time");
		if (series.series.some((item) => Date.parse(item.retrievedAt) > this.now())) deny("invalid_source_time");
		await this.assertCurrent(config, signal);
		return { config, snapshots, mandate, series, assumptions };
	}
	private publicPacket(packet: Awaited<ReturnType<MarketScenarioService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((item) => sameRef(item.source.artifact, packet.config.seriesSourceRef))!
				.source,
			sourceArtifacts: packet.snapshots.map((item) => item.source),
		};
	}
	private async deliver<T>(packet: Awaited<ReturnType<MarketScenarioService["load"]>>, value: T, signal?: AbortSignal) {
		if ((await this.options.contentGuard(reviewJson(value))) !== true) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots) this.fresh(snapshot.source.evidence.asOf);
		return value;
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		return this.run(async () => {
			const packet = await this.load(reference, who, "read", signal);
			return this.deliver(
				packet,
				{
					...this.publicPacket(packet),
					mandate: packet.mandate,
					series: packet.series.series.map(({ observations, ...metadata }) => ({
						...metadata,
						observationCount: observations.length,
					})),
					scenarios: packet.assumptions.scenarios.map((item) => ({
						id: item.id,
						period: item.period,
						region: item.region,
						unit: item.unit,
					})),
					reviewStatus: "unreviewed",
					commercialAuthority: false,
				},
				signal,
			);
		});
	}
	async calculate(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		return this.run(async () => {
			const packet = await this.load(reference, who, "read", signal);
			const market = buildMarketScenario({
				mandate: packet.mandate,
				series: packet.series,
				assumptions: packet.assumptions,
				proposal: calculationProposal(packet.mandate),
			});
			return this.deliver(packet, { ...this.publicPacket(packet), market }, signal);
		});
	}
	async draft(reference: unknown, proposal: unknown, revision: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		return this.run(async () => {
			const workRevision = marketRefSchema.shape.revision.parse(revision),
				packet = await this.load(reference, who, "export", signal);
			const market = buildMarketScenario({
				mandate: packet.mandate,
				series: packet.series,
				assumptions: packet.assumptions,
				proposal,
			});
			const evidenceIds = packet.snapshots.map((item) => item.source.evidence.id),
				identity = hash(packet.config.task.scope);
			const assumptionId = `assumption.market.${identity}`;
			const finding = (name: string, value: number | null, reason: string | null) =>
				value === null
					? {
							id: `finding.market.${hash([identity, name])}`,
							basis: "unknown",
							value: null,
							unit: packet.mandate.targetUnit,
							evidenceIds: [],
							assumptionIds: [],
							reason: reason ?? "Required market comparison or scenario input is unavailable",
						}
					: {
							id: `finding.market.${hash([identity, name])}`,
							basis: "assumed",
							value,
							unit: packet.mandate.targetUnit,
							evidenceIds,
							assumptionIds: [assumptionId],
							reason:
								"Arithmetic uses the supplied period selection, native source values and operator conversion/scenario assumptions; human commercial review is required",
						};
			const work = validateContract({
				contractVersion: "0.1.0",
				kind: "work-product",
				scope: packet.config.task.scope,
				taskRevision: packet.config.task.revision,
				artifact: {
					id: `work.market.${identity}`,
					revision: workRevision,
					uri: `urn:shaleyeah:market:${identity}:${encodeURIComponent(workRevision)}`,
				},
				status: market.status === "blocked" ? "blocked" : "ready_for_review",
				inputs: packet.config.task.inputs,
				evidence: packet.snapshots.map((item) => item.source.evidence),
				findings: [
					finding("mean-differential", market.comparison.meanDifferential, null),
					...market.scenarios.map((item) => finding(`scenario.${item.id}`, item.price, item.reason)),
				],
				assumptions: [
					{
						id: assumptionId,
						statement:
							"The operator supplies region/period selection, heat-content conversion and future commercial assumptions. The original observations and units remain in the market packet; no scenario is an observed or licensed forward price.",
						evidenceIds,
					},
				],
				uncertainty:
					"Source metadata and heat content are operator-attested. Scenario values require the commercial owner's exact human review; this packet grants no trade, contract, bid or capital authority.",
				blockers: market.blockers.map((code) => ({ code: "missing_input", message: code, references: [] })),
				review: { status: "unreviewed", decisionRefs: [] },
			});
			if (work.kind !== "work-product") deny("invalid_work");
			return this.deliver(packet, { ...this.publicPacket(packet), work, market }, signal);
		});
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = marketRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((item) => sameRef(item, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		await this.assertCurrent(config, signal);
		this.fresh(snapshot.source.evidence.asOf);
		return snapshot;
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		return this.run(async () => {
			pageBounds(offset, maxChars);
			const snapshot = await this.source(reference, "read", who, signal),
				points = Array.from(snapshot.text);
			return {
				sourceArtifact: snapshot.source,
				text: points.slice(offset, offset + maxChars).join(""),
				offset,
				offsetUnit: "unicode-code-points",
				nextOffset: offset + maxChars < points.length ? offset + maxChars : null,
			};
		});
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		return this.run(async () => {
			z.enum(["read", "export"]).parse(operation);
			return { sourceArtifact: (await this.source(reference, operation, who, signal)).source, operation };
		});
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		return this.run(async () => {
			const config = await this.configuration(),
				input = config.task.inputs.find((item) => item.id === id);
			if (!input) deny("source_binding_mismatch");
			const snapshot = await this.source({ id: input.id, revision: input.revision }, "export", who, signal);
			await this.assertCurrent(config, signal);
			this.fresh(snapshot.source.evidence.asOf);
			return {
				artifact: snapshot.source,
				bytes: snapshot.bytes,
			};
		});
	}
}
