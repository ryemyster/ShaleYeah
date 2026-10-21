import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { qaProfileSchema } from "../dist/tools/qa-rules.js";
import { reviewJson } from "@shaleyeah/sdk";

const directory = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2] && process.getuid, "Supply an empty private fixture directory on a POSIX host");
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
assert.equal((await fs.readdir(directory)).length, 0, "Fixture directory must be empty");
const info = await fs.lstat(directory);
assert.ok(info.isDirectory() && !info.isSymbolicLink() && !(info.mode & 0o077) && info.uid === process.getuid());
const profile = qaProfileSchema.parse(JSON.parse(await fs.readFile(new URL("profile.json", import.meta.url), "utf8")));
const data = JSON.parse(await fs.readFile(new URL("source.json", import.meta.url), "utf8"));
const observedAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 3600000).toISOString();
data.rows[0].asOf = observedAt;
const bytes = Buffer.from(JSON.stringify(data)), hash = (input) => createHash("sha256").update(input).digest("hex");
const scope = { customerId: "operator-fixture", assetId: "well-1", taskId: "task.qa.fixture", employeeId: "employee.qa" };
const refs = ["source.input", "source.reference"].map((id) => ({ id, revision: "r1", uri: `urn:qa:fixture:${id}` }));
const task = { contractVersion: "0.1.0", kind: "task-assignment", id: scope.taskId, revision: "r1", scope, outcome: "Check synthetic normalized rows", requiredCapabilities: ["qa.check"], inputs: refs, constraints: [], status: "assigned", workProductRefs: [], reviewDecisionRefs: [] };
const config = { version: "0.1.0", sourceAuthority: "operator-attested-export", qualification: "fixture",
	correlation: { runId: `run.qa.${randomUUID()}`, traceId: randomUUID().replaceAll("-", "") },
	directory: path.join(directory, "state"), auditFile: path.join(directory, "state/events.jsonl"), task, profile,
	grant: { subjectId: "qa.fixture.operator", scope, taskRevision: task.revision, profileRef: { id: profile.id, revision: profile.revision }, profileHash: hash(reviewJson(profile)), operations: ["run", "read", "report"], current: true, expiresAt },
	sources: refs.map((ref) => ({ snapshot: { scope, evidence: { ...ref, hash: { algorithm: "sha256", value: hash(bytes) }, asOf: observedAt, accessClassification: "restricted", usagePolicy: { id: "policy.synthetic.fixture", version: "r1" } }, bytesBase64: bytes.toString("base64") }, grant: { subjectId: "qa.fixture.operator", scope, taskRevision: task.revision, operations: ["read", "export"], current: true, expiresAt } })),
	localOperator: { uid: process.getuid(), subjectId: "qa.fixture.operator" }, sensitiveFiles: [], retentionSeconds: 3600,
};
const file = path.join(directory, "qa.json"); await fs.writeFile(file, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
console.log(file);
