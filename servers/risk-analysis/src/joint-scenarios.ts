/** Exact appraisal of declared joint states. No field probabilities or financial solver are inferred. */
import { z } from "zod";

export const riskRefSchema = z
	.object({
		id: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[A-Za-z0-9_.:/-]+$/),
		revision: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[A-Za-z0-9_.:/-]+$/),
	})
	.strict();
const label = z.string().min(1).max(2048);
const category = z.enum(["geological", "technical", "economic", "regulatory", "environmental", "operational"]);
const severity = z.enum(["low", "medium", "high", "critical"]);
const horizon = z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict();
const metadata = { version: z.literal("0.1.0"), currency: z.string().regex(/^[A-Z]{3}$/), horizon };
export const riskRegisterSchema = z
	.object({
		...metadata,
		entries: z
			.array(
				z
					.object({
						riskRef: riskRefSchema,
						category,
						statement: label,
						consequence: label,
						severity: z.enum(["low", "medium", "high", "critical", "unknown"]),
						severityBasis: label,
						evidenceState: z.enum(["supported", "missing", "conflicting"]),
						evidenceRefs: z.array(riskRefSchema).max(32),
						conflicts: z.array(label).max(16),
						mitigation: z
							.object({
								state: z.enum(["none", "proposed", "implemented", "verified"]),
								ownerId: label,
								verificationRef: riskRefSchema.nullable(),
							})
							.strict(),
					})
					.strict(),
			)
			.min(1)
			.max(64),
	})
	.strict();
export const riskPolicySchema = z
	.object({
		...metadata,
		policyRef: riskRefSchema,
		requiredCategories: z.array(category).min(1).max(6),
		escalateSeverities: z.array(severity).min(1).max(4),
		maxUnmitigatedSevereRisks: z.number().int().min(0).max(64),
		maxExpectedLoss: z.number().finite().min(0).max(1e15),
		maxTailProbability: z.number().finite().min(0).max(1),
		lossThreshold: z.number().finite().min(0).max(1e12),
	})
	.strict();
export const jointScenariosSchema = z
	.object({
		...metadata,
		modelRef: riskRefSchema.extend({ id: riskRefSchema.shape.id.max(96) }),
		method: z.literal("complete-joint-scenarios-v1"),
		totalWeight: z.number().int().min(1).max(512_000_000_000),
		exhaustiveWithinDeclaredModel: z.literal(true),
		dependenceBasis: label,
		limitations: z.array(label).min(1).max(16),
		states: z
			.array(
				z
					.object({
						stateRef: riskRefSchema,
						weight: z.number().int().min(0).max(1_000_000_000),
						riskRefs: z.array(riskRefSchema).max(64),
						residualLoss: z.number().finite().min(0).max(1e12),
					})
					.strict(),
			)
			.min(1)
			.max(512),
	})
	.strict();
export type RiskRegister = z.infer<typeof riskRegisterSchema>;
export type RiskPolicy = z.infer<typeof riskPolicySchema>;
export type JointScenarios = z.infer<typeof jointScenariosSchema>;
export class JointRiskError extends Error {
	constructor(public readonly code: string) {
		super(`Joint risk appraisal blocked: ${code}`);
	}
}
const deny = (code: string): never => {
	throw new JointRiskError(code);
};
const duplicate = (values: string[]) => new Set(values).size !== values.length;
const sameRef = (a: { id: string; revision: string }, b: { id: string; revision: string }) =>
	a.id === b.id && a.revision === b.revision;

/** Validate full declared inputs before any summary. A source adapter separately enforces rights and hashes. */
export function parseJointRiskInputs(registerInput: unknown, policyInput: unknown, modelInput: unknown) {
	try {
		const register = riskRegisterSchema.parse(structuredClone(registerInput));
		const policy = riskPolicySchema.parse(structuredClone(policyInput));
		const model = jointScenariosSchema.parse(structuredClone(modelInput));
		if (Date.parse(register.horizon.end) <= Date.parse(register.horizon.start)) deny("horizon_invalid");
		for (const value of [policy, model])
			if (
				value.currency !== register.currency ||
				value.horizon.start !== register.horizon.start ||
				value.horizon.end !== register.horizon.end
			)
				deny("unit_horizon_mismatch");
		if (
			duplicate(register.entries.map((e) => e.riskRef.id)) ||
			duplicate(model.states.map((s) => s.stateRef.id)) ||
			duplicate(policy.requiredCategories) ||
			duplicate(policy.escalateSeverities)
		)
			deny("duplicate_identity");
		if (model.states.reduce((sum, state) => sum + state.weight, 0) !== model.totalWeight)
			deny("incomplete_probability_mass");
		for (const state of model.states) {
			if (duplicate(state.riskRefs.map((r) => r.id))) deny("duplicate_identity");
			if (state.riskRefs.some((r) => !register.entries.some((e) => sameRef(e.riskRef, r))))
				deny("risk_reference_mismatch");
		}
		for (const entry of register.entries)
			if (duplicate(entry.evidenceRefs.map((r) => r.id))) deny("duplicate_identity");
		return { register, policy, model };
	} catch (error) {
		if (error instanceof JointRiskError) throw error;
		throw new JointRiskError("invalid_content");
	}
}

function sum(values: number[]) {
	let total = 0,
		correction = 0;
	for (const value of values) {
		const adjusted = value - correction,
			next = total + adjusted;
		correction = next - total - adjusted;
		total = next;
	}
	if (!Number.isFinite(total)) deny("numeric_range");
	return total;
}

/** No authority is granted by a policy summary or this mathematical helper. */
export function riskBlockers(coverage: RiskCoverage, policy: Pick<RiskPolicy, "maxUnmitigatedSevereRisks">) {
	return [
		[coverage.missingCategories.length > 0, "missing-category"],
		[coverage.unsupportedRiskIds.length > 0, "unsupported-evidence"],
		[coverage.conflictingRiskIds.length > 0, "conflicting-evidence"],
		[coverage.unknownSeverityRiskIds.length > 0, "unknown-severity"],
		[coverage.unmitigatedSevereRiskIds.length > policy.maxUnmitigatedSevereRisks, "unmitigated-severe-risk-limit"],
		[!coverage.expectedLossWithinLimit, "expected-loss-limit"],
		[!coverage.tailProbabilityWithinLimit, "tail-probability-limit"],
	]
		.filter(([active]) => active)
		.map(([, reason]) => reason as string);
}
export interface RiskCoverage {
	coveredCategories: string[];
	missingCategories: string[];
	unsupportedRiskIds: string[];
	conflictingRiskIds: string[];
	unknownSeverityRiskIds: string[];
	unmitigatedSevereRiskIds: string[];
	expectedLossWithinLimit: boolean;
	tailProbabilityWithinLimit: boolean;
	status: "passed" | "failed";
}

export function calculateJointRisk(registerInput: unknown, policyInput: unknown, modelInput: unknown) {
	const { register, policy, model } = parseJointRiskInputs(registerInput, policyInput, modelInput);
	const positive = model.states.filter((s) => s.weight > 0);
	// Center in a small offset space so unequal weights cannot create variance
	// in a constant large loss or erase small real variation around that baseline.
	const origin = Math.min(...positive.map((s) => s.residualLoss));
	const meanOffset = sum(positive.map((s) => (s.residualLoss - origin) * (s.weight / model.totalWeight)));
	const expectedLoss = origin + meanOffset;
	const variance = sum(
		positive.map((s) => (s.residualLoss - origin - meanOffset) ** 2 * (s.weight / model.totalWeight)),
	);
	const ordered = [...positive].sort((a, b) => a.residualLoss - b.residualLoss);
	const quantile = (tenth: number) => {
		let cumulative = 0;
		for (const state of ordered) {
			cumulative += state.weight;
			if (cumulative * 10 >= model.totalWeight * tenth) return state.residualLoss;
		}
		return deny("incomplete_probability_mass");
	};
	const probabilityLossAtOrAbove =
		positive.reduce((total, s) => total + (s.residualLoss >= policy.lossThreshold ? s.weight : 0), 0) /
		model.totalWeight;
	const riskIds = register.entries.map((e) => e.riskRef.id).sort();
	const weights = new Map(
		riskIds.map((id) => [
			id,
			model.states.reduce((total, s) => total + (s.riskRefs.some((r) => r.id === id) ? s.weight : 0), 0),
		]),
	);
	const occurrence = riskIds.map((riskId) => ({ riskId, probability: weights.get(riskId)! / model.totalWeight }));
	const correlations: Array<{
		riskIds: string[];
		basis: string;
		correlation: { status: string; value: number | null; reason?: string };
	}> = [];
	for (let i = 0; i < riskIds.length; i++)
		for (let j = i + 1; j < riskIds.length; j++) {
			const a = riskIds[i],
				b = riskIds[j],
				wa = BigInt(weights.get(a)!),
				wb = BigInt(weights.get(b)!),
				total = BigInt(model.totalWeight);
			const joint = BigInt(
				model.states.reduce(
					(n, s) => n + (s.riskRefs.some((r) => r.id === a) && s.riskRefs.some((r) => r.id === b) ? s.weight : 0),
					0,
				),
			);
			const product = wa * (total - wa) * wb * (total - wb);
			correlations.push({
				riskIds: [a, b],
				basis: "assumed-joint-scenarios",
				correlation:
					product === 0n
						? { status: "unavailable", value: null, reason: "zero_variance" }
						: { status: "available", value: Number(joint * total - wa * wb) / Math.sqrt(Number(product)) },
			});
		}
	const coveredCategories = [...new Set(register.entries.map((e) => e.category))].sort();
	const ids = (predicate: (entry: RiskRegister["entries"][number]) => boolean) =>
		register.entries
			.filter(predicate)
			.map((e) => e.riskRef.id)
			.sort();
	const coverage: RiskCoverage = {
		coveredCategories,
		missingCategories: policy.requiredCategories.filter((c) => !coveredCategories.includes(c)).sort(),
		unsupportedRiskIds: ids((e) => e.evidenceState !== "supported" || e.evidenceRefs.length === 0),
		conflictingRiskIds: ids((e) => e.evidenceState === "conflicting" || e.conflicts.length > 0),
		unknownSeverityRiskIds: ids((e) => e.severity === "unknown"),
		unmitigatedSevereRiskIds: ids(
			(e) =>
				policy.escalateSeverities.some((s) => s === e.severity) &&
				(e.mitigation.state !== "verified" || e.mitigation.verificationRef === null),
		),
		expectedLossWithinLimit: expectedLoss <= policy.maxExpectedLoss,
		tailProbabilityWithinLimit: probabilityLossAtOrAbove <= policy.maxTailProbability,
		status: "passed",
	};
	if (riskBlockers(coverage, policy).length) coverage.status = "failed";
	return {
		version: "0.1.0",
		definition: {
			modelRef: model.modelRef,
			method: model.method,
			currency: register.currency,
			horizon: register.horizon,
			amountBasis: "undiscounted-residual-loss",
			probabilityBasis: "assumed-joint-scenarios",
			quantileConvention: "weighted-inverted-cdf",
			totalWeight: model.totalWeight,
			lossThreshold: policy.lossThreshold,
		},
		policyRef: policy.policyRef,
		dependenceBasis: model.dependenceBasis,
		limitations: model.limitations,
		riskRefs: register.entries.map((e) => e.riskRef),
		summary: {
			expectedLoss,
			standardDeviation: Math.sqrt(variance),
			lossQuantiles: { p10: quantile(1), p50: quantile(5), p90: quantile(9) },
			probabilityLossAtOrAbove,
			scenarioCount: model.states.length,
			positiveWeightScenarioCount: positive.length,
		},
		occurrence,
		correlations,
		coverage,
		reviewStatus: "unreviewed",
		riskAccepted: false,
		professionalAcceptance: false,
	};
}
