import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadLegalBinding } from "../dist/configuration.js";
import { LegalServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.LEGAL_HTTP_CONFIG_FILE);
	const legal = await readPrivateJson(config.legalConfigFile, 8_000_000);
	if (!legal.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadLegalBinding(config.legalConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries([
		["read_legal_inputs", "legal:read"], ["read_legal_source", "legal:read"],
		["get_context_source_metadata", "legal:read"], ["read_legal_provision", "legal:read"], ["cite_legal_source", "legal:read"],
		["compare_legal_sources", "legal:read"], ["draft_legal_memo", "legal:read"],
		["prepare_legal_review", "legal:review"], ["legal_review_status", "legal:review"],
		["record_legal_memo", "legal:record"],
	].map(([name, scope]) => [name, [scope]]));
	server = new LegalServer({
		...binding,
		events: bindMCPEvents(emitter),
		dataPath: config.dataPath,
		http: { access: {
			mode: "local", principal, accessToken, bindHost: "127.0.0.1",
			allowedHosts: ["127.0.0.1"], allowedOrigins: [],
			policy: { id: "access.legal-analyst", version: "r1", connectionScopes: ["legal:read"], toolScopes, resourceScopes: {} },
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
	console.error("Legal MCP HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
