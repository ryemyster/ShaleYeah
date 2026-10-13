/** Authoring-time extraction proof; installed units never import this workspace. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(serverRoot, "../..");
const reportIndex = process.argv.indexOf("--report");
assert.ok(reportIndex >= 2 && process.argv[reportIndex + 1], "Supply --report <metadata-file>");
const destination = path.resolve(process.argv[reportIndex + 1]);
const keepIndex = process.argv.indexOf("--bundle");
const root =
	keepIndex >= 2
		? path.resolve(process.argv[keepIndex + 1])
		: await fs.mkdtemp(path.join(os.tmpdir(), "shale-extracted-"));
const checksDirectory = path.join(root, "tool/checks");
const controls = [];
const units = [];
const passed = (id) => controls.push({ id, status: "passed" });
const env = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !/^(?:GEOLOGIST_|GEOWIZ_|PYTHONPATH|PYTHONHOME)/.test(name)),
);
const pythonName = process.platform === "win32" ? "Scripts/python.exe" : "bin/python";

async function run(command, args, cwd = repo, extra = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
		}, 600_000);
		for (const stream of [child.stdout, child.stderr])
			stream.on("data", (bytes) => {
				if (output.length < 1_048_576) output += bytes.toString();
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

async function copy(relative, destinationDirectory) {
	const source = path.join(repo, relative);
	await fs.cp(source, destinationDirectory, {
		recursive: true,
		filter: (file) => !/\/(?:__pycache__|\.pytest_cache|\.venv|node_modules|dist|extraction)(?:\/|$)/.test(file),
	});
}

async function fingerprint(file) {
	return createHash("sha256")
		.update(await fs.readFile(file))
		.digest("hex");
}

try {
	await fs.mkdir(root, { recursive: true });
	assert.equal((await fs.readdir(root)).length, 0, "Extraction requires an empty destination directory");
	for (const directory of [
		"npm",
		"wheels",
		"tool/checks",
		"source/geowiz",
		"tool",
		"employee",
		"recipes/geowiz",
		"recipes/geologist",
	])
		await fs.mkdir(path.join(root, directory), { recursive: true });
	console.log("Building declared packages and locked dependency records");
	const artifacts = {};
	for (const relative of ["contracts", "connectors", "sdk", "servers/geowiz"]) {
		const folder = path.join(repo, relative);
		await run("pnpm", ["build"], folder);
		await run("pnpm", ["pack", "--pack-destination", path.join(root, "npm")], folder);
		const manifest = JSON.parse(await fs.readFile(path.join(folder, "package.json"), "utf8"));
		artifacts[manifest.name] = path.join(
			root,
			"npm",
			`${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`,
		);
	}
	for (const relative of ["contracts", "evaluations", "sdk/python", "sdk/employee", "agents/geologist"])
		await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], path.join(repo, relative));
	const agentSource = path.join(root, "source/geologist");
	await fs.mkdir(agentSource, { recursive: true });
	for (const name of ["app", "tests/eval", "pyproject.toml", "LICENSE"])
		await copy(`agents/geologist/${name}`, path.join(agentSource, name));
	const agentProject = path.join(agentSource, "pyproject.toml");
	let localSources = false;
	const projectText = (await fs.readFile(agentProject, "utf8"))
		.split("\n")
		.filter((line) => {
			if (line.startsWith("[")) localSources = line.trim() === "[tool.uv.sources]";
			return !localSources;
		})
		.join("\n");
	assert.ok(!projectText.includes("../../sdk/") && !projectText.includes("../../evaluations"));
	await fs.writeFile(agentProject, projectText);
	await run("uv", ["build", "--wheel", "--out-dir", path.join(root, "wheels")], agentSource);
	for (const [relative, name] of [
		["evaluations", "tool"],
		["agents/geologist", "employee"],
	]) {
		await run(
			"uv",
			[
				"export",
				"--locked",
				"--no-dev",
				"--no-emit-local",
				"--output-file",
				path.join(root, `requirements-${name}.txt`),
			],
			path.join(repo, relative),
		);
		await run("uv", ["venv", "--python", "3.12", path.join(root, name, ".venv")]);
		const interpreter = path.join(root, name, ".venv", pythonName);
		await run("uv", [
			"pip",
			"install",
			"--python",
			interpreter,
			"--require-hashes",
			"-r",
			path.join(root, `requirements-${name}.txt`),
		]);
		const wheels = (await fs.readdir(path.join(root, "wheels"))).filter(
			(file) => file.endsWith(".whl") && (name === "employee" || /shaleyeah_(contracts|evaluations)-/.test(file)),
		);
		await run("uv", [
			"pip",
			"install",
			"--python",
			interpreter,
			"--no-deps",
			...wheels.map((file) => path.join(root, "wheels", file)),
		]);
		await run("uv", ["pip", "check", "--python", interpreter]);
	}
	const source = path.join(root, "source/geowiz");
	for (const name of ["src", "tests", "examples", "package.json", "tsconfig.json", "biome.json", "LICENSE"])
		await copy(`servers/geowiz/${name}`, path.join(source, name));
	await fs.mkdir(path.join(source, "vendor"));
	const packageManifest = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
	for (const name of ["@shaleyeah/contracts", "@shaleyeah/connectors", "@shaleyeah/sdk"]) {
		const file = path.basename(artifacts[name]);
		await fs.copyFile(artifacts[name], path.join(source, "vendor", file));
		packageManifest.dependencies[name] = `file:vendor/${file}`;
	}
	delete packageManifest.scripts["test:extraction"];
	await fs.writeFile(path.join(source, "package.json"), `${JSON.stringify(packageManifest, null, 2)}\n`);
	console.log("Building and testing the extracted tool source without parent files");
	await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], source);
	await run("npm", ["run", "build"], source);
	await run("npm", ["test"], source, { GEOWIZ_TEST_PYTHON: path.join(root, "tool/.venv", pythonName) });
	passed("tool-generic-client");
	passed("qualification-required");
	await fs.writeFile(path.join(root, "tool/package.json"), JSON.stringify({ private: true, type: "module" }));
	await run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			...Object.values(artifacts).map((file) => path.relative(path.join(root, "tool"), file)),
		],
		path.join(root, "tool"),
	);
	for (const [id, prefix] of [
		["geowiz", "shaleyeah-server-geowiz-"],
		["geologist", "shaleyeah_geologist_adk-"],
	]) {
		const directory = id === "geowiz" ? "npm" : "wheels";
		const file = (await fs.readdir(path.join(root, directory))).find((name) => name.startsWith(prefix));
		assert.ok(file);
		units.push({ id, independent: true, artifactSha256: await fingerprint(path.join(root, directory, file)) });
	}
	for (const name of [
		"pair.py",
		"archive-control.py",
		"archive-negative.py",
		"generic-client.mjs",
		"diagnostic-config.mjs",
		"external-mcp.py",
		"employee-step.py",
	])
		await fs.copyFile(path.join(serverRoot, "tests/extraction", name), path.join(checksDirectory, name));
	for (const name of [
		"provider-fetch.mjs",
		"qualification_fixture.py",
		"employee-records.json",
		"connector-records.json",
		"performance-profile.json",
	])
		await fs.copyFile(path.join(serverRoot, "tests/fixtures", name), path.join(checksDirectory, name));
	await fs.copyFile(path.join(serverRoot, "tests/sample-files/sample.las"), path.join(checksDirectory, "sample.las"));
	for (const unit of ["geowiz", "geologist"])
		await fs.copyFile(
			path.join(repo, unit === "geowiz" ? "servers/geowiz/Dockerfile" : "agents/geologist/Dockerfile"),
			path.join(root, "recipes", unit, "Dockerfile"),
		);
	await fs.writeFile(
		path.join(root, ".dockerignore"),
		"**\n!npm/\n!npm/**\n!wheels/\n!wheels/**\n!requirements-*.txt\n!tool/\n!tool/package.json\n!tool/package-lock.json\n!recipes/\n!recipes/**\n",
	);
	await run(
		path.join(root, "tool/.venv", pythonName),
		["-I", path.join(checksDirectory, "archive-control.py"), root],
		root,
	);
	passed("distribution-allowlist");
	await run(
		path.join(root, "tool/.venv", pythonName),
		["-I", path.join(checksDirectory, "archive-negative.py"), root],
		root,
	);
	passed("distribution-drift-denial");
	console.log("Running the installed employee/tool reference outside the checkout");
	await run(path.join(root, "employee/.venv", pythonName), ["-I", path.join(checksDirectory, "pair.py"), root], root);
	for (const id of [
		"agent-external-mcp",
		"paired-source-context",
		"provider-switch",
		"human-review-resume",
		"revision-source-denial",
		"contract-version-denial",
	])
		passed(id);
	const version = (await run("git", ["rev-parse", "HEAD"])).trim();
	const report = {
		schemaVersion: "0.1.0",
		status: "passed",
		qualification: "fixture",
		professionalAcceptance: false,
		codeRevision: version,
		units,
		controls,
		locks: {
			npm: await fingerprint(path.join(root, "tool/package-lock.json")),
			python: await fingerprint(path.join(root, "requirements-employee.txt")),
		},
	};
	await fs.writeFile(path.join(root, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
	await fs.mkdir(path.dirname(destination), { recursive: true });
	await fs.writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
	console.log("Extracted reference: passed (offline fixture evidence)");
} catch (error) {
	await fs.mkdir(path.dirname(destination), { recursive: true });
	await fs.writeFile(
		destination,
		`${JSON.stringify({
			schemaVersion: "0.1.0",
			status: "blocked",
			qualification: "fixture",
			professionalAcceptance: false,
			controls,
			failures: ["extraction_failed"],
		})}\n`,
	);
	console.error(error instanceof Error ? error.message : "Extraction failed");
	process.exitCode = 1;
} finally {
	if (keepIndex < 2) await fs.rm(root, { recursive: true, force: true });
}
