/**
 * SHALE YEAH TypeScript Type Definitions
 *
 * Core types for the agentic AI oil & gas investment platform
 */

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

export interface Formation {
	name: string;
	lithology: string;
	topDepth: number;
	bottomDepth: number;
	thickness: number;
	depthUnit: string;
	confidence: number;
	properties: {
		porosity?: number;
		permeability?: number;
		[key: string]: unknown;
	};
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
