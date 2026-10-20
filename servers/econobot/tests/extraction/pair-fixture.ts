/** Export only synthetic inputs for the installed two-container journey. */
import fs from "node:fs/promises";
import path from "node:path";
import { loadEconomicBinding } from "../node_modules/@shaleyeah/server-econobot/dist/configuration.js";
import { localBindingFixture } from "./fixtures/local-binding.js";
import { ref } from "./fixtures/scenario.js";

const destination = path.resolve(process.argv[2]);
const f = await localBindingFixture({ liveClock: true });
await fs.mkdir(destination, { mode: 0o700 });
try {
	await fs.cp(f.inputs, path.join(destination, "inputs"), { recursive: true });
	await fs.copyFile(path.join(f.root, "access-key"), path.join(destination, "access-key"));
	const binding = await loadEconomicBinding(f.file);
	try {
		for (const provider of ["gemini", "anthropic"]) {
			const draft = await binding.service.draft(ref, ["base"], `${provider}-r1`, binding.localPrincipal);
			const config = JSON.parse(JSON.stringify(f.config).replaceAll(f.root, "/run/operator"));
			config.directory = `/run/operator/state-${provider}`;
			config.auditFile = `${config.directory}/events.jsonl`;
			config.sensitiveFiles.push("/run/client/access-token");
			config.review.qualificationConfigFile = "/run/operator/qualification.json";
			const settings = {
				provider,
				draft,
				task: f.current.task,
				subjectId: binding.localPrincipal.subjectId,
				tokenFile: "/run/client/access-token",
				contextDirectory: `/run/state/context-${provider}`,
				eventFile: `/run/state/events-${provider}.jsonl`,
				contextPolicy: config.review.policy.contextPolicy,
				retentionPolicy: config.review.policy.retentionPolicy,
				expiresAt: config.review.policy.expiresAt,
				correlation: config.correlation,
				expectedHead: null,
			};
			await fs.writeFile(path.join(destination, `${provider}.json`), JSON.stringify({ config, settings }), {
				mode: 0o600,
			});
		}
	} finally {
		binding.close();
	}
} finally {
	await f.close();
}
