// Fixture diagnostics identify the failing boundary without returning private values.
import fs from "node:fs/promises";
import { parseReferenceModelConfig } from "@shaleyeah/sdk";
import { loadSourceBinding } from "@shaleyeah/server-geowiz/dist/source-config.js";

const settings = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
for (const [stage, check] of [
	["models", async () => parseReferenceModelConfig(JSON.parse(await fs.readFile(settings.modelConfigFile, "utf8")))],
	["sources", async () => loadSourceBinding(settings.sourceConfigFile, async () => {})],
]) {
	try {
		await check();
		console.log(`${stage}: passed`);
	} catch (error) {
		console.log(`${stage}: ${error.code ?? error.message ?? "blocked"} ${JSON.stringify(error.issues ?? [])}`);
	}
}
