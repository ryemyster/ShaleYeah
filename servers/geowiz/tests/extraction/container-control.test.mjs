import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("container readiness observes diagnostics written to stderr", () => {
	const result = spawnSync(
		"uv",
		[
			"run",
			"--project",
			"../../evaluations",
			"--locked",
			"python",
			"-I",
			"-c",
			[
				"import runpy, sys",
				"invoke = runpy.run_path('scripts/check-containers.py')['invoke']",
				"message = 'MCP HTTP transport listening on port 3456'",
				"output = invoke(sys.executable, '-c', 'import sys; sys.stderr.write(' + repr(message) + ')', combine_output=True)",
				"assert output == message, repr(output)",
				"assert invoke(sys.executable, '-c', 'import sys; print(123); sys.stderr.write(\"diagnostic\")') == '123'",
			].join("\n"),
		],
		{ encoding: "utf8" },
	);
	assert.equal(result.status, 0, result.stderr);
});

test("unavailable container runtime blocks with a decision instead of skipping", () => {
	const temporary = mkdtempSync(path.join(os.tmpdir(), "shale-container-denied-"));
	try {
		const report = path.join(temporary, "report.json");
		const result = spawnSync(
			"uv",
			[
				"run",
				"--project",
				"../../evaluations",
				"--locked",
				"python",
				"scripts/check-containers.py",
				"--bundle",
				temporary,
				"--report",
				report,
			],
			{
				env: { ...process.env, DOCKER_HOST: "unix:///nonexistent-shale-test.sock" },
				encoding: "utf8",
			},
		);
		assert.equal(result.status, 1, result.stderr);
		const metadata = JSON.parse(readFileSync(report, "utf8"));
		assert.equal(metadata.status, "blocked");
		assert.equal(metadata.qualification, "fixture");
		assert.equal(metadata.professionalAcceptance, false);
		assert.ok(metadata.failures.includes("container_runtime_unavailable"));
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
});
