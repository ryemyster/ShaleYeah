import { z } from "zod";

const reference = z.object({ id: z.string().min(1).max(128), revision: z.string().min(1).max(128) }).strict();
const nonnegative = z.number().finite().min(0);

/** Rates are instantaneous daily rates; elapsed times use the explicitly declared fixed time basis. */
export const forecastContextSchema = z
	.object({
		contractVersion: z.literal("0.1.0"),
		product: z.enum(["oil", "gas"]),
		rateUnit: z.enum(["bbl/day", "Mcf/day"]),
		timeBasis: z
			.object({ unit: z.enum(["day", "month", "year"]), daysPerUnit: z.number().finite().positive().max(366) })
			.strict(),
		horizon: z.number().finite().positive().max(1_000_000),
		economicLimitRate: nonnegative,
		forecastTimes: z.array(nonnegative).min(1).max(601),
		inputRef: reference,
		assumptionRefs: z.array(reference).min(1).max(64),
	})
	.strict()
	.superRefine((value, ctx) => {
		if ((value.product === "oil") !== (value.rateUnit === "bbl/day"))
			ctx.addIssue({ code: "custom", message: "product_rate_unit_mismatch", path: ["rateUnit"] });
		const { unit, daysPerUnit } = value.timeBasis;
		if (
			(unit === "day" && daysPerUnit !== 1) ||
			(unit === "month" && (daysPerUnit < 28 || daysPerUnit > 31)) ||
			(unit === "year" && (daysPerUnit < 360 || daysPerUnit > 366))
		)
			ctx.addIssue({ code: "custom", message: "invalid_fixed_time_basis", path: ["timeBasis"] });
		if (value.forecastTimes.some((time, i) => time > value.horizon || (i > 0 && time <= value.forecastTimes[i - 1])))
			ctx.addIssue({ code: "custom", message: "invalid_forecast_times", path: ["forecastTimes"] });
	});

export const forecastInputSchema = forecastContextSchema.safeExtend({
	initialRate: nonnegative,
	nominalDecline: nonnegative.max(1_000_000),
	bFactor: nonnegative.max(2),
});

export type ForecastPoint = { time: number; rate: number; cumulativeProduction: number };
export type NumericMetric =
	| { status: "available"; value: number }
	| { status: "unavailable"; value: null; reason: string };

/** Continuous ratios also handle products that underflow to exact zero. */
export const log1pRatio = (value: number) => (value === 0 ? 1 : Math.log1p(value) / value);
export const expm1Ratio = (value: number) => (value === 0 ? 1 : Math.expm1(value) / value);

function rateAt(qi: number, decline: number, b: number, time: number) {
	if (time === 0 || decline === 0) return qi;
	const x = decline * time;
	// Combine the large rate and small decay before exponentiating, preserving representable tails.
	return Math.min(qi, Math.exp(Math.log(qi) - x * log1pRatio(b * x)));
}

function integratedDays(decline: number, b: number, time: number, daysPerUnit: number) {
	const x = decline * time;
	if (x === 0) return time * daysPerUnit;
	const g = x * log1pRatio(b * x);
	const exponent = (b - 1) * g;
	// expm1/log1p preserve the continuous limits near b=0, b=1 and D*t=0.
	const relative = expm1Ratio(exponent);
	return time * (g / x) * relative * daysPerUnit;
}

export function calculateForecast(input: unknown) {
	const parsed = forecastInputSchema.parse(input);
	const {
		initialRate: qi,
		nominalDecline: decline,
		bFactor: b,
		horizon,
		economicLimitRate: cutoff,
		timeBasis,
	} = parsed;
	const common = {
		contractVersion: parsed.contractVersion,
		product: parsed.product,
		rateUnit: parsed.rateUnit,
		timeBasis,
		inputRef: parsed.inputRef,
		assumptionRefs: parsed.assumptionRefs,
		model: {
			name: "arps" as const,
			initialRate: qi,
			nominalDecline: decline,
			bFactor: b,
			declineConvention: "nominal-per-declared-time" as const,
		},
		requestedHorizon: horizon,
		economicLimitRate: cutoff,
		volumeUnit: parsed.product === "oil" ? ("bbl" as const) : ("Mcf" as const),
		volumeBasis: "modeled-from-declared-time-zero" as const,
		uncertainty: { status: "unavailable" as const, reason: "no_uncertainty_model" },
		reviewStatus: "unreviewed" as const,
		professionalAcceptance: false as const,
		authorizesReserves: false as const,
	};
	let end = horizon;
	let reason: "horizon" | "economic_limit" | "initial_rate_at_or_below_limit" = "horizon";
	if (qi <= cutoff) {
		end = 0;
		reason = "initial_rate_at_or_below_limit";
	} else if (cutoff > 0 && decline > 0) {
		const ratio = (qi - cutoff) / cutoff;
		const logRatio = Number.isFinite(ratio) ? Math.log1p(ratio) : Math.log(qi) - Math.log(cutoff);
		const stop = (logRatio * expm1Ratio(b * logRatio)) / decline;
		if (stop < horizon) {
			end = stop;
			reason = "economic_limit";
		}
	}
	const volumeAt = (time: number) => qi * integratedDays(decline, b, Math.min(time, end), timeBasis.daysPerUnit);
	const volume = volumeAt(end);
	const forecast: ForecastPoint[] = parsed.forecastTimes.map((time) => ({
		time,
		rate: reason === "initial_rate_at_or_below_limit" || time > end ? 0 : rateAt(qi, decline, b, time),
		cumulativeProduction: volumeAt(time),
	}));
	if (
		!Number.isFinite(volume) ||
		(qi > 0 && end > 0 && volume === 0) ||
		forecast.some((point) => !Number.isFinite(point.rate) || !Number.isFinite(point.cumulativeProduction))
	) {
		return {
			...common,
			status: "unavailable" as const,
			interval: null,
			cumulativeProduction: { status: "unavailable" as const, value: null, reason: "numeric_range" },
			forecast: [] as ForecastPoint[],
		};
	}
	return {
		...common,
		status: "available" as const,
		interval: { start: 0, end, reason },
		cumulativeProduction: { status: "available" as const, value: volume },
		forecast,
	};
}
