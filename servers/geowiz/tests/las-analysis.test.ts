import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assessDataQuality, performFormationAnalysis, processMultiFormatWellLog } from "../src/index.js";

function fixture({ unit = "G/C3", parameters = "", values = ["2.65", "2.485", "-999.25"] } = {}) {
	return `~V\nVERS. 2.0\nWRAP. NO\n~W\nSTRT.FT 1000\nSTOP.FT 1001\nSTEP.FT 0.5\nNULL. -999.25\nWELL. CONTROL\n~C\nDEPT.FT : measured depth\nRHOB.${unit} : density\nNPHI.PU : neutron response\n~P\n${parameters}\n~A\n1000 ${values[0]} 0\n1000.5 ${values[1]} -999.25\n1001 ${values[2]} 12\n`;
}

async function input(text: string, run: (filePath: string) => Promise<void>) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "geowiz-analysis-"));
	try {
		const file = path.join(directory, "private.las");
		fs.writeFileSync(file, text);
		await run(file);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

const runtime = {
	publicProfile: () => ({ provider: "gemini", model: "fixture", revision: "r1" }),
	generate: async () => ({
		output: { note: "Review density assumptions before interpretation.", evidenceIds: ["curve:RHOB"] },
		metadata: { provider: "gemini", model: "fixture", revision: "r1" },
	}),
};

test("control: known density equation preserves zero, nulls, supplied assumptions and source units", async () => {
	await input(fixture({ parameters: "MDEN.G/C3 2.65 : matrix\nFDEN.G/C3 1 : fluid" }), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [{ filePath }, runtime]);
		const packet = result.inputReview;
		assert.equal(packet.version, "0.1.0");
		assert.match(packet.revision, /^sha256:[a-f0-9]{64}$/);
		assert.equal(packet.derived.densityPorosity.unit, "fraction");
		assert.ok(Math.abs(packet.derived.densityPorosity.statistics.mean - 0.05) < 1e-12);
		assert.equal(packet.derived.densityPorosity.statistics.min, 0);
		assert.equal(packet.derived.densityPorosity.validPoints, 2);
		assert.equal(packet.derived.densityPorosity.nullPoints, 1);
		assert.equal(packet.assumptions.length, 2);
		assert.equal(packet.review.status, "unreviewed");
		assert.equal(result.porosity, null, "apparent density porosity is not calibrated formation porosity");
		assert.equal(result.canonicalOutput, undefined, "unqualified values cannot replace a canonical formation section");
	});
});

test("boundary: GR, depth and requested formation labels cannot establish pay, TOC, maturity or confidence", async () => {
	await input(fixture().replace("NPHI.PU : neutron response", "GR.GAPI : gamma ray"), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [
			{ filePath, formations: ["Wolfcamp"], analysisType: "comprehensive" },
			runtime,
		]);
		for (const field of ["netPay", "porosity", "permeability", "toc", "maturity", "targets", "confidence"])
			assert.equal(result[field], null, field);
		assert.deepEqual(result.formations, []);
		assert.deepEqual(result.requestedFormations, ["Wolfcamp"]);
		assert.equal(result.inputReview.derived.densityPorosity, null);
		assert.equal(result.inputReview.qc.completeness, 2 / 3);
		assert.ok(result.inputReview.unknowns.some((entry: { field: string }) => entry.field === "netPay"));
	});
});

test("edge: kilogram units and explicit operator assumptions yield the same apparent porosity", async () => {
	await input(fixture({ unit: "K/M3", values: ["2650", "2485", "-999.25"] }), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [
			{
				filePath,
				densityAssumptions: { matrixDensity: 2650, fluidDensity: 1000, unit: "kg/m3", basis: "operator scenario" },
			},
			runtime,
		]);
		assert.ok(Math.abs(result.inputReview.derived.densityPorosity.statistics.mean - 0.05) < 1e-12);
		assert.equal(result.inputReview.assumptions[0].basis, "operator scenario");
	});
});

test("edge: null-only curves have unknown statistics; impossible assumptions never get clamped", async () => {
	await input(fixture({ values: ["-999.25", "-999.25", "-999.25"] }), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [{ filePath }, runtime]);
		const density = result.inputReview.observations.find((entry: { curve: string }) => entry.curve === "RHOB");
		assert.equal(density.statistics, null);
		assert.equal(density.validPoints, 0);
	});
	await input(fixture({ parameters: "MDEN.G/C3 1 : matrix\nFDEN.G/C3 1 : fluid" }), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [{ filePath }, runtime]);
		assert.equal(result.inputReview.derived.densityPorosity, null);
		assert.ok(
			result.inputReview.qc.warnings.some((entry: { code: string }) => entry.code === "invalid_density_assumptions"),
		);
	});
});

test("edge: absent runtime and model outage keep deterministic evidence and cannot invent interpretation", async () => {
	await input(fixture(), async (filePath) => {
		const absent = await performFormationAnalysis({ filePath });
		assert.equal(absent.synthesis.status, "not_configured");
		let calls = 0;
		const failed = await Reflect.apply(performFormationAnalysis, undefined, [
			{ filePath },
			{
				...runtime,
				generate: async () => {
					calls++;
					throw new Error("PRIVATE-VENDOR-RESPONSE");
				},
			},
		]);
		assert.equal(failed.synthesis.status, "unavailable");
		assert.equal(failed.status, "partial");
		assert.equal(failed.inputReview.input.rows, 3);
		assert.equal(calls, 1);
		assert.equal(failed.toc, null);
		assert.ok(!JSON.stringify(failed).includes("PRIVATE-VENDOR-RESPONSE"));
	});
});

test("boundary: fabricated model fields or unknown citations cannot populate measured output", async () => {
	await input(fixture(), async (filePath) => {
		for (const output of [
			{ toc: 8, recommendation: "Drill" },
			{ note: "Unproven", evidenceIds: ["not-a-fact"] },
		]) {
			const result = await Reflect.apply(performFormationAnalysis, undefined, [
				{ filePath },
				{
					...runtime,
					generate: async () => ({ output, metadata: runtime.publicProfile() }),
				},
			]);
			assert.equal(result.synthesis.status, "invalid_output");
			assert.equal(result.toc, null);
		}
	});
});

test("declared reviewer confidence zero stays zero and is separate from unmeasured confidence", async () => {
	await input(fixture(), async (filePath) => {
		const result = await Reflect.apply(performFormationAnalysis, undefined, [
			{
				filePath,
				reviewConfidence: { value: 0, basis: "operator assessment, not calibrated" },
			},
			runtime,
		]);
		assert.equal(result.confidence, null);
		assert.equal(result.inputReview.review.declaredConfidence.value, 0);
	});
});

test("all reference tools inspect the same approved bytes; accuracy stays unknown", async () => {
	await input(fixture(), async (filePath) => {
		const quality = Reflect.apply(assessDataQuality, undefined, [
			{ filePath, dataType: "las", thresholds: { completeness: 0.8, accuracy: 0.85 } },
		]);
		const logs = await processMultiFormatWellLog({ filePath, format: "las" });
		assert.equal(quality.metrics.completeness, 2 / 3);
		assert.equal(quality.metrics.accuracy, null);
		assert.equal(quality.passesThresholds, false);
		assert.equal(logs.inputReview.qc.completeness, quality.metrics.completeness);
		assert.deepEqual(logs.geologicalInsights.formations, []);
		assert.ok(!JSON.stringify(logs).includes("Proceed with development"));
	});
});

test("boundary: unsupported density units and out-of-range calculations remain visible", async () => {
	await input(
		fixture({ unit: "UNKNOWN", parameters: "MDEN.G/C3 2.65 : matrix\nFDEN.G/C3 1 : fluid" }),
		async (filePath) => {
			const result = await performFormationAnalysis({ filePath });
			assert.equal(result.inputReview.derived.densityPorosity, null);
			assert.ok(result.inputReview.qc.warnings.some((entry) => entry.code === "unsupported_density_unit"));
		},
	);
	await input(
		fixture({ values: ["3", "0.5", "-999.25"], parameters: "MDEN.G/C3 2.65 : matrix\nFDEN.G/C3 1 : fluid" }),
		async (filePath) => {
			const result = await performFormationAnalysis({ filePath });
			const calculation = result.inputReview.derived.densityPorosity;
			assert.equal(calculation?.rangeViolations, 2);
			assert.ok((calculation?.statistics?.min ?? 0) < 0);
			assert.ok((calculation?.statistics?.max ?? 0) > 1);
		},
	);
});

test("cancelled analysis stops before reading or calling a provider", async () => {
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(performFormationAnalysis({ filePath: "does-not-exist.las" }, undefined, controller.signal), {
		code: "cancelled",
	});
});

test("conflicting declared fluid densities require an explicit choice; they are not silently preferred", async () => {
	await input(
		fixture({ parameters: "MDEN.G/C3 2.65 : matrix\nFDEN.G/C3 1 : fluid\nFD.K/M3 1200 : conflicting fluid" }),
		async (filePath) => {
			const result = await performFormationAnalysis({ filePath });
			assert.equal(result.inputReview.derived.densityPorosity, null);
			assert.ok(result.inputReview.qc.warnings.some((entry) => entry.code === "conflicting_density_assumptions"));
			assert.equal(result.inputReview.input.densityParameters.length, 3);
		},
	);
});

test("invalid numeric parameter notation is unknown; overflow is a calculation failure rather than an input null", async () => {
	await input(fixture({ parameters: "MDEN.G/C3 0x10 : matrix\nFDEN.G/C3 1 : fluid" }), async (filePath) => {
		const result = await performFormationAnalysis({ filePath });
		assert.equal(result.inputReview.derived.densityPorosity, null);
	});
	await input(
		fixture({
			parameters: "MDEN.G/C3 1.000000000001 : matrix\nFDEN.G/C3 1 : fluid",
			values: ["1e308", "1", "-999.25"],
		}),
		async (filePath) => {
			const result = await performFormationAnalysis({ filePath });
			assert.equal(result.inputReview.derived.densityPorosity?.invalidCalculationPoints, 1);
			assert.equal(result.inputReview.derived.densityPorosity?.nullPoints, 1);
			assert.ok(result.inputReview.qc.warnings.some((entry) => entry.code === "nonfinite_density_calculation"));
		},
	);
});
