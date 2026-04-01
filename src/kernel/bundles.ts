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
 * Quick Screen bundle — 4 core servers in parallel.
 * Fast first-pass assessment for go/no-go screening.
 */
export const QUICK_SCREEN_BUNDLE: TaskBundle = {
	name: "quick_screen",
	description: "Fast parallel screening: geology, economics, engineering, and risk in one pass.",
	steps: [
		{
			toolName: "geowiz.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "econobot.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "curve-smith.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
		{
			toolName: "risk-analysis.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "summary",
		},
	],
	gatherStrategy: "all",
};

/**
 * Full Due Diligence bundle — all 14 servers in 4 phases.
 * Complete investment analysis with dependency ordering.
 */
export const FULL_DUE_DILIGENCE_BUNDLE: TaskBundle = {
	name: "full_due_diligence",
	description: "Comprehensive investment analysis across all 14 domain experts with phased execution.",
	steps: [
		// Phase 1: Core analysis (parallel)
		{
			toolName: "geowiz.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "econobot.analyze",
			args: {},
			parallel: true,
			optional: false,
			detailLevel: "standard",
		},
		{
			toolName: "curve-smith.analyze",
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
			detailLevel: "standard",
		},
		{
			toolName: "research.analyze",
			args: {},
			parallel: true,
			optional: true,
			detailLevel: "standard",
		},
		// Phase 2: Extended analysis (parallel, depends on phase 1)
		{
			toolName: "risk-analysis.analyze",
			args: {},
			parallel: true,
			optional: false,
			dependsOn: ["geowiz.analyze", "econobot.analyze", "curve-smith.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "legal.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "title.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "drilling.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "infrastructure.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze"],
			detailLevel: "standard",
		},
		{
			toolName: "development.analyze",
			args: {},
			parallel: true,
			optional: true,
			dependsOn: ["geowiz.analyze", "econobot.analyze"],
			detailLevel: "standard",
		},
		// Phase 3: QA (depends on phase 2)
		{
			toolName: "test.analyze",
			args: {},
			parallel: false,
			optional: true,
			dependsOn: ["risk-analysis.analyze"],
			detailLevel: "standard",
		},
		// Phase 4: Reporting & decision (sequential, depends on all)
		{
			toolName: "reporter.analyze",
			args: {},
			parallel: false,
			optional: false,
			dependsOn: ["test.analyze"],
			detailLevel: "full",
		},
		{
			toolName: "decision.analyze",
			args: {},
			parallel: false,
			optional: false,
			dependsOn: ["reporter.analyze"],
			detailLevel: "full",
		},
	],
	gatherStrategy: "majority",
};

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
	quick_screen: QUICK_SCREEN_BUNDLE,
	full_due_diligence: FULL_DUE_DILIGENCE_BUNDLE,
	geological_deep_dive: GEOLOGICAL_DEEP_DIVE_BUNDLE,
	financial_review: FINANCIAL_REVIEW_BUNDLE,
};
