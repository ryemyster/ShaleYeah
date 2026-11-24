import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
				env: { ...process.env, DOCKER_CONTEXT: "", DOCKER_HOST: "unix:///nonexistent-shale-test.sock" },
				encoding: "utf8",
			},
		);
		assert.equal(result.status, 1, result.stderr);
		const metadata = JSON.parse(readFileSync(report, "utf8"));
		assert.equal(metadata.status, "blocked");
		assert.equal(metadata.qualification, "fixture");
		assert.equal(metadata.professionalAcceptance, false);
		assert.ok(metadata.failures.includes("container_runtime_unavailable"), JSON.stringify(metadata));
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
});

for (const metadata of [
	{ ServerVersion: "", ServerErrors: [] },
	{ ServerVersion: "28.0.0", ServerErrors: ["offline fixture"] },
]) {
	test(`incomplete Docker server metadata blocks before reading the bundle: ${JSON.stringify(metadata)}`, () => {
		const temporary = mkdtempSync(path.join(os.tmpdir(), "shale-docker-metadata-"));
		try {
			writeFileSync(
				path.join(temporary, "docker"),
				`#!/usr/bin/env python3\nimport json\nprint(json.dumps(${JSON.stringify(metadata)}))\n`,
				{ mode: 0o700 },
			);
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
				{ env: { ...process.env, PATH: temporary + path.delimiter + process.env.PATH }, encoding: "utf8" },
			);
			assert.equal(result.status, 1, result.stderr);
			assert.deepEqual(JSON.parse(readFileSync(report, "utf8")).failures, ["container_runtime_unavailable"]);
		} finally {
			rmSync(temporary, { recursive: true, force: true });
		}
	});
}
