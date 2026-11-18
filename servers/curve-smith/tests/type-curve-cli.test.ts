import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { analogInput, forecastInput } from "./fixtures/type-curve.js";

test("independent stdio client gets source-derived curves and finite volumes, rejects legacy guesses", {
	timeout: 25000,
}, async () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "curve-smith-protocol-"));
	const client = new Client(
		{ name: "independent-reservoir-review", version: "r1" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) => value !== undefined && !/^(PORT|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY)$/.test(key),
		),
	) as Record<string, string>;
	try {
		await client.connect(
			new StdioClientTransport({
				command: process.execPath,
				args: [path.resolve("dist/index.js")],
				cwd: directory,
				env,
				stderr: "pipe",
			}),
		);
		const curves = await client.callTool({ name: "generate_type_curve", arguments: analogInput });
		assert.equal(curves.isError, false, "versioned actual histories must be accepted");
		const result = curves.structuredContent as {
			analysis: { cumulativeProduction: { value: number }; evidenceKind: string; professionalAcceptance: boolean };
		};
		assert.ok(Math.abs(result.analysis.cumulativeProduction.value - 547500 * Math.log(1.5)) < 1e-6);
		assert.equal(result.analysis.evidenceKind, "contains_synthetic");
		assert.equal(result.analysis.professionalAcceptance, false);
		const volume = await client.callTool({ name: "calculate_eur", arguments: forecastInput });
		assert.equal(volume.isError, false);
		const legacy = await client.callTool({
			name: "generate_type_curve",
			arguments: { formation: "Wolfcamp A", analogWells: ["id-only"], tier: 1 },
		});
		assert.equal(legacy.isError, true, "identifier counts must not produce fabricated percentiles");
		const missing = await client.callTool({
			name: "calculate_eur",
			arguments: { ...forecastInput, horizon: undefined },
		});
		assert.equal(missing.isError, true);
	} finally {
		await client.close();
		rmSync(directory, { recursive: true, force: true });
	}
});
