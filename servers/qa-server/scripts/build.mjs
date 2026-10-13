import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Clear only this package's generated output so retired tools cannot enter an archive.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
const result = spawnSync("pnpm", ["exec", "tsc"], { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
