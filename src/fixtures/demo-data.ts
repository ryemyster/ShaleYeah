/**
 * Demo fixture inputs for all 14 SHALE YEAH servers.
 *
 * These are static, deterministic args passed to real server tool handlers
 * during demo mode. No Math.random() — same inputs every run, same outputs.
 *
 * Used by demo-runner.ts instead of the deleted generateMockAnalysis().
 * Mirrors the args previously built in mcp-client.ts getServerSpecificArguments().
 */

const DEMO_OUTPUT_BASE = "./outputs/demo/fixtures";

/** Fixture args for the geowiz server (analyze_formation tool) */
const geowiz = {
	filePath: "data/samples/demo.las",
	formations: ["Wolfcamp A", "Wolfcamp B", "Bone Spring"],
	analysisType: "standard" as const,
	outputPath: `${DEMO_OUTPUT_BASE}/geowiz-analysis.json`,
};

/** Fixture args for the econobot server */
const econobot = {
	filePath: "data/samples/economics.csv",
	dataType: "mixed" as const,
	oilPrice: 75,
	gasPrice: 3.5,
	outputPath: `${DEMO_OUTPUT_BASE}/econobot-analysis.json`,
};

/** Fixture args for the curve-smith server */
const curveSmith = {
	filePath: "data/samples/demo.las",
	wellType: "horizontal",
	lateralLength: "10000",
	outputPath: `${DEMO_OUTPUT_BASE}/curve-smith-analysis.json`,
};

const defaultAnalysisResults = {
	geological: {
		formations: ["Wolfcamp A", "Wolfcamp B"],
		porosity: 14.5,
		permeability: 0.8,
	},
	economic: { npv: 2_500_000, irr: 28.5, payback: 8 },
	engineering: { eur: 450_000, initialRate: 1200, declineRate: 12 },
	risk: { overallRisk: "Medium", score: 65 },
};

const defaultProjectData = {
	npv: 2_500_000,
	irr: 28.5,
	geology: { quality: "good", formations: ["Wolfcamp A", "Wolfcamp B"] },
	market: { outlook: "stable", oilPrice: 75, gasPrice: 3.5 },
	engineering: { eur: 450_000, initialRate: 1200 },
};

/** Fixture args for the risk-analysis server */
const riskAnalysis = {
	projectData: defaultProjectData,
	outputPath: `${DEMO_OUTPUT_BASE}/risk-analysis.json`,
};

/** Fixture args for the reporter server */
const reporter = {
	tractName: "Permian Basin Demo Tract",
	analysisResults: defaultAnalysisResults,
	decisionCriteria: {
		minNPV: 1_000_000,
		minIRR: 15,
		maxRisk: "High",
	},
	outputPath: `${DEMO_OUTPUT_BASE}/reporter-analysis.json`,
};

/** Fixture args for the decision server */
const decision = {
	analysisInputs: defaultAnalysisResults,
	outputPath: `${DEMO_OUTPUT_BASE}/decision-analysis.json`,
};

/** Fixture args for the legal server */
const legal = {
	jurisdiction: "Texas",
	projectType: "development" as const,
	assets: ["Permian Basin Demo Tract"],
	outputPath: `${DEMO_OUTPUT_BASE}/legal-analysis.json`,
};

/** Fixture args for the market server */
const market = {
	commodity: "both" as const,
	region: "Permian Basin",
	outputPath: `${DEMO_OUTPUT_BASE}/market-analysis.json`,
};

/** Fixture args for the development server */
const development = {
	project: {
		name: "Permian Basin Demo Tract",
		type: "horizontal drilling program",
		wells: 8,
		spacing: "660ft",
	},
	outputPath: `${DEMO_OUTPUT_BASE}/development-analysis.json`,
};

/** Fixture args for the drilling server */
const drilling = {
	wellParameters: {
		lateralLength: 10_000,
		stages: 45,
		clustersPerStage: 4,
	},
	location: {
		latitude: 31.8457,
		longitude: -102.3676,
		basin: "Permian",
	},
	outputPath: `${DEMO_OUTPUT_BASE}/drilling-analysis.json`,
};

/** Fixture args for the infrastructure server */
const infrastructure = {
	projectScope: {
		wells: 8,
		production: "1200 bbl/d initial",
		area: "Permian Basin",
	},
	requirements: ["flowlines", "separators", "compressors", "electricity"],
	outputPath: `${DEMO_OUTPUT_BASE}/infrastructure-analysis.json`,
};

/** Fixture args for the title server */
const title = {
	propertyDescription: "Permian Basin Demo Tract",
	county: "Midland County",
	state: "Texas",
	examPeriod: "20 years",
	outputPath: `${DEMO_OUTPUT_BASE}/title-analysis.json`,
};

/** Fixture args for the test/QA server */
const test = {
	targets: ["geological", "economic", "engineering", "risk"],
	outputPath: `${DEMO_OUTPUT_BASE}/test-analysis.json`,
};

/** Fixture args for the research server */
const research = {
	topic: "Investment analysis for Permian Basin oil and gas prospects",
	outputPath: `${DEMO_OUTPUT_BASE}/research-analysis.json`,
};

/**
 * All demo fixture args indexed by server name.
 * Each entry is a static, deterministic set of tool arguments.
 */
export const DEMO_FIXTURE_ARGS = {
	geowiz,
	econobot,
	"curve-smith": curveSmith,
	reporter,
	decision,
	"risk-analysis": riskAnalysis,
	legal,
	market,
	development,
	drilling,
	infrastructure,
	title,
	test,
	research,
} as const;

/** All 14 server names in the order they appear in the kernel registry. */
export const DEMO_SERVER_NAMES = [
	"geowiz",
	"econobot",
	"curve-smith",
	"reporter",
	"decision",
	"risk-analysis",
	"legal",
	"market",
	"development",
	"drilling",
	"infrastructure",
	"title",
	"test",
	"research",
] as const;

export type DemoServerName = (typeof DEMO_SERVER_NAMES)[number];
