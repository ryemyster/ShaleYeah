import { createHash } from "node:crypto";
import type { FetchedSource, SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, validateContract, validateSourceContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { calculateCashFlows, cashFlowInputSchema } from "./cash-flow.js";

const id = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z][a-z0-9._:-]*$/);
export const economicRefSchema = z
	.object({ id: z.string().min(1).max(128), revision: z.string().min(1).max(128) })
	.strict();
export const financialBasisSchema = z
	.object({
		version: z.literal("0.1.0"),
		assumptionsRef: economicRefSchema,
		forecastRef: economicRefSchema,
		priceDeckRef: economicRefSchema,
		priceDeckAsOf: z.iso.datetime(),
		costRef: economicRefSchema,
		ownershipRef: economicRefSchema,
		taxRoyaltyRef: economicRefSchema,
		workingInterest: z.number().finite().min(0).max(1),
		revenueInterest: z.number().finite().min(0).max(1),
		cashFlowBasis: z.literal("net-entity"),
		moneyScale: z.literal(1),
		nominalReal: z.enum(["nominal", "real"]),
		startDate: z.iso.date(),
		limitations: z.array(z.string().min(1).max(2048)).max(32),
	})
	.strict();
export const scenarioDefinitionSchema = z
	.object({
		id,
		revision: economicRefSchema.shape.revision,
		currency: cashFlowInputSchema.shape.currency,
		periodUnit: cashFlowInputSchema.shape.periodUnit,
		discountRate: cashFlowInputSchema.shape.discountRate,
		basis: financialBasisSchema,
	})
	.strict();
const configurationSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		cashFlowSourceRef: economicRefSchema,
		scenarios: z.array(scenarioDefinitionSchema).min(1).max(100),
	})
	.strict();
export interface EconomicScenarioOptions {
	/** Current host-owned task and assumption revisions. They are not model arguments. */
	current: () => Promise<unknown>;
	/** Installed source boundary must enforce current read/export rights and source identity. */
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<FetchedSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxPriceAgeSeconds: number;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class EconomicScenarioError extends Error {
	constructor(public readonly code: string) {
		super(`Economic scenario blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new EconomicScenarioError(code);
}
const same = (left: unknown, right: unknown) => reviewJson(left) === reviewJson(right);
const sameRef = (left: { id: string; revision: string }, right: { id: string; revision: string }) =>
	left.id === right.id && left.revision === right.revision;
const basisKeys = [
	"assumptionsRef",
	"forecastRef",
	"priceDeckRef",
	"costRef",
	"ownershipRef",
	"taxRoyaltyRef",
] as const;
function number(value: string) {
	if (
		typeof value !== "string" ||
		value.length > 128 ||
		!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value) ||
		!Number.isFinite(Number(value))
	)
		deny("invalid_cash_flow_rows");
	return Number(value);
}

/** Source/assumption mapping only. All numerical work uses the qualified cash-flow calculator. */
export class EconomicScenarioService {
	constructor(private readonly options: EconomicScenarioOptions) {
		if (
			!Number.isSafeInteger(options.maxPriceAgeSeconds) ||
			options.maxPriceAgeSeconds < 1 ||
			options.maxPriceAgeSeconds > 31536000 ||
			!Number.isSafeInteger(options.maxSourceAgeSeconds) ||
			options.maxSourceAgeSeconds < 1 ||
			options.maxSourceAgeSeconds > 31536000 ||
			typeof options.contentGuard !== "function" ||
			typeof options.current !== "function" ||
			typeof options.fetchSource !== "function"
		)
			deny("configuration");
	}
	private async configuration() {
		const config = configurationSchema.parse(await this.options.current());
		const task = validateContract(config.task);
		if (task.kind !== "task-assignment" || ["completed", "cancelled", "failed"].includes(task.status))
			deny("task_unavailable");
		if (new Set(config.scenarios.map((scenario) => scenario.id)).size !== config.scenarios.length)
			deny("duplicate_scenario");
		if (
			!task.inputs.length ||
			task.inputs.length > 16 ||
			new Set(task.inputs.map((item) => item.id)).size !== task.inputs.length
		)
			deny("invalid_sources");
		if (!task.inputs.some((item) => sameRef(item, config.cashFlowSourceRef))) deny("source_binding_mismatch");
		for (const scenario of config.scenarios)
			for (const key of basisKeys) {
				if (!task.inputs.some((item) => sameRef(item, scenario.basis[key]))) deny("basis_source_missing");
			}
		return { ...config, task };
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<EconomicScenarioService["configuration"]>>,
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
		if (source.kind !== "source-artifact" || source.format !== "csv" || !same(source.artifact, reference))
			deny("source_binding_mismatch");
		if (
			!(fetched.bytes instanceof Uint8Array) ||
			fetched.bytes.byteLength > 8_000_000 ||
			fetched.bytes.byteLength !== source.byteLength ||
			createHash("sha256").update(fetched.bytes).digest("hex") !== source.evidence.hash.value
		)
			deny("source_binding_mismatch");
		const age = (this.options.clock?.() ?? new Date()).getTime() - Date.parse(source.evidence.asOf);
		if (age < 0 || age > this.options.maxSourceAgeSeconds * 1000) deny("stale_source");
		const text = new TextDecoder("utf-8", { fatal: true }).decode(fetched.bytes);
		if (!(await this.options.contentGuard(text)) || !(await this.options.contentGuard(reviewJson(source))))
			deny("unsafe_content");
		if (signal?.aborted) deny("cancelled");
		return { source, bytes: fetched.bytes, text };
	}
	private async load(reference: unknown, who: SourcePrincipal, operation: "read" | "export", signal?: AbortSignal) {
		if (signal?.aborted) deny("cancelled");
		const ref = economicRefSchema.parse(reference),
			config = await this.configuration();
		if (ref.id !== config.task.id || ref.revision !== config.task.revision) deny("revision_mismatch");
		if (who.customerId !== config.task.scope.customerId || who.employeeId !== config.task.scope.employeeId)
			deny("access_denied");
		const snapshots: Awaited<ReturnType<EconomicScenarioService["fetchBound"]>>[] = [];
		let totalBytes = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			totalBytes += snapshot.bytes.byteLength;
			if (totalBytes > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const primary = snapshots.find((item) => sameRef(item.source.artifact, config.cashFlowSourceRef))!;
		const { source, text } = primary;
		if (!(await this.options.contentGuard(reviewJson(config)))) deny("unsafe_content");
		const rows: string[][] = parse(text, { bom: true, skip_empty_lines: true, max_record_size: 16384 });
		if (
			!same(rows.shift(), ["scenarioId", "scenarioRevision", "period", "netCashFlow"]) ||
			!rows.length ||
			rows.length > 60100 ||
			rows.some((row) => row.length !== 4)
		)
			deny("invalid_cash_flow_rows");
		const scenarios = config.scenarios.map((definition) => {
			const selected = rows.filter((row) => row[0] === definition.id);
			if (selected.length < 2 || selected.length > 601 || selected.some((row) => row[1] !== definition.revision))
				deny("scenario_input_missing");
			const indexed = selected
				.map((row) => ({ period: number(row[2]), value: number(row[3]) }))
				.sort((a, b) => a.period - b.period);
			if (indexed.some((row, index) => row.period !== index)) deny("period_mismatch");
			if (
				!source.units.some(
					(unit) =>
						unit.field === "netCashFlow" && unit.unit === definition.currency && unit.origin === "operator-declared",
				)
			)
				deny("unit_mismatch");
			const now = (this.options.clock?.() ?? new Date()).getTime(),
				priceAge = now - Date.parse(definition.basis.priceDeckAsOf);
			if (priceAge < 0 || priceAge > this.options.maxPriceAgeSeconds * 1000) deny("stale_price_basis");
			const { basis } = definition;
			const price = snapshots.find((item) => sameRef(item.source.artifact, basis.priceDeckRef))!;
			if (Date.parse(price.source.evidence.asOf) !== Date.parse(basis.priceDeckAsOf)) deny("price_source_mismatch");
			const ownership = snapshots.find((item) => sameRef(item.source.artifact, basis.ownershipRef))!;
			const owners: string[][] = parse(ownership.text, { bom: true, skip_empty_lines: true, max_record_size: 16384 });
			if (
				!same(owners.shift(), ["scenarioId", "workingInterest", "revenueInterest"]) ||
				owners.some((row) => row.length !== 3)
			)
				deny("ownership_mismatch");
			const matching = owners.filter((row) => row[0] === definition.id);
			if (
				matching.length !== 1 ||
				number(matching[0][1]) !== basis.workingInterest ||
				number(matching[0][2]) !== basis.revenueInterest
			)
				deny("ownership_mismatch");
			const input = cashFlowInputSchema.parse({
				contractVersion: "0.1.0",
				cashFlows: indexed.map((row) => row.value),
				currency: definition.currency,
				periodUnit: definition.periodUnit,
				discountRate: definition.discountRate,
				inputRef: { id: source.artifact.id, revision: source.artifact.revision },
				assumptionRefs: [
					basis.assumptionsRef,
					basis.forecastRef,
					basis.priceDeckRef,
					basis.costRef,
					basis.ownershipRef,
					basis.taxRoyaltyRef,
				],
			});
			return { reference: { id: definition.id, revision: definition.revision }, input, basis };
		});
		if (rows.some((row) => !config.scenarios.some((scenario) => scenario.id === row[0]))) deny("unknown_scenario");
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
		return {
			task: config.task,
			taskRef: ref,
			sourceArtifact: source,
			sourceArtifacts: snapshots.map((item) => item.source),
			scenarios,
		};
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		const ref = economicRefSchema.parse(reference),
			config = await this.configuration();
		if (
			!Number.isSafeInteger(offset) ||
			offset < 0 ||
			!Number.isSafeInteger(maxChars) ||
			maxChars < 1 ||
			maxChars > 32000
		)
			deny("invalid_pagination");
		const input = config.task.inputs.find((item) => sameRef(item, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, "read", signal);
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		return {
			sourceArtifact: snapshot.source,
			text: snapshot.text.slice(offset, offset + maxChars),
			offset,
			nextOffset: offset + maxChars < snapshot.text.length ? offset + maxChars : null,
		};
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = economicRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((item) => sameRef(item, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		return { sourceArtifact: snapshot.source, operation };
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		const config = await this.configuration(),
			input = config.task.inputs.find((item) => item.id === id);
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, "export", signal);
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		return {
			artifact: {
				artifact: snapshot.source.artifact,
				evidence: snapshot.source.evidence,
				retrievedAt: snapshot.source.retrievedAt,
			},
			bytes: snapshot.bytes,
		};
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const { task: _task, ...packet } = await this.load(reference, who, "read", signal);
		return { ...packet, reviewStatus: "unreviewed", authorizesInvestment: false };
	}
	async calculate(reference: unknown, selected: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const ref = economicRefSchema.parse(selected),
			packet = await this.load(reference, who, "read", signal);
		const scenario = packet.scenarios.find((item) => same(item.reference, ref));
		if (!scenario) deny("revision_mismatch");
		return {
			reference: scenario.reference,
			basis: scenario.basis,
			economics: calculateCashFlows(scenario.input),
			sourceArtifact: packet.sourceArtifact,
			sourceArtifacts: packet.sourceArtifacts,
		};
	}
	private selected(packet: Awaited<ReturnType<EconomicScenarioService["load"]>>, ids: unknown) {
		const selected = z.array(id).min(1).max(100).parse(ids);
		if (new Set(selected).size !== selected.length) deny("duplicate_scenario");
		const scenarios = selected.map((id) => {
			const scenario = packet.scenarios.find((item) => item.reference.id === id);
			if (!scenario) deny("scenario_input_missing");
			return { reference: scenario.reference, basis: scenario.basis, economics: calculateCashFlows(scenario.input) };
		});
		if (
			scenarios.some(
				(item) =>
					item.economics.currency !== scenarios[0].economics.currency ||
					item.economics.periodUnit !== scenarios[0].economics.periodUnit ||
					item.basis.nominalReal !== scenarios[0].basis.nominalReal ||
					item.basis.startDate !== scenarios[0].basis.startDate,
			)
		)
			deny("scenario_basis_mismatch");
		return scenarios;
	}
	async compare(reference: unknown, ids: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return {
			taskRef: packet.taskRef,
			scenarios: this.selected(packet, ids),
			sourceArtifact: packet.sourceArtifact,
			sourceArtifacts: packet.sourceArtifacts,
			reviewStatus: "unreviewed",
			authorizesInvestment: false,
		};
	}
	async draft(reference: unknown, ids: unknown, revision: string, who: SourcePrincipal, signal?: AbortSignal) {
		economicRefSchema.shape.revision.parse(revision);
		const packet = await this.load(reference, who, "export", signal),
			scenarios = this.selected(packet, ids);
		const scenario = {
			version: "0.1.0",
			taskRef: packet.taskRef,
			scenarioIds: scenarios.map((item) => item.reference.id),
			scenarios,
			reviewStatus: "unreviewed",
			authorizesInvestment: false,
		};
		const evidenceIds = packet.sourceArtifacts.map((item) => item.evidence.id);
		const assumptions = scenarios.map((item) => ({
			id: `${item.reference.id}.basis`,
			statement: `Operator-declared financial scenario, not professional certification: ${reviewJson({ basis: item.basis, discountRate: item.economics.discountRate, periodUnit: item.economics.periodUnit })}`,
			evidenceIds,
		}));
		const findings = scenarios.flatMap((item) =>
			(["npv", "irr", "payback"] as const).map((name) => {
				const metric = item.economics[name];
				const unit =
					name === "npv"
						? item.economics.currency
						: name === "irr"
							? `fraction_per_${item.economics.periodUnit}`
							: item.economics.periodUnit;
				return metric.status === "available"
					? {
							id: `${item.reference.id}.${name}`,
							basis: "assumed",
							value: metric.value,
							unit,
							evidenceIds,
							assumptionIds: [`${item.reference.id}.basis`],
						}
					: {
							id: `${item.reference.id}.${name}`,
							basis: "unknown",
							value: null,
							unit,
							reason: metric.reason,
							evidenceIds: [],
							assumptionIds: [],
						};
			}),
		);
		const identity = createHash("sha256").update(reviewJson(packet.task.scope)).digest("hex");
		const work = validateContract({
			contractVersion: "0.1.0",
			kind: "work-product",
			scope: packet.task.scope,
			taskRevision: packet.task.revision,
			artifact: {
				id: `work.economics.${identity}`,
				revision,
				uri: `urn:shaleyeah:economics:${identity}:${encodeURIComponent(revision)}`,
			},
			status: "ready_for_review",
			inputs: packet.task.inputs,
			evidence: packet.sourceArtifacts.map((item) => item.evidence),
			findings,
			assumptions,
			uncertainty:
				"Operator-supplied forecasts and financial assumptions require human scenario review. No capital commitment or professional/fiscal certification.",
			blockers: [],
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		const result = { work, scenario, sourceArtifact: packet.sourceArtifact, sourceArtifacts: packet.sourceArtifacts };
		if (!(await this.options.contentGuard(reviewJson(result)))) deny("unsafe_content");
		if (signal?.aborted) deny("cancelled");
		return result;
	}
}
