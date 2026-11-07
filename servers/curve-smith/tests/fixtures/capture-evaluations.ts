/** Explicit fixture freeze, never run by the test suite. References are authored from known synthetic parameters, not fitted outputs. */
import { mkdir, writeFile } from "node:fs/promises";
import { forecastFixture, ref, who } from "./forecast.js";

const controls = [
	{ name: "harmonic", qi: 100, decline: 0.1, b: 1, days: 365, product: "oil", unit: "year", fitUntil: 2 },
	{ name: "exponential", qi: 100, decline: 0.1, b: 0, days: 365, product: "oil", unit: "year", fitUntil: 2 },
	{ name: "hyperbolic", qi: 120, decline: 0.2, b: 0.5, days: 365, product: "oil", unit: "year", fitUntil: 2 },
	{ name: "monthly-gas", qi: 60, decline: 0.1, b: 1, days: 30, product: "gas", unit: "month", fitUntil: 2 },
	{ name: "insufficient", qi: 100, decline: 0.1, b: 1, days: 365, product: "oil", unit: "year", fitUntil: 1 },
	{ name: "cutoff", qi: 100, decline: 0.1, b: 1, days: 365, product: "oil", unit: "year", fitUntil: 2, cutoff: 80 },
	{
		name: "initial-cutoff",
		qi: 100,
		decline: 0.1,
		b: 1,
		days: 365,
		product: "oil",
		unit: "year",
		fitUntil: 2,
		cutoff: 110,
	},
	{ name: "no-holdout", qi: 100, decline: 0.1, b: 1, days: 365, product: "oil", unit: "year", fitUntil: 4 },
] as const;
const observed: Record<string, unknown> = {},
	references: Record<string, unknown> = {};
for (const c of controls) {
	const f = forecastFixture();
	Object.assign(f.history, {
		product: c.product,
		rateUnit: c.product === "oil" ? "bbl/day" : "Mcf/day",
		timeBasis: { unit: c.unit, daysPerUnit: c.days },
	});
	const origin = c.unit === "month" ? "2025-10-03T00:00:00Z" : "2023-01-01T00:00:00Z";
	f.history.wells[0].origin = origin;
	f.history.wells[0].observations = [0, 1, 2, 3].map((t) => ({
		elapsedTime: t,
		observedAt: new Date(Date.parse(origin) + t * c.days * 86400000).toISOString(),
		rate: c.b === 0 ? c.qi * Math.exp(-c.decline * t) : c.qi / (1 + c.b * c.decline * t) ** (1 / c.b),
		operation: "producing",
	}));
	Object.assign(f.basis, { product: f.history.product, rateUnit: f.history.rateUnit, timeBasis: f.history.timeBasis });
	f.assumptions.forecasts = [
		{
			...f.assumptions.forecasts[0],
			bFactor: c.b,
			fitUntil: c.fitUntil,
			economicLimitRate: "cutoff" in c ? c.cutoff : 0,
		},
	];
	for (const [key, value] of [
		["history", f.history],
		["basis", f.basis],
		["assumptions", f.assumptions],
	] as const)
		f.texts.set(key, JSON.stringify(value));
	f.bind();
	const packet = await f.service.draft(ref, ["base"], "r1", who);
	observed[c.name] = {
		work: packet.work,
		forecast: packet.forecast,
		sourceArtifacts: packet.sourceArtifacts,
		evaluatedAt: "2026-01-02T12:00:00Z",
	};
	references[c.name] = {
		id: "base",
		revision: "r1",
		product: c.product,
		rateUnit: f.history.rateUnit,
		timeBasis: f.history.timeBasis,
		formation: f.history.formation,
		definition: f.assumptions.forecasts[0],
		wells: [
			{
				wellRef: f.history.wells[0].wellRef,
				initialRate: c.qi,
				nominalDecline: c.decline,
				origin,
				observations: f.history.wells[0].observations.map(({ elapsedTime, rate }) => ({ elapsedTime, rate })),
			},
		],
		expectedFitAvailable: c.fitUntil >= 2,
	};
}
const target = new URL("../../../../agents/reservoir-engineer/tests/eval/fixtures/", import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL("observed-forecasts.json", target), `${JSON.stringify(observed, null, 2)}\n`);
await writeFile(
	new URL("forecast-oracles.json", target),
	`${JSON.stringify(
		{
			version: "0.1.0",
			labelAuthority: "provisional-codex-research-review",
			reviewedAt: "2026-11-06T00:00:00Z",
			professionalAcceptance: false,
			sources: [
				"https://equinor.github.io/decline-curve-analysis/dca_report.html",
				"https://www.eia.gov/analysis/drilling/curve_analysis/2020/",
			],
			rationale:
				"Synthetic point-rate histories use independently declared qi, nominal D and fixed b. The installed verifier independently evaluates the rate equation, bisects cutoff and integrates with Simpson quadrature. This does not implement EIA's monthly-total preprocessing or certify reserves, field accuracy or source rights.",
			references,
		},
		null,
		2,
	)}\n`,
);
