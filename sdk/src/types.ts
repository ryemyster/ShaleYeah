/**
 * SHALE YEAH TypeScript Type Definitions
 *
 * Core types for the agentic AI oil & gas investment platform
 */

// ==========================================
// Pagination — Arcade #31: Paginated Result
// ==========================================

/**
 * Standard cursor-based pagination envelope for data-heavy MCP tool responses.
 * Callers pass the returned `cursor` back as an input param to fetch the next page.
 * `totalCount` is optional because some data sources cannot cheaply compute it.
 */
export interface PaginatedResult<T> {
	data: T[];
	/** Opaque offset cursor — pass back to retrieve the next page. Absent on the last page. */
	cursor?: string;
	hasMore: boolean;
	/** Total items across all pages (may be omitted when the source cannot compute it cheaply). */
	totalCount?: number;
}

/** Encode a numeric offset as an opaque base64url cursor string. */
export function encodeCursor(offset: number): string {
	return Buffer.from(String(offset)).toString("base64url");
}

/**
 * Decode a cursor back to a numeric offset.
 * Returns 0 (first page) on any malformed input so callers never need to guard.
 */
export function decodeCursor(cursor: string): number {
	try {
		const n = parseInt(Buffer.from(cursor, "base64url").toString(), 10);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	} catch {
		return 0;
	}
}

/**
 * Slice `items` into a page and return a `PaginatedResult`.
 * `pageSize` is clamped to [1, 100]; defaults to 25 when not provided.
 * `cursor` absent or undefined means start from the beginning.
 */
export function paginateArray<T>(items: T[], options: { cursor?: string; pageSize?: number }): PaginatedResult<T> {
	const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
	const offset = options.cursor !== undefined ? decodeCursor(options.cursor) : 0;
	const page = items.slice(offset, offset + pageSize);
	const hasMore = offset + pageSize < items.length;
	return {
		data: page,
		hasMore,
		totalCount: items.length,
		...(hasMore ? { cursor: encodeCursor(offset + pageSize) } : {}),
	};
}

// ==========================================
// GUI URL Envelope — Arcade #33
// ==========================================

/**
 * Wraps a tool response with optional dashboard link metadata.
 * When DASHBOARD_BASE_URL is set, agents surface the viewUrl as a clickable link for users.
 */
export interface ToolResponseEnvelope<T> {
	data: T;
	/** Absolute URL to the relevant dashboard view. Only present when DASHBOARD_BASE_URL is configured. */
	viewUrl?: string;
	/** Human-readable link label (e.g. "View in Dashboard"). */
	viewLabel?: string;
}

/**
 * Conditionally wrap a tool response in a ToolResponseEnvelope.
 * Returns `data` unchanged when DASHBOARD_BASE_URL is not set (no schema change for callers
 * that don't have the dashboard configured). Returns an envelope when the env var is present.
 */
export function wrapWithGuiUrl<T>(data: T, urlPath: string, label = "View in Dashboard"): T | ToolResponseEnvelope<T> {
	const base = process.env.DASHBOARD_BASE_URL;
	if (!base) return data;
	const viewUrl = `${base.replace(/\/$/, "")}/${urlPath.replace(/^\//, "")}`;
	return { data, viewUrl, viewLabel: label };
}

// ==========================================
// Geological Data Types
// ==========================================

export interface LASCurve {
	name: string;
	unit: string;
	description: string;
	data: number[];
}

export interface LASData {
	version: string;
	wellName: string;
	depthUnit: string;
	depthStart: number;
	depthStop: number;
	depthStep: number;
	nullValue: number;
	curves: LASCurve[];
	depthData: number[];
	rows: number;
	company?: string;
	field?: string;
	location?: string;
}

export interface GeologicalAnalysis {
	formationQuality: {
		reservoirQuality: "excellent" | "good" | "fair" | "poor";
		porosityAssessment: string;
		permeabilityAssessment: string;
		hydrocarbonPotential: "high" | "medium" | "low";
		completionEffectiveness: string;
	};
	drillingRecommendations: {
		optimalLandingZones: string[];
		lateralLengthRecommendation: string;
		completionStrategy: string;
		drillingRisks: string[];
	};
	investmentPerspective: {
		geologicalConfidence: number;
		developmentPotential: string;
		keyRisks: string[];
		comparableAnalogues: string[];
		recommendedAction: "drill" | "pass" | "more_data_needed";
	};
	professionalSummary: string;
	confidenceLevel: number;
	llmEnhanced?: boolean;
	geologistPersona?: string;
}

// ==========================================
// Economic and Risk Types
// ==========================================

export interface EconomicAnalysis {
	npv: number;
	irr: number;
	roi: number;
	paybackPeriod: number;
	paybackMonths?: number; // Alias for paybackPeriod in months
	assumptions: {
		oilPrice: number;
		gasPrice: number;
		drillingCost: number;
		completionCost: number;
	};
	sensitivityAnalysis: Array<{
		variable: string;
		scenarios: Record<string, number>;
	}>;
	confidence?: number;
}

// Curve Analysis Types
export interface DeclineCurveAnalysis {
	initialRate: {
		oil: number;
		gas: number;
		water: number;
	};
	declineRate: number;
	bFactor: number;
	eur: {
		oil: number;
		gas: number;
	};
	typeCurve: string;
	confidence: number;
	qualityGrade: "Excellent" | "Good" | "Fair" | "Poor";
}

// Investment Decision Types
export interface InvestmentDecision {
	decision: "INVEST" | "PASS" | "CONDITIONAL";
	confidence: number;
	recommendedBid?: number;
	maxBid?: number;
	reasoning: string[];
	riskFactors: string[];
	upside: string[];
	conditions?: string[];
	timeline?: string;
	recommendation?: string;
	keyMetrics?: {
		npv: number;
		irr: number;
		payback: number;
		netPay: number;
	};
	nextSteps?: string[];
}

// Market Research Types
export interface MarketResearch {
	scope: string;
	sources: string[];
	keyFindings: string[];
	competitiveIntelligence: Array<{
		company: string;
		activity: string;
		confidence: string;
	}>;
	marketTrends: Array<{
		trend: string;
		impact: string;
		timeframe: string;
	}>;
	priceForecasts: Array<{
		period: string;
		oilPrice: number;
		gasPrice: number;
		confidence: string;
	}>;
	confidence: number;
	recommendations: string[];
}

export interface RiskAssessment {
	overallRiskScore: number;
	overallRisk?: number; // Alias for overallRiskScore
	riskFactors: Array<{
		category: string;
		description: string;
		probability: number;
		impact: number;
		mitigationStrategies: string[];
	}>;
	monteCarloResults?: {
		p10: number;
		p50: number;
		p90: number;
	};
	confidence?: number;
}

// MCP Analysis Result Types
export interface MCPAnalysisResult {
	economic?: EconomicAnalysis;
	geological?: GeologicalAnalysis;
	curve?: DeclineCurveAnalysis;
	risk?: RiskAssessment;
	market?: MarketResearch;
	confidence?: number;
}

// Investment Criteria Types
export interface InvestmentCriteria {
	minNPV: number;
	minIRR: number;
	maxPayback: number;
	maxRisk: number;
	minConfidence?: number;
}

// Bid Strategy Types
export interface BidStrategy {
	recommendedBid: number;
	maxBid: number;
	bidIncrement: number;
	strategy: "AGGRESSIVE" | "CONSERVATIVE" | "OPPORTUNISTIC";
	reasoning: string;
}

// Portfolio Fit Types
export interface PortfolioFit {
	score: number;
	strategic: boolean;
	diversification: number;
	synergies: string[];
	conflicts: string[];
	recommendation: string;
}

// Analysis Function Parameter Types
export interface AnalysisInputs {
	economic?: EconomicAnalysis;
	geological?: GeologicalAnalysis;
	curve?: DeclineCurveAnalysis;
	risk?: RiskAssessment;
	market?: MarketResearch;
	filePath?: string;
	tractName?: string;
	analysisType?: string;
	includeAppendices?: boolean;
	reprojectToWGS84?: boolean;
	thresholds?: {
		completeness: number;
		accuracy: number;
		consistency: number;
	};
}

// Portfolio Asset Types
export interface PortfolioAsset {
	formation: string;
	location: string;
	expectedReturns?: number;
	acquisitionCost?: number;
	status: string;
}
