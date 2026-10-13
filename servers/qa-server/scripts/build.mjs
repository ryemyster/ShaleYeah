import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// Clear only this package's generated output so retired tools cannot enter an archive.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
const compiler = createRequire(import.meta.url).resolve("typescript/bin/tsc");
const result = spawnSync(process.execPath, [compiler], { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
