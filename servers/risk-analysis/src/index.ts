#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadRiskBinding } from "./configuration.js";
import { RiskAnalysisServer } from "./server.js";

export type { RiskReviewOptions } from "./review-workflow.js";
export { parseRiskReviewPolicy, RiskReviewWorkflow } from "./review-workflow.js";
export type { RiskAssessmentOptions, RiskSource } from "./risk-service.js";
export { RiskAssessmentService } from "./risk-service.js";
export type { RiskAnalysisOptions } from "./server.js";
export { createRiskAnalysisTemplate, RiskAnalysisServer } from "./server.js";
export type { RiskSnapshotHookOptions } from "./source-hooks.js";
export { createRiskSnapshotHook } from "./source-hooks.js";
export default RiskAnalysisServer;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.RISK_ANALYSIS_CONFIG_FILE;
		runMCPServer(new RiskAnalysisServer(file ? await loadRiskBinding(file) : {}));
	} catch {
		console.error("Risk Analysis startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
