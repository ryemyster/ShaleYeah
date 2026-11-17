/** Actual synthetic backend records; expected arithmetic and decisions are authored independently. */
import { employeeFixture, who } from "./employee.js";

async function capture(change?: (input: ReturnType<typeof employeeFixture>["input"]) => void) {
	const fixture = employeeFixture();
	change?.(fixture.input);
	for (const key of ["mandate", "series", "assumptions"] as const)
		fixture.texts.set(key, JSON.stringify(fixture.input[key]));
	fixture.bind();
	const draft = await fixture.service.draft(fixture.ref(), fixture.proposal, "r1", who);
	return {
		work: draft.work,
		market: draft.market,
		sourceArtifacts: draft.sourceArtifacts,
		mandate: fixture.input.mandate,
		series: fixture.input.series,
		assumptions: fixture.input.assumptions,
	};
}
const variants = {
	"zero-negative": await capture((input) => {
		input.series.series[0].observations[0].value = 0;
		input.series.series[0].observations[1].value = -1;
		input.series.series[1].observations[0].value = 0;
		input.series.series[1].observations[1].value = -1.05;
	}),
	monthly: await capture((input) => {
		input.mandate.frequency = "monthly";
		input.mandate.requiredPeriods = ["2026-09", "2026-10"];
		input.mandate.maxObservationAgeSeconds = 60 * 86400;
		for (const series of input.series.series) {
			series.frequency = "monthly";
			series.observations[0].period = "2026-09";
			series.observations[1].period = "2026-10";
			if (series.heatContent) series.heatContent.validFrom = "2026-09-01";
		}
	}),
	oil: await capture((input) => {
		Object.assign(input.mandate, {
			commodity: "oil",
			region: "Permian",
			targetUnit: "USD/bbl",
			benchmarkSeriesId: "cushing-wti",
			realizedSeriesId: "operator-permian",
		});
		Object.assign(input.series.series[0], {
			id: "cushing-wti",
			commodity: "oil",
			location: "Cushing, Oklahoma",
			unit: "USD/bbl",
			sourceUri: "https://www.eia.gov/dnav/pet/hist/rwtcd.htm",
		});
		Object.assign(input.series.series[1], {
			id: "operator-permian",
			commodity: "oil",
			location: "Permian",
			unit: "USD/bbl",
			heatContent: null,
			sourceUri: "urn:operator:permian-realized",
		});
		for (const [index, series] of input.series.series.entries())
			series.observations.forEach((row: { value: number }, period: number) => {
				row.value = [
					[60, 61],
					[58, 59.5],
				][index][period];
			});
		input.assumptions.scenarios.forEach(
			(
				scenario: {
					commodity: string;
					region: string;
					unit: string;
					benchmarkPrice: number;
					basisDifferential: number;
				},
				index: number,
			) => {
				Object.assign(scenario, {
					commodity: "oil",
					region: "Permian",
					unit: "USD/bbl",
					benchmarkPrice: [65, 55, 75][index],
					basisDifferential: [-2, -3, -1][index],
				});
			},
		);
		input.proposal.evidenceSeriesIds = ["cushing-wti", "operator-permian"];
		input.proposal.title = "Fictional Permian oil comparison and commercial scenarios";
		input.proposal.summary =
			"Compare supplied Cushing WTI and fictional operator realized observations. Future prices remain explicit operator assumptions for commercial review.";
	}),
	"missing-period": await capture((input) => {
		input.series.series[1].observations.pop();
	}),
	"missing-conversion": await capture((input) => {
		input.series.series[1].heatContent = null;
	}),
	"stale-observations": await capture((input) => {
		input.mandate.maxObservationAgeSeconds = 3600;
	}),
	"wrong-region": await capture((input) => {
		input.series.series[1].location = "Permian";
		input.series.series[1].heatContent.location = "Permian";
	}),
	"missing-scenario": await capture((input) => {
		input.assumptions.scenarios.pop();
	}),
};
process.stdout.write(`${JSON.stringify(process.argv.includes("--variants") ? variants : await capture(), null, 2)}\n`);
