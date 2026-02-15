/**
 * SHALE YEAH Agent OS - Pre-Built Task Bundles
 *
 * High-level composite tools that compose multiple servers into single operations.
 * Implements Arcade patterns:
 * - Abstraction Ladder (low/mid/high-level tools)
 * - Task Bundle (pre-defined multi-tool workflows)
 */

import type { TaskBundle } from "./types.js";

// ==========================================
// Bundle Definitions
// ==========================================

/**
 * Geological Deep Dive — focused geological analysis.
 * geowiz at full detail, curve-smith at standard, research at summary.
 */
export const GEOLOGICAL_DEEP_DIVE_BUNDLE: TaskBundle = {
	name: "geological_deep_dive",
	description:
		"Focused geological analysis with full-detail formation evaluation, production curve modeling, and research context.",
	steps: [
		{
			toolName: "geowiz.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "full",
		},
		{
			toolName: "curve-smith.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "research.analyze",
			args: {},
			parallel: true,
			optional: true,
			detailLevel: "summary",
		},
	],
	gatherStrategy: "all",
};

/**
 * Financial Review — focused financial and risk analysis.
 * econobot at full detail, risk-analysis at standard, market at summary.
 */
export const FINANCIAL_REVIEW_BUNDLE: TaskBundle = {
	name: "financial_review",
	description: "Focused financial analysis with full-detail economics, risk assessment, and market context.",
	steps: [
		{
			toolName: "econobot.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "full",
		},
		{
			toolName: "risk-analysis.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "market.analyze",
			args: {},
			parallel: true,
			optional: true,
			detailLevel: "summary",
		},
	],
	gatherStrategy: "all",
};

/**
 * All available bundles indexed by name.
 */
export const BUNDLES: Record<string, TaskBundle> = {
	geological_deep_dive: GEOLOGICAL_DEEP_DIVE_BUNDLE,
	financial_review: FINANCIAL_REVIEW_BUNDLE,
};
