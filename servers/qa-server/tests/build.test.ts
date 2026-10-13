import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("independent build uses its installed compiler without invoking a package manager or replacing dependencies", () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-build-"));
	try {
		for (const name of ["src", "scripts", "bin", "node_modules/typescript"])
			mkdirSync(path.join(directory, name), { recursive: true });
		cpSync(
			path.dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
			path.join(directory, "node_modules/typescript"),
			{ recursive: true },
		);
		cpSync("scripts/build.mjs", path.join(directory, "scripts/build.mjs"));
		writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
		writeFileSync(
			path.join(directory, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2022", module: "ESNext", outDir: "dist", rootDir: "src", types: [] },
				include: ["src"],
			}),
		);
		writeFileSync(path.join(directory, "src/index.ts"), "export const measured: number = 0;\n");
		writeFileSync(path.join(directory, "bin/pnpm"), "#!/bin/sh\nexit 77\n", { mode: 0o700 });
		execFileSync(process.execPath, ["scripts/build.mjs"], {
			cwd: directory,
			env: { ...process.env, PATH: path.join(directory, "bin") },
			stdio: "pipe",
		});
		assert.match(readFileSync(path.join(directory, "dist/index.js"), "utf8"), /measured = 0/);
		assert.ok(readFileSync(path.join(directory, "node_modules/typescript/package.json"), "utf8"));
	} finally {
		rmSync(directory, { recursive: true });
	}
});
