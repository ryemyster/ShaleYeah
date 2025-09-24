#!/usr/bin/env tsx
/**
 * Enhanced ARIES Database Processor for SHALE YEAH
 * Processes ARIES (.adb) petroleum economics and reserves database files
 *
 * LEGAL NOTICE: ARIES database processing provided under DMCA Section 1201(f)
 * interoperability exception. Users must have appropriate Halliburton/Landmark
 * ARIES software license and access rights.
 */

import fs from "node:fs";
import path from "node:path";

// Enhanced interface for ARIES database processing
export interface AriesData {
	format: "ARIES";
	version: string;
	databaseName: string;
	projects: AriesProject[];
	wells: AriesWell[];
	forecasts: AriesForecast[];
	economics: AriesEconomics[];
	totalRecords: number;
	metadata: {
		filePath?: string;
		fileSize?: number;
		createdDate?: string;
		modifiedDate?: string;
		ariesVersion?: string;
		licenseRequired?: boolean;
		isPasswordProtected?: boolean;
		[key: string]: unknown;
	};
	oilGasAnalysis: {
		reservesAssessment: ReservesAssessment;
		productionForecasting: ProductionForecasting;
		economicEvaluation: EconomicEvaluation;
		riskAnalysis: RiskAnalysis;
		portfolioSummary: PortfolioSummary;
	};
	qualityMetrics: {
		dataCompleteness: number;
		forecastReliability: number;
		economicConsistency: number;
		confidence: number;
	};
}

export interface AriesProject {
	projectId: string;
	projectName: string;
	operator: string;
	area: string;
	projectType: "development" | "exploration" | "acquisition" | "disposal";
	status: "active" | "inactive" | "completed" | "cancelled";
	createdDate: string;
	modifiedDate: string;
	wellCount: number;
	associatedWells: string[];
}

export interface AriesWell {
	wellId: string;
	wellName: string;
	operator: string;
	field: string;
	projectId?: string;
	location: {
		latitude?: number;
		longitude?: number;
		surfaceHoleLatitude?: number;
		surfaceHoleLongitude?: number;
		county?: string;
		state?: string;
		country?: string;
	};
	wellType: "oil" | "gas" | "oil_gas" | "injection" | "disposal";
	status: "producing" | "shut_in" | "abandoned" | "drilling" | "completing";
	spudDate?: string;
	completionDate?: string;
	firstProductionDate?: string;
	totalDepth?: number;
	lateralLength?: number;
	formations: string[];
}

export interface AriesForecast {
	forecastId: string;
	wellId: string;
	forecastName: string;
	forecastType: "decline_curve" | "type_curve" | "simulation" | "analogy";
	createdDate: string;
	createdBy: string;
	parameters: {
		initialRate?: number;
		declineRate?: number;
		bFactor?: number;
		minimumRate?: number;
		economicLimit?: number;
		forecastLength: number; // months
	};
	monthlyData: MonthlyProductionData[];
	reserves: {
		oilReserves?: number; // barrels
		gasReserves?: number; // MCF
		nglReserves?: number; // barrels
		boeReserves?: number; // barrel oil equivalent
	};
	quality: {
		r2?: number; // correlation coefficient
		confidenceLevel: number; // 0-1 scale
		lastUpdated: string;
	};
}

export interface MonthlyProductionData {
	month: number;
	year: number;
	date: string;
	oilProduction?: number; // barrels
	gasProduction?: number; // MCF
	nglProduction?: number; // barrels
	waterProduction?: number; // barrels
	boeProduction?: number; // barrel oil equivalent
	days: number;
	status: "actual" | "forecast";
}

export interface AriesEconomics {
	economicsId: string;
	wellId?: string;
	projectId?: string;
	economicsName: string;
	analysisDate: string;
	analysisType: "single_well" | "project" | "portfolio";
	pricing: {
		oilPrice: number; // $/barrel
		gasPrice: number; // $/MCF
		nglPrice?: number; // $/barrel
		priceDate: string;
		escalation?: number; // % per year
	};
	costs: {
		wellCost?: number; // total well cost
		facilitiesCost?: number;
		operatingCost?: number; // $/month
		abandonmentCost?: number;
	};
	fiscalTerms: {
		royalty: number; // decimal (0.125 = 12.5%)
		workingInterest: number; // decimal
		netRevenueInterest: number; // decimal
		severanceTax?: number; // decimal
		adValoremTax?: number; // decimal
	};
	results: {
		grossRevenue: number;
		netRevenue: number;
		totalCosts: number;
		beforeTaxCashFlow: number;
		afterTaxCashFlow: number;
		npv10: number; // NPV at 10%
		npv15?: number; // NPV at 15%
		irr: number; // %
		payout: number; // months
		eur: number; // estimated ultimate recovery in BOE
		eurPerWell?: number;
		breakeven: number; // $/BOE or $/barrel
	};
}

export interface ReservesAssessment {
	totalReserves: {
		oil: number; // barrels
		gas: number; // MCF
		ngl: number; // barrels
		boe: number; // barrel oil equivalent
	};
	reservesByCategory: {
		proved: number; // BOE
		probable: number; // BOE
		possible: number; // BOE
	};
	reservesByWell: Array<{
		wellId: string;
		wellName: string;
		oilReserves: number;
		gasReserves: number;
		boeReserves: number;
	}>;
	reservesDate: string;
	confidenceLevel: number;
}

export interface ProductionForecasting {
	totalWells: number;
	producingWells: number;
	peakProduction: {
		oil: number; // barrels per month
		gas: number; // MCF per month
		boe: number; // BOE per month
		peakMonth: string;
	};
	currentProduction: {
		oil: number; // barrels per month
		gas: number; // MCF per month
		boe: number; // BOE per month
		date: string;
	};
	forecastLength: number; // months
	declineParameters: {
		averageDeclineRate: number; // % per year
		averageBFactor: number;
		averageInitialRate: number; // BOE per month
	};
}

export interface EconomicEvaluation {
	totalInvestment: number;
	totalRevenue: number;
	totalCosts: number;
	netCashFlow: number;
	npv10: number;
	npv15: number;
	irr: number; // %
	payout: number; // months
	breakeven: number; // $/BOE
	averageWellCost: number;
	operatingMargin: number; // %
	fiscalSummary: {
		averageRoyalty: number; // %
		averageWorkingInterest: number; // %
		totalTaxes: number;
	};
}

export interface RiskAnalysis {
	riskFactors: Array<{
		factor: string;
		impact: "high" | "medium" | "low";
		probability: "high" | "medium" | "low";
		mitigation: string;
	}>;
	sensitivityAnalysis: {
		oilPriceImpact: number; // NPV change per $1/barrel
		gasPriceImpact: number; // NPV change per $0.10/MCF
		wellCostImpact: number; // NPV change per $100k well cost
		declineRateImpact: number; // NPV change per 1% decline rate
	};
	confidenceIntervals: {
		p10: number; // optimistic NPV
		p50: number; // expected NPV
		p90: number; // conservative NPV
	};
}

export interface PortfolioSummary {
	totalProjects: number;
	totalWells: number;
	totalReserves: number; // BOE
	totalNPV: number;
	averageIRR: number; // %
	averagePayout: number; // months
	topPerformingWells: Array<{
		wellName: string;
		npv: number;
		irr: number;
		eur: number;
	}>;
	portfolioRisk: "low" | "medium" | "high";
}

export async function processAriesDatabase(
	filePath: string,
): Promise<AriesData> {
	try {
		const stats = fs.statSync(filePath);
		const databaseName = path.basename(filePath, path.extname(filePath));

		// Check if file is accessible
		if (!fs.existsSync(filePath)) {
			throw new Error(`ARIES database file not found: ${filePath}`);
		}

		// Detect ARIES version
		const version = await detectAriesVersion(filePath);

		// Extract ARIES data (placeholder - requires ARIES API or database access)
		const { projects, wells, forecasts, economics } =
			await extractAriesData(filePath);

		// Analyze oil & gas data
		const oilGasAnalysis = await analyzeAriesData(
			projects,
			wells,
			forecasts,
			economics,
		);

		// Calculate quality metrics
		const qualityMetrics = calculateAriesQuality(
			projects,
			wells,
			forecasts,
			economics,
		);

		const totalRecords =
			projects.length + wells.length + forecasts.length + economics.length;

		return {
			format: "ARIES",
			version,
			databaseName,
			projects,
			wells,
			forecasts,
			economics,
			totalRecords,
			metadata: {
				filePath,
				fileSize: stats.size,
				createdDate: stats.birthtime.toISOString(),
				modifiedDate: stats.mtime.toISOString(),
				ariesVersion: version,
				licenseRequired: true,
				isPasswordProtected: false, // Would need to check actual file
			},
			oilGasAnalysis,
			qualityMetrics,
		};
	} catch (error) {
		throw new Error(`Failed to process ARIES database: ${error}`);
	}
}

async function detectAriesVersion(filePath: string): Promise<string> {
	// Note: ARIES version detection would require file header analysis
	// This is a placeholder implementation
	const ext = path.extname(filePath).toLowerCase();

	if (ext === ".adb") {
		return "5000+"; // Modern ARIES version
	}

	return "UNKNOWN";
}

async function extractAriesData(_filePath: string): Promise<{
	projects: AriesProject[];
	wells: AriesWell[];
	forecasts: AriesForecast[];
	economics: AriesEconomics[];
}> {
	// Note: Full ARIES integration requires Halliburton/Landmark API or database drivers
	// This is a placeholder implementation showing the structure

	console.warn(
		"ARIES database processing requires Halliburton/Landmark licensing:",
	);
	console.warn("- Valid ARIES software license");
	console.warn("- DecisionSpace 365 subscription (cloud version)");
	console.warn("- ARIES API access or database connectivity");
	console.warn("Contact: LandmarkSupport@halliburton.com for licensing");
	console.warn(
		"User must have appropriate ARIES software license and access rights.",
	);

	// Return demo structure for development
	const _currentYear = new Date().getFullYear();
	const currentDate = new Date().toISOString();

	const demoProjects: AriesProject[] = [
		{
			projectId: "PROJ_001",
			projectName: "Permian Basin Development",
			operator: "Demo Energy LLC",
			area: "Midland Basin",
			projectType: "development",
			status: "active",
			createdDate: currentDate,
			modifiedDate: currentDate,
			wellCount: 12,
			associatedWells: ["DEMO-001", "DEMO-002", "DEMO-003"],
		},
	];

	const demoWells: AriesWell[] = [
		{
			wellId: "WELL_001",
			wellName: "DEMO-001H",
			operator: "Demo Energy LLC",
			field: "Demo Field",
			projectId: "PROJ_001",
			location: {
				latitude: 32.0,
				longitude: -102.0,
				county: "Midland",
				state: "Texas",
				country: "USA",
			},
			wellType: "oil",
			status: "producing",
			spudDate: "2023-01-15",
			completionDate: "2023-03-20",
			firstProductionDate: "2023-04-01",
			totalDepth: 12500,
			lateralLength: 8500,
			formations: ["Wolfcamp A", "Wolfcamp B"],
		},
		{
			wellId: "WELL_002",
			wellName: "DEMO-002H",
			operator: "Demo Energy LLC",
			field: "Demo Field",
			projectId: "PROJ_001",
			location: {
				latitude: 32.01,
				longitude: -102.01,
				county: "Midland",
				state: "Texas",
				country: "USA",
			},
			wellType: "oil_gas",
			status: "producing",
			spudDate: "2023-02-20",
			completionDate: "2023-04-25",
			firstProductionDate: "2023-05-01",
			totalDepth: 13200,
			lateralLength: 9100,
			formations: ["Wolfcamp A"],
		},
	];

	const demoForecasts: AriesForecast[] = [
		{
			forecastId: "FCST_001",
			wellId: "WELL_001",
			forecastName: "DEMO-001H Type Curve",
			forecastType: "decline_curve",
			createdDate: currentDate,
			createdBy: "Demo Analyst",
			parameters: {
				initialRate: 1200,
				declineRate: 65,
				bFactor: 1.8,
				minimumRate: 10,
				economicLimit: 5,
				forecastLength: 300,
			},
			monthlyData: [], // Would be populated with actual monthly data
			reserves: {
				oilReserves: 875000,
				gasReserves: 2100000,
				nglReserves: 125000,
				boeReserves: 1350000,
			},
			quality: {
				r2: 0.92,
				confidenceLevel: 0.85,
				lastUpdated: currentDate,
			},
		},
	];

	const demoEconomics: AriesEconomics[] = [
		{
			economicsId: "ECON_001",
			wellId: "WELL_001",
			projectId: "PROJ_001",
			economicsName: "DEMO-001H Base Case",
			analysisDate: currentDate,
			analysisType: "single_well",
			pricing: {
				oilPrice: 75.0,
				gasPrice: 3.5,
				nglPrice: 45.0,
				priceDate: currentDate,
				escalation: 2.0,
			},
			costs: {
				wellCost: 8500000,
				facilitiesCost: 1500000,
				operatingCost: 25000,
				abandonmentCost: 150000,
			},
			fiscalTerms: {
				royalty: 0.1875,
				workingInterest: 0.8,
				netRevenueInterest: 0.65,
				severanceTax: 0.046,
				adValoremTax: 0.015,
			},
			results: {
				grossRevenue: 95600000,
				netRevenue: 62140000,
				totalCosts: 32500000,
				beforeTaxCashFlow: 29640000,
				afterTaxCashFlow: 21750000,
				npv10: 18200000,
				npv15: 14800000,
				irr: 28.5,
				payout: 18,
				eur: 1350000,
				eurPerWell: 1350000,
				breakeven: 42.5,
			},
		},
	];

	return {
		projects: demoProjects,
		wells: demoWells,
		forecasts: demoForecasts,
		economics: demoEconomics,
	};
}

async function analyzeAriesData(
	projects: AriesProject[],
	wells: AriesWell[],
	forecasts: AriesForecast[],
	economics: AriesEconomics[],
): Promise<AriesData["oilGasAnalysis"]> {
	// Reserves assessment
	const totalOilReserves = forecasts.reduce(
		(sum, f) => sum + (f.reserves.oilReserves || 0),
		0,
	);
	const totalGasReserves = forecasts.reduce(
		(sum, f) => sum + (f.reserves.gasReserves || 0),
		0,
	);
	const totalNglReserves = forecasts.reduce(
		(sum, f) => sum + (f.reserves.nglReserves || 0),
		0,
	);
	const totalBoeReserves = forecasts.reduce(
		(sum, f) => sum + (f.reserves.boeReserves || 0),
		0,
	);

	const reservesAssessment: ReservesAssessment = {
		totalReserves: {
			oil: totalOilReserves,
			gas: totalGasReserves,
			ngl: totalNglReserves,
			boe: totalBoeReserves,
		},
		reservesByCategory: {
			proved: totalBoeReserves * 0.7, // Assume 70% proved
			probable: totalBoeReserves * 0.2, // Assume 20% probable
			possible: totalBoeReserves * 0.1, // Assume 10% possible
		},
		reservesByWell: forecasts.map((f) => ({
			wellId: f.wellId,
			wellName: wells.find((w) => w.wellId === f.wellId)?.wellName || "Unknown",
			oilReserves: f.reserves.oilReserves || 0,
			gasReserves: f.reserves.gasReserves || 0,
			boeReserves: f.reserves.boeReserves || 0,
		})),
		reservesDate: new Date().toISOString(),
		confidenceLevel:
			forecasts.reduce((sum, f) => sum + f.quality.confidenceLevel, 0) /
			forecasts.length,
	};

	// Production forecasting
	const productionForecasting: ProductionForecasting = {
		totalWells: wells.length,
		producingWells: wells.filter((w) => w.status === "producing").length,
		peakProduction: {
			oil:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) *
				0.6, // Assume 60% oil
			gas:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) *
				2.5, // GOR = 2500
			boe: forecasts.reduce(
				(sum, f) => sum + (f.parameters.initialRate || 0),
				0,
			),
			peakMonth: "Month 1",
		},
		currentProduction: {
			oil:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) *
				0.3, // Declining
			gas:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) *
				1.25,
			boe:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) *
				0.5,
			date: new Date().toISOString(),
		},
		forecastLength: Math.max(
			...forecasts.map((f) => f.parameters.forecastLength),
		),
		declineParameters: {
			averageDeclineRate:
				forecasts.reduce((sum, f) => sum + (f.parameters.declineRate || 0), 0) /
				forecasts.length,
			averageBFactor:
				forecasts.reduce((sum, f) => sum + (f.parameters.bFactor || 0), 0) /
				forecasts.length,
			averageInitialRate:
				forecasts.reduce((sum, f) => sum + (f.parameters.initialRate || 0), 0) /
				forecasts.length,
		},
	};

	// Economic evaluation
	const totalInvestment = economics.reduce(
		(sum, e) => sum + (e.costs.wellCost || 0) + (e.costs.facilitiesCost || 0),
		0,
	);
	const totalRevenue = economics.reduce(
		(sum, e) => sum + e.results.grossRevenue,
		0,
	);
	const totalCosts = economics.reduce(
		(sum, e) => sum + e.results.totalCosts,
		0,
	);

	const economicEvaluation: EconomicEvaluation = {
		totalInvestment,
		totalRevenue,
		totalCosts,
		netCashFlow: economics.reduce(
			(sum, e) => sum + e.results.beforeTaxCashFlow,
			0,
		),
		npv10: economics.reduce((sum, e) => sum + e.results.npv10, 0),
		npv15: economics.reduce((sum, e) => sum + (e.results.npv15 || 0), 0),
		irr:
			economics.reduce((sum, e) => sum + e.results.irr, 0) / economics.length,
		payout:
			economics.reduce((sum, e) => sum + e.results.payout, 0) /
			economics.length,
		breakeven:
			economics.reduce((sum, e) => sum + e.results.breakeven, 0) /
			economics.length,
		averageWellCost: totalInvestment / wells.length,
		operatingMargin: ((totalRevenue - totalCosts) / totalRevenue) * 100,
		fiscalSummary: {
			averageRoyalty:
				(economics.reduce((sum, e) => sum + e.fiscalTerms.royalty, 0) /
					economics.length) *
				100,
			averageWorkingInterest:
				(economics.reduce((sum, e) => sum + e.fiscalTerms.workingInterest, 0) /
					economics.length) *
				100,
			totalTaxes:
				economics.reduce(
					(sum, e) =>
						sum +
						(e.fiscalTerms.severanceTax || 0) +
						(e.fiscalTerms.adValoremTax || 0),
					0,
				) * totalRevenue,
		},
	};

	// Risk analysis
	const avgNpv = economicEvaluation.npv10;
	const riskAnalysis: RiskAnalysis = {
		riskFactors: [
			{
				factor: "Oil Price Volatility",
				impact: "high",
				probability: "high",
				mitigation: "Hedging strategy recommended",
			},
			{
				factor: "Decline Rate Uncertainty",
				impact: "medium",
				probability: "medium",
				mitigation: "Additional well performance monitoring",
			},
		],
		sensitivityAnalysis: {
			oilPriceImpact: avgNpv * 0.15, // 15% NPV change per $1/barrel
			gasPriceImpact: avgNpv * 0.08, // 8% NPV change per $0.10/MCF
			wellCostImpact: avgNpv * -0.12, // -12% NPV change per $100k well cost
			declineRateImpact: avgNpv * -0.1, // -10% NPV change per 1% decline rate
		},
		confidenceIntervals: {
			p10: avgNpv * 1.4, // Optimistic
			p50: avgNpv, // Expected
			p90: avgNpv * 0.6, // Conservative
		},
	};

	// Portfolio summary
	const portfolioSummary: PortfolioSummary = {
		totalProjects: projects.length,
		totalWells: wells.length,
		totalReserves: totalBoeReserves,
		totalNPV: economicEvaluation.npv10,
		averageIRR: economicEvaluation.irr,
		averagePayout: economicEvaluation.payout,
		topPerformingWells: economics
			.map((e) => ({
				wellName:
					wells.find((w) => w.wellId === e.wellId)?.wellName || "Unknown",
				npv: e.results.npv10,
				irr: e.results.irr,
				eur: e.results.eur,
			}))
			.sort((a, b) => b.npv - a.npv)
			.slice(0, 5),
		portfolioRisk:
			economicEvaluation.irr > 20
				? "low"
				: economicEvaluation.irr > 15
					? "medium"
					: "high",
	};

	return {
		reservesAssessment,
		productionForecasting,
		economicEvaluation,
		riskAnalysis,
		portfolioSummary,
	};
}

function calculateAriesQuality(
	_projects: AriesProject[],
	wells: AriesWell[],
	forecasts: AriesForecast[],
	economics: AriesEconomics[],
): AriesData["qualityMetrics"] {
	// Data completeness: percentage of wells with forecasts and economics
	const wellsWithForecasts = wells.filter((w) =>
		forecasts.some((f) => f.wellId === w.wellId),
	).length;
	const wellsWithEconomics = wells.filter((w) =>
		economics.some((e) => e.wellId === w.wellId),
	).length;
	const dataCompleteness =
		wells.length > 0
			? (wellsWithForecasts + wellsWithEconomics) / (2 * wells.length)
			: 0;

	// Forecast reliability: based on confidence levels and R² values
	const avgConfidence =
		forecasts.reduce((sum, f) => sum + f.quality.confidenceLevel, 0) /
		forecasts.length;
	const avgR2 =
		forecasts.reduce((sum, f) => sum + (f.quality.r2 || 0), 0) /
		forecasts.length;
	const forecastReliability = (avgConfidence + avgR2) / 2;

	// Economic consistency: variance in key economic metrics
	const irrs = economics.map((e) => e.results.irr);
	const avgIrr = irrs.reduce((sum, irr) => sum + irr, 0) / irrs.length;
	const irrVariance =
		irrs.reduce((sum, irr) => sum + (irr - avgIrr) ** 2, 0) / irrs.length;
	const economicConsistency = Math.max(0, 1 - Math.sqrt(irrVariance) / avgIrr);

	// Overall confidence
	const confidence =
		(dataCompleteness + forecastReliability + economicConsistency) / 3;

	return {
		dataCompleteness: Math.round(dataCompleteness * 100) / 100,
		forecastReliability: Math.round(forecastReliability * 100) / 100,
		economicConsistency: Math.round(economicConsistency * 100) / 100,
		confidence: Math.round(confidence * 100) / 100,
	};
}

// CLI usage
const main = async () => {
	const filePath = process.argv[2];
	const options = process.argv.slice(3);

	if (!filePath) {
		console.error(
			"Usage: aries-processor <database.adb> [--json|--summary|--economics]",
		);
		console.error("Options:");
		console.error("  --json       Output full JSON data");
		console.error("  --summary    Output project summary (default)");
		console.error("  --economics  Output economic analysis only");
		process.exit(1);
	}

	if (!fs.existsSync(filePath)) {
		console.error(`ARIES database file not found: ${filePath}`);
		process.exit(1);
	}

	try {
		const ariesData = await processAriesDatabase(filePath);

		if (options.includes("--economics")) {
			console.log(
				JSON.stringify(
					{
						databaseName: ariesData.databaseName,
						format: ariesData.format,
						economicEvaluation: ariesData.oilGasAnalysis.economicEvaluation,
						portfolioSummary: ariesData.oilGasAnalysis.portfolioSummary,
						qualityMetrics: ariesData.qualityMetrics,
					},
					null,
					2,
				),
			);
		} else if (options.includes("--json")) {
			console.log(JSON.stringify(ariesData, null, 2));
		} else {
			// Summary output (default)
			const summary = {
				format: ariesData.format,
				version: ariesData.version,
				databaseName: ariesData.databaseName,
				projects: ariesData.projects.length,
				wells: ariesData.wells.length,
				forecasts: ariesData.forecasts.length,
				economics: ariesData.economics.length,
				totalRecords: ariesData.totalRecords,
				portfolioSummary: {
					totalReserves:
						ariesData.oilGasAnalysis.portfolioSummary.totalReserves,
					totalNPV: ariesData.oilGasAnalysis.portfolioSummary.totalNPV,
					averageIRR: ariesData.oilGasAnalysis.portfolioSummary.averageIRR,
					portfolioRisk:
						ariesData.oilGasAnalysis.portfolioSummary.portfolioRisk,
				},
				quality: ariesData.qualityMetrics,
				metadata: {
					fileSize: ariesData.metadata.fileSize,
					licenseRequired: ariesData.metadata.licenseRequired,
					modifiedDate: ariesData.metadata.modifiedDate,
				},
			};
			console.log(JSON.stringify(summary, null, 2));
		}
	} catch (error) {
		console.error(`Error processing ARIES database: ${error}`);
		process.exit(1);
	}
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
