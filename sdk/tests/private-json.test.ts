import assert from "node:assert/strict";
import { appendFileSync, chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readPrivateJson, readPrivateText } from "../dist/private-json.js";

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

test("a larger permitted ceiling does not multiply allocations for unchanged small private content", async (t) => {
	const root = mkdtempSync(path.join(os.tmpdir(), "employee-private-allocation-"));
	const file = path.join(root, "config.json");
	const content = JSON.stringify({ version: "r1", allowed: true });
	writeFileSync(file, content, { mode: 0o600 });
	const original = Buffer.alloc;
	const allocated: number[] = [];
	try {
		for (const maximum of [65536, 8000000]) {
			let bytes = 0;
			const observed = t.mock.method(Buffer, "alloc", (...args: Parameters<typeof Buffer.alloc>) => {
				bytes += args[0];
				return original(...args);
			});
			try {
				assert.equal(await readPrivateText(file, maximum), content);
			} finally {
				observed.mock.restore();
			}
			allocated.push(bytes);
		}
		assert.ok(
			allocated[1] <= allocated[0] + 65536,
			`Private read allocated ${allocated[1]} bytes under the large ceiling versus ${allocated[0]} for the same content`,
		);
	} finally {
		rmSync(root, { recursive: true });
	}
});

test("growth between private reads is rejected even when stat timestamps appear unchanged", async (t) => {
	const root = mkdtempSync(path.join(os.tmpdir(), "employee-private-growth-"));
	const file = path.join(root, "config.json");
	writeFileSync(file, JSON.stringify({ version: "r1" }), { mode: 0o600 });
	const originalOpen = fs.open;
	t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
		const handle = await originalOpen(...args);
		const snapshot = await handle.stat();
		const originalRead = handle.read.bind(handle);
		let grown = false;
		t.mock.method(handle, "stat", async () => snapshot);
		t.mock.method(handle, "read", async (buffer: Buffer, offset: number, length: number, position: number) => {
			const result = await originalRead(buffer, offset, length, position);
			if (!grown) {
				appendFileSync(file, " ");
				grown = true;
			}
			return result;
		});
		return handle;
	});
	try {
		await assert.rejects(readPrivateText(file, 128), /Private configuration unavailable/);
	} finally {
		rmSync(root, { recursive: true });
	}
});
