import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadQABinding } from "../dist/configuration.js";
import { QAServer } from "../dist/server.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.QA_HTTP_CONFIG_FILE);
	const qaConfiguration = await readPrivateJson(config.qaConfigFile, 8_000_000);
	if (!qaConfiguration.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadQABinding(config.qaConfigFile);
	const principal = binding.localPrincipal;
	const resolve = createFileModelCredentialResolver({
		customerId: principal.customerId,
		employeeId: principal.employeeId,
	});
	const accessToken = await resolve(
		{ customerId: principal.customerId, employeeId: principal.employeeId },
		`file:${config.accessTokenFile}`,
		"agent",
	);
	const emitter = await loadJsonlEmitter(config.eventConfigFile, [accessToken]);
	const events = config.requireCorrelation === true ? bindMCPEvents(emitter) : undefined;
	process.env.PORT ??= "3004";
	server = new QAServer({
		...binding,
		events,
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
					id: "access.qa",
					version: "r1",
					connectionScopes: ["qa:read"],
					toolScopes: {
                        get_qa_status: ["qa:read"], run_quality_tests: ["qa:run"], generate_quality_report: ["qa:report"], triage_quality_result: ["qa:report"],
                        get_context_source_metadata: ["qa:report"], draft_disposition: ["qa:review"], prepare_review: ["qa:review"], get_review_status: ["qa:review"], record_disposition: ["qa:disposition"],
                    },
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
		process.exitCode = 0;
	};
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
} catch {
	console.error("QA HTTP startup blocked: private access/event/source/review configuration required.");
	binding?.close();
	process.exitCode = 1;
}
