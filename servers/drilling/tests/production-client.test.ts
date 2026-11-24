import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

test("exported production inputs survive fixture cleanup and the plain JavaScript client enforces source revocation", async () => {
	const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "drilling-production-")));
	const production = path.join(directory, "inputs");
	try {
		await promisify(execFile)(
			process.execPath,
			["--import", "tsx", path.resolve("tests/fixtures/export-production.ts"), production],
			{ env: { PATH: process.env.PATH ?? "" }, timeout: 15000 },
		);
		const settingsFile = path.join(production, "stdio-client.json");
		const settings = JSON.parse(await fs.readFile(settingsFile, "utf8"));
		const config = JSON.parse(await fs.readFile(settings.configurationFile, "utf8"));
		for (const source of config.sources) {
			const relative = path.relative(production, await fs.realpath(source.file));
			assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
		}
		const secret = await fs.readFile(path.join(production, "access-key"), "utf8");
		const run = () =>
			promisify(execFile)(
				process.execPath,
				[path.resolve("tests/fixtures/production-client.mjs"), settingsFile, path.resolve("dist/index.js")],
				{ env: { PATH: process.env.PATH ?? "" }, timeout: 15000 },
			);
		const result = await run();
		assert.deepEqual(JSON.parse(result.stdout), {
			tools: 12,
			sources: 3,
			quotedTotal: "450000/1",
			operationalApproval: false,
		});
		assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
		config.sourceGrant.revoked = true;
		await fs.writeFile(settings.configurationFile, JSON.stringify(config));
		await assert.rejects(run(), (error: Error & { stderr?: string; code?: number }) => {
			assert.equal(error.code, 1);
			assert.match(error.stderr ?? "", /Production client blocked/);
			assert.ok(!error.message.includes(secret) && !error.stderr?.includes(secret));
			return true;
		});
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});
