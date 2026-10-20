import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadEconomicBinding } from "../dist/configuration.js";
import { EconobotServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.ECONOBOT_HTTP_CONFIG_FILE);
	const economic = await readPrivateJson(config.economicConfigFile, 8_000_000);
	if (!economic.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadEconomicBinding(config.economicConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries([
		["read_scenario_inputs", "economics:read"], ["read_scenario_source", "economics:read"],
		["get_context_source_metadata", "economics:read"], ["calculate_scenario", "economics:read"],
		["compare_scenarios", "economics:read"], ["draft_scenario", "economics:scenario"],
		["prepare_review", "economics:review"], ["get_review_status", "economics:review"],
		["record_scenario", "economics:scenario"],
	].map(([name, scope]) => [name, [scope]]));
	server = new EconobotServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: { access: {
			mode: "local", principal, accessToken, bindHost: "127.0.0.1",
			allowedHosts: ["127.0.0.1"], allowedOrigins: [],
			policy: { id: "access.economist", version: "r1", connectionScopes: ["economics:read"], toolScopes, resourceScopes: {} },
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
	console.error("Econobot HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
