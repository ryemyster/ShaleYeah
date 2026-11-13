import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

test("an unavailable container runtime blocks before reading a claimed extraction bundle", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "economist-container-denial-"));
	try {
		const runtime = path.join(directory, "docker"), report = path.join(directory, "decision.json");
		await fs.writeFile(runtime, '#!/bin/sh\nprintf \'{"ServerErrors":["fixture unavailable"]}\\n\'\n', { mode: 0o700 });
		await assert.rejects(promisify(execFile)("python3", ["scripts/check-containers.py", "--bundle", path.join(directory, "absent"), "--report", report], {
			env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
		}));
		const decision = JSON.parse(await fs.readFile(report, "utf8"));
		assert.equal(decision.status, "blocked");
		assert.equal(decision.professionalAcceptance, false);
		assert.deepEqual(decision.failures, ["container_runtime_unavailable"]);
		assert.deepEqual(decision.images, {});
	} finally { await fs.rm(directory, { recursive: true, force: true }); }
});
