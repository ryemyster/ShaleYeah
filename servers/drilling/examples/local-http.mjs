import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadDrillingBinding } from "../dist/configuration.js";
import { DrillingServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.DRILLING_HTTP_CONFIG_FILE);
	const drilling = await readPrivateJson(config.drillingConfigFile, 8_000_000);
	if (!drilling.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadDrillingBinding(config.drillingConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries(
		[
			["read_drilling_inputs", "drilling:read"],
			["read_drilling_source", "drilling:read"],
			["get_context_source_metadata", "drilling:read"],
			["read_drilling_evidence", "drilling:read"],
			["cite_drilling_evidence", "drilling:read"],
			["design_drilling_program", "drilling:read"],
			["estimate_well_costs", "drilling:read"],
			["assess_drilling_risks", "drilling:read"],
			["draft_drilling_packet", "drilling:read"],
			["prepare_drilling_review", "drilling:review"],
			["drilling_review_status", "drilling:review"],
			["record_drilling_packet", "drilling:record"],
		].map(([name, scope]) => [name, [scope]]),
	);
	server = new DrillingServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: {
			access: {
				mode: "local",
				principal,
				accessToken,
				bindHost: "127.0.0.1",
				allowedHosts: ["127.0.0.1"],
				allowedOrigins: [],
				policy: {
					id: "access.drilling-engineer",
					version: "r1",
					connectionScopes: ["drilling:read"],
					toolScopes,
					resourceScopes: {},
				},
				audit: async (event) => {
					await emitter.emit("tool", event.decision === "allow" ? "succeeded" : "denied", {
						error: event.decision === "deny" ? { code: "access_denied", classification: "auth_required" } : undefined,
					});
				},
			},
		},
	});
	await server.initialize();
	const close = async () => {
		await server.stop();
		binding.close();
	};
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
} catch {
	console.error("Drilling MCP HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
