import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadMarketBinding } from "../dist/configuration.js";
import { MarketServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.MARKET_HTTP_CONFIG_FILE);
	const market = await readPrivateJson(config.marketConfigFile, 8_000_000);
	if (!market.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadMarketBinding(config.marketConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries([
		["read_market_inputs", "market:read"], ["read_market_source", "market:read"],
		["get_context_source_metadata", "market:read"], ["calculate_market_scenarios", "market:read"],
		["analyze_market_conditions", "market:read"], ["competitive_analysis", "market:read"], ["draft_market_scenario", "market:read"],
		["prepare_market_review", "market:review"], ["market_review_status", "market:review"],
		["record_market_scenarios", "market:record"],
	].map(([name, scope]) => [name, [scope]]));
	server = new MarketServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: { access: {
			mode: "local", principal, accessToken, bindHost: "127.0.0.1",
			allowedHosts: ["127.0.0.1"], allowedOrigins: [],
			policy: { id: "access.market-analyst", version: "r1", connectionScopes: ["market:read"], toolScopes, resourceScopes: {} },
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
	console.error("Market MCP HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
