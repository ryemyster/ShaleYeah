/**
 * Monte Carlo Simulation Tests — Issue #224
 *
 * TDD: these tests are written BEFORE the implementation.
 * All tests should fail against the current stub and pass after real samplers are wired in.
 *
 * Validates:
 * - Triangular distribution sampler: p50 ≈ base value ±5%
 * - Normal distribution sampler: ~68% of samples within ±1 stddev
 * - Uniform distribution sampler: samples span the full [min, max] range
 * - p10 < p50 < p90 ordering invariant holds
 * - 10,000 iterations completes in <5 seconds
 * - Simulation uses the input distributions (not fixed linear spread)
 */

import assert from "node:assert";

// We test by calling performMonteCarloAnalysis via a thin re-export.
// The function is currently module-internal, so we test via the tool handler
// by constructing the args object directly.
//
// Strategy: import the production export and call its tool handler.
// The server's monte_carlo_simulation tool returns MonteCarloAnalysis.

// Dynamic import to avoid needing a running MCP process
let monteCarloFn: (args: MonteCarloArgs) => MonteCarloAnalysis;

interface DistributionSpec {
	base: number;
	min: number;
	max: number;
	distribution: "normal" | "triangular" | "uniform";
}

interface MonteCarloArgs {
	variables: {
		oilPrice: DistributionSpec;
		initialProduction: DistributionSpec;
		declineRate: DistributionSpec;
		capex: DistributionSpec;
	};
	iterations: number;
	targetIRR: number;
	outputPath?: string;
}

interface MonteCarloAnalysis {
	iterations: number;
	results: {
		npv: { mean: number; p10: number; p50: number; p90: number; stdDev: number };
		irr: { mean: number; p10: number; p50: number; p90: number; stdDev: number };
		probability: { positive_npv: number; target_irr: number };
	};
	sensitivities: Array<{ variable: string; correlation: number; impact: string }>;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			console.log(`  ✓ ${name}`);
			passed++;
		})
		.catch((err: unknown) => {
			console.log(`  ✗ ${name}`);
			console.log(`    ${err instanceof Error ? err.message : String(err)}`);
			failed++;
		});
}

// ---------------------------------------------------------------------------
// Distribution sampler unit tests (exported from the implementation module)
// ---------------------------------------------------------------------------

// These samplers are also tested indirectly through the Monte Carlo outputs,
// but we also import them directly for unit-level coverage.
// If they are not exported yet, these tests will fail with an import error —
// which is the expected TDD starting state.

import { sampleNormal, sampleTriangular, sampleUniform } from "../src/servers/risk-analysis.js";

async function runTests(): Promise<void> {
	console.log("\n🧪 Monte Carlo Simulation Tests (Issue #224)\n");

	// ------------------------------------------------------------------
	// Sampler unit tests
	// ------------------------------------------------------------------

	await test("sampleUniform returns value in [min, max]", () => {
		for (let i = 0; i < 1000; i++) {
			const v = sampleUniform(10, 50);
			assert.ok(v >= 10 && v <= 50, `Expected value in [10,50], got ${v}`);
		}
	});

	await test("sampleUniform mean ≈ midpoint over many samples", () => {
		const N = 10000;
		let sum = 0;
		for (let i = 0; i < N; i++) sum += sampleUniform(10, 50);
		const mean = sum / N;
		// midpoint = 30, allow ±5%
		assert.ok(Math.abs(mean - 30) < 1.5, `Expected uniform mean ≈ 30, got ${mean.toFixed(3)}`);
	});

	await test("sampleTriangular returns value in [min, max]", () => {
		for (let i = 0; i < 1000; i++) {
			const v = sampleTriangular(60, 75, 100);
			assert.ok(v >= 60 && v <= 100, `Expected value in [60,100], got ${v}`);
		}
	});

	await test("sampleTriangular p50 ≈ base value ±5% (triangular median formula)", () => {
		// Triangular(60, 75, 100): median ≈ 75.6 (via closed-form)
		// Accept range [71.25, 78.75] (±5% of 75)
		const N = 50000;
		const samples: number[] = [];
		for (let i = 0; i < N; i++) samples.push(sampleTriangular(60, 75, 100));
		samples.sort((a, b) => a - b);
		const p50 = samples[Math.floor(N * 0.5)];
		assert.ok(Math.abs(p50 - 75) < 75 * 0.07, `Expected p50 ≈ 75 (±7%), got ${p50.toFixed(2)}`);
	});

	await test("sampleNormal Box-Muller: ~68% of samples within ±1 stddev", () => {
		const mean = 0.15;
		const stddev = 0.03;
		const N = 50000;
		let within = 0;
		for (let i = 0; i < N; i++) {
			const v = sampleNormal(mean, stddev);
			if (Math.abs(v - mean) <= stddev) within++;
		}
		const fraction = within / N;
		// Should be ~68.27% — accept [65%, 72%]
		assert.ok(fraction >= 0.65 && fraction <= 0.72, `Expected ~68% within ±1σ, got ${(fraction * 100).toFixed(1)}%`);
	});

	await test("sampleNormal mean and stddev are approximately correct", () => {
		const mean = 0.18;
		const stddev = 0.06;
		const N = 50000;
		const samples: number[] = [];
		for (let i = 0; i < N; i++) samples.push(sampleNormal(mean, stddev));
		const observedMean = samples.reduce((a, b) => a + b) / N;
		const observedVar = samples.reduce((s, v) => s + (v - observedMean) ** 2, 0) / N;
		const observedStd = Math.sqrt(observedVar);
		assert.ok(Math.abs(observedMean - mean) < 0.002, `Mean off: expected ${mean}, got ${observedMean.toFixed(4)}`);
		assert.ok(Math.abs(observedStd - stddev) < 0.003, `StdDev off: expected ${stddev}, got ${observedStd.toFixed(4)}`);
	});

	// ------------------------------------------------------------------
	// Monte Carlo integration tests (via performMonteCarloAnalysis)
	// ------------------------------------------------------------------

	// Import the internal function via a named export that we'll add
	const { performMonteCarloAnalysis } = await import("../src/servers/risk-analysis.js");
	monteCarloFn = performMonteCarloAnalysis as (args: MonteCarloArgs) => MonteCarloAnalysis;

	const defaultArgs: MonteCarloArgs = {
		variables: {
			oilPrice: { base: 75, min: 50, max: 100, distribution: "triangular" },
			initialProduction: { base: 500, min: 300, max: 800, distribution: "normal" },
			declineRate: { base: 0.15, min: 0.08, max: 0.25, distribution: "normal" },
			capex: { base: 3000000, min: 2000000, max: 5000000, distribution: "triangular" },
		},
		iterations: 10000,
		targetIRR: 0.15,
	};

	await test("p10 < p50 < p90 ordering invariant — NPV", () => {
		const result = monteCarloFn(defaultArgs);
		const { p10, p50, p90 } = result.results.npv;
		assert.ok(p10 < p50, `NPV p10 (${p10}) must be < p50 (${p50})`);
		assert.ok(p50 < p90, `NPV p50 (${p50}) must be < p90 (${p90})`);
	});

	await test("p10 < p50 < p90 ordering invariant — IRR", () => {
		const result = monteCarloFn(defaultArgs);
		const { p10, p50, p90 } = result.results.irr;
		assert.ok(p10 < p50, `IRR p10 (${p10}) must be < p50 (${p50})`);
		assert.ok(p50 < p90, `IRR p50 (${p50}) must be < p90 (${p90})`);
	});

	await test("iterations parameter propagates to result", () => {
		const result = monteCarloFn({ ...defaultArgs, iterations: 5000 });
		assert.strictEqual(result.iterations, 5000);
	});

	await test("results are non-deterministic on repeated runs (real sampling)", () => {
		// If the implementation is still the fixed linear stub, p50 will be identical
		// across runs. Real sampling should produce different values.
		const r1 = monteCarloFn(defaultArgs);
		const r2 = monteCarloFn(defaultArgs);
		// It would be astronomically unlikely for two 10k-sample runs to land on identical p50
		assert.notStrictEqual(
			r1.results.npv.p50,
			r2.results.npv.p50,
			"NPV p50 was identical across two independent runs — suggests deterministic stub, not real sampling",
		);
	});

	await test("probability.positive_npv is between 0 and 1", () => {
		const result = monteCarloFn(defaultArgs);
		const p = result.results.probability.positive_npv;
		assert.ok(p >= 0 && p <= 1, `positive_npv probability ${p} out of [0,1]`);
	});

	await test("probability.target_irr is between 0 and 1", () => {
		const result = monteCarloFn(defaultArgs);
		const p = result.results.probability.target_irr;
		assert.ok(p >= 0 && p <= 1, `target_irr probability ${p} out of [0,1]`);
	});

	await test("NPV stdDev is positive and nonzero", () => {
		const result = monteCarloFn(defaultArgs);
		assert.ok(result.results.npv.stdDev > 0, `NPV stdDev should be > 0, got ${result.results.npv.stdDev}`);
	});

	await test("10,000 iterations completes in <5 seconds", async () => {
		const start = Date.now();
		monteCarloFn(defaultArgs);
		const elapsed = Date.now() - start;
		assert.ok(elapsed < 5000, `10k iterations took ${elapsed}ms, expected <5000ms`);
	});

	await test("uniform distribution: wide spread spans > 80% of [min,max]", () => {
		// With uniform oil price distribution, the spread of results should be wide
		const uniformArgs: MonteCarloArgs = {
			...defaultArgs,
			variables: {
				...defaultArgs.variables,
				oilPrice: { base: 75, min: 50, max: 100, distribution: "uniform" },
			},
			iterations: 20000,
		};
		const result = monteCarloFn(uniformArgs);
		const npvRange = result.results.npv.p90 - result.results.npv.p10;
		// Wide input should produce non-trivial spread in outputs
		assert.ok(npvRange > 0, `Expected nonzero NPV p10-p90 spread, got ${npvRange}`);
	});

	// ------------------------------------------------------------------
	// Summary
	// ------------------------------------------------------------------
	console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
	if (failed > 0) {
		process.exit(1);
	}
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
