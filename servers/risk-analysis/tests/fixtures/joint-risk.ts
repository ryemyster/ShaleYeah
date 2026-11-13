import { readFileSync } from "node:fs";

export const oracles = JSON.parse(readFileSync(new URL("joint-scenario-oracles.json", import.meta.url), "utf8"));
export const horizon = { start: "2026-01-01T00:00:00Z", end: "2027-01-01T00:00:00Z" };
export function jointRiskFixture(name = "dependent") {
	const oracle = structuredClone(oracles.cases[name]);
	const metadata = { version: "0.1.0", currency: "USD", horizon };
	const register = {
		...metadata,
		entries: oracle.risks.map((id: string, i: number) => ({
			riskRef: { id, revision: "r1" },
			category: i ? "economic" : "geological",
			statement: `Synthetic ${id}`,
			consequence: "Declared hypothetical downside; not a measured field event",
			severity: "medium",
			severityBasis: "Operator-assumed synthetic medium severity; no field calibration",
			evidenceState: "supported",
			evidenceRefs: [{ id: `specialist.${i}`, revision: "r1" }],
			conflicts: [],
			mitigation: { state: "proposed", ownerId: `owner.${i}`, verificationRef: null },
		})),
	};
	const policy = {
		...metadata,
		policyRef: { id: "risk-policy.fixture", revision: "r1" },
		requiredCategories: [...new Set(register.entries.map((entry: { category: string }) => entry.category))],
		escalateSeverities: ["high", "critical"],
		maxUnmitigatedSevereRisks: 0,
		maxExpectedLoss: 2e12,
		maxTailProbability: 1,
		lossThreshold: oracle.lossThreshold,
	};
	const model = {
		...metadata,
		modelRef: { id: "joint.fixture", revision: "r1" },
		method: "complete-joint-scenarios-v1",
		totalWeight: oracle.totalWeight,
		exhaustiveWithinDeclaredModel: true,
		dependenceBasis: "Operator-authored complete synthetic joint states; no independence inference",
		limitations: ["Provisional hypothetical fixture; no field probability calibration or human risk acceptance"],
		states: oracle.states.map((state: { id: string; weight: number; risks: string[]; loss: number }) => ({
			stateRef: { id: state.id, revision: "r1" },
			weight: state.weight,
			riskRefs: state.risks.map((id) => ({ id, revision: "r1" })),
			residualLoss: state.loss,
		})),
	};
	return { register, policy, model, oracle };
}
