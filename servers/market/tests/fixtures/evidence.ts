/** Synthetic source packets; these are not observations about actual companies or current prices. */
export const NOW = "2026-11-13T12:00:00.000Z";
export const observedAt = "2026-11-12";
export const bundle = {
	version: "0.1.0",
	rights: "operator-attested-permitted",
	records: [
		{
			id: "obs.acme.production",
			subject: { kind: "competitor", name: "Acme", market: "Permian" },
			metric: "production",
			value: 0,
			unit: "boe/day",
			basis: "observed",
			observedAt,
			retrievedAt: "2026-11-13T10:00:00.000Z",
			source: { id: "source.acme.report", uri: "urn:fixture:acme-report" },
			review: null,
		},
		{
			id: "obs.acme.costs",
			subject: { kind: "competitor", name: "Acme", market: "Permian" },
			metric: "costs",
			value: 12.25,
			unit: "USD/boe",
			basis: "observed",
			observedAt,
			retrievedAt: "2026-11-13T10:00:00.000Z",
			source: { id: "source.acme.report", uri: "urn:fixture:acme-report" },
			review: null,
		},
		{
			id: "scenario.beta.production",
			subject: { kind: "competitor", name: "Beta", market: "Permian" },
			metric: "production",
			value: 500,
			unit: "boe/day",
			basis: "assumed",
			observedAt: null,
			retrievedAt: "2026-11-13T10:00:00.000Z",
			source: null,
			review: {
				reviewerId: "fixture.operator",
				reviewedAt: "2026-11-13T09:00:00.000Z",
				reason: "Reviewed synthetic scenario assumption, not a production observation",
			},
		},
	],
};

export function eiaRow(series: "RWTC" | "RNGWHHD", value = series === "RWTC" ? "82.50" : "3.75", period = observedAt) {
	return { response: { data: [{ series, value, period, units: series === "RWTC" ? "$/BBL" : "$/MMBTU" }] } };
}

export const competitorQuery = {
	competitors: ["Acme", "Beta"],
	market: "Permian",
	metrics: ["market_share", "production", "costs"],
};

export function narrative(name = "Acme", evidenceIds = ["obs.acme.production", "obs.acme.costs"]) {
	return JSON.stringify({
		narratives: [{ name, summary: "Inspect the supplied observations and their limits.", evidenceIds }],
		limitations: ["Unreviewed advisory interpretation"],
	});
}
