import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readPrivateJson } from "../dist/private-json.js";

test("operator JSON reads bounded private regular files and denies public modes, symlinks and size excess", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "employee-private-json-"));
	try {
		const file = path.join(root, "config.json");
		writeFileSync(file, JSON.stringify({ version: "r1" }), { mode: 0o600 });
		assert.deepEqual(await readPrivateJson(file, 128), { version: "r1" });
		chmodSync(file, 0o644);
		await assert.rejects(() => readPrivateJson(file, 128));
		chmodSync(file, 0o600);
		symlinkSync(file, path.join(root, "link.json"));
		await assert.rejects(() => readPrivateJson(path.join(root, "link.json"), 128));
		await assert.rejects(() => readPrivateJson(file, 2));
	} finally {
		rmSync(root, { recursive: true });
	}
});
