import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Economist and Econobot run from independent source, wheels and production archives", async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), "econobot-extraction-control-"));
	try {
		const reportFile = path.join(directory, "report.json");
		const child = spawn(process.execPath, ["scripts/check-extraction.mjs", "--report", reportFile], {
			cwd: fileURLToPath(new URL("../../", import.meta.url)), stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { if (output.length < 1_000_000) output += bytes.toString(); });
		const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
		assert.equal(code, 0, output);
		const report = JSON.parse(await readFile(reportFile, "utf8"));
		assert.equal(report.status, "passed");
		assert.equal(report.professionalAcceptance, false);
		for (const id of ["clean-source-build", "installed-tool", "archive-allowlist", "generic-mcp", "production-independent-client", "installed-employee", "external-mcp", "actual-output-grading", "source-context-review-restart", "source-revocation", "installed-exact-qualification"])
			assert.equal(report.controls.find((control) => control.id === id)?.status, "passed", id);
		for (const key of ["artifactSha256", "employeeArtifactSha256", "productionLockSha256", "employeeLockSha256", "verifierLockSha256"])
			assert.match(report[key], /^[a-f0-9]{64}$/);
	} finally { await rm(directory, { recursive: true, force: true }); }
});
