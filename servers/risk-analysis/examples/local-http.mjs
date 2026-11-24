import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadRiskBinding } from "../dist/configuration.js";
import { RiskAnalysisServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.RISK_ANALYSIS_HTTP_CONFIG_FILE);
	const risk = await readPrivateJson(config.riskConfigFile, 8_000_000);
	if (!risk.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadRiskBinding(config.riskConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries([
		["read_risk_inputs", "risk:read"], ["read_risk_source", "risk:read"],
		["get_context_source_metadata", "risk:read"], ["calculate_risk", "risk:read"],
		["compare_risk_scenarios", "risk:read"], ["draft_risk", "risk:assess"],
		["prepare_risk_review", "risk:review"], ["risk_review_status", "risk:review"],
		["record_risk_assessment", "risk:assess"],
	].map(([name, scope]) => [name, [scope]]));
	server = new RiskAnalysisServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: { access: {
			mode: "local", principal, accessToken, bindHost: "127.0.0.1",
			allowedHosts: ["127.0.0.1"], allowedOrigins: [],
			policy: { id: "access.risk-analyst", version: "r1", connectionScopes: ["risk:read"], toolScopes, resourceScopes: {} },
			audit: async (event) => {
				await emitter.emit("tool", event.decision === "allow" ? "succeeded" : "denied", {
					error: event.decision === "deny" ? { code: "access_denied", classification: "auth_required" } : undefined,
				});
			},
		} },
	});
	await server.initialize();
	const close = async () => { await server.stop(); binding.close(); };
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
} catch {
	console.error("Risk Analysis HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
