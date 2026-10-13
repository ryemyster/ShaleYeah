import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { evaluateQARules } from "../dist/tools/qa-rules.js";

const index = process.argv.indexOf("--report");
if (index < 2 || !process.argv[index + 1]) throw new Error("Supply --report METADATA_FILE");
const fixtureBytes = readFileSync(new URL("../examples/qualification-cases.json", import.meta.url));
const fixture = JSON.parse(fixtureBytes.toString("utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cases = [];
let tp = 0, fp = 0, fn = 0, tn = 0;
for (const item of fixture.cases) {
	let actual;
	try {
		const snapshots = item.sources.map((source) => {
			const bytes = Buffer.from(JSON.stringify(source.data));
			return { scope: fixture.scope, bytes, evidence: { id: source.id, revision: "r1", uri: `urn:qa:fixture:${source.id}`, hash: { algorithm: "sha256", value: source.declaredHash ?? hash(bytes) }, asOf: fixture.evaluatedAt, accessClassification: "restricted", usagePolicy: { id: "policy.synthetic", version: "r1" } } };
		});
		actual = evaluateQARules({ scope: fixture.scope, profile: item.profile, snapshots, evaluatedAt: fixture.evaluatedAt }).status;
	} catch { actual = "REJECTED"; }
	cases.push({ id: item.id, dimension: item.dimension, expected: item.expected, actual, status: actual === item.expected ? "passed" : "failed" });
	if (["PASS", "FAIL"].includes(item.expected)) {
		if (item.expected === "FAIL") { if (actual === "FAIL") tp++; else fn++; }
		else { if (actual === "FAIL") fp++; else if (actual === "PASS") tn++; }
	}
}
let codeRevision = null;
try { codeRevision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* An extracted archive has no checkout. */ }
const report = { schemaVersion: "0.1.0", unit: "qa-server", status: cases.every((item) => item.status === "passed") ? "passed" : "failed", qualification: "fixture", professionalAcceptance: false,
	codeRevision, fixture: { id: fixture.id, revision: fixture.revision, labelAuthority: fixture.labelAuthority }, fixtureHash: hash(fixtureBytes), evaluatorHash: hash(readFileSync(new URL("../dist/tools/qa-rules.js", import.meta.url))),
	cases, detection: { truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, population: "16 synthetic deterministic labels; not field accuracy" },
	reviewerEffortSeconds: null, limits: ["No measured human effort baseline", "No licensed PPDM rules adopted", "No raw petroleum format or professional interpretation qualification", "QA employee migration is separate"] };
writeFileSync(process.argv[index + 1], JSON.stringify(report, null, 2));
console.log(`QA fixture qualification ${report.status}: ${cases.length} cases; no professional acceptance`);
if (report.status !== "passed") process.exitCode = 1;
