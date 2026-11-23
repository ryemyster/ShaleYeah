/** Export synthetic private inputs for the independent production-only stdio check. */
import fs from "node:fs/promises";
import path from "node:path";
import { localBindingFixture } from "./local-binding.js";
import { ref } from "./title.js";

const requested = path.resolve(process.argv[2]);
const destination = path.join(await fs.realpath(path.dirname(requested)), path.basename(requested));
const f = await localBindingFixture({ liveClock: true });
try {
	await fs.mkdir(destination, { mode: 0o700 });
	await fs.cp(f.inputs, path.join(destination, "inputs"), { recursive: true });
	await fs.copyFile(path.join(f.root, "access-key"), path.join(destination, "access-key"));
	const configurationFile = path.join(destination, "stdio-title.json");
	await fs.writeFile(configurationFile, JSON.stringify(f.config).replaceAll(f.root, destination), { mode: 0o600 });
	await fs.writeFile(
		path.join(destination, "stdio-client.json"),
		JSON.stringify({
			configurationFile,
			workingDirectory: destination,
			taskRef: ref,
			proposal: f.proposal,
			correlation: {
				context: {
					scope: f.current.task.scope,
					taskRevision: ref.revision,
					...f.config.correlation,
					qualification: "fixture",
				},
				parentEventId: "production-client",
				spanId: "1".repeat(16),
			},
		}),
		{ mode: 0o600 },
	);
} finally {
	await f.close();
}
