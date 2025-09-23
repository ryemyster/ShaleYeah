#!/usr/bin/env node

/**
 * SHALE YEAH MCP Client Orchestrator
 *
 * Standards-compliant MCP client that coordinates 14 domain expert servers
 * for comprehensive oil & gas investment analysis.
 *
 * Implements Anthropic MCP best practices:
 * - JSON-RPC 2.0 protocol compliance
 * - Proper session management
 * - Multi-server coordination
 * - Error recovery and resilience
 */

import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPAnalysisResult, EconomicAnalysis, DeclineCurveAnalysis } from "./shared/types.js";

export interface MCPServerConfig {
	name: string;
	script: string;
	description: string;
	persona: string;
	domain: string;
	capabilities: string[];
}

export interface AnalysisRequest {
	runId: string;
	tractName: string;
	mode: "demo" | "production";
	inputFiles?: string[];
	outputDir: string;
	workflow?: string;
}

export interface AnalysisResult {
	server: string;
	persona: string;
	analysis: MCPAnalysisResult;
	confidence: number;
	executionTime: number;
	success: boolean;
	error?: string;
}

export interface WorkflowResult {
	runId: string;
	totalTime: number;
	results: AnalysisResult[];
	recommendation: string;
	confidence: number;
	success: boolean;
}

/**
 * MCP Client for SHALE YEAH multi-server orchestration
 */
export class ShaleYeahMCPClient {
	private clients: Map<string, Client> = new Map();
	private transports: Map<string, StdioClientTransport> = new Map();
	private serverConfigs: MCPServerConfig[] = [];
	private initialized = false;

	constructor() {
		this.initializeServerConfigs();
	}

	/**
	 * Initialize all server configurations
	 */
	private initializeServerConfigs(): void {
		this.serverConfigs = [
			{
				name: "geowiz",
				script: "src/servers/geowiz.ts",
				description: "Geological Analysis Server",
				persona: "Marcus Aurelius Geologicus",
				domain: "geology",
				capabilities: [
					"formation_analysis",
					"gis_processing",
					"well_log_analysis",
				],
			},
			{
				name: "econobot",
				script: "src/servers/econobot.ts",
				description: "Economic Analysis Server",
				persona: "Caesar Augustus Economicus",
				domain: "economics",
				capabilities: ["dcf_analysis", "financial_modeling", "cost_estimation"],
			},
			{
				name: "curve-smith",
				script: "src/servers/curve-smith.ts",
				description: "Reservoir Engineering Server",
				persona: "Lucius Technicus Engineer",
				domain: "engineering",
				capabilities: ["decline_curves", "eur_estimation", "type_curves"],
			},
			{
				name: "reporter",
				script: "src/servers/reporter.ts",
				description: "Executive Reporting Server",
				persona: "Scriptor Reporticus Maximus",
				domain: "reporting",
				capabilities: ["executive_summary", "report_generation", "synthesis"],
			},
			{
				name: "decision",
				script: "src/servers/decision.ts",
				description: "Investment Decision Server",
				persona: "Augustus Decidius Maximus",
				domain: "strategy",
				capabilities: [
					"investment_strategy",
					"portfolio_optimization",
					"decision_analysis",
				],
			},
			{
				name: "risk-analysis",
				script: "src/servers/risk-analysis.ts",
				description: "Risk Assessment Server",
				persona: "Gaius Probabilis Assessor",
				domain: "risk",
				capabilities: ["risk_assessment", "monte_carlo", "scenario_analysis"],
			},
			{
				name: "legal",
				script: "src/servers/legal.ts",
				description: "Legal Analysis Server",
				persona: "Legatus Juridicus",
				domain: "legal",
				capabilities: [
					"contract_analysis",
					"compliance_review",
					"legal_framework",
				],
			},
			{
				name: "market",
				script: "src/servers/market.ts",
				description: "Market Analysis Server",
				persona: "Mercatus Analyticus",
				domain: "market",
				capabilities: [
					"market_analysis",
					"competitive_analysis",
					"price_forecasting",
				],
			},
			{
				name: "development",
				script: "src/servers/development.ts",
				description: "Development Planning Server",
				persona: "Architectus Developmentus",
				domain: "development",
				capabilities: [
					"development_planning",
					"project_management",
					"resource_allocation",
				],
			},
			{
				name: "drilling",
				script: "src/servers/drilling.ts",
				description: "Drilling Operations Server",
				persona: "Perforator Maximus",
				domain: "drilling",
				capabilities: [
					"drilling_program",
					"cost_estimation",
					"risk_assessment",
				],
			},
			{
				name: "infrastructure",
				script: "src/servers/infrastructure.ts",
				description: "Infrastructure Planning Server",
				persona: "Structura Ingenious",
				domain: "infrastructure",
				capabilities: [
					"infrastructure_planning",
					"capacity_analysis",
					"cost_estimation",
				],
			},
			{
				name: "title",
				script: "src/servers/title.ts",
				description: "Title Analysis Server",
				persona: "Titulus Verificatus",
				domain: "title",
				capabilities: [
					"title_examination",
					"ownership_analysis",
					"due_diligence",
				],
			},
			{
				name: "test",
				script: "src/servers/test.ts",
				description: "Quality Assurance Server",
				persona: "Testius Validatus",
				domain: "quality",
				capabilities: ["quality_tests", "validation", "compliance_checking"],
			},
			{
				name: "research",
				script: "src/servers/research.ts",
				description: "Research Server",
				persona: "Scientius Researchicus",
				domain: "research",
				capabilities: [
					"market_research",
					"technology_analysis",
					"competitive_intelligence",
				],
			},
		];
	}

	/**
	 * Initialize connections to all MCP servers
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		console.log("🔗 Initializing MCP Client connections...");
		console.log(
			`📡 Connecting to ${this.serverConfigs.length} domain expert servers`,
		);

		const connectionPromises = this.serverConfigs.map(async (config) => {
			try {
				await this.connectToServer(config);
				console.log(
					`  ✅ ${config.persona} (${config.name}) - ${config.domain}`,
				);
			} catch (error) {
				console.log(
					`  ❌ ${config.name} - Connection failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				throw error;
			}
		});

		await Promise.all(connectionPromises);
		this.initialized = true;
		console.log("🎯 All MCP servers connected successfully!\\n");
	}

	/**
	 * Connect to a single MCP server
	 */
	private async connectToServer(config: MCPServerConfig): Promise<void> {
		const transport = new StdioClientTransport({
			command: "npx",
			args: ["tsx", config.script],
		});

		const client = new Client(
			{
				name: "shale-yeah-client",
				version: "1.0.0",
			},
			{
				capabilities: {
					tools: {},
					resources: {},
				},
			},
		);

		await client.connect(transport);

		this.clients.set(config.name, client);
		this.transports.set(config.name, transport);
	}

	/**
	 * Execute comprehensive oil & gas investment analysis
	 */
	async executeAnalysis(request: AnalysisRequest): Promise<WorkflowResult> {
		if (!this.initialized) {
			await this.initialize();
		}

		const startTime = Date.now();
		const results: AnalysisResult[] = [];

		console.log(`🛢️  SHALE YEAH - MCP-Powered Investment Analysis`);
		console.log("================================================");
		console.log(`📋 Analysis ID: ${request.runId}`);
		console.log(`🗺️  Target Tract: ${request.tractName}`);
		console.log(`📁 Output Directory: ${request.outputDir}`);
		console.log(`💡 Mode: ${request.mode.toUpperCase()}`);
		console.log();

		// Create output directory
		await fs.mkdir(request.outputDir, { recursive: true });

		// Execute complete analysis workflow with all 14 servers
		const allServers = this.serverConfigs.map((config) => config.name);

		for (const serverName of allServers) {
			const result = await this.executeServerAnalysis(serverName, request);
			results.push(result);

			if (result.success) {
				console.log(
					`🤖 ${result.persona}: ✅ ${result.confidence}% confidence in ${result.executionTime}ms`,
				);
			} else {
				console.log(
					`🤖 ${result.persona}: ❌ Analysis failed - ${result.error}`,
				);
			}
		}

		const totalTime = Date.now() - startTime;
		const successfulResults = results.filter((r) => r.success);
		const overallConfidence = Math.round(
			successfulResults.reduce((sum, r) => sum + r.confidence, 0) /
				successfulResults.length,
		);

		// Generate final recommendation
		const recommendation = this.generateRecommendation(
			successfulResults,
			overallConfidence,
		);

		// Write final reports
		await this.writeAnalysisReports(
			request,
			results,
			recommendation,
			overallConfidence,
		);

		console.log();
		console.log(`🎯 SHALE YEAH Analysis Complete!`);
		console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
		console.log(`📊 Overall Recommendation: ${recommendation}`);

		return {
			runId: request.runId,
			totalTime,
			results,
			recommendation,
			confidence: overallConfidence,
			success: successfulResults.length >= 4, // Need at least 4 successful analyses
		};
	}

	/**
	 * Execute analysis on a specific server
	 */
	private async executeServerAnalysis(
		serverName: string,
		request: AnalysisRequest,
	): Promise<AnalysisResult> {
		const config = this.serverConfigs.find((c) => c.name === serverName);
		const client = this.clients.get(serverName);

		if (!config || !client) {
			return {
				server: serverName,
				persona: "Unknown",
				analysis: {},
				confidence: 0,
				executionTime: 0,
				success: false,
				error: "Server not found or not connected",
			};
		}

		const startTime = Date.now();

		try {
			// In demo mode, use realistic mock analysis
			if (request.mode === "demo") {
				const mockAnalysis = this.generateMockAnalysis(serverName, request);
				const executionTime = Date.now() - startTime;

				return {
					server: serverName,
					persona: config.persona,
					analysis: mockAnalysis as MCPAnalysisResult,
					confidence: typeof mockAnalysis.confidence === 'number' ? mockAnalysis.confidence : 85,
					executionTime,
					success: true,
				};
			}

			// Production mode - call actual MCP server tools
			const tools = await client.listTools();
			const primaryTool = tools.tools[0]; // Use first available tool

			if (!primaryTool) {
				throw new Error("No tools available on server");
			}

			// Create server-specific arguments
			const toolArguments = this.getServerSpecificArguments(
				serverName,
				primaryTool.name,
				request,
			);

			const result = await client.callTool({
				name: primaryTool.name,
				arguments: toolArguments,
			});

			const executionTime = Date.now() - startTime;

			return {
				server: serverName,
				persona: config.persona,
				analysis: result.content as MCPAnalysisResult,
				confidence:
					((result.content as Record<string, unknown>)?.confidence as number) ||
					85,
				executionTime,
				success: true,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;

			return {
				server: serverName,
				persona: config.persona,
				analysis: {},
				confidence: 0,
				executionTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get server-specific tool arguments
	 */
	private getServerSpecificArguments(
		serverName: string,
		_toolName: string,
		request: AnalysisRequest,
	): Record<string, unknown> {
		const baseArgs = {
			tractName: request.tractName,
			runId: request.runId,
			outputPath: path.join(request.outputDir, `${serverName}-analysis.json`),
		};

		// Default project data for all servers
		const defaultProjectData = {
			npv: 2500000,
			irr: 28.5,
			geology: { quality: "good", formations: ["Wolfcamp A", "Wolfcamp B"] },
			market: { outlook: "stable", oilPrice: 75, gasPrice: 3.5 },
			engineering: { eur: 450000, initialRate: 1200 },
		};

		const defaultAnalysisResults = {
			geological: {
				formations: ["Wolfcamp A", "Wolfcamp B"],
				porosity: 14.5,
				permeability: 0.8,
			},
			economic: { npv: 2500000, irr: 28.5, payback: 8 },
			engineering: { eur: 450000, initialRate: 1200, declineRate: 12 },
			risk: { overallRisk: "Medium", score: 65 },
		};

		// Server-specific argument mapping for all 14 servers
		switch (serverName) {
			case "title":
				return {
					propertyDescription: request.tractName || "Demo Analysis Tract",
					county: "Demo County",
					state: "Texas",
					examPeriod: "20 years",
					outputPath: baseArgs.outputPath,
				};

			case "geowiz":
				return {
					filePath: "data/samples/demo.las",
					depthInterval: "5000-15000",
					formations: ["Wolfcamp A", "Wolfcamp B", "Bone Spring"],
					outputPath: baseArgs.outputPath,
				};

			case "curve-smith":
				return {
					filePath: "data/samples/demo.las",
					wellType: "horizontal",
					lateralLength: "10000",
					outputPath: baseArgs.outputPath,
				};

			case "econobot":
				return {
					filePath: "data/samples/economics.csv",
					dataType: "mixed" as const,
					oilPrice: 75,
					gasPrice: 3.5,
					outputPath: baseArgs.outputPath,
				};

			case "risk-analysis":
				return {
					projectData: defaultProjectData,
					outputPath: baseArgs.outputPath,
				};

			case "reporter":
				return {
					tractName: request.tractName || "Demo Analysis Tract",
					analysisResults: defaultAnalysisResults,
					decisionCriteria: {
						minNPV: 1000000,
						minIRR: 15,
						maxRisk: "High",
					},
					outputPath: baseArgs.outputPath,
				};

			case "decision":
				return {
					analysisInputs: defaultAnalysisResults,
					outputPath: baseArgs.outputPath,
				};

			case "legal":
				return {
					jurisdiction: "Texas",
					projectType: "development" as const,
					assets: [request.tractName || "Demo Analysis Tract"],
					outputPath: baseArgs.outputPath,
				};

			case "market":
				return {
					commodity: "both" as const,
					region: "Permian Basin",
					outputPath: baseArgs.outputPath,
				};

			case "development":
				return {
					project: {
						name: request.tractName || "Demo Analysis Tract",
						type: "horizontal drilling program",
						wells: 8,
						spacing: "660ft",
					},
					outputPath: baseArgs.outputPath,
				};

			case "drilling":
				return {
					wellParameters: {
						lateralLength: 10000,
						stages: 45,
						clustersPerStage: 4,
					},
					location: {
						latitude: 31.8457,
						longitude: -102.3676,
						basin: "Permian",
					},
					outputPath: baseArgs.outputPath,
				};

			case "infrastructure":
				return {
					projectScope: {
						wells: 8,
						production: "1200 bbl/d initial",
						area: "Permian Basin",
					},
					requirements: [
						"flowlines",
						"separators",
						"compressors",
						"electricity",
					],
					outputPath: baseArgs.outputPath,
				};

			case "test":
				return {
					targets: ["geological", "economic", "engineering", "risk"],
					outputPath: baseArgs.outputPath,
				};

			case "research":
				return {
					topic: `Investment analysis for ${request.tractName || "oil and gas prospects"}`,
					outputPath: baseArgs.outputPath,
				};

			default:
				// Fallback for any unmapped servers
				return {
					...baseArgs,
					data: defaultProjectData,
				};
		}
	}

	/**
	 * Generate realistic mock analysis for demo mode
	 */
	private generateMockAnalysis(
		serverName: string,
		_request: AnalysisRequest,
	): MCPAnalysisResult {
		const baseConfidence = 75 + Math.random() * 20;

		const mockData: Record<string, MCPAnalysisResult> = {
			geowiz: {
				geological: {
					formationQuality: {
						reservoirQuality: "good",
						porosityAssessment: "Good porosity for completion",
						permeabilityAssessment: "Moderate permeability",
						hydrocarbonPotential: "medium",
						completionEffectiveness: "Standard completion recommended",
					},
					drillingRecommendations: {
						optimalLandingZones: ["Wolfcamp A", "Wolfcamp B"],
						lateralLengthRecommendation: "7500 ft lateral",
						completionStrategy: "Standard multi-stage frac",
						drillingRisks: ["Standard completion risk"],
					},
					investmentPerspective: {
						geologicalConfidence: baseConfidence,
						developmentPotential: "Good development potential",
						keyRisks: ["Commodity price risk"],
						comparableAnalogues: ["Nearby wells"],
						recommendedAction: "drill",
					},
					professionalSummary: "Good geological prospect",
					confidenceLevel: baseConfidence,
				},
				confidence: baseConfidence,
			},
			"curve-smith": {
				curve: {
					initialRate: {
						oil: Math.round(800 + Math.random() * 600),
						gas: Math.round(1500 + Math.random() * 1000),
						water: Math.round(50 + Math.random() * 100),
					},
					declineRate: Math.round((8 + Math.random() * 4) * 10) / 10,
					bFactor: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
					eur: {
						oil: Math.round(450000 + Math.random() * 200000),
						gas: Math.round(900000 + Math.random() * 400000),
					},
					typeCurve: "Tier 1 horizontal well",
					confidence: baseConfidence,
					qualityGrade: "Good",
				},
				confidence: baseConfidence,
			},
			econobot: {
				economic: {
					npv: Math.round((2.5 + Math.random() * 2) * 1000000),
					irr: Math.round((22 + Math.random() * 12) * 10) / 10,
					roi: Math.round((1.5 + Math.random() * 1) * 100) / 100,
					paybackPeriod: Math.round(8 + Math.random() * 6),
					paybackMonths: Math.round(8 + Math.random() * 6),
					assumptions: {
						oilPrice: 75 + Math.random() * 10,
						gasPrice: 3 + Math.random() * 1,
						drillingCost: 8000000 + Math.random() * 2000000,
						completionCost: 4000000 + Math.random() * 1000000,
					},
					sensitivityAnalysis: [],
					confidence: baseConfidence,
				},
				confidence: baseConfidence,
			},
			"risk-analysis": {
				risk: {
					overallRiskScore: Math.round(30 + Math.random() * 40),
					overallRisk: Math.round(30 + Math.random() * 40),
					riskFactors: [
						{
							category: "Technical",
							description: "Standard drilling risk",
							probability: 0.3,
							impact: 0.4,
							mitigationStrategies: ["Use experienced drilling contractor"],
						},
					],
					confidence: baseConfidence,
				},
				confidence: baseConfidence,
			},
			title: {
				confidence: baseConfidence,
			},
			reporter: {
				confidence: baseConfidence,
			},
		};

		return mockData[serverName] || { confidence: baseConfidence };
	}

	/**
	 * Generate investment recommendation based on analysis results
	 */
	private generateRecommendation(
		_results: AnalysisResult[],
		confidence: number,
	): string {
		if (confidence >= 85) {
			return "✅ PROCEED (Strong Economics & Low Risk)";
		} else if (confidence >= 70) {
			return "✅ PROCEED (Strong Economics & Acceptable Risk)";
		} else if (confidence >= 55) {
			return "⚠️ CONDITIONAL (Review Required)";
		} else {
			return "❌ DO NOT PROCEED (High Risk)";
		}
	}

	/**
	 * Write comprehensive analysis reports
	 */
	private async writeAnalysisReports(
		request: AnalysisRequest,
		results: AnalysisResult[],
		recommendation: string,
		confidence: number,
	): Promise<void> {
		// Investment Decision Summary
		const investmentDecision = `# SHALE YEAH Investment Analysis Report

**Analysis Date:** ${new Date().toISOString().split("T")[0]}
**Tract:** ${request.tractName}
**Analysis ID:** ${request.runId}
**Mode:** ${request.mode.toUpperCase()}

## Executive Summary

**RECOMMENDATION: ${recommendation}**

Our MCP-powered analysis indicates ${confidence}% confidence in the investment thesis based on comprehensive geological, engineering, and financial analysis from ${results.length} domain experts.

## Key Investment Metrics

${this.generateInvestmentMetrics(results)}

## Expert Analysis Summary

${results
	.map(
		(r) => `### ${r.persona}
- **Domain**: ${r.server}
- **Confidence**: ${r.confidence}%
- **Status**: ${r.success ? "✅ Complete" : "❌ Failed"}
- **Execution Time**: ${r.executionTime}ms`,
	)
	.join("\\n\\n")}

## Risk Assessment

Based on comprehensive multi-domain analysis, this investment presents ${confidence >= 70 ? "acceptable" : "elevated"} risk levels with ${confidence >= 80 ? "strong" : "moderate"} economic fundamentals.

---
*Generated with SHALE YEAH MCP Architecture*
*${new Date().toISOString()}*`;

		await fs.writeFile(
			path.join(request.outputDir, "INVESTMENT_DECISION.md"),
			investmentDecision,
		);

		// Detailed Analysis Report
		const detailedAnalysis = this.generateDetailedReport(request, results);
		await fs.writeFile(
			path.join(request.outputDir, "DETAILED_ANALYSIS.md"),
			detailedAnalysis,
		);

		// Financial Model JSON
		const financialModel = this.generateFinancialModel(request, results);
		await fs.writeFile(
			path.join(request.outputDir, "FINANCIAL_MODEL.json"),
			JSON.stringify(financialModel, null, 2),
		);

		console.log();
		console.log("📄 Reports Generated:");
		console.log(
			`   • Executive Summary: ${request.outputDir}/INVESTMENT_DECISION.md`,
		);
		console.log(
			`   • Detailed Analysis: ${request.outputDir}/DETAILED_ANALYSIS.md`,
		);
		console.log(
			`   • Financial Model: ${request.outputDir}/FINANCIAL_MODEL.json`,
		);
	}

	private generateInvestmentMetrics(results: AnalysisResult[]): string {
		const econResult = results.find((r) => r.server === "econobot");
		const curveResult = results.find((r) => r.server === "curve-smith");

		if (!econResult?.analysis || !curveResult?.analysis) {
			return "| Metric | Value | Assessment |\\n|--------|-------|------------|\\n| Status | Incomplete | Analysis in progress |";
		}

		const econ = econResult.analysis.economic;
		const curve = curveResult.analysis.curve;

		const npv = econ?.npv || 0;
		const irr = econ?.irr || 0;
		const payback = econ?.paybackMonths || 0;
		const eur = curve?.eur?.oil || 0;

		return `| Metric | Value | Assessment |
|--------|-------|------------|
| **NPV (10%)** | $${(npv / 1000000).toFixed(1)}M | ${npv > 2000000 ? "Strong" : "Moderate"} |
| **IRR** | ${irr}% | ${irr > 25 ? "Excellent" : irr > 18 ? "Good" : "Fair"} |
| **Payback Period** | ${payback} months | ${payback > 0 && payback < 12 ? "Fast" : "Standard"} |
| **EUR** | ${(eur / 1000).toFixed(0)}K BOE | ${eur > 500000 ? "High" : "Moderate"} |`;
	}

	private generateDetailedReport(
		request: AnalysisRequest,
		results: AnalysisResult[],
	): string {
		return `# Detailed Investment Analysis

**Analysis ID:** ${request.runId}
**Generated:** ${new Date().toISOString()}

## Analysis Overview

This comprehensive analysis was performed using SHALE YEAH's MCP architecture, coordinating ${results.length} domain expert servers for complete investment evaluation.

${results
	.map(
		(result) => `## ${result.persona} Analysis

**Domain:** ${result.server}
**Confidence:** ${result.confidence}%
**Execution Time:** ${result.executionTime}ms

${
	result.success
		? `**Key Findings:**
${JSON.stringify(result.analysis, null, 2)}`
		: `**Status:** Analysis failed - ${result.error}`
}
`,
	)
	.join("\\n")}

---
*Detailed analysis generated by SHALE YEAH MCP Client*`;
	}

	private generateFinancialModel(
		request: AnalysisRequest,
		results: AnalysisResult[],
	): Record<string, unknown> {
		const econResult = results.find((r) => r.server === "econobot");
		const curveResult = results.find((r) => r.server === "curve-smith");

		const econ = econResult?.analysis?.economic;
		const curve = curveResult?.analysis?.curve;

		return {
			analysis_metadata: {
				run_id: request.runId,
				analysis_date: new Date().toISOString(),
				mode: request.mode,
				tract_name: request.tractName,
			},
			investment_summary: {
				npv_10_percent: econ?.npv || 0,
				irr: (econ?.irr || 0) / 100,
				payback_months: econ?.paybackMonths || 0,
				roi_multiple: econ?.npv ? econ.npv / 1000000 : 0,
			},
			production_profile: {
				initial_oil_rate: curve?.initialRate?.oil || 0,
				eur_boe: curve?.eur?.oil || 0,
				decline_rate: (curve?.declineRate || 0) / 100,
			},
			confidence_metrics: {
				overall_confidence: Math.round(
					results
						.filter((r) => r.success)
						.reduce((sum, r) => sum + r.confidence, 0) /
						results.filter((r) => r.success).length,
				),
				analysis_completeness:
					(results.filter((r) => r.success).length / results.length) * 100,
			},
		};
	}

	/**
	 * Cleanup connections to all servers
	 */
	async cleanup(): Promise<void> {
		console.log("🔌 Closing MCP connections...");

		for (const [name, client] of this.clients) {
			try {
				await client.close();
				console.log(`  ✅ ${name} disconnected`);
			} catch (error) {
				console.log(
					`  ⚠️  ${name} disconnect error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		this.clients.clear();
		this.transports.clear();
		this.initialized = false;
	}

	/**
	 * Get status of all connected servers
	 */
	async getServerStatus(): Promise<
		Array<{ name: string; status: string; capabilities: string[] }>
	> {
		const status = [];

		for (const config of this.serverConfigs) {
			const client = this.clients.get(config.name);

			status.push({
				name: config.name,
				status: client ? "connected" : "disconnected",
				capabilities: config.capabilities,
			});
		}

		return status;
	}
}

export default ShaleYeahMCPClient;
