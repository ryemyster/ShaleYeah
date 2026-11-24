import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadForecastBinding } from "../dist/configuration.js";
import { CurveSmithServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.CURVE_SMITH_HTTP_CONFIG_FILE);
	const forecast = await readPrivateJson(config.forecastConfigFile, 8_000_000);
	if (!forecast.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadForecastBinding(config.forecastConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries([
		["read_forecast_inputs", "reservoir:read"], ["read_forecast_source", "reservoir:read"],
		["get_context_source_metadata", "reservoir:read"], ["calculate_forecast", "reservoir:read"],
		["compare_forecasts", "reservoir:read"], ["draft_forecast", "reservoir:forecast"],
		["prepare_review", "reservoir:review"], ["get_review_status", "reservoir:review"],
		["record_forecast", "reservoir:forecast"],
	].map(([name, scope]) => [name, [scope]]));
	server = new CurveSmithServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: { access: {
			mode: "local", principal, accessToken, bindHost: "127.0.0.1",
			allowedHosts: ["127.0.0.1"], allowedOrigins: [],
			policy: { id: "access.reservoir-engineer", version: "r1", connectionScopes: ["reservoir:read"], toolScopes, resourceScopes: {} },
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
	console.error("Curve-smith HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
