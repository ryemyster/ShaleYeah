import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

test("container expiry uses the existing UTC millisecond policy representation", () => {
	const expiry = execFileSync(
		"python3",
		[
			"-B",
			"-c",
			"import importlib.util; from datetime import UTC, datetime; s=importlib.util.spec_from_file_location('controller', 'scripts/check-containers.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.utc_timestamp(datetime(2026,10,13,3,0,0,123456,tzinfo=UTC)))",
		],
		{ encoding: "utf8" },
	).trim();
	assert.equal(expiry, "2026-10-13T03:00:00.123Z");
});

test("unavailable Docker blocks Reporter qualification instead of skipping", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "reporter-container-control-"));
	try {
		const report = path.join(root, "report.json");
		await assert.rejects(() =>
			promisify(execFile)(
				"uv",
				[
					"run",
					"--project",
					"../../evaluations",
					"--locked",
					"python",
					"scripts/check-containers.py",
					"--bundle",
					root,
					"--report",
					report,
				],
				{ env: { ...process.env, DOCKER_HOST: `unix://${root}/missing.sock`, DOCKER_CONTEXT: "" } },
			),
		);
		const result = JSON.parse(await readFile(report, "utf8"));
		assert.equal(result.status, "blocked");
		assert.equal(result.qualification, "fixture");
		assert.equal(result.professionalAcceptance, false);
		assert.deepEqual(result.failures, ["container_runtime_unavailable"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
