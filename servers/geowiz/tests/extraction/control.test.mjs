/** Clean installed units must retain the protected reference journey outside the workspace. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

test("extracted employee, tool and pair preserve contracts and review without workspace runtime files", async () => {
	const temporary = await mkdtemp(path.join(os.tmpdir(), "shale-extraction-control-"));
	try {
		const report = path.join(temporary, "report.json");
		const child = spawn(process.execPath, ["scripts/check-extraction.mjs", "--report", report], {
			cwd: packageRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		for (const stream of [child.stdout, child.stderr])
			stream.on("data", (bytes) => {
				output += bytes.toString();
			});
		const code = await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("close", resolve);
		});
		assert.equal(code, 0, output);
		const result = JSON.parse(await readFile(report, "utf8"));
		assert.equal(result.schemaVersion, "0.1.0");
		assert.equal(result.status, "passed");
		assert.equal(result.qualification, "fixture");
		assert.equal(result.professionalAcceptance, false);
		assert.deepEqual(new Set(result.units.map((unit) => unit.id)), new Set(["geologist", "geowiz"]));
		assert.ok(result.units.every((unit) => unit.independent === true && unit.artifactSha256.match(/^[a-f0-9]{64}$/)));
		for (const name of [
			"agent-external-mcp",
			"tool-generic-client",
			"paired-source-context",
			"provider-switch",
			"qualification-required",
			"human-review-resume",
			"revision-source-denial",
			"distribution-allowlist",
			"contract-version-denial",
		])
			assert.equal(result.controls.find((control) => control.id === name)?.status, "passed", name);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
});
