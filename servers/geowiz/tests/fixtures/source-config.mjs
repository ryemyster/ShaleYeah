import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Explicit offline source declarations for real protected-server controls.
export async function sourceConfig(file, principal) {
	const records = JSON.parse(await fs.readFile(new URL("../../../../contracts/fixtures/data-connectors.json", import.meta.url), "utf8"));
	const config = records.configuration;
	const now = new Date();
	config.workspaceRoot = await fs.realpath(path.dirname(file));
	config.scope = { ...config.scope, customerId: principal.customerId, employeeId: principal.employeeId };
	config.manifest.owner = { customerId: principal.customerId, employeeId: principal.employeeId };
	config.grant = { ...config.grant, subjectId: principal.subjectId, scope: { ...config.scope }, expiresAt: new Date(now.getTime() + 86400000).toISOString() };
	config.sources[0].locator = path.basename(file);
	config.sources[0].evidence.hash.value = createHash("sha256").update(await fs.readFile(file)).digest("hex");
	config.sources[0].evidence.asOf = now.toISOString();
	return config;
}
