import { z } from "zod";

const reference = z.object({ id: z.string().min(1).max(128), revision: z.string().min(1).max(128) }).strict();
/** Cash flows start at time zero; every later observation is one declared period apart. */
export const cashFlowInputSchema = z
	.object({
		contractVersion: z.literal("0.1.0"),
		cashFlows: z.array(z.number().finite()).min(2).max(601),
		discountRate: z.number().finite().gt(-1),
		currency: z.string().regex(/^[A-Z]{3}$/),
		periodUnit: z.enum(["year", "quarter", "month"]),
		inputRef: reference,
		assumptionRefs: z.array(reference).max(64),
	})
	.strict();
export type CashFlowInput = z.infer<typeof cashFlowInputSchema>;
type Metric = { status: "available" | "unavailable"; value: number | null; reason?: string };
type IRRMetric = Metric & { relativeResidual?: number; iterations?: number };
const unavailable = (reason: string): Metric => ({ status: "unavailable", value: null, reason });
const available = (value: number): Metric => ({ status: "available", value });

/** Log scaling prevents overflow while testing the sign and relative zero-NPV residual. */
function evaluate(flows: number[], logDiscount: number) {
	const terms = flows.map((value, period) =>
		value === 0 ? -Infinity : Math.log(Math.abs(value)) - period * logDiscount,
	);
	const largest = Math.max(...terms);
	if (largest === -Infinity) return { signed: 0, relativeResidual: 0, value: 0 };
	let signed = 0,
		absolute = 0,
		correction = 0;
	for (let i = 0; i < flows.length; i++) {
		const magnitude = Math.exp(terms[i] - largest);
		const term = Math.sign(flows[i]) * magnitude - correction;
		const next = signed + term;
		correction = next - signed - term;
		signed = next;
		absolute += magnitude;
	}
	const value = signed === 0 ? 0 : Math.sign(signed) * Math.exp(largest + Math.log(Math.abs(signed)));
	return { signed, relativeResidual: Math.abs(signed) / absolute, value };
}

function irr(flows: number[], maxIterations: number): IRRMetric {
	const signs = flows.filter((value) => value !== 0).map(Math.sign);
	if (signs.length === 0) return unavailable("indeterminate");
	const changes = signs.slice(1).filter((sign, i) => sign !== signs[i]).length;
	if (changes === 0) return unavailable("no_solution");
	// Multiple sign changes require a separate root-selection decision, never an arbitrary guess.
	if (changes !== 1) return unavailable("ambiguous_series");
	let low = Math.log1p(-0.999999),
		high = Math.log1p(1_000_000);
	let left = evaluate(flows, low);
	const right = evaluate(flows, high);
	if (Math.sign(left.signed) === Math.sign(right.signed)) return unavailable("outside_solver_bounds");
	for (let iteration = 1; iteration <= maxIterations; iteration++) {
		const middle = iteration === 1 ? 0 : (low + high) / 2;
		const observed = evaluate(flows, middle);
		if (observed.relativeResidual <= 1e-12) {
			const rate = Math.expm1(middle);
			const checked = evaluate(flows, Math.log1p(rate));
			if (checked.relativeResidual > 1e-10) return unavailable("nonconvergent");
			return { ...available(rate), relativeResidual: checked.relativeResidual, iterations: iteration };
		}
		if (Math.sign(observed.signed) === Math.sign(left.signed)) {
			low = middle;
			left = observed;
		} else high = middle;
	}
	return unavailable("nonconvergent");
}

function payback(flows: number[]): Metric {
	if (flows[0] >= 0) return unavailable("no_initial_investment");
	const scale = Math.max(...flows.map(Math.abs));
	let cumulative = 0;
	for (let period = 0; period < flows.length; period++) {
		cumulative += flows[period] / scale;
		if (cumulative >= 0) return available(period);
	}
	return unavailable("not_recovered");
}

export function calculateCashFlows(input: unknown, options: { maxIterations?: number } = {}) {
	const parsed = cashFlowInputSchema.parse(input);
	const maxIterations = options.maxIterations ?? 160;
	if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 512)
		throw new Error("Invalid solver limit");
	const npv = evaluate(parsed.cashFlows, Math.log1p(parsed.discountRate)).value;
	return {
		...parsed,
		timing: "time-zero-then-period-end" as const,
		discountRateConvention: "effective-per-period" as const,
		paybackConvention: "first-undiscounted-period-end-recovery" as const,
		npv: Number.isFinite(npv) ? available(npv) : unavailable("numeric_range"),
		irr: irr(parsed.cashFlows, maxIterations),
		payback: payback(parsed.cashFlows),
		solver: { id: "bounded-log-bisection", version: "1", minRate: -0.999999, maxRate: 1_000_000, maxIterations },
		reviewStatus: "unreviewed" as const,
		authorizesInvestment: false as const,
	};
}
