import { bindMCPEvents, createFileModelCredentialResolver, loadJsonlEmitter, readPrivateJson } from "@shaleyeah/sdk";
import { loadReporterBinding } from "../dist/configuration.js";
import { ReporterServer } from "../dist/server.js";

let server, binding;
try {
	const config = await readPrivateJson(process.env.REPORTER_HTTP_CONFIG_FILE);
	const reporting = await readPrivateJson(config.reporterConfigFile, 8_000_000);
	if (!reporting.sensitiveFiles.includes(config.accessTokenFile)) throw new Error("Access credential scanner required");
	binding = await loadReporterBinding(config.reporterConfigFile);
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
	process.env.PORT ??= "3009";
	server = new ReporterServer({
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
					id: "access.reporter",
					version: "r1",
					connectionScopes: ["reporter:sources"],
					toolScopes: {
						get_reporter_status: ["reporter:sources"],
						get_reviewed_source: ["reporter:sources"],
						get_context_source_metadata: ["reporter:sources"],
						draft_report: ["reporter:sources"],
						get_model_profile: ["reporter:sources"],
						synthesize_report: ["reporter:sources"],
						prepare_review: ["reporter:review"],
						get_review_status: ["reporter:review"],
						release_report: ["reporter:release"],
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
		binding.reviewWorkflow.close();
		process.exitCode = 0;
	};
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
} catch {
	console.error("Reporter HTTP startup blocked: private access/event/source/review configuration required.");
	binding?.reviewWorkflow.close();
	process.exitCode = 1;
}
