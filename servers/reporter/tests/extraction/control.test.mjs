import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Reporter source, installed employee and installed tool work outside the checkout", async () => {
	const temporary = await mkdtemp(path.join(os.tmpdir(), "reporter-extraction-control-"));
	try {
		const report = path.join(temporary, "report.json");
		const child = spawn(process.execPath, ["scripts/check-extraction.mjs", "--report", report], {
			cwd: fileURLToPath(new URL("../../", import.meta.url)),
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		for (const stream of [child.stdout, child.stderr])
			stream.on("data", (bytes) => {
				if (output.length < 1_000_000) output += bytes.toString();
			});
		const code = await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("close", resolve);
		});
		assert.equal(code, 0, output);
		const result = JSON.parse(await readFile(report, "utf8"));
		assert.equal(result.status, "passed");
		assert.equal(result.qualification, "fixture");
		assert.equal(result.professionalAcceptance, false);
		assert.deepEqual(new Set(result.units.map((unit) => unit.id)), new Set(["reporter-agent", "reporter"]));
		for (const id of [
			"clean-source-build",
			"installed-employee",
			"installed-tool",
			"source-context-review-restart",
			"source-revocation",
			"external-mcp",
		])
			assert.equal(result.controls.find((control) => control.id === id)?.status, "passed", id);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
});
