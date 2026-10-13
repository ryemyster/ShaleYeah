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
async function copyEmployee(name, destination) {
	await fs.cp(path.join(repo, "agents/quality-assurance", name), destination, { recursive: true,
		filter: (file) => !/\/(?:__pycache__|\.venv|\.pytest_cache|\.ruff_cache)(?:\/|$)/.test(file) });
}
try {
	await fs.mkdir(root, { recursive: true, mode: 0o700 });
	assert.equal((await fs.readdir(root)).length, 0, "An empty owned destination is required");
	for (const name of ["npm", "source", "tool", "wheels", "employee", "source-agent", "checks"]) await fs.mkdir(path.join(root, name));
	for (const unit of ["contracts", "sdk", "servers/qa-server"]) {
		await run("pnpm", ["build"], path.join(repo, unit));
		await run("pnpm", ["pack", "--pack-destination", path.join(root, "npm")], path.join(repo, unit));
		const manifest = JSON.parse(await fs.readFile(path.join(repo, unit, "package.json"), "utf8"));
		artifacts[manifest.name] = path.join(root, "npm", `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`);
	}
	const archive = artifacts["@shaleyeah/server-qa"], entries = (await run("tar", ["-tzf", archive])).trim().split("\n");
	for (const entry of entries) assert.ok(/^package\/(?:(?:package.json|LICENSE|README.md)$|(?:dist|examples)\/|scripts\/qualify.mjs$)/.test(entry) && !/(?:validation|reporting)\.[^/]+$/.test(entry), `Unexpected distribution entry ${entry}`);
	passed("archive-allowlist");
	for (const unit of ["contracts", "evaluations", "sdk/python", "sdk/employee"])
		await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], path.join(repo, unit));
	const agentSource = path.join(root, "source-agent");
	for (const name of ["app", "tests", "pyproject.toml", "LICENSE", "agents-cli-manifest.yaml"])
		await copyEmployee(name, path.join(agentSource, name));
	let sources = false;
	const pyproject = (await fs.readFile(path.join(agentSource, "pyproject.toml"), "utf8")).split("\n").filter((line) => {
		if (line.startsWith("[")) sources = line.trim() === "[tool.uv.sources]";
		return !sources;
	}).join("\n");
	await fs.writeFile(path.join(agentSource, "pyproject.toml"), pyproject);
	await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], agentSource);
	await copyEmployee("tests/eval", path.join(root, "checks/eval"));
	await copyEmployee("tests/fixtures/context-step.py", path.join(root, "checks/context-step.py"));
	await copy("tests/extraction/generic-client.mjs", path.join(root, "checks/generic-client.mjs"));
	const code = (await run("git", ["rev-parse", "HEAD"])).trim();
	for (const [unit, name] of [["agents/quality-assurance", "employee"], ["evaluations", "tool"]]) {
		const requirements = path.join(root, `requirements-${name}.txt`);
		await run("uv", ["export", "--locked", "--no-dev", "--no-emit-local", "--output-file", requirements], path.join(repo, unit));
		const venv = path.join(root, name, ".venv"), python = path.join(venv, "bin/python");
		await run("uv", ["venv", "--python", "3.12", venv]);
		await run("uv", ["pip", "install", "--python", python, "--require-hashes", "-r", requirements]);
		const wheels = (await fs.readdir(path.join(root, "wheels"))).filter((file) => file.endsWith(".whl") &&
			(name === "employee" || /shaleyeah_(contracts|evaluations)-/.test(file)));
		await run("uv", ["pip", "install", "--python", python, "--no-deps", ...wheels.map((file) => path.join(root, "wheels", file))]);
		await run("uv", ["pip", "check", "--python", python]);
	}
	const employeePython = path.join(root, "employee/.venv/bin/python");
	await run(employeePython, ["-I", "-c", "from app.agent import root_agent; from app.context_runtime import QARuntime; assert root_agent.name == 'quality_assurance'; assert not root_agent.sub_agents"], root);
	await run(path.join(root, "tool/.venv/bin/python"), ["-I", "-c", "import importlib.util; import shaleyeah_evaluations; assert importlib.util.find_spec('app') is None"], root);
	await run("uv", ["pip", "install", "--python", employeePython, "pytest>=9,<10", "pytest-asyncio>=1,<2", "pytest-cov>=7,<8"]);
	await run(employeePython, ["-m", "pytest", "-q", "--cov=app", "--cov-fail-under=90"], agentSource);
	passed("installed-employee"); passed("external-mcp");
	const testEnv = { QA_TEST_PYTHON: employeePython, QA_CONTEXT_STEP: path.join(root, "checks/context-step.py"),
		QA_QUALIFICATION_SCRIPT: path.join(root, "checks/eval/run_fixture_evals.py"), QA_TEST_CODE_REVISION: code };
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
	await run("npm", ["run", "test:coverage"], source, testEnv);
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
	await run(process.execPath, ["--import", "tsx", "--test", ...(await fs.readdir(path.join(tool, "tests"))).filter((name) => name.endsWith(".test.ts")).map((name) => path.join("tests", name))], tool, { ...testEnv, QA_TEST_ENTRY: path.join(installed, "dist/index.js") });
	passed("installed-tool"); passed("generic-mcp"); passed("durable-observed-results");
	passed("source-context-review-restart"); passed("source-revocation"); passed("installed-exact-qualification");
	await run("npm", ["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], tool);
	await run(process.execPath, ["--input-type=module", "-e", 'await import("@modelcontextprotocol/client"); await import("@modelcontextprotocol/client/stdio")'], tool);
	passed("production-independent-client");
	await run(process.execPath, ["scripts/qualify.mjs", "--report", path.join(root, "qualification.json")], tool);
	const qualification = JSON.parse(await fs.readFile(path.join(root, "qualification.json"), "utf8"));
	assert.equal(qualification.status, "passed");
	passed("locked-production-install");
	const report = { schemaVersion: "0.1.0", status: "passed", qualification: "fixture", professionalAcceptance: false,
		codeRevision: code, unit: "qa-server", controls, artifactSha256: await hash(archive), productionLockSha256: await hash(path.join(tool, "package-lock.json")), fixtureHash: qualification.fixtureHash,
		employeeArtifactSha256: await hash(path.join(root, "wheels", (await fs.readdir(path.join(root, "wheels"))).find((file) => file.startsWith("shaleyeah_quality_assurance_adk-")))),
		employeeLockSha256: await hash(path.join(root, "requirements-employee.txt")), verifierLockSha256: await hash(path.join(root, "requirements-tool.txt")) };
	await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(report, null, 2));
	await fs.writeFile(path.join(root, ".dockerignore"), "**\n!npm/\n!npm/**\n!wheels/\n!wheels/**\n!requirements-*.txt\n!tool/\n!tool/package.json\n!tool/package-lock.json\n");
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify(report, null, 2));
	console.log("QA extraction passed: clean source and installed archive, fixture evidence only");
} catch (error) {
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify({ schemaVersion: "0.1.0", status: "blocked", qualification: "fixture", professionalAcceptance: false, controls, failures: ["extraction_failed"] }));
	console.error(error instanceof Error ? error.message : "QA extraction failed"); process.exitCode = 1;
} finally { if (keepIndex < 2) await fs.rm(root, { recursive: true, force: true }); }
