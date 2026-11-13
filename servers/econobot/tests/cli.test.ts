import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test("independent generic MCP client receives actual economics and rejects legacy guessed-data requests", async () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "econobot-protocol-"));
	const client = new Client(
		{ name: "independent-economics", version: "r1" },
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
		assert.deepEqual(
			new Set((await client.listTools()).tools.map((tool) => tool.name)),
			new Set(["analyze_economics", "calculate_dcf", "sensitivity_analysis"]),
		);
		const args = {
			contractVersion: "0.1.0",
			cashFlows: [-100, 110],
			discountRate: 0.1,
			currency: "USD",
			periodUnit: "year",
			inputRef: { id: "source.cash-flows", revision: "r1" },
			assumptionRefs: [],
		};
		const response = await client.callTool({ name: "calculate_dcf", arguments: args });
		assert.equal(response.isError, false);
		const result = response.structuredContent as {
			analysis: { irr: { value: number }; authorizesInvestment: boolean };
		};
		assert.ok(Math.abs(result.analysis.irr.value - 0.1) < 1e-8);
		assert.equal(result.analysis.authorizesInvestment, false);
		const missing = await client.callTool({
			name: "calculate_dcf",
			arguments: { cashFlows: [-100, 110], discountRate: 0.1 },
		});
		assert.equal(missing.isError, true);
		const unavailable = await client.callTool({ name: "calculate_dcf", arguments: { ...args, cashFlows: [1, 2] } });
		assert.equal(unavailable.isError, false);
		assert.equal(
			(unavailable.structuredContent as { analysis: { irr: { value: null; reason: string } } }).analysis.irr.value,
			null,
		);
		const old = await client.callTool({
			name: "analyze_economics",
			arguments: { filePath: "/missing.xlsx", dataType: "production" },
		});
		assert.equal(old.isError, true);
	} finally {
		await client.close();
		rmSync(directory, { recursive: true });
	}
});
