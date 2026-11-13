import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("actual stdio stdout contains MCP frames only; operational output uses stderr", { timeout: 15000 }, async () => {
	const directory = await mkdtemp(join(tmpdir(), "shale-stdio-"));
	const child = spawn(
		process.execPath,
		["--import", "tsx", fileURLToPath(new URL("./fixtures/mcp-stdio.ts", import.meta.url)), directory],
		{
			env: { ...process.env, PORT: undefined },
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
	const lines: string[] = [];
	let diagnostics = "";
	child.stderr.on("data", (data) => {
		diagnostics += data.toString();
	});
	const reader = createInterface({ input: child.stdout });
	const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
	try {
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("stdio control deadline")), 12000);
			reader.on("line", (line) => {
				lines.push(line);
				let message: { id?: number; result?: object };
				try {
					message = JSON.parse(line);
				} catch {
					return;
				}
				if (message.id === 1) {
					send({ jsonrpc: "2.0", method: "notifications/initialized" });
					send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: { value: "kept" } } });
				}
				if (message.id === 2) {
					clearTimeout(timer);
					resolve();
				}
			});
			child.once("error", (error) => {
				clearTimeout(timer);
				reject(error);
			});
			child.once("exit", () => {
				clearTimeout(timer);
				reject(new Error("stdio fixture stopped before reply"));
			});
			send({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "control", version: "1" } },
			});
		});
		assert.ok(lines.length >= 2);
		for (const line of lines) assert.equal(JSON.parse(line).jsonrpc, "2.0", "stdout must contain protocol JSON");
		assert.match(diagnostics, /initialized/);
	} finally {
		reader.close();
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
			await new Promise<void>((resolve) => child.once("exit", () => resolve()));
		}
		await rm(directory, { recursive: true, force: true });
	}
});
