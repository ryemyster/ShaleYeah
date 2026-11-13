import { type MCPServer, ServerFactory, type ServerRuntimeOptions, type ServerTemplate } from "@shaleyeah/sdk";
import { type RiskEmployeeOptions, riskEmployeeTools } from "./employee-tools.js";

export type RiskAnalysisOptions = RiskEmployeeOptions & ServerRuntimeOptions;
export function createRiskAnalysisTemplate(options: RiskAnalysisOptions = {}): ServerTemplate {
	return {
		name: "risk-analysis",
		description: "Source-bound joint-scenario risk appraisal with exact human review",
		persona: {
			name: "Gaius Probabilis Assessor",
			role: "Risk appraisal tooling",
			expertise: ["Declared joint scenarios", "Source-linked risk registers", "Operator risk-policy coverage"],
		},
		directories: [],
		tools: riskEmployeeTools(options),
	};
}
export const RiskAnalysisServer = function (options: RiskAnalysisOptions = {}) {
	if (!new.target) throw new Error("Risk Analysis requires constructor invocation");
	const server = new (ServerFactory.createServer(createRiskAnalysisTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: RiskAnalysisOptions): MCPServer };
