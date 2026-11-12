import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateJointRisk } from "../src/joint-scenarios.js";
import { jointRiskFixture, oracles } from "./fixtures/joint-risk.js";

test("unequal scenario weights cannot create variance in a constant large residual loss", () => {
	for (const loss of [1e12, 1e12 - 0.0001]) {
		const { register, policy, model } = jointRiskFixture();
		const weights = [1, 1, 1, 4];
		model.totalWeight = 7;
		for (const [index, state] of model.states.entries()) {
			state.weight = weights[index];
			state.residualLoss = loss;
		}
		const actual = calculateJointRisk(register, policy, model);
		assert.equal(actual.summary.expectedLoss, loss);
		assert.equal(actual.summary.standardDeviation, 0);
	}
});

test("a small-weight large loss retains its mean without subtracting a large baseline", () => {
	const { register, policy, model } = jointRiskFixture();
	model.totalWeight = 3_000_000_001;
	for (const [index, state] of model.states.entries()) {
		state.weight = index === 0 ? 1 : 1_000_000_000;
		state.residualLoss = index === 0 ? 1e12 : 0;
	}
	const actual = calculateJointRisk(register, policy, model);
	assert.ok(Math.abs(actual.summary.expectedLoss - 1e12 / model.totalWeight) < 1e-9);
});

for (const name of Object.keys(oracles.cases))
	test(`independently authored joint risk control: ${name}`, () => {
		const { register, policy, model, oracle } = jointRiskFixture(name);
		const before = JSON.stringify({ register, policy, model });
		const actual = calculateJointRisk(register, policy, model);
		assert.equal(actual.summary.expectedLoss, oracle.expected.mean);
		assert.ok(Math.abs(actual.summary.standardDeviation ** 2 - oracle.expected.variance) < 1e-6);
		assert.deepEqual(actual.summary.lossQuantiles, {
			p10: oracle.expected.p10,
			p50: oracle.expected.p50,
			p90: oracle.expected.p90,
		});
		assert.equal(actual.summary.probabilityLossAtOrAbove, oracle.expected.tailProbability);
		assert.deepEqual(
			actual.occurrence.map((item) => item.probability),
			oracle.expected.occurrence,
		);
		assert.deepEqual(
			actual.correlations.map((item) => item.correlation.value),
			oracle.expected.correlations,
		);
		assert.equal(actual.reviewStatus, "unreviewed");
		assert.equal(actual.riskAccepted, false);
		assert.equal(JSON.stringify({ register, policy, model }), before);
		assert.deepEqual(actual, calculateJointRisk(register, policy, model));
	});

test("risk policy retains missing evidence, conflicts and severe hazards even if their assumed probability is zero", () => {
	const { register, policy, model } = jointRiskFixture("zero-variance");
	register.entries[1].severity = "critical";
	register.entries[0].evidenceState = "conflicting";
	register.entries[0].conflicts.push("Competing specialist interpretations");
	const actual = calculateJointRisk(register, policy, model);
	assert.deepEqual(actual.coverage.unmitigatedSevereRiskIds, ["risk.b"]);
	assert.equal(actual.occurrence[1].probability, 0);
	assert.deepEqual(actual.coverage.unsupportedRiskIds, ["risk.a"]);
	assert.deepEqual(actual.coverage.conflictingRiskIds, ["risk.a"]);
	assert.equal(actual.coverage.status, "failed");
});

test("complete coverage and owner limits are explicit, with literal zeros preserved", () => {
	const { register, policy, model } = jointRiskFixture();
	policy.requiredCategories.push("environmental");
	policy.maxExpectedLoss = 79;
	policy.maxTailProbability = 0.19;
	register.entries[0].severity = "unknown";
	register.entries[0].evidenceState = "missing";
	register.entries[0].evidenceRefs = [];
	const actual = calculateJointRisk(register, policy, model);
	assert.deepEqual(actual.coverage.missingCategories, ["environmental"]);
	assert.deepEqual(actual.coverage.unknownSeverityRiskIds, ["risk.a"]);
	assert.equal(actual.coverage.expectedLossWithinLimit, false);
	assert.equal(actual.coverage.tailProbabilityWithinLimit, false);
});

test("malformed, incomplete, ambiguous or unit-inconsistent inputs cannot yield proxy success", () => {
	for (const mutate of [
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.totalWeight += 1;
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.states[0].weight = -1;
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.states[0].residualLoss = -1;
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.currency = "CAD";
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.states[1].riskRefs[0].revision = "other";
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.states[0].riskRefs = [{ id: "foreign", revision: "r1" }];
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.states.push(structuredClone(f.model.states[0]));
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.register.entries.push(structuredClone(f.register.entries[0]));
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.exhaustiveWithinDeclaredModel = false;
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.policy.requiredCategories = [];
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.register.entries[0].severityBasis = "";
		},
		(f: ReturnType<typeof jointRiskFixture>) => {
			f.model.horizon = { ...f.model.horizon, end: f.model.horizon.start };
		},
	]) {
		const f = jointRiskFixture();
		mutate(f);
		assert.throws(() => calculateJointRisk(f.register, f.policy, f.model));
	}
});
