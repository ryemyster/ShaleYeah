/** Authoring-only: freeze actual synthetic QA observations, not model-authored verdicts. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { reviewJson } from "@shaleyeah/sdk";
import { qaProfileSchema } from "../../src/tools/qa-rules.js";
import { fixture } from "./qa-fixture.js";

if (!process.argv[2]) throw new Error("Supply an output JSON fixture path");
const reports: Record<string, unknown> = {};
for (const mode of ["pass", "failure", "missing-reference", "error"]) {
	const f = fixture();
	try {
		if (mode === "failure") Object.assign(f.profile.rules[0], { id: "rule.units", type: "units", expectedUnit: "m" });
		if (mode === "missing-reference")
			Object.assign(f.profile.rules[0], {
				id: "rule.reference",
				type: "correctness",
				referenceSourceId: "source.missing",
				tolerance: 0,
			});
		if (mode === "error") {
			f.source.snapshot.bytes = new TextEncoder().encode("{broken");
			f.source.snapshot.evidence.hash.value = createHash("sha256").update(f.source.snapshot.bytes).digest("hex");
		}
		const profile = qaProfileSchema.parse(f.profile);
		f.grant.profileHash = createHash("sha256").update(reviewJson(profile)).digest("hex");
		const run = await f.service.run(f.request, f.principal);
		const report = await f.service.report(run.resultRef, f.principal);
		const evidence = f.source.snapshot.evidence;
		const sourceArtifact = {
			kind: "source-artifact",
			contractVersion: "0.2.0",
			scope: f.task.scope,
			taskRevision: f.task.revision,
			connectorRef: { id: "connector.qa", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			evidence,
			artifact: { id: evidence.id, revision: evidence.hash.value, uri: `urn:sha256:${evidence.hash.value}` },
			retrievedAt: "2026-10-13T00:00:00Z",
			format: "json",
			parserRef: { id: "normalized-qa-data", version: "0.1.0" },
			jurisdiction: "US-TX",
			units: [],
			byteLength: f.source.snapshot.bytes.length,
			accessNotes: "Authored operator fixture",
			licenseNotes: "Synthetic data; no licensed rule library",
			revisionOrigin: "operator-declared",
		};
		reports[mode] = {
			report,
			sourceArtifacts: [sourceArtifact],
			sourceBytesBase64: Buffer.from(f.source.snapshot.bytes).toString("base64"),
			profile,
		};
	} finally {
		f.close();
	}
}
writeFileSync(process.argv[2], `${JSON.stringify(reports, null, 2)}\n`);
