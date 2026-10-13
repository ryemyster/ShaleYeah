/** Authoring-only export control; extracted units import only their own code and declared archives. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url)), repo = path.resolve(packageRoot, "../..");
const reportIndex = process.argv.indexOf("--report"), keepIndex = process.argv.indexOf("--bundle");
assert.ok(reportIndex >= 2 && process.argv[reportIndex + 1], "Supply --report METADATA_FILE");
const destination = path.resolve(process.argv[reportIndex + 1]);
const root = keepIndex >= 2 ? path.resolve(process.argv[keepIndex + 1]) : await fs.mkdtemp(path.join(os.tmpdir(), "qa-extracted-"));
const controls = [], artifacts = {};
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(QA_|PYTHONPATH|PYTHONHOME)/.test(name)));
const passed = (id) => controls.push({ id, status: "passed" });
const hash = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
async function run(command, args, cwd = repo, extra = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		const timer = setTimeout(() => child.kill("SIGKILL"), 600000);
		for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { if (output.length < 1_000_000) output += bytes.toString(); });
		child.once("error", (error) => { clearTimeout(timer); reject(error); });
		child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(output); else reject(new Error(`${command} failed (${code}):\n${output.slice(-16000)}`)); });
	});
}
async function copy(name, destination) {
	await fs.cp(path.join(packageRoot, name), destination, { recursive: true, filter: (file) => !/\/(?:node_modules|dist|extraction)(?:\/|$)/.test(file) });
}
try {
	await fs.mkdir(root, { recursive: true, mode: 0o700 });
	assert.equal((await fs.readdir(root)).length, 0, "An empty owned destination is required");
	for (const name of ["npm", "source", "tool"]) await fs.mkdir(path.join(root, name));
	for (const unit of ["contracts", "sdk", "servers/qa-server"]) {
		await run("pnpm", ["build"], path.join(repo, unit));
		await run("pnpm", ["pack", "--pack-destination", path.join(root, "npm")], path.join(repo, unit));
		const manifest = JSON.parse(await fs.readFile(path.join(repo, unit, "package.json"), "utf8"));
		artifacts[manifest.name] = path.join(root, "npm", `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`);
	}
	const archive = artifacts["@shaleyeah/server-qa"], entries = (await run("tar", ["-tzf", archive])).trim().split("\n");
	for (const entry of entries) assert.ok(/^package\/(?:(?:package.json|LICENSE|README.md)$|(?:dist|examples)\/|scripts\/qualify.mjs$)/.test(entry) && !/(?:validation|reporting)\.[^/]+$/.test(entry), `Unexpected distribution entry ${entry}`);
	passed("archive-allowlist");
	const source = path.join(root, "source");
	for (const name of ["src", "tests", "examples", "package.json", "tsconfig.json", "biome.json", "LICENSE"]) await copy(name, path.join(source, name));
	await fs.mkdir(path.join(source, "scripts"));
	for (const name of ["build.mjs", "qualify.mjs"]) await copy(`scripts/${name}`, path.join(source, "scripts", name));
	await fs.mkdir(path.join(source, "vendor"));
	const manifest = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
	for (const name of ["@shaleyeah/contracts", "@shaleyeah/sdk"]) {
		await fs.copyFile(artifacts[name], path.join(source, "vendor", path.basename(artifacts[name])));
		manifest.dependencies[name] = `file:vendor/${path.basename(artifacts[name])}`;
	}
	delete manifest.scripts["test:extraction"];
	await fs.writeFile(path.join(source, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], source);
	await run("npm", ["run", "build"], source);
	await run("npm", ["run", "type-check"], source);
	await run("npm", ["run", "lint"], source);
	await run("npm", ["run", "test:coverage"], source);
	passed("clean-source-build");
	const tool = path.join(root, "tool");
	await fs.writeFile(path.join(tool, "package.json"), JSON.stringify({ private: true, type: "module", devDependencies: { tsx: "4.21.0", typescript: "6.0.2" }, dependencies: { "@modelcontextprotocol/client": "2.3.1", ...Object.fromEntries(Object.entries(artifacts).map(([name, file]) => [name, `file:${path.relative(tool, file)}`])) } }));
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], tool);
	await fs.cp(path.join(source, "tests"), path.join(tool, "tests"), { recursive: true });
	for (const [directory, prefix] of [[path.join(tool, "tests"), "../"], [path.join(tool, "tests/fixtures"), "../../"]]) {
		for (const name of await fs.readdir(directory)) if (name.endsWith(".ts")) {
			const file = path.join(directory, name), text = await fs.readFile(file, "utf8");
			await fs.writeFile(file, text.replaceAll(`${prefix}src/`, `${prefix}node_modules/@shaleyeah/server-qa/dist/`));
		}
	}
	const installed = path.join(tool, "node_modules/@shaleyeah/server-qa");
	for (const name of ["dist", "examples", "scripts"]) await fs.cp(path.join(installed, name), path.join(tool, name), { recursive: true });
	await fs.copyFile(path.join(packageRoot, "scripts/build.mjs"), path.join(tool, "scripts/build.mjs"));
	assert.equal(await hash(path.join(installed, "dist/tools/qa-rules.js")), await hash(path.join(packageRoot, "dist/tools/qa-rules.js")));
	await run(process.execPath, ["--import", "tsx", "--test", ...(await fs.readdir(path.join(tool, "tests"))).filter((name) => name.endsWith(".test.ts")).map((name) => path.join("tests", name))], tool, { QA_TEST_ENTRY: path.join(installed, "dist/index.js") });
	passed("installed-tool"); passed("generic-mcp"); passed("durable-observed-results");
	await run("npm", ["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], tool);
	await run(process.execPath, ["--input-type=module", "-e", 'await import("@modelcontextprotocol/client"); await import("@modelcontextprotocol/client/stdio")'], tool);
	passed("production-independent-client");
	await run(process.execPath, ["scripts/qualify.mjs", "--report", path.join(root, "qualification.json")], tool);
	const qualification = JSON.parse(await fs.readFile(path.join(root, "qualification.json"), "utf8"));
	assert.equal(qualification.status, "passed");
	passed("locked-production-install");
	const report = { schemaVersion: "0.1.0", status: "passed", qualification: "fixture", professionalAcceptance: false,
		codeRevision: (await run("git", ["rev-parse", "HEAD"])).trim(), unit: "qa-server", controls, artifactSha256: await hash(archive), productionLockSha256: await hash(path.join(tool, "package-lock.json")), fixtureHash: qualification.fixtureHash };
	await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(report, null, 2));
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify(report, null, 2));
	console.log("QA extraction passed: clean source and installed archive, fixture evidence only");
} catch (error) {
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify({ schemaVersion: "0.1.0", status: "blocked", qualification: "fixture", professionalAcceptance: false, controls, failures: ["extraction_failed"] }));
	console.error(error instanceof Error ? error.message : "QA extraction failed"); process.exitCode = 1;
} finally { if (keepIndex < 2) await fs.rm(root, { recursive: true, force: true }); }
