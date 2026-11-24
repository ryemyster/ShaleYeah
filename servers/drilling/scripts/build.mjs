import { spawnSync } from "node:child_process";
import { lstatSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const compiler = createRequire(import.meta.url).resolve("typescript/bin/tsc");
const output = new URL("../dist", import.meta.url);
let previous;
try {
	previous = lstatSync(output);
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) {
	throw new Error("Drilling build requires a package-local generated dist directory");
}
// Displaced tools must not survive a successful build or enter an archive.
rmSync(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, [compiler], {
	cwd: fileURLToPath(new URL("../", import.meta.url)),
	stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
