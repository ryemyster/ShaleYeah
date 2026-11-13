import { z } from "zod";
import {
	calculateForecast,
	expm1Ratio,
	type ForecastPoint,
	forecastContextSchema,
	log1pRatio,
	type NumericMetric,
} from "./arps.js";

const wellSchema = z
	.object({
		wellRef: z.object({ id: z.string().min(1).max(128), revision: z.string().min(1).max(128) }).strict(),
		evidenceKind: z.enum(["observed", "synthetic"]),
		observations: z
			.array(z.object({ elapsedTime: z.number().finite().min(0), rate: z.number().finite().min(0) }).strict())
			.max(1200),
	})
	.strict();

export const typeCurveInputSchema = forecastContextSchema
	.safeExtend({
		formation: z.string().min(1).max(128),
		basis: z.discriminatedUnion("kind", [
			z
				.object({
					kind: z.literal("analog-history"),
					bFactor: z.number().finite().min(0).max(2),
					analogWells: z.array(wellSchema).max(64),
				})
				.strict(),
			z
				.object({
					kind: z.literal("scenario"),
					initialRate: z.number().finite().min(0),
					nominalDecline: z.number().finite().min(0).max(1_000_000),
					bFactor: z.number().finite().min(0).max(2),
				})
				.strict(),
		]),
	})
	.superRefine((input, ctx) => {
		if (input.basis.kind !== "analog-history") return;
		const ids = new Set<string>();
		for (const [index, well] of input.basis.analogWells.entries()) {
			if (ids.has(well.wellRef.id))
				ctx.addIssue({ code: "custom", message: "duplicate_well_identity", path: ["basis", "analogWells", index] });
			ids.add(well.wellRef.id);
			if (
				well.observations.some(
					(point, i) =>
						point.elapsedTime > input.horizon ||
						(i === 0 ? point.elapsedTime !== 0 : point.elapsedTime <= well.observations[i - 1].elapsedTime),
				)
			)
				ctx.addIssue({
					code: "custom",
					message: "invalid_history_times",
					path: ["basis", "analogWells", index, "observations"],
				});
		}
	});

type Fit = {
	initialRate: number;
	nominalDecline: number;
	bFactor: number;
	observationCount: number;
	rmseRate: number;
	rSquared: NumericMetric;
};
type WellResult = {
	wellRef: { id: string; revision: string };
	evidenceKind: "observed" | "synthetic";
	status: "available" | "unavailable";
	fit?: Fit;
	reason?: string;
	cumulativeProduction: NumericMetric;
	interval: ReturnType<typeof calculateForecast>["interval"];
};

function fitFixedB(observations: z.infer<typeof wellSchema>["observations"], b: number): Fit | string {
	if (observations.length < 3) return "insufficient_history";
	if (observations.some((point) => point.rate <= 0)) return "nonpositive_history_rate";
	const referenceRate = Math.max(...observations.map((point) => point.rate));
	const span = observations.at(-1)!.elapsedTime;
	const xs = observations.map((point) => point.elapsedTime / span);
	const ys = observations.map((point) => {
		const logRatio = Math.log(referenceRate) - Math.log(point.rate);
		return logRatio * expm1Ratio(b * logRatio);
	});
	if (ys.some((value) => !Number.isFinite(value))) return "numeric_range";
	const n = xs.length,
		meanX = xs.reduce((a, x) => a + x / n, 0),
		meanY = ys.reduce((a, y) => a + y / n, 0);
	let xx = 0,
		xy = 0;
	for (let i = 0; i < n; i++) {
		xx += (xs[i] - meanX) ** 2;
		xy += (xs[i] - meanX) * (ys[i] - meanY);
	}
	const slope = xy / xx,
		intercept = meanY - slope * meanX,
		denominator = 1 + b * intercept;
	const initialRate = Math.exp(Math.log(referenceRate) - intercept * log1pRatio(b * intercept));
	const nominalDecline = slope / (denominator * span);
	if (!(denominator > 0) || !Number.isFinite(initialRate) || initialRate <= 0 || !Number.isFinite(nominalDecline))
		return "numeric_range";
	if (nominalDecline < 0 || nominalDecline > 1_000_000) return "outside_decline_model";
	const scaled = observations.map((point) => point.rate / referenceRate);
	const predictions = observations.map((point) =>
		Math.exp(
			Math.log(initialRate) -
				Math.log(referenceRate) -
				nominalDecline * point.elapsedTime * log1pRatio(b * nominalDecline * point.elapsedTime),
		),
	);
	const meanRate = scaled.reduce((sum, rate) => sum + rate / n, 0);
	const sse = predictions.reduce((sum, rate, i) => sum + (rate - scaled[i]) ** 2, 0);
	const sst = scaled.reduce((sum, rate) => sum + (rate - meanRate) ** 2, 0);
	const rmseRate = referenceRate * Math.sqrt(sse / n);
	const rSquared: NumericMetric =
		sst === 0
			? { status: "unavailable", value: null, reason: "constant_series" }
			: { status: "available", value: 1 - sse / sst };
	if (!Number.isFinite(rmseRate) || (rSquared.value !== null && !Number.isFinite(rSquared.value)))
		return "numeric_range";
	return { initialRate, nominalDecline, bFactor: b, observationCount: n, rmseRate, rSquared };
}

function mean(values: number[]) {
	return values.reduce((average, value, i) => average + (value - average) / (i + 1), 0);
}

export function generateTypeCurve(input: unknown) {
	const parsed = typeCurveInputSchema.parse(input);
	const { formation, basis, ...context } = parsed;
	const common = {
		...context,
		formation,
		basis: basis.kind,
		volumeUnit: context.product === "oil" ? ("bbl" as const) : ("Mcf" as const),
		volumeBasis: "modeled-from-declared-time-zero" as const,
		method: {
			id: "equal-well-mean-fixed-b-transformed-regression-v1",
			bFactor: basis.bFactor,
			fitLoss: "unweighted-transformed-rate-least-squares",
			cohortWeight: "equal-well",
			bSource: "declared-assumption",
		},
		uncertainty: { status: "unavailable" as const, reason: "no_uncertainty_model" },
		reviewStatus: "unreviewed" as const,
		professionalAcceptance: false as const,
		authorizesReserves: false as const,
	};
	if (basis.kind === "scenario") {
		const { kind: _kind, ...parameters } = basis;
		const forecast = calculateForecast({ ...context, ...parameters });
		return {
			...common,
			method: {
				...common.method,
				id: "explicit-arps-scenario-v1",
				fitLoss: "not-fitted",
				cohortWeight: "not-applicable",
			},
			evidenceKind: "assumptions_only",
			status: forecast.status,
			cumulativeProduction: forecast.cumulativeProduction,
			forecast: forecast.forecast,
			scenario: { ...forecast.model, interval: forecast.interval },
			wells: [] as WellResult[],
		};
	}
	const wells: WellResult[] = [],
		forecasts: ReturnType<typeof calculateForecast>[] = [];
	for (const well of basis.analogWells) {
		const fit = fitFixedB(well.observations, basis.bFactor);
		const identity = { wellRef: well.wellRef, evidenceKind: well.evidenceKind };
		if (typeof fit === "string") {
			wells.push({
				...identity,
				status: "unavailable",
				reason: fit,
				cumulativeProduction: { status: "unavailable", value: null, reason: fit },
				interval: null,
			});
			continue;
		}
		const forecast = calculateForecast({
			...context,
			initialRate: fit.initialRate,
			nominalDecline: fit.nominalDecline,
			bFactor: fit.bFactor,
		});
		if (forecast.status !== "available") {
			wells.push({
				...identity,
				status: "unavailable",
				fit,
				reason: "numeric_range",
				cumulativeProduction: forecast.cumulativeProduction,
				interval: forecast.interval,
			});
			continue;
		}
		wells.push({
			...identity,
			status: "available",
			fit,
			cumulativeProduction: forecast.cumulativeProduction,
			interval: forecast.interval,
		});
		forecasts.push(forecast);
	}
	const evidenceKind =
		basis.analogWells.length === 0
			? "no_evidence"
			: basis.analogWells.some((well) => well.evidenceKind === "synthetic")
				? "contains_synthetic"
				: "caller_supplied_observations";
	if (wells.length === 0 || forecasts.length !== wells.length) {
		return {
			...common,
			evidenceKind,
			status: "unavailable" as const,
			cumulativeProduction: {
				status: "unavailable" as const,
				value: null,
				reason: wells.length ? "unusable_analog_cohort" : "no_analog_history",
			},
			forecast: [] as ForecastPoint[],
			wells,
		};
	}
	return {
		...common,
		evidenceKind,
		status: "available" as const,
		cumulativeProduction: {
			status: "available" as const,
			value: mean(forecasts.map((forecast) => forecast.cumulativeProduction.value!)),
		},
		forecast: context.forecastTimes.map((time, i) => ({
			time,
			rate: mean(forecasts.map((forecast) => forecast.forecast[i].rate)),
			cumulativeProduction: mean(forecasts.map((forecast) => forecast.forecast[i].cumulativeProduction)),
		})),
		wells,
	};
}
