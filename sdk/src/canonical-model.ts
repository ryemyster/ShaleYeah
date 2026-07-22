/**
 * SHALE YEAH Agent OS — Canonical Tool Model (Issue #208)
 *
 * Defines the shared Zod schemas that all 14 MCP servers write into.
 * The kernel accumulates partial results into a WellAnalysisContext per session.
 *
 * Why this exists:
 *   Before #208, downstream servers consumed upstream output via unchecked
 *   `?.field || 0` chains and `z.any()` inputs. A mis-named field or wrong
 *   type would produce silently wrong numbers — decision.ts would happily
 *   compute a bid on NPV=0 because econobot wrote "npv_value" instead of "npv".
 *   The canonical model makes the shared contract explicit and Zod-validated —
 *   a schema mismatch throws at runtime rather than producing garbage output.
 *
 * Design:
 *   - All sections are optional at the top level (accumulate incrementally)
 *   - All fields within sections are optional (servers write what they compute)
 *   - Sections are atomic — merging a section replaces the whole section
 *   - wellIdentifier is the only required field (anchors the analysis run)
 *
 * MA-COMPAT: When Managed Agents integration lands (#285), each server will
 *   emitEvent({ type: "canonical:formation", data: FormationSchema.parse(x) })
 *   instead of calling SessionManager.mergeCanonical(). The schema definitions
 *   here stay the same — only the accumulation mechanism changes.
 */

import { z } from "zod";

// ==========================================
// Section schemas — one per analysis domain
// ==========================================

/**
 * Formation data from geowiz.
 * Porosity and saturation are fractions (0–1); depth is in feet.
 */
export const FormationSchema = z.object({
	/** Formation name (e.g. "Wolfcamp A") */
	name: z.string().optional(),
	/** True vertical depth (ft) */
	depth: z.number().optional(),
	/** Net pay thickness (ft) — hydrocarbons-bearing interval */
	netPay: z.number().optional(),
	/** Porosity fraction 0–1 (8% = 0.08) */
	porosity: z.number().min(0).max(1).optional(),
	/** Water saturation fraction 0–1 */
	saturation: z.number().min(0).max(1).optional(),
});

export type Formation = z.infer<typeof FormationSchema>;

/**
 * Economic metrics from econobot.
 * NPV and breakEven are in USD; IRR is a fraction (28.5% = 0.285).
 * paybackMonths is always in months (not years) for unambiguous comparison.
 */
export const EconomicsSchema = z.object({
	/** Net Present Value in USD */
	npv: z.number().optional(),
	/** Internal Rate of Return as a fraction (0.285 = 28.5%) */
	irr: z.number().optional(),
	/** Payback period in months */
	paybackMonths: z.number().optional(),
	/** Oil price ($/bbl) at which NPV = 0 */
	breakEvenPrice: z.number().optional(),
});

export type Economics = z.infer<typeof EconomicsSchema>;

/**
 * Production forecast from curve-smith.
 * initialRate is bbl/month (oil equivalent); EUR is total bbl over well life.
 * declineRate is monthly exponential decline fraction; bFactor is the Arps b exponent.
 * confidence is 0–100.
 */
export const ProductionSchema = z.object({
	/** Initial production rate (bbl/month oil equivalent) */
	initialRate: z.number().optional(),
	/** Monthly decline rate fraction (10.5%/month = 0.105) */
	declineRate: z.number().optional(),
	/** Arps b-factor for hyperbolic decline (0 = exponential, 1 = harmonic) */
	bFactor: z.number().optional(),
	/** Estimated Ultimate Recovery (bbl oil equivalent) */
	eur: z.number().optional(),
	/** Type curve label (e.g. "Tier 1 horizontal well") */
	typeCurve: z.string().optional(),
	/** Analyst confidence in the production forecast, 0–100 */
	confidence: z.number().min(0).max(100).optional(),
});

export type Production = z.infer<typeof ProductionSchema>;

/**
 * Risk scores from risk-analysis.
 * All sub-scores are fractions 0–1; overallScore is 0–100 (for display).
 */
export const RiskProfileSchema = z.object({
	/** Overall risk score 0–100 (displayed in reports) */
	overallScore: z.number().min(0).max(100).optional(),
	/** Geological risk fraction 0–1 */
	geologic: z.number().min(0).max(1).optional(),
	/** Economic risk fraction 0–1 */
	economic: z.number().min(0).max(1).optional(),
	/** Regulatory/environmental risk fraction 0–1 */
	regulatory: z.number().min(0).max(1).optional(),
});

export type RiskProfile = z.infer<typeof RiskProfileSchema>;

/**
 * Final recommendation from decision.
 * PROCEED / REJECT / CONDITIONAL map to the three canonical decision outcomes.
 * Note: "INVEST"/"PASS" are legacy labels used in decision.ts output — the canonical
 * model uses PROCEED/REJECT/CONDITIONAL to avoid confusion with financial "pass" lists.
 */
export const DecisionSchema = z.object({
	/** Final recommendation — three canonical outcomes only */
	recommendation: z.enum(["PROCEED", "REJECT", "CONDITIONAL"]).optional(),
	/** Analyst confidence in the decision, 0–100 */
	confidence: z.number().min(0).max(100).optional(),
	/** 1-3 sentence rationale for the investment memo */
	rationale: z.string().optional(),
});

export type Decision = z.infer<typeof DecisionSchema>;

// ==========================================
// Root context schema — the accumulated well analysis
// ==========================================

/**
 * The single canonical context object per analysis run.
 * All sections are optional so the kernel can accumulate incrementally
 * as each server completes — not every run exercises every domain.
 */
export const WellAnalysisContextSchema = z.object({
	/** Unique identifier for this well or lease (anchors the analysis run) */
	wellIdentifier: z.string(),
	/** Geological formation data from geowiz */
	formation: FormationSchema.optional(),
	/** Economic model outputs from econobot */
	economics: EconomicsSchema.optional(),
	/** Production forecast from curve-smith */
	production: ProductionSchema.optional(),
	/** Risk assessment from risk-analysis */
	risk: RiskProfileSchema.optional(),
	/** Final investment recommendation from decision */
	decision: DecisionSchema.optional(),
});

export type WellAnalysisContext = z.infer<typeof WellAnalysisContextSchema>;

// ==========================================
// Section key type — used by mergeCanonical
// ==========================================

/**
 * The valid section keys for mergeCanonical.
 * Constrains callers to only merge recognized sections — no typos.
 */
export type CanonicalSection = keyof Omit<WellAnalysisContext, "wellIdentifier">;
