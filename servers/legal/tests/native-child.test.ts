import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { runNativeChild } from "./fixtures/native-child.js";

const prefix = "LEGAL_NATIVE_PHASE ";
const phase = JSON.stringify({
	phase: "native-run",
	provider: "anthropic",
	runtimeElapsedMs: 3,
	sourceCalls: 4,
	modelCalls: 2,
	countCalls: 2,
});
const phaseLine = `${prefix}${phase}\n`;

function diagnostics(error: unknown) {
	assert.ok(error instanceof Error);
	const label = "Legal native child failed: ";
	assert.ok(error.message.startsWith(label));
	return JSON.parse(error.message.slice(label.length));
}

test("native child success preserves its actual stdout and stderr", async () => {
	const result = await runNativeChild(
		process.execPath,
		["-e", `process.stdout.write("native-ok\\n"); process.stderr.write(${JSON.stringify(phaseLine)});`],
		{ timeout: 5000 },
	);
	assert.equal(result.stdout, "native-ok\n");
	assert.equal(result.stderr, phaseLine);
	assert.equal(result.diagnostics.phase, "native-run");
	assert.equal(result.diagnostics.provider, "anthropic");
	assert.equal(result.diagnostics.code, 0);
	assert.equal(result.diagnostics.killed, false);
	assert.equal(result.diagnostics.countCalls, 2);
	assert.ok(Number.isFinite(result.diagnostics.elapsedMs));
});

test("native child failures expose phase and exit metadata without raw output or command arguments", async () => {
	const secret = "synthetic-private-value-never-print";
	const credentialPath = "/private/fixture-credential-path";
	await assert.rejects(
		runNativeChild(
			process.execPath,
			[
				"-e",
				`process.stderr.write(${JSON.stringify(phaseLine)}); process.stderr.write(process.argv.slice(1).join("\\n")); process.exitCode = 7;`,
				secret,
				credentialPath,
			],
			{ timeout: 5000 },
		),
		(error) => {
			const actual = diagnostics(error);
			assert.equal(actual.phase, "native-run");
			assert.equal(actual.provider, "anthropic");
			assert.equal(actual.code, 7);
			assert.equal(actual.killed, false);
			assert.equal(actual.deadlineMs, 5000);
			assert.ok(Number.isFinite(actual.elapsedMs) && actual.elapsedMs >= 0);
			assert.ok(!String(error).includes(secret));
			assert.ok(!String(error).includes(credentialPath));
			return true;
		},
	);
});

test("a stalled native child is terminated within its declared bound and retains its last safe phase", async () => {
	const started = performance.now();
	await assert.rejects(
		runNativeChild(
			process.execPath,
			["-e", `process.stderr.write(${JSON.stringify(phaseLine)}); setInterval(() => {}, 1000);`],
			{ timeout: 1000 },
		),
		(error) => {
			const actual = diagnostics(error);
			assert.equal(actual.phase, "native-run");
			assert.equal(actual.provider, "anthropic");
			assert.equal(actual.killed, true);
			assert.ok(["SIGTERM", "SIGKILL"].includes(actual.signal));
			assert.equal(actual.deadlineMs, 1000);
			assert.ok(actual.elapsedMs >= 900 && actual.elapsedMs < 5000);
			return true;
		},
	);
	assert.ok(performance.now() - started < 5000);
});

test("malformed or unknown phase fields cannot copy private strings into failure diagnostics", async () => {
	const secret = "customer-secret";
	const forged = JSON.stringify({ phase: secret, provider: secret, elapsedMs: secret });
	const forgedLine = `${prefix}${forged}\n`;
	await assert.rejects(
		runNativeChild(
			process.execPath,
			["-e", `process.stderr.write(${JSON.stringify(forgedLine)}); process.exitCode = 2;`],
			{ timeout: 5000 },
		),
		(error) => {
			const actual = diagnostics(error);
			assert.equal(actual.phase, null);
			assert.equal(actual.provider, null);
			assert.equal(actual.code, 2);
			assert.ok(!String(error).includes(secret));
			return true;
		},
	);
});
