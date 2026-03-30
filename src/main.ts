#!/usr/bin/env node
/**
 * SHALE YEAH - MCP-Compliant Production Platform
 *
 * Main entry point for SHALE YEAH oil & gas investment analysis platform.
 * Uses standards-compliant MCP client to orchestrate 14 domain expert servers.
 *
 * Supports multiple execution modes:
 * - Production: Live analysis with real data and AI
 * - Demo: Professional demonstration with realistic mock data
 * - Batch: Multiple prospect analysis for portfolio evaluation
 * - Research: Deep-dive analysis with comprehensive reporting
 */

import fs from "node:fs/promises";
import { type AnalysisRequest, ShaleYeahMCPClient } from "./mcp-client.js";

interface CLIOptions {
	mode: "production" | "demo" | "batch" | "research";
	files?: string[];
	tract?: string;
	output?: string;
	workflow?: string;
	help?: boolean;
}

function parseCommandLineArgs(): CLIOptions {
	const args = process.argv.slice(2);
	const options: CLIOptions = {
		mode: "production",
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// Handle --key=value format
		if (arg.includes("=")) {
			const [key, value] = arg.split("=", 2);
			switch (key) {
				case "--mode":
					options.mode = value as CLIOptions["mode"];
					continue;
				case "--files":
					options.files = value.split(",");
					continue;
				case "--tract":
					options.tract = value;
					continue;
				case "--output":
					options.output = value;
					continue;
			}
		}

		switch (arg) {
			case "--mode":
				options.mode = args[++i] as CLIOptions["mode"];
				break;
			case "--files":
				options.files = args[++i].split(",");
				break;
			case "--tract":
				options.tract = args[++i];
				break;
			case "--output":
				options.output = args[++i];
				break;
			case "--workflow":
				options.workflow = args[++i];
				break;
			case "--help":
				options.help = true;
				break;
		}
	}

	return options;
}

function showHelp(): void {
	console.log(`
🛢️  SHALE YEAH - MCP-Powered Oil & Gas Investment Analysis

Usage:
  npm run start -- [options]
  npm run prod -- [options]

Options:
  --mode <mode>        Analysis mode: production, demo, batch, research (default: production)
  --files <files>      Comma-separated input files (LAS, Excel, GIS)
  --tract <name>       Target tract name (default: "Analysis Tract")
  --output <dir>       Output directory (default: ./outputs/<mode>/<timestamp>)
  --workflow <file>    Custom workflow configuration file
  --help              Show this help message

Examples:
  # Production analysis with files
  npm run prod -- --mode=production --files="data/wells/*.las,data/economics/*.xlsx" --tract="Permian Prospect A"

  # Demo mode for presentation
  npm run demo

  # Batch processing multiple prospects
  npm run start -- --mode=batch --workflow="workflows/portfolio.yaml"

  # Research mode for deep analysis
  npm run start -- --mode=research --tract="Research Target" --output="./research-results"

For more information, visit: https://github.com/your-org/ShaleYeah
`);
}

async function main(): Promise<void> {
	const options = parseCommandLineArgs();

	if (options.help) {
		showHelp();
		return;
	}

	console.log("🛢️  SHALE YEAH - MCP-Powered Investment Analysis");
	console.log("===============================================");
	console.log(`🎯 Mode: ${options.mode.toUpperCase()}`);
	if (options.files) {
		console.log(`📁 Input Files: ${options.files.length} files`);
	}
	console.log();

	// Generate unique run ID
	const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, -5);
	const runId = `${options.mode}-${timestamp}`;

	// Determine output directory based on mode
	let outputDir: string;
	if (options.output) {
		outputDir = options.output;
	} else if (options.mode === "demo") {
		outputDir = `./outputs/demo/${runId}`;
	} else if (options.mode === "batch" || options.mode === "research") {
		outputDir = `./outputs/processing/${runId}`;
	} else {
		// Production mode - use outputs directory
		outputDir = `./outputs/reports/${runId}`;
	}

	// Create analysis request
	const request: AnalysisRequest = {
		runId,
		tractName: options.tract || `${options.mode} Analysis Tract`,
		mode: options.mode === "demo" ? "demo" : "production",
		inputFiles: options.files,
		outputDir,
		workflow: options.workflow,
	};

	// Validate analysis request
	const validation = await validateAnalysisRequest(request);
	if (!validation.valid) {
		console.error("❌ Analysis validation failed:");
		validation.errors.forEach((error) => {
			console.error(`   • ${error}`);
		});
		process.exit(1);
	}

	// Initialize MCP client (wraps kernel internally)
	const client = new ShaleYeahMCPClient();

	// Create a kernel session for this analysis run
	const session = client.kernel.createSession();

	try {
		// Setup graceful shutdown
		process.on("SIGINT", async () => {
			console.log("\n🛑 Shutting down gracefully...");
			client.kernel.destroySession(session.id);
			await client.cleanup();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			console.log("\n🛑 Shutting down gracefully...");
			client.kernel.destroySession(session.id);
			await client.cleanup();
			process.exit(0);
		});

		// Execute analysis workflow via kernel — session enables result forwarding between agents
		const result = await client.executeAnalysis(request, session);

		if (result.success) {
			console.log("\n✅ Analysis completed successfully!");
			console.log(`📊 Confidence: ${result.confidence}%`);
			console.log(`⏱️  Total Time: ${(result.totalTime / 1000).toFixed(2)} seconds`);
			console.log(`📁 Results: ${outputDir}`);

			if (options.mode === "demo") {
				console.log("\n💡 This was a demonstration using realistic mock data.");
				console.log("   For production analysis, use --mode=production with real data files.");
			}
		} else {
			console.log("\n❌ Analysis failed or incomplete");
			console.log(`📊 Confidence: ${result.confidence}%`);
			console.log(`⚠️  Successful analyses: ${result.results.filter((r) => r.success).length}/${result.results.length}`);
			process.exit(1);
		}
	} catch (error) {
		console.error("💥 Fatal error during analysis:", error instanceof Error ? error.message : String(error));
		await client.cleanup();
		process.exit(1);
	} finally {
		client.kernel.destroySession(session.id);
		await client.cleanup();
	}
}

// Validate analysis requirements
async function validateAnalysisRequest(request: AnalysisRequest): Promise<{ valid: boolean; errors: string[] }> {
	const errors: string[] = [];

	// Validate output directory is writable
	try {
		await fs.mkdir(request.outputDir, { recursive: true });
	} catch (error) {
		errors.push(`Cannot create output directory: ${error instanceof Error ? error.message : String(error)}`);
	}

	// Validate input files exist (production mode)
	if (request.mode === "production" && request.inputFiles) {
		for (const file of request.inputFiles) {
			try {
				await fs.access(file);
			} catch {
				errors.push(`Input file not found: ${file}`);
			}
		}
	}

	// Validate workflow file if specified
	if (request.workflow) {
		try {
			await fs.access(request.workflow);
		} catch {
			errors.push(`Workflow file not found: ${request.workflow}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("💥 Unhandled error:", error);
		process.exit(1);
	});
}
