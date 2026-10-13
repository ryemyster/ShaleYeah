import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = process.argv.indexOf("--report");
assert.ok(index >= 2 && process.argv[index + 1], "Supply --report METADATA_FILE");
const reportFile = path.resolve(process.argv[index + 1]);
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "qa-container-")), bundle = path.join(temporary, "bundle");
const tag = `shaleyeah-qa-fixture:${randomUUID()}`;
let built = false;
async function run(command, args, input) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
		let output = ""; const timer = setTimeout(() => child.kill("SIGKILL"), 900000);
		for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { if (output.length < 2_000_000) output += bytes.toString(); });
		child.stdin.end(input);
		child.once("error", (error) => { clearTimeout(timer); reject(error); });
		child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(output); else reject(new Error(`${command} failed (${code}): ${output.slice(-16000)}`)); });
	});
}
try {
	const info = JSON.parse(await run("docker", ["info", "--format", "{{json .}}"]));
	assert.equal(info.OSType, "linux"); assert.ok(info.Architecture && !info.ServerErrors?.length);
	await run(process.execPath, ["scripts/check-extraction.mjs", "--bundle", bundle, "--report", path.join(temporary, "extraction.json")]);
	await fs.copyFile(path.join(root, "Dockerfile"), path.join(bundle, "Dockerfile"));
	await fs.writeFile(path.join(bundle, ".dockerignore"), "**\n!Dockerfile\n!npm/\n!npm/**\n!tool/\n!tool/package.json\n!tool/package-lock.json\n!wheels/\n!wheels/**\n!requirements-tool.txt\n");
	await run("docker", ["build", "--platform", "linux/amd64", "--tag", tag, bundle]); built = true;
	const image = JSON.parse(await run("docker", ["image", "inspect", tag]))[0];
	assert.equal(image.Config.User, "10001:10001"); assert.ok(/^sha256:[a-f0-9]{64}$/.test(image.Id));
	const output = await run("docker", ["run", "--rm", "--platform", "linux/amd64", "--network", "none", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "-i", tag, "node", "--input-type=module"], await fs.readFile(path.join(root, "tests/extraction/container-control.mjs")));
	const control = JSON.parse(output.trim().split("\n").findLast((line) => line.startsWith('{"status"')));
	assert.equal(control.status, "passed"); assert.equal(control.architecture, "x64"); assert.equal(control.uid, 10001);
	const extraction = JSON.parse(await fs.readFile(path.join(temporary, "extraction.json"), "utf8"));
	await fs.mkdir(path.dirname(reportFile), { recursive: true });
	await fs.writeFile(reportFile, JSON.stringify({ schemaVersion: "0.1.0", status: "passed", codeRevision: extraction.codeRevision, qualification: "fixture", professionalAcceptance: false, image: { id: image.Id, platform: "linux/amd64", user: image.Config.User }, runtime: control, artifactSha256: extraction.artifactSha256, productionLockSha256: extraction.productionLockSha256 }, null, 2));
	console.log("QA installed container passed: non-root Node runtime, fixture evidence only");
} catch (error) {
	await fs.mkdir(path.dirname(reportFile), { recursive: true }); await fs.writeFile(reportFile, JSON.stringify({ schemaVersion: "0.1.0", status: "blocked", qualification: "fixture", professionalAcceptance: false, failures: ["container_check_failed"] }));
	console.error(error instanceof Error ? error.message : "QA container check failed"); process.exitCode = 1;
} finally {
	if (built) await run("docker", ["image", "rm", tag]);
	await fs.rm(temporary, { recursive: true, force: true });
}
