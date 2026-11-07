export const forecastInput = {
	contractVersion: "0.1.0",
	product: "oil",
	rateUnit: "bbl/day",
	timeBasis: { unit: "year", daysPerUnit: 365 },
	horizon: 5,
	economicLimitRate: 0,
	forecastTimes: [0, 1, 5],
	initialRate: 100,
	nominalDecline: 0.1,
	bFactor: 1,
	inputRef: { id: "fixture.parameters", revision: "r1" },
	assumptionRefs: [{ id: "fixture.method", revision: "fixed-b-r1" }],
};

// Synthetic instantaneous daily rates at declared elapsed years, not monthly totals.
export const analogInput = {
	...Object.fromEntries(
		Object.entries(forecastInput).filter(([key]) => !["initialRate", "nominalDecline", "bFactor"].includes(key)),
	),
	formation: "Synthetic formation",
	inputRef: { id: "fixture.analog-cohort", revision: "r1" },
	basis: {
		kind: "analog-history",
		bFactor: 1,
		analogWells: [100, 200].map((qi, index) => ({
			wellRef: { id: `fixture.well-${index + 1}`, revision: "r1" },
			evidenceKind: "synthetic",
			observations: [0, 1, 2, 3].map((elapsedTime) => ({ elapsedTime, rate: qi / (1 + 0.1 * elapsedTime) })),
		})),
	},
};
