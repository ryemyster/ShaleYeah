import { z } from "zod";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9_.:/-]+$/);
const label = z
	.string()
	.min(1)
	.max(256)
	.refine((value) => value.trim().length > 0);
const frequency = z.enum(["daily", "monthly"]);
const unit = z.enum(["USD/bbl", "USD/MMBtu", "USD/Mcf"]);
const period = z.string().min(7).max(10);
const sourceUri = z
	.string()
	.min(1)
	.max(2048)
	.refine((value) => {
		if (/^urn:[A-Za-z0-9_.:/-]+$/.test(value)) return true;
		try {
			const parsed = new URL(value);
			return (
				["https:", "http:"].includes(parsed.protocol) &&
				!parsed.username &&
				!parsed.password &&
				!parsed.search &&
				!parsed.hash
			);
		} catch {
			return false;
		}
	});
export const marketRefSchema = z.object({ id, revision: id }).strict();
export const marketMandateSchema = z
	.object({
		version: z.literal("0.1.0"),
		commodity: z.enum(["oil", "gas"]),
		region: label,
		asOf: z.iso.datetime(),
		frequency,
		requiredPeriods: z.array(period).min(1).max(4096),
		benchmarkSeriesId: id,
		realizedSeriesId: id,
		targetUnit: z.enum(["USD/bbl", "USD/MMBtu"]),
		maxObservationAgeSeconds: z.number().int().min(1).max(31536000),
		maxConversionAgeSeconds: z.number().int().min(1).max(31536000),
		requiredScenarioIds: z.array(id).min(1).max(32),
	})
	.strict();
const heatContentSchema = z
	.object({
		value: z.number().finite().positive(),
		unit: z.literal("MMBtu/Mcf"),
		location: label,
		asOf: z.iso.datetime(),
		validFrom: z.iso.date(),
		validThrough: z.iso.date(),
		sourceUri,
	})
	.strict();
export const marketSeriesSchema = z
	.object({
		version: z.literal("0.1.0"),
		series: z
			.array(
				z
					.object({
						id,
						commodity: z.enum(["oil", "gas"]),
						location: label,
						basis: z.enum(["spot-benchmark", "realized", "forward"]),
						unit,
						frequency,
						retrievedAt: z.iso.datetime(),
						vintage: z.iso.datetime().nullable(),
						sourceUri,
						heatContent: heatContentSchema.nullable(),
						observations: z.array(z.object({ period, value: z.number().finite() }).strict()).max(4096),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();
export const marketAssumptionsSchema = z
	.object({
		version: z.literal("0.1.0"),
		asOf: z.iso.datetime(),
		scenarios: z
			.array(
				z
					.object({
						id,
						period,
						commodity: z.enum(["oil", "gas"]),
						region: label,
						unit,
						benchmarkPrice: z.number().finite(),
						basisDifferential: z.number().finite(),
						rationale: z.string().min(1).max(2048),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();
export const marketProposalSchema = z
	.object({
		version: z.literal("0.1.0"),
		title: z.string().min(1).max(512),
		summary: z.string().min(1).max(8000),
		evidenceSeriesIds: z.array(id).min(1).max(32),
		scenarioIds: z.array(id).min(1).max(32),
		limitations: z.array(z.string().min(1).max(2048)).max(32),
	})
	.strict();
const inputSchema = z
	.object({
		mandate: marketMandateSchema,
		series: marketSeriesSchema,
		assumptions: marketAssumptionsSchema,
		proposal: marketProposalSchema,
	})
	.strict();
export type MarketScenarioInput = z.infer<typeof inputSchema>;
type Series = z.infer<typeof marketSeriesSchema>["series"][number];
export class MarketScenarioError extends Error {
	constructor(public readonly code: string) {
		super(`Market scenario unavailable: ${code}`);
		this.name = "MarketScenarioError";
	}
}
function unique(values: string[], code: string) {
	if (new Set(values).size !== values.length) throw new MarketScenarioError(code);
}
function instant(value: string, kind: "daily" | "monthly") {
	if (kind === "daily") {
		if (!z.iso.date().safeParse(value).success) throw new MarketScenarioError("invalid_period");
		return Date.parse(`${value}T00:00:00.000Z`);
	}
	if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)) throw new MarketScenarioError("invalid_period");
	const start = new Date(`${value}-01T00:00:00.000Z`);
	start.setUTCMonth(start.getUTCMonth() + 1);
	return start.getTime() - 1;
}
const location = (value: string) => value.trim().normalize("NFKC").toLowerCase();
export function parseMarketScenarioInputs(value: unknown): MarketScenarioInput {
	let parsed: MarketScenarioInput;
	try {
		parsed = inputSchema.parse(value);
	} catch {
		throw new MarketScenarioError("invalid_input");
	}
	const { mandate, series, assumptions, proposal } = parsed;
	unique(mandate.requiredPeriods, "ambiguous_period");
	unique(mandate.requiredScenarioIds, "ambiguous_scenario");
	unique(
		series.series.map((item) => item.id),
		"ambiguous_series",
	);
	unique(
		assumptions.scenarios.map((item) => item.id),
		"ambiguous_scenario",
	);
	unique(proposal.evidenceSeriesIds, "ambiguous_evidence");
	unique(proposal.scenarioIds, "ambiguous_scenario");
	for (const value of mandate.requiredPeriods) instant(value, mandate.frequency);
	if (
		mandate.benchmarkSeriesId === mandate.realizedSeriesId ||
		mandate.targetUnit !== (mandate.commodity === "gas" ? "USD/MMBtu" : "USD/bbl")
	)
		throw new MarketScenarioError("invalid_mandate");
	for (const item of series.series) {
		unique(
			item.observations.map((row) => row.period),
			"ambiguous_period",
		);
		for (const row of item.observations) instant(row.period, item.frequency);
		if (item.heatContent && item.heatContent.validFrom > item.heatContent.validThrough)
			throw new MarketScenarioError("invalid_conversion_period");
	}
	for (const scenario of assumptions.scenarios)
		instant(scenario.period, scenario.period.length === 7 ? "monthly" : "daily");
	const permitted = new Set([mandate.benchmarkSeriesId, mandate.realizedSeriesId]);
	if (
		proposal.evidenceSeriesIds.some((value) => !permitted.has(value)) ||
		proposal.scenarioIds.some((value) => !mandate.requiredScenarioIds.includes(value))
	)
		throw new MarketScenarioError("unsupported_proposal");
	return parsed;
}

/** Pure source arithmetic. Source access, task identity and human authority are enforced by the service boundary. */
export function buildMarketScenario(value: unknown) {
	const { mandate, series: bundle, assumptions, proposal } = parseMarketScenarioInputs(value);
	const asOf = Date.parse(mandate.asOf);
	const blockers = new Set<string>();
	const limitations = new Set(proposal.limitations);
	const benchmark = bundle.series.find((item) => item.id === mandate.benchmarkSeriesId);
	const realized = bundle.series.find((item) => item.id === mandate.realizedSeriesId);
	function eligible(item: Series | undefined, basis: "spot-benchmark" | "realized") {
		if (!item) {
			blockers.add("series_missing");
			return false;
		}
		let valid = true;
		const require = (condition: boolean, code: string) => {
			if (!condition) {
				valid = false;
				blockers.add(code);
			}
		};
		require(item.commodity === mandate.commodity, "commodity_mismatch");
		require(item.basis === basis, "price_basis_mismatch");
		require(item.frequency === mandate.frequency, "frequency_mismatch");
		if (basis === "realized") require(location(item.location) === location(mandate.region), "region_mismatch");
		require(item.unit === mandate.targetUnit ||
			(mandate.commodity === "gas" && item.unit === "USD/Mcf"), "unit_mismatch");
		if (item.vintage === null) {
			limitations.add(`Upstream publication vintage is unavailable for ${item.id}; retrieval time is separate.`);
			require(Date.parse(item.retrievedAt) <= asOf, "vintage_unavailable");
		} else {
			require(Date.parse(item.vintage) <= asOf &&
				Date.parse(item.vintage) <= Date.parse(item.retrievedAt), "vintage_unavailable");
		}
		const observedBy = Math.min(
			asOf,
			Date.parse(item.retrievedAt),
			item.vintage === null ? Infinity : Date.parse(item.vintage),
		);
		require(item.observations.every((row) => instant(row.period, item.frequency) <= observedBy), "future_observation");
		return valid;
	}
	const benchmarkEligible = eligible(benchmark, "spot-benchmark");
	const realizedEligible = eligible(realized, "realized");
	function normalized(item: Series | undefined, period: string, valid: boolean) {
		const row = item?.observations.find((candidate) => candidate.period === period);
		if (!item || !row || !valid) return { native: row?.value ?? null, value: null };
		const observed = instant(period, item.frequency);
		if (asOf - observed > mandate.maxObservationAgeSeconds * 1000) {
			blockers.add("observation_stale");
			return { native: row.value, value: null };
		}
		let result = row.value;
		if (item.unit !== mandate.targetUnit) {
			const heat = item.heatContent;
			const conversionAge = heat ? asOf - Date.parse(heat.asOf) : Infinity;
			const date = new Date(observed).toISOString().slice(0, 10);
			if (
				!heat ||
				location(heat.location) !== location(item.location) ||
				conversionAge < 0 ||
				conversionAge > mandate.maxConversionAgeSeconds * 1000 ||
				date < heat.validFrom ||
				date > heat.validThrough
			) {
				blockers.add("conversion_unavailable");
				return { native: row.value, value: null };
			}
			result /= heat.value;
		}
		if (!Number.isFinite(result) || (row.value !== 0 && result === 0)) {
			blockers.add("numeric_unavailable");
			return { native: row.value, value: null };
		}
		return { native: row.value, value: result };
	}
	const rows = [...mandate.requiredPeriods].sort().map((period) => {
		const left = normalized(benchmark, period, benchmarkEligible);
		const right = normalized(realized, period, realizedEligible);
		let differential = left.value !== null && right.value !== null ? right.value - left.value : null;
		if (differential !== null && !Number.isFinite(differential)) {
			blockers.add("numeric_unavailable");
			differential = null;
		}
		return {
			period,
			benchmarkNativeValue: left.native,
			benchmarkValue: left.value,
			realizedNativeValue: right.native,
			realizedValue: right.value,
			differential,
		};
	});
	const missing = rows.filter((row) => row.differential === null).map((row) => row.period);
	if (missing.length) blockers.add("incomplete_period_coverage");
	let meanDifferential = missing.length
		? null
		: rows.reduce((total, row) => total + row.differential! / rows.length, 0);
	if (meanDifferential !== null && !Number.isFinite(meanDifferential)) {
		blockers.add("numeric_unavailable");
		meanDifferential = null;
	}
	if (Date.parse(assumptions.asOf) > asOf) blockers.add("assumption_vintage_unavailable");
	const scenarios = mandate.requiredScenarioIds.map((id) => {
		const scenario = assumptions.scenarios.find((item) => item.id === id);
		let price: number | null = null;
		let reason: string | null = null;
		if (!scenario || !proposal.scenarioIds.includes(id)) reason = "scenario_missing";
		else if (
			scenario.commodity !== mandate.commodity ||
			location(scenario.region) !== location(mandate.region) ||
			scenario.unit !== mandate.targetUnit ||
			Date.parse(assumptions.asOf) > asOf
		)
			reason = "scenario_basis_mismatch";
		else {
			price = scenario.benchmarkPrice + scenario.basisDifferential;
			if (!Number.isFinite(price)) {
				reason = "numeric_unavailable";
				price = null;
			}
		}
		if (reason) blockers.add(reason);
		return {
			id,
			period: scenario?.period ?? null,
			unit: mandate.targetUnit,
			basis: "operator-scenario" as const,
			benchmarkPriceAssumption: scenario?.benchmarkPrice ?? null,
			basisDifferentialAssumption: scenario?.basisDifferential ?? null,
			price,
			rationale: scenario?.rationale ?? null,
			reason,
		};
	});
	return {
		version: "0.1.0" as const,
		title: proposal.title,
		commodity: mandate.commodity,
		region: mandate.region,
		asOf: mandate.asOf,
		frequency: mandate.frequency,
		status: blockers.size ? ("blocked" as const) : ("ready-for-review" as const),
		reviewStatus: "unreviewed" as const,
		commercialAuthority: false as const,
		comparison: {
			benchmarkSeriesId: mandate.benchmarkSeriesId,
			realizedSeriesId: mandate.realizedSeriesId,
			unit: mandate.targetUnit,
			rows,
			coverage: { required: rows.length, aligned: rows.length - missing.length, missing },
			meanDifferential,
		},
		seriesMetadata: bundle.series.map(({ observations: _observations, ...metadata }) => structuredClone(metadata)),
		scenarios,
		proposal: structuredClone(proposal),
		limitations: [...limitations],
		blockers: [...blockers],
	};
}
export type MarketScenario = ReturnType<typeof buildMarketScenario>;
