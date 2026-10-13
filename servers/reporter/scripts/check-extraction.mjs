/** Authoring-only export control. Installed units use declared archives and never this checkout. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(packageRoot, "../..");
const reportIndex = process.argv.indexOf("--report"),
	keepIndex = process.argv.indexOf("--bundle");
assert.ok(reportIndex >= 2 && process.argv[reportIndex + 1], "Supply --report METADATA_FILE");
const destination = path.resolve(process.argv[reportIndex + 1]);
let root =
	keepIndex >= 2
		? path.resolve(process.argv[keepIndex + 1])
		: await fs.mkdtemp(path.join(os.tmpdir(), "reporter-extracted-"));
const controls = [],
	units = [];
const env = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !/^(REPORTER_|PYTHONPATH|PYTHONHOME)/.test(name)),
);
const passed = (id) => controls.push({ id, status: "passed" });
const fingerprint = async (file) =>
	createHash("sha256")
		.update(await fs.readFile(file))
		.digest("hex");
async function run(command, args, cwd = repo, extra = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		const timer = setTimeout(() => child.kill("SIGKILL"), 600000);
		for (const stream of [child.stdout, child.stderr])
			stream.on("data", (bytes) => {
				if (output.length < 1_000_000) output += bytes.toString();
			});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(output);
			else reject(new Error(`${command} failed (${code}):\n${output.slice(-16000)}`));
		});
	});
}
async function copy(relative, target) {
	await fs.cp(path.join(repo, relative), target, {
		recursive: true,
		filter: (file) =>
			!/\/(?:__pycache__|\.pytest_cache|\.ruff_cache|\.venv|node_modules|dist|extraction)(?:\/|$)/.test(file),
	});
}
async function stripSources(file) {
	let sources = false;
	const text = (await fs.readFile(file, "utf8"))
		.split("\n")
		.filter((line) => {
			if (line.startsWith("[")) sources = line.trim() === "[tool.uv.sources]";
			return !sources;
		})
		.join("\n");
	assert.ok(!text.includes("../../sdk/") && !text.includes("../../contracts"));
	await fs.writeFile(file, text);
}
try {
	await fs.mkdir(root, { recursive: true, mode: 0o700 });
	root = await fs.realpath(root);
	assert.equal((await fs.readdir(root)).length, 0, "An empty owned destination is required");
	for (const name of [
		"npm",
		"wheels",
		"employee",
		"tool",
		"source/reporter",
		"source/reporter-agent",
		"checks/eval",
		"recipes",
	])
		await fs.mkdir(path.join(root, name), { recursive: true });
	const artifacts = {};
	for (const unit of ["contracts", "sdk", "servers/reporter"]) {
		await run("pnpm", ["build"], path.join(repo, unit));
		await run("pnpm", ["pack", "--pack-destination", path.join(root, "npm")], path.join(repo, unit));
		const manifest = JSON.parse(await fs.readFile(path.join(repo, unit, "package.json"), "utf8"));
		artifacts[manifest.name] = path.join(
			root,
			"npm",
			`${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`,
		);
	}
	for (const unit of ["contracts", "evaluations", "sdk/python", "sdk/employee"])
		await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], path.join(repo, unit));
	const agentSource = path.join(root, "source/reporter-agent");
	for (const name of ["app", "tests", "pyproject.toml", "LICENSE", "agents-cli-manifest.yaml"])
		await copy(`agents/reporter-agent/${name}`, path.join(agentSource, name));
	await stripSources(path.join(agentSource, "pyproject.toml"));
	await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], agentSource);
	await copy("agents/reporter-agent/tests/eval", path.join(root, "checks/eval"));
	await copy("agents/reporter-agent/tests/fixtures/context-step.py", path.join(root, "checks/context-step.py"));
	await fs.copyFile(
		path.join(repo, "servers/reporter/tests/fixtures/employee.json"),
		path.join(root, "checks/employee.json"),
	);
	await fs.copyFile(
		path.join(repo, "servers/reporter/tests/extraction/generic-client.mjs"),
		path.join(root, "checks/generic-client.mjs"),
	);
	const code = (await run("git", ["rev-parse", "HEAD"])).trim();
	for (const [unit, name] of [
		["agents/reporter-agent", "employee"],
		["evaluations", "tool"],
	]) {
		const requirements = path.join(root, `requirements-${name}.txt`);
		await run(
			"uv",
			["export", "--locked", "--no-dev", "--no-emit-local", "--output-file", requirements],
			path.join(repo, unit),
		);
		const venv = path.join(root, name, ".venv"),
			python = path.join(venv, "bin/python");
		await run("uv", ["venv", "--python", "3.12", venv]);
		await run("uv", ["pip", "install", "--python", python, "--require-hashes", "-r", requirements]);
		const wheels = (await fs.readdir(path.join(root, "wheels"))).filter(
			(file) => file.endsWith(".whl") && (name === "employee" || /shaleyeah_(contracts|evaluations)-/.test(file)),
		);
		await run("uv", [
			"pip",
			"install",
			"--python",
			python,
			"--no-deps",
			...wheels.map((file) => path.join(root, "wheels", file)),
		]);
		await run("uv", ["pip", "check", "--python", python]);
	}
	const employeePython = path.join(root, "employee/.venv/bin/python"),
		toolPython = path.join(root, "tool/.venv/bin/python");
	await run(
		employeePython,
		[
			"-I",
			"-c",
			"from app.agent import root_agent; from app.context_runtime import ReporterRuntime; assert root_agent.name == 'reporter'; assert not root_agent.sub_agents",
		],
		root,
	);
	passed("installed-employee");
	// Test dependencies are explicit and separate from the hash-locked production environment.
	await run("uv", [
		"pip",
		"install",
		"--python",
		employeePython,
		"pytest>=9,<10",
		"pytest-asyncio>=1,<2",
		"pytest-cov>=7,<8",
	]);
	await run(employeePython, ["-m", "pytest", "-q", "--cov=app", "--cov-fail-under=90"], agentSource);
	passed("external-mcp");
	const source = path.join(root, "source/reporter");
	for (const name of ["src", "tests", "examples", "package.json", "tsconfig.json", "biome.json", "LICENSE"])
		await copy(`servers/reporter/${name}`, path.join(source, name));
	await fs.mkdir(path.join(source, "vendor"));
	const manifest = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
	for (const name of ["@shaleyeah/contracts", "@shaleyeah/sdk"]) {
		const archive = path.basename(artifacts[name]);
		await fs.copyFile(artifacts[name], path.join(source, "vendor", archive));
		manifest.dependencies[name] = `file:vendor/${archive}`;
	}
	delete manifest.scripts["test:extraction"];
	await fs.writeFile(path.join(source, "package.json"), JSON.stringify(manifest, null, 2));
	const testEnv = {
		REPORTER_TEST_PYTHON: employeePython,
		REPORTER_CONTEXT_STEP: path.join(root, "checks/context-step.py"),
		REPORTER_QUALIFICATION_SCRIPT: path.join(root, "checks/eval/run_fixture_evals.py"),
		REPORTER_TEST_CODE_REVISION: code,
	};
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], source);
	await run("npm", ["run", "build"], source);
	await run("npm", ["run", "test:coverage"], source, testEnv);
	passed("clean-source-build");
	const tool = path.join(root, "tool");
	await fs.writeFile(
		path.join(tool, "package.json"),
		JSON.stringify({
			private: true,
			type: "module",
			devDependencies: { tsx: "4.21.0", "@modelcontextprotocol/client": "2.3.1" },
		}),
	);
	await run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			...Object.values(artifacts).map((file) => path.relative(tool, file)),
		],
		tool,
	);
	await fs.cp(path.join(source, "tests"), path.join(tool, "tests"), { recursive: true });
	// Installed-production checks import archive code, rather than the clean-source implementation.
	for (const [directory, prefix] of [
		[path.join(tool, "tests"), "../"],
		[path.join(tool, "tests/fixtures"), "../../"],
	]) {
		for (const name of await fs.readdir(directory))
			if (name.endsWith(".ts")) {
				const file = path.join(directory, name),
					text = await fs.readFile(file, "utf8");
				await fs.writeFile(
					file,
					text.replaceAll(`${prefix}src/`, `${prefix}node_modules/@shaleyeah/server-reporter/dist/`),
				);
			}
	}
	await fs.cp(path.join(tool, "node_modules/@shaleyeah/server-reporter/examples"), path.join(tool, "examples"), {
		recursive: true,
	});
	// Copied launchers keep their original archive-relative dist paths.
	await fs.cp(path.join(tool, "node_modules/@shaleyeah/server-reporter/dist"), path.join(tool, "dist"), {
		recursive: true,
	});
	await run(
		process.execPath,
		[
			"--import",
			"tsx",
			"--test",
			...(await fs.readdir(path.join(tool, "tests")))
				.filter((name) => name.endsWith(".test.ts"))
				.map((name) => path.join("tests", name)),
		],
		tool,
		testEnv,
	);
	await run(
		toolPython,
		[
			"-I",
			"-c",
			"import shaleyeah_evaluations; import importlib.util; assert importlib.util.find_spec('app') is None; assert importlib.util.find_spec('google') is None or importlib.util.find_spec('google.adk') is None",
		],
		tool,
	);
	for (const file of ["archive-control.py", "archive-negative.py"])
		await fs.copyFile(path.join(repo, `servers/reporter/tests/extraction/${file}`), path.join(root, "checks", file));
	await run(toolPython, ["-I", path.join(root, "checks/archive-control.py"), root], root);
	await run(toolPython, ["-I", path.join(root, "checks/archive-negative.py"), root], root);
	passed("distribution-allowlist");
	passed("distribution-drift-denial");
	passed("installed-tool");
	passed("source-context-review-restart");
	passed("source-revocation");
	for (const [id, file] of [
		["reporter", artifacts["@shaleyeah/server-reporter"]],
		[
			"reporter-agent",
			path.join(
				root,
				"wheels",
				(await fs.readdir(path.join(root, "wheels"))).find((name) => name.startsWith("shaleyeah_reporter_adk-")),
			),
		],
	])
		units.push({ id, independent: true, artifactSha256: await fingerprint(file) });
	for (const [unit, file] of [
		["reporter", "servers/reporter/Dockerfile"],
		["reporter-agent", "agents/reporter-agent/Dockerfile"],
	]) {
		await fs.mkdir(path.join(root, "recipes", unit), { recursive: true });
		await fs.copyFile(path.join(repo, file), path.join(root, "recipes", unit, "Dockerfile"));
	}
	await fs.writeFile(
		path.join(root, ".dockerignore"),
		"**\n!npm/\n!npm/**\n!wheels/\n!wheels/**\n!requirements-*.txt\n!tool/\n!tool/package.json\n!tool/package-lock.json\n!recipes/\n!recipes/**\n",
	);
	const report = {
		schemaVersion: "0.1.0",
		status: "passed",
		qualification: "fixture",
		professionalAcceptance: false,
		codeRevision: code,
		units,
		controls,
		locks: {
			employee: await fingerprint(path.join(root, "requirements-employee.txt")),
			tool: await fingerprint(path.join(tool, "package-lock.json")),
		},
	};
	await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(report, null, 2));
	await fs.mkdir(path.dirname(destination), { recursive: true });
	await fs.writeFile(destination, JSON.stringify(report, null, 2));
	console.log("Reporter extraction passed: fixture evidence, no professional acceptance");
} catch (error) {
	await fs.mkdir(path.dirname(destination), { recursive: true });
	await fs.writeFile(
		destination,
		JSON.stringify({
			schemaVersion: "0.1.0",
			status: "blocked",
			qualification: "fixture",
			professionalAcceptance: false,
			controls,
			failures: ["extraction_failed"],
		}),
	);
	console.error(error instanceof Error ? error.message : "Reporter extraction failed");
	process.exitCode = 1;
} finally {
	if (keepIndex < 2) await fs.rm(root, { recursive: true, force: true });
}
