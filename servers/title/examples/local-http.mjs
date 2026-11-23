import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadTitleBinding } from "../dist/configuration.js";
import { TitleServer } from "../dist/index.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.TITLE_HTTP_CONFIG_FILE);
	const title = await readPrivateJson(config.titleConfigFile, 8_000_000);
	if (!title.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadTitleBinding(config.titleConfigFile);
	const principal = binding.localPrincipal;
	const owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	const accessToken = await createFileModelCredentialResolver(owner)(owner, `file:${config.accessTokenFile}`, "agent");
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const toolScopes = Object.fromEntries(
		[
			["read_title_inputs", "title:read"],
			["read_title_source", "title:read"],
			["get_context_source_metadata", "title:read"],
			["read_title_instrument", "title:read"],
			["cite_title_instrument", "title:read"],
			["examine_ownership", "title:read"],
			["trace_chain_of_title", "title:read"],
			["check_burdens", "title:read"],
			["analyze_lease", "title:read"],
			["draft_title_packet", "title:read"],
			["prepare_title_review", "title:review"],
			["title_review_status", "title:review"],
			["record_title_packet", "title:record"],
		].map(([name, scope]) => [name, [scope]]),
	);
	server = new TitleServer({
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
					id: "access.title-analyst",
					version: "r1",
					connectionScopes: ["title:read"],
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
	console.error("Title MCP HTTP startup blocked: private access, source, event and review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
