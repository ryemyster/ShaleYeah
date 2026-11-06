#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { type MCPServer, runMCPServer, ServerFactory, type ServerTemplate } from "@shaleyeah/sdk";
import { loadForecastBinding } from "./configuration.js";
import { forecastEmployeeTools } from "./employee-tools.js";
import { type CurveSmithOptions, typeCurveTools } from "./type-curve-tools.js";

export type { ForecastSource, ProductionForecastOptions } from "./forecast-service.js";
export { ProductionForecastService } from "./forecast-service.js";
export type { ForecastReviewOptions } from "./review-workflow.js";
export { ProductionForecastWorkflow, parseForecastReviewPolicy } from "./review-workflow.js";
export type { ProductionSnapshotHookOptions } from "./source-hooks.js";
export { createProductionSnapshotHook } from "./source-hooks.js";
export type { CurveSmithOptions } from "./type-curve-tools.js";

export function createCurveSmithTemplate(options: CurveSmithOptions = {}): ServerTemplate {
	return {
		name: "curve-smith",
		description: "Source-bound production forecasts and observed diagnostics with exact human review",
		persona: {
			name: "Lucius Technicus Engineer",
			role: "Reservoir forecast tooling",
			expertise: [
				"Declared fixed-b decline models",
				"Source-linked production evidence",
				"Observed fit and holdout diagnostics",
			],
		},
		directories: [],
		tools: [...typeCurveTools(options), ...forecastEmployeeTools(options)],
	};
}
export const CurveSmithServer = function (options: CurveSmithOptions = {}) {
	if (!new.target) throw new Error("Curve-smith requires constructor invocation");
	const server = new (ServerFactory.createServer(createCurveSmithTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: CurveSmithOptions): MCPServer };
export default CurveSmithServer;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.CURVE_SMITH_CONFIG_FILE;
		runMCPServer(new CurveSmithServer(file ? await loadForecastBinding(file) : {}));
	} catch {
		console.error("Curve-smith startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
