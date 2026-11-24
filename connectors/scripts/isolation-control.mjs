import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";
import { validateSourceContract } from "@shaleyeah/contracts";

const records = JSON.parse(await fs.readFile("records.json", "utf8"));
const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "connector-installed-input-")));
const bytes = Buffer.from('DEPT,NOTE\n0,"fixture, preserve zero"\n');
const config = records.configuration;
config.workspaceRoot = directory;
config.sources[0].locator = "input.csv";
config.sources[0].format = "csv";
config.sources[0].units[0].origin = "operator-declared";
config.sources[0].evidence.hash.value = createHash("sha256").update(bytes).digest("hex");
const principal = { subjectId: config.grant.subjectId, ...config.manifest.owner, scopes: ["source:read"] };
try {
	await fs.writeFile(path.join(directory, "input.csv"), bytes);
	for (const transport of ["operator-file", "internal-api"]) {
		const adapter = transport === "operator-file" ? operatorFileAdapter : { id: "fixture.api", version: "1", sourceKinds: ["internal-api"], fetch: async (source) => ({ bytes, revision: source.evidence.revision, asOf: source.evidence.asOf, revisionOrigin: "source-reported" }) };
		config.adapterRef = { id: adapter.id, version: adapter.version };
		config.sources[0].sourceKind = transport;
		const runtime = createConnectorRuntime(config, { installedAdapters: [adapter], currentGrant: async () => config.grant, audit: async () => {}, clock: () => new Date(records.artifact.retrievedAt) });
		const fetched = await runtime.fetch(runtime.request(config.sources[0].evidence.id), principal);
		assert.deepEqual(validateSourceContract(fetched.artifact), fetched.artifact);
		assert.deepEqual(fetched.bytes, bytes);
		assert.equal(fetched.artifact.evidence.hash.value, config.sources[0].evidence.hash.value);
		await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), { ...principal, subjectId: "different" }));
	}
} finally { await fs.rm(directory, { recursive: true, force: true }); }
