/** Authoring control: exported units use only their own source and declared archives. */
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
const root = keepIndex >= 2 ? path.resolve(process.argv[keepIndex + 1]) : await fs.mkdtemp(path.join(os.tmpdir(), "economist-extracted-"));
const controls = [], artifacts = {}, overrides = {};
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(ECONOMIST_|PYTHONPATH|PYTHONHOME)/.test(name)));
const passed = (id) => { controls.push({ id, status: "passed" }); console.log(`Extraction: ${id}`); };
const hash = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
async function run(command, args, cwd = repo, extra = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		const timer = setTimeout(() => child.kill("SIGKILL"), 600000);
		for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { if (output.length < 1_000_000) output += bytes.toString(); });
		child.once("error", (error) => { clearTimeout(timer); reject(error); });
		child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(output); else reject(new Error(`${command} failed (${code}):\n${output.slice(-20000)}`)); });
	});
}
async function copyFrom(from, name, to) {
	await fs.cp(path.join(from, name), to, { recursive: true,
		filter: (file) => !/\/(?:node_modules|dist|extraction|__pycache__|\.venv|\.pytest_cache|\.ruff_cache)(?:\/|$)/.test(file) });
}
try {
	await fs.mkdir(root, { recursive: true, mode: 0o700 });
	assert.equal((await fs.readdir(root)).length, 0, "An empty owned destination is required");
	for (const name of ["npm", "source", "tool", "wheels", "employee", "source-agent", "checks/fixtures"]) await fs.mkdir(path.join(root, name), { recursive: true });
	for (const unit of ["contracts", "connectors", "sdk", "servers/econobot"]) {
		const folder = path.join(repo, unit);
		await run("pnpm", ["build"], folder);
		await run("pnpm", ["pack", "--pack-destination", path.join(root, "npm")], folder);
		const manifest = JSON.parse(await fs.readFile(path.join(folder, "package.json"), "utf8"));
		artifacts[manifest.name] = path.join(root, "npm", `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`);
		for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) if (!spec.startsWith("workspace:"))
			overrides[name] = JSON.parse(await fs.readFile(path.join(folder, "node_modules", name, "package.json"), "utf8")).version;
	}
	const archive = artifacts["@shaleyeah/server-econobot"], entries = (await run("tar", ["-tzf", archive])).trim().split("\n");
	for (const entry of entries) assert.ok(/^package\/(?:(?:package.json|LICENSE|README.md)$|(?:dist|examples)\/)/.test(entry), `Unexpected archive entry ${entry}`);
	passed("archive-allowlist");
	for (const unit of ["contracts", "evaluations", "sdk/python", "sdk/employee"])
		await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], path.join(repo, unit));
	const employeeRoot = path.join(repo, "agents/economist"), agentSource = path.join(root, "source-agent");
	for (const name of ["app", "tests", "pyproject.toml", "LICENSE", "agents-cli-manifest.yaml"])
		await copyFrom(employeeRoot, name, path.join(agentSource, name));
	let sources = false;
	const pyproject = (await fs.readFile(path.join(agentSource, "pyproject.toml"), "utf8")).split("\n").filter((line) => {
		if (line.startsWith("[")) sources = line.trim() === "[tool.uv.sources]";
		return !sources;
	}).join("\n");
	await fs.writeFile(path.join(agentSource, "pyproject.toml"), pyproject);
	await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], agentSource);
	// The standalone source lock selects declared dependency wheels, not sibling
	// authoring trees. Seed registry resolutions from the reviewed employee lock.
	await fs.copyFile(path.join(employeeRoot, "uv.lock"), path.join(agentSource, "uv.lock"));
	const wheelFiles = await fs.readdir(path.join(root, "wheels"));
	const wheelSources = ["shaleyeah-contracts", "shaleyeah-evaluations", "shaleyeah-mcp-client", "shaleyeah-employee-runtime"].map((name) => {
		const file = wheelFiles.find((file) => file.startsWith(name.replaceAll("-", "_") + "-"));
		assert.ok(file, `Missing declared wheel ${name}`);
		return `${name} = { path = "../wheels/${file}" }`;
	});
	await fs.appendFile(path.join(agentSource, "pyproject.toml"), `\n[tool.uv.sources]\n${wheelSources.join("\n")}\n`);
	await run("uv", ["lock", "--python", "3.12"], agentSource);
	await copyFrom(employeeRoot, "tests/eval", path.join(root, "checks/eval"));
	await fs.copyFile(path.join(employeeRoot, "tests/fixtures/context-step.py"), path.join(root, "checks/fixtures/context-step.py"));
	await fs.copyFile(path.join(packageRoot, "tests/extraction/generic-client.mjs"), path.join(root, "checks/generic-client.mjs"));
	const code = (await run("git", ["rev-parse", "HEAD"])).trim();
	for (const [unit, name] of [["agents/economist", "employee"], ["evaluations", "tool"]]) {
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
	await run(employeePython, ["-I", "-c", "from app.agent import root_agent; from app.context_runtime import EconomistRuntime; assert root_agent.name == 'economist'; assert not root_agent.sub_agents"], root);
	await run(path.join(root, "tool/.venv/bin/python"), ["-I", "-c", "import importlib.util; import shaleyeah_evaluations; assert importlib.util.find_spec('app') is None"], root);
	await run("uv", ["pip", "install", "--python", employeePython, "pytest>=9,<10", "pytest-asyncio>=1,<2", "pytest-cov>=7,<8"]);
	await run(employeePython, ["-m", "pytest", "-q", "--cov=app", "--cov-fail-under=90"], agentSource);
	passed("installed-employee"); passed("external-mcp");
	const testEnv = { ECONOMIST_TEST_PYTHON: employeePython, ECONOMIST_CONTEXT_STEP: path.join(root, "checks/fixtures/context-step.py"),
		ECONOMIST_QUALIFICATION_SCRIPT: path.join(root, "checks/eval/run_fixture_evals.py"), ECONOMIST_TEST_CODE_REVISION: code };
	const source = path.join(root, "source");
	for (const name of ["src", "tests", "examples", "package.json", "tsconfig.json", "biome.json", "LICENSE"]) await copyFrom(packageRoot, name, path.join(source, name));
	await fs.mkdir(path.join(source, "vendor"));
	const manifest = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
	for (const name of ["@shaleyeah/contracts", "@shaleyeah/connectors", "@shaleyeah/sdk"]) {
		await fs.copyFile(artifacts[name], path.join(source, "vendor", path.basename(artifacts[name])));
		manifest.dependencies[name] = `file:vendor/${path.basename(artifacts[name])}`;
	}
	for (const name of Object.keys(manifest.devDependencies))
		manifest.devDependencies[name] = JSON.parse(await fs.readFile(path.join(packageRoot, "node_modules", name, "package.json"), "utf8")).version;
	for (const name of Object.keys(manifest.dependencies)) if (overrides[name]) manifest.dependencies[name] = overrides[name];
	manifest.overrides = overrides;
	delete manifest.scripts["test:extraction"];
	await fs.writeFile(path.join(source, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], source);
	for (const command of ["build", "type-check", "lint", "test"]) await run("npm", ["run", command], source, testEnv);
	passed("clean-source-build");
	const tool = path.join(root, "tool");
	await fs.writeFile(path.join(tool, "package.json"), JSON.stringify({ private: true, type: "module", overrides,
		devDependencies: { tsx: manifest.devDependencies.tsx, typescript: manifest.devDependencies.typescript }, dependencies: { "@modelcontextprotocol/client": "2.3.1", ...Object.fromEntries(Object.entries(artifacts).map(([name, file]) => [name, `file:${path.relative(tool, file)}`])) } }));
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], tool);
	await fs.cp(path.join(source, "tests"), path.join(tool, "tests"), { recursive: true });
	for (const [directory, prefix] of [[path.join(tool, "tests"), "../"], [path.join(tool, "tests/fixtures"), "../../"]]) {
		for (const name of await fs.readdir(directory)) if (name.endsWith(".ts")) {
			const file = path.join(directory, name), text = await fs.readFile(file, "utf8");
			await fs.writeFile(file, text.replaceAll(`${prefix}src/`, `${prefix}node_modules/@shaleyeah/server-econobot/dist/`));
		}
	}
	const installed = path.join(tool, "node_modules/@shaleyeah/server-econobot");
	for (const name of ["dist", "examples"]) await fs.cp(path.join(installed, name), path.join(tool, name), { recursive: true });
	assert.equal(await hash(path.join(installed, "dist/cash-flow.js")), await hash(path.join(packageRoot, "dist/cash-flow.js")));
	await run(process.execPath, ["--import", "tsx", "--test", ...(await fs.readdir(path.join(tool, "tests"))).filter((name) => name.endsWith(".test.ts")).map((name) => path.join("tests", name))], tool, testEnv);
	passed("installed-tool"); passed("generic-mcp"); passed("actual-output-grading");
	passed("source-context-review-restart"); passed("source-revocation"); passed("installed-exact-qualification");
	await fs.copyFile(path.join(packageRoot, "tests/extraction/pair-fixture.ts"), path.join(tool, "tests/pair-fixture.ts"));
	await run(process.execPath, ["--import", "tsx", "tests/pair-fixture.ts", path.join(root, "pair")], tool);
	await run("npm", ["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], tool);
	await run(process.execPath, ["--input-type=module", "-e", 'await import("@modelcontextprotocol/client"); await import("@modelcontextprotocol/client/stdio"); const { EconobotServer } = await import("@shaleyeah/server-econobot"); const server = new EconobotServer(); await server.stop()'], tool);
	passed("production-independent-client");
	const report = { schemaVersion: "0.1.0", status: "passed", qualification: "fixture", professionalAcceptance: false,
		codeRevision: code, unit: "econobot", controls, artifactSha256: await hash(archive), productionLockSha256: await hash(path.join(tool, "package-lock.json")),
		employeeArtifactSha256: await hash(path.join(root, "wheels", (await fs.readdir(path.join(root, "wheels"))).find((file) => file.startsWith("shaleyeah_economist_adk-")))),
		employeeLockSha256: await hash(path.join(root, "requirements-employee.txt")), verifierLockSha256: await hash(path.join(root, "requirements-tool.txt")) };
	await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(report, null, 2));
	await fs.writeFile(path.join(root, ".dockerignore"), "**\n!npm/\n!npm/**\n!wheels/\n!wheels/**\n!requirements-*.txt\n!tool/\n!tool/package.json\n!tool/package-lock.json\n");
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify(report, null, 2));
	console.log("Economist extraction passed: independent source and installed pair; fixture evidence only");
} catch (error) {
	await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, JSON.stringify({ schemaVersion: "0.1.0", status: "blocked", qualification: "fixture", professionalAcceptance: false, controls, failures: ["extraction_failed"] }));
	console.error(error instanceof Error ? error.message : "Economist extraction failed"); process.exitCode = 1;
} finally { if (keepIndex < 2) await fs.rm(root, { recursive: true, force: true }); }
