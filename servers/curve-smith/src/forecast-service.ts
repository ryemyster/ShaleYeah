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
import { calculateForecast, forecastContextSchema, type NumericMetric } from "./arps.js";
import { generateTypeCurve } from "./type-curve.js";

export const forecastRefSchema = z
	.object({ id: z.string().min(1).max(128), revision: z.string().min(1).max(128) })
	.strict();
const label = z.string().min(1).max(2048);
const identity = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z][a-z0-9._:-]*$/);
const sourceBasis = {
	version: z.literal("0.1.0"),
	formation: label,
	product: forecastContextSchema.shape.product,
	rateUnit: forecastContextSchema.shape.rateUnit,
	timeBasis: forecastContextSchema.shape.timeBasis,
	timeConvention: z.literal("calendar-elapsed"),
	sourceGrain: z.literal("well"),
};
const observationSchema = z
	.object({
		elapsedTime: z.number().finite().nonnegative(),
		observedAt: z.iso.datetime(),
		rate: z.number().finite().positive(),
		operation: z.literal("producing"),
	})
	.strict();
export const productionHistorySchema = z
	.object({
		...sourceBasis,
		observationKind: z.literal("instantaneous-rate"),
		wells: z
			.array(
				z
					.object({
						wellRef: forecastRefSchema,
						evidenceKind: z.enum(["observed", "synthetic"]),
						origin: z.iso.datetime(),
						observations: z.array(observationSchema).min(1).max(1200),
					})
					.strict(),
			)
			.min(1)
			.max(64),
	})
	.strict();
export const operatingBasisSchema = z
	.object({
		...sourceBasis,
		wells: z.array(forecastRefSchema).min(1).max(64),
		operatingBasis: label,
		limitations: z.array(label).min(1).max(32),
	})
	.strict();
export const forecastDefinitionSchema = z
	.object({
		id: identity,
		revision: forecastRefSchema.shape.revision,
		bFactor: z.number().finite().min(0).max(2),
		horizon: forecastContextSchema.shape.horizon,
		economicLimitRate: forecastContextSchema.shape.economicLimitRate,
		forecastTimes: forecastContextSchema.shape.forecastTimes,
		fitUntil: z.number().finite().positive(),
		minimumTrainingObservations: z.number().int().min(3).max(1200),
		minimumHoldoutObservations: z.number().int().min(1).max(1200),
		maxFitRelativeRmse: z.number().finite().nonnegative().max(100),
		maxHoldoutRelativeRmse: z.number().finite().nonnegative().max(100),
	})
	.strict();
const assumptionsSchema = z
	.object({ version: z.literal("0.1.0"), forecasts: z.array(forecastDefinitionSchema).min(1).max(100) })
	.strict();
const configurationSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		historySourceRef: forecastRefSchema,
		basisSourceRef: forecastRefSchema,
		assumptionsSourceRef: forecastRefSchema,
	})
	.strict();
export interface ForecastSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface ProductionForecastOptions {
	/** Host-owned current task and grant revision. A model cannot supply authority. */
	current: () => Promise<unknown>;
	/** Installed connector enforces read/export rights on every source access. */
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<ForecastSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	maxObservationAgeSeconds: number;
	clock?: () => Date;
}
export class ProductionForecastError extends Error {
	constructor(public readonly code: string) {
		super(`Production forecast blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new ProductionForecastError(code);
}
const same = (a: unknown, b: unknown) => reviewJson(a) === reviewJson(b);
const sameRef = (a: { id: string; revision: string }, b: { id: string; revision: string }) =>
	a.id === b.id && a.revision === b.revision;
const available = (value: number): NumericMetric =>
	Number.isFinite(value)
		? { status: "available", value }
		: { status: "unavailable", value: null, reason: "numeric_range" };
const unavailable = (reason: string): NumericMetric => ({ status: "unavailable", value: null, reason });

/** Normalized source mapping and observed diagnostics. Numerical fitting/integration stays in #712's kernel. */
export class ProductionForecastService {
	constructor(private readonly options: ProductionForecastOptions) {
		for (const seconds of [options.maxSourceAgeSeconds, options.maxObservationAgeSeconds])
			if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 31536000) deny("configuration");
		if ([options.current, options.fetchSource, options.contentGuard].some((fn) => typeof fn !== "function"))
			deny("configuration");
	}
	private now() {
		const now = (this.options.clock?.() ?? new Date()).getTime();
		if (!Number.isFinite(now)) deny("configuration");
		return now;
	}
	private fresh(date: string, maximum: number) {
		const age = this.now() - Date.parse(date);
		if (!Number.isFinite(age) || age < 0 || age > maximum * 1000) deny("stale_source");
	}
	private async configuration() {
		// Keep an immutable comparison snapshot even if a host returns mutable records.
		const config = configurationSchema.parse(structuredClone(await this.options.current()));
		const task = validateContract(config.task);
		if (task.kind !== "task-assignment" || ["completed", "cancelled", "failed"].includes(task.status))
			deny("task_unavailable");
		if (task.inputs.length !== 3 || new Set(task.inputs.map((item) => item.id)).size !== 3) deny("invalid_sources");
		const refs = [config.historySourceRef, config.basisSourceRef, config.assumptionsSourceRef];
		if (
			new Set(refs.map((ref) => ref.id)).size !== 3 ||
			refs.some((ref) => !task.inputs.some((item) => sameRef(item, ref)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(
		config: Awaited<ReturnType<ProductionForecastService["configuration"]>>,
		signal?: AbortSignal,
	) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<ProductionForecastService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (who.customerId !== config.task.scope.customerId || who.employeeId !== config.task.scope.employeeId)
			deny("access_denied");
		const fetched = await this.options.fetchSource(
			{ id: reference.id, revision: reference.revision },
			who,
			operation,
			signal,
		);
		const source = validateSourceContract(fetched.artifact, {
			expectedScope: config.task.scope,
			expectedTaskRevision: config.task.revision,
		});
		if (source.kind !== "source-artifact" || source.format !== "json" || !same(source.artifact, reference))
			deny("source_binding_mismatch");
		if (
			!(fetched.bytes instanceof Uint8Array) ||
			fetched.bytes.byteLength > 8_000_000 ||
			fetched.bytes.byteLength !== source.byteLength ||
			createHash("sha256").update(fetched.bytes).digest("hex") !== source.evidence.hash.value
		)
			deny("source_binding_mismatch");
		// Copy before awaiting host guards: the connector's buffer may be reused.
		const bytes = Uint8Array.from(fetched.bytes),
			text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		if (!(await this.options.contentGuard(text)) || !(await this.options.contentGuard(reviewJson(source))))
			deny("unsafe_content");
		this.fresh(source.evidence.asOf, this.options.maxSourceAgeSeconds);
		if (signal?.aborted) deny("cancelled");
		return { source, bytes, text };
	}
	private async load(reference: unknown, who: SourcePrincipal, operation: "read" | "export", signal?: AbortSignal) {
		const ref = forecastRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<ProductionForecastService["fetchBound"]>>[] = [];
		let size = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			size += snapshot.bytes.byteLength;
			if (size > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const snapshot = (reference: { id: string; revision: string }) =>
			snapshots.find((item) => sameRef(item.source.artifact, reference))!;
		const history = productionHistorySchema.parse(JSON.parse(snapshot(config.historySourceRef).text));
		const basis = operatingBasisSchema.parse(JSON.parse(snapshot(config.basisSourceRef).text));
		const assumptions = assumptionsSchema.parse(JSON.parse(snapshot(config.assumptionsSourceRef).text));
		for (const key of ["formation", "product", "rateUnit", "timeBasis", "timeConvention", "sourceGrain"] as const)
			if (!same(history[key], basis[key])) deny("basis_mismatch");
		if ((history.product === "oil") !== (history.rateUnit === "bbl/day")) deny("unit_mismatch");
		if (
			!snapshot(config.historySourceRef).source.units.some(
				(unit) => unit.field === "rate" && unit.unit === history.rateUnit && unit.origin === "operator-declared",
			)
		)
			deny("unit_mismatch");
		if (
			new Set(history.wells.map((well) => well.wellRef.id)).size !== history.wells.length ||
			new Set(basis.wells.map((well) => well.id)).size !== basis.wells.length ||
			!same(history.wells.map((well) => reviewJson(well.wellRef)).sort(), basis.wells.map(reviewJson).sort())
		)
			deny("well_identity_mismatch");
		if (new Set(assumptions.forecasts.map((forecast) => forecast.id)).size !== assumptions.forecasts.length)
			deny("duplicate_forecast");
		for (const well of history.wells) {
			for (const [index, point] of well.observations.entries()) {
				const elapsedMs = Date.parse(point.observedAt) - Date.parse(well.origin);
				if (
					Math.abs(elapsedMs - point.elapsedTime * history.timeBasis.daysPerUnit * 86400000) > 1 ||
					(index === 0 ? point.elapsedTime !== 0 : point.elapsedTime <= well.observations[index - 1].elapsedTime) ||
					Date.parse(point.observedAt) > this.now()
				)
					deny("observation_time_mismatch");
			}
			this.fresh(well.observations.at(-1)!.observedAt, this.options.maxObservationAgeSeconds);
		}
		for (const forecast of assumptions.forecasts) {
			forecastContextSchema.parse(this.context(config, history, forecast));
			if (
				forecast.fitUntil >= forecast.horizon ||
				history.wells.some((well) => well.observations.at(-1)!.elapsedTime > forecast.horizon)
			)
				deny("forecast_time_mismatch");
		}
		if (!(await this.options.contentGuard(reviewJson(config)))) deny("unsafe_content");
		await this.assertCurrent(config, signal);
		return { config, snapshots, history, basis, assumptions };
	}
	private context(
		config: Awaited<ReturnType<ProductionForecastService["configuration"]>>,
		history: z.infer<typeof productionHistorySchema>,
		definition: z.infer<typeof forecastDefinitionSchema>,
	) {
		return {
			contractVersion: "0.1.0",
			product: history.product,
			rateUnit: history.rateUnit,
			timeBasis: history.timeBasis,
			horizon: definition.horizon,
			economicLimitRate: definition.economicLimitRate,
			forecastTimes: definition.forecastTimes,
			inputRef: config.historySourceRef,
			assumptionRefs: [config.basisSourceRef, config.assumptionsSourceRef],
		};
	}
	private calculateBound(
		packet: Awaited<ReturnType<ProductionForecastService["load"]>>,
		definition: z.infer<typeof forecastDefinitionSchema>,
	) {
		const context = this.context(packet.config, packet.history, definition);
		const modeled = generateTypeCurve({
			...context,
			formation: packet.history.formation,
			basis: {
				kind: "analog-history",
				bFactor: definition.bFactor,
				analogWells: packet.history.wells.map((well) => ({
					wellRef: well.wellRef,
					evidenceKind: well.evidenceKind,
					observations: well.observations
						.filter((point) => point.elapsedTime <= definition.fitUntil)
						.map(({ elapsedTime, rate }) => ({ elapsedTime, rate })),
				})),
			},
		});
		const remaining: {
			wellRef: { id: string; revision: string };
			interval: { start: number; end: number } | null;
			volumeUnit: string;
			volumeBasis: string;
			cumulativeProduction: NumericMetric;
		}[] = [];
		const validation = packet.history.wells.map((well, index) => {
			const training = well.observations.filter((point) => point.elapsedTime <= definition.fitUntil);
			const fitted = modeled.wells[index],
				holdout = well.observations.filter((point) => point.elapsedTime > definition.fitUntil);
			const origin = well.observations.at(-1)!.elapsedTime;
			let fitRelativeRmse: NumericMetric = unavailable(fitted.reason ?? "fit_unavailable"),
				relativeRmse = unavailable("fit_unavailable");
			let volume = unavailable(fitted.reason ?? "fit_unavailable"),
				interval: { start: number; end: number } | null = null;
			if (fitted.status === "available" && fitted.fit) {
				const fit = fitted.fit;
				const scale = Math.max(...training.map((point) => point.rate));
				fitRelativeRmse = available(fit.rmseRate / scale);
				const times = [...new Set([origin, ...holdout.map((point) => point.elapsedTime)])].sort((a, b) => a - b);
				const predicted = calculateForecast({
					...context,
					...{ initialRate: fit.initialRate, nominalDecline: fit.nominalDecline, bFactor: fit.bFactor },
					forecastTimes: times,
				});
				if (predicted.status === "available") {
					const startVolume = predicted.forecast.find((point) => point.time === origin)!.cumulativeProduction;
					volume = available(Math.max(0, predicted.cumulativeProduction.value! - startVolume));
					interval = { start: origin, end: Math.max(origin, predicted.interval!.end) };
					if (holdout.length)
						relativeRmse = available(
							Math.sqrt(
								holdout.reduce(
									(sum, point) =>
										sum +
										((predicted.forecast.find((prediction) => prediction.time === point.elapsedTime)!.rate -
											point.rate) /
											scale) **
											2,
									0,
								) / holdout.length,
							),
						);
					else relativeRmse = unavailable("no_holdout_history");
				}
			}
			remaining.push({
				wellRef: well.wellRef,
				interval,
				volumeUnit: modeled.volumeUnit,
				volumeBasis: "future-only-after-last-observation",
				cumulativeProduction: volume,
			});
			const passed =
				fitted.status === "available" &&
				(fitted.fit?.observationCount ?? 0) >= definition.minimumTrainingObservations &&
				holdout.length >= definition.minimumHoldoutObservations &&
				fitRelativeRmse.value !== null &&
				fitRelativeRmse.value <= definition.maxFitRelativeRmse &&
				relativeRmse.value !== null &&
				relativeRmse.value <= definition.maxHoldoutRelativeRmse &&
				volume.status === "available";
			return {
				wellRef: well.wellRef,
				trainingCount: training.length,
				holdoutCount: holdout.length,
				fitRelativeRmse,
				relativeRmse,
				status: passed ? "passed" : "failed",
			};
		});
		return {
			reference: { id: definition.id, revision: definition.revision },
			definition,
			modeled,
			remaining,
			validation,
			quality: {
				status: validation.every((item) => item.status === "passed") ? "passed" : "failed",
				thresholds: {
					minimumTrainingObservations: definition.minimumTrainingObservations,
					minimumHoldoutObservations: definition.minimumHoldoutObservations,
					maxFitRelativeRmse: definition.maxFitRelativeRmse,
					maxHoldoutRelativeRmse: definition.maxHoldoutRelativeRmse,
				},
			},
			uncertainty: modeled.uncertainty,
			reviewStatus: "unreviewed",
			authorizesReserves: false,
		};
	}
	private selected(packet: Awaited<ReturnType<ProductionForecastService["load"]>>, ids: unknown) {
		const parsed = z.array(identity).min(1).max(100).parse(ids);
		if (new Set(parsed).size !== parsed.length) deny("duplicate_forecast");
		return parsed.map((id) => {
			const definition = packet.assumptions.forecasts.find((definition) => definition.id === id);
			if (!definition) deny("forecast_missing");
			return this.calculateBound(packet, definition);
		});
	}
	private publicPacket(packet: Awaited<ReturnType<ProductionForecastService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((snapshot) =>
				sameRef(snapshot.source.artifact, packet.config.historySourceRef),
			)!.source,
			sourceArtifacts: packet.snapshots.map((snapshot) => snapshot.source),
		};
	}
	private async deliver<T>(
		packet: Awaited<ReturnType<ProductionForecastService["load"]>>,
		result: T,
		signal?: AbortSignal,
	): Promise<T> {
		if (!(await this.options.contentGuard(reviewJson(result)))) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots)
			this.fresh(snapshot.source.evidence.asOf, this.options.maxSourceAgeSeconds);
		for (const well of packet.history.wells)
			this.fresh(well.observations.at(-1)!.observedAt, this.options.maxObservationAgeSeconds);
		return result;
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		const { wells, ...history } = packet.history;
		const { limitations, ...basis } = packet.basis;
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				history: {
					...history,
					wells: wells.map(({ observations, ...well }) => ({
						...well,
						observationCount: observations.length,
						firstObservation: observations[0],
						lastObservation: observations.at(-1)!,
					})),
				},
				basis: { ...basis, limitationCount: limitations.length },
				forecasts: packet.assumptions.forecasts.map(({ forecastTimes, ...definition }) => ({
					...definition,
					forecastPointCount: forecastTimes.length,
				})),
				reviewStatus: "unreviewed",
				authorizesReserves: false,
			},
			signal,
		);
	}
	async calculate(reference: unknown, selected: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const ref = forecastRefSchema.parse(selected),
			packet = await this.load(reference, who, "read", signal);
		const definition = packet.assumptions.forecasts.find((item) => sameRef(item, ref));
		if (!definition) deny("revision_mismatch");
		return this.deliver(
			packet,
			{ ...this.publicPacket(packet), calculation: this.calculateBound(packet, definition) },
			signal,
		);
	}
	async compare(reference: unknown, ids: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				forecasts: this.selected(packet, ids),
				reviewStatus: "unreviewed",
				authorizesReserves: false,
			},
			signal,
		);
	}
	async draft(reference: unknown, ids: unknown, revision: string, who: SourcePrincipal, signal?: AbortSignal) {
		forecastRefSchema.shape.revision.parse(revision);
		const packet = await this.load(reference, who, "export", signal),
			forecasts = this.selected(packet, ids);
		const evidenceIds = packet.snapshots.map((item) => item.source.evidence.id);
		const assumptions = forecasts.map((item) => ({
			id: `${item.reference.id}.basis`,
			statement: `Declared fixed-b Arps assumption b=${item.definition.bFactor}, fit until ${item.definition.fitUntil}, horizon ${item.definition.horizon} (${reviewJson(packet.history.timeBasis)}), daily-rate unit ${packet.history.rateUnit}, cutoff ${item.definition.economicLimitRate}. Operating basis: ${packet.basis.operatingBasis}. Full forecast grid, validation thresholds and limitations remain in the source-linked forecast packet. This is not reserves certification.`,
			evidenceIds,
		}));
		const blockers = forecasts
			.filter((item) => item.quality.status !== "passed")
			.map((item) => ({
				code: "missing_input",
				message: `Forecast ${item.reference.id} failed configured history/validation requirements`,
				references: [item.reference],
			}));
		const identity = createHash("sha256").update(reviewJson(packet.config.task.scope)).digest("hex");
		const work = validateContract({
			contractVersion: "0.1.0",
			kind: "work-product",
			scope: packet.config.task.scope,
			taskRevision: packet.config.task.revision,
			artifact: {
				id: `work.reservoir.${identity}`,
				revision,
				uri: `urn:shaleyeah:reservoir:${identity}:${encodeURIComponent(revision)}`,
			},
			status: blockers.length ? "blocked" : "ready_for_review",
			inputs: packet.config.task.inputs,
			evidence: packet.snapshots.map((item) => item.source.evidence),
			findings: forecasts.map((item) => {
				const metric = item.modeled.cumulativeProduction;
				return metric.status === "available"
					? {
							id: `${item.reference.id}.modeled-volume`,
							basis: "assumed",
							value: metric.value,
							unit: item.modeled.volumeUnit,
							evidenceIds,
							assumptionIds: [`${item.reference.id}.basis`],
						}
					: {
							id: `${item.reference.id}.modeled-volume`,
							basis: "unknown",
							value: null,
							reason: metric.reason,
							unit: item.modeled.volumeUnit,
							evidenceIds: [],
							assumptionIds: [],
						};
			}),
			assumptions,
			uncertainty:
				"Finite modeled volumes are not observed cumulative production or certified reserves. No calibrated uncertainty model or field/capital authority.",
			blockers,
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		const forecast = {
			version: "0.1.0",
			taskRef: this.publicPacket(packet).taskRef,
			forecastIds: forecasts.map((item) => item.reference.id),
			forecasts,
			basis: packet.basis,
			reviewStatus: "unreviewed",
			authorizesReserves: false,
		};
		return this.deliver(packet, { ...this.publicPacket(packet), work, forecast }, signal);
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = forecastRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((item) => sameRef(item, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		await this.assertCurrent(config, signal);
		this.fresh(snapshot.source.evidence.asOf, this.options.maxSourceAgeSeconds);
		return snapshot;
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		if (
			!Number.isSafeInteger(offset) ||
			offset < 0 ||
			!Number.isSafeInteger(maxChars) ||
			maxChars < 1 ||
			maxChars > 32000
		)
			deny("invalid_pagination");
		const snapshot = await this.source(reference, "read", who, signal);
		return {
			sourceArtifact: snapshot.source,
			text: snapshot.text.slice(offset, offset + maxChars),
			offset,
			nextOffset: offset + maxChars < snapshot.text.length ? offset + maxChars : null,
		};
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		return { sourceArtifact: (await this.source(reference, operation, who, signal)).source, operation };
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		const config = await this.configuration(),
			input = config.task.inputs.find((item) => item.id === id);
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
