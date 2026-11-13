import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { WorkProduct } from "@shaleyeah/contracts";
import { localBindingFixture } from "./fixtures/local-binding.js";

test("generic MCP client and separate commercial CLI inspect, request changes and recover the exact scenario review", async () => {
	const f = await localBindingFixture({ liveClock: true });
	let client: Client | undefined,
		sequence = 0;
	const env = { PATH: process.env.PATH ?? "", MARKET_CONFIG_FILE: f.file };
	const call = (name: string, args: Record<string, unknown>) =>
		client!.callTool({
			name,
			arguments: args,
			_meta: {
				"org.shaleyeah/correlation": {
					context: {
						scope: f.current.task.scope,
						taskRevision: "r1",
						...f.config.correlation,
						qualification: "fixture",
					},
					parentEventId: `generic-call-${++sequence}`,
					spanId: sequence.toString(16).padStart(16, "0"),
				},
			},
		});
	async function connected() {
		const instance = new Client(
			{ name: "independent-market", version: "1" },
			{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
		);
		await instance.connect(
			new StdioClientTransport({
				command: process.execPath,
				args: [path.resolve("dist/index.js")],
				cwd: f.root,
				env,
				stderr: "pipe",
			}),
		);
		return instance;
	}
	const human = (args: string[]) =>
		spawnSync(process.execPath, [path.resolve("examples/review.mjs"), ...args], {
			env,
			encoding: "utf8",
			timeout: 15000,
		});
	try {
		client = await connected();
		const names = (await client.listTools()).tools.map((tool) => tool.name);
		assert.equal(names.length, 10);
		assert.ok(names.includes("record_market_scenarios") && names.includes("calculate_market_scenarios"));
		assert.ok(!names.some((name) => /decide|approve/.test(name)));
		const read = await call("read_market_inputs", { taskRef: f.ref() });
		assert.equal(read.isError, false, JSON.stringify(read));
		assert.equal(
			(read.structuredContent as { analysis: { sourceArtifacts: unknown[] } }).analysis.sourceArtifacts.length,
			3,
		);
		const source = await call("read_market_source", { sourceRef: f.current.seriesSourceRef, maxChars: 80 });
		assert.equal(source.isError, false, JSON.stringify(source));
		assert.equal(Array.from((source.structuredContent as { analysis: { text: string } }).analysis.text).length, 80);
		const calculated = await call("calculate_market_scenarios", { taskRef: f.ref() });
		assert.equal(calculated.isError, false, JSON.stringify(calculated));
		const comparison = (
			calculated.structuredContent as { analysis: { market: { comparison: { meanDifferential: number } } } }
		).analysis.market.comparison;
		assert.ok(Math.abs(comparison.meanDifferential + 0.2) < 1e-12);
		const drafted = await call("draft_market_scenario", { taskRef: f.ref(), proposal: f.proposal, revision: "r1" });
		assert.equal(drafted.isError, false, JSON.stringify(drafted));
		const product = (drafted.structuredContent as { analysis: { work: WorkProduct; market: unknown } }).analysis;
		const prepared = await call("prepare_market_review", { candidate: f.candidate(product), expectedHead: null });
		assert.equal(prepared.isError, false, JSON.stringify(prepared));
		const receipt = (prepared.structuredContent as { analysis: { reviewId: string; packetDigest: string } }).analysis;
		const previewFile = path.join(f.root, "human-preview.json"),
			inspected = human(["inspect", receipt.reviewId, previewFile]);
		assert.equal(inspected.status, 0, inspected.stderr);
		const preview = JSON.parse(await fs.readFile(previewFile, "utf8"));
		assert.equal(preview.packet.sources.length, 3);
		assert.equal(preview.packet.market.commercialAuthority, false);
		assert.ok(preview.packet.sources.some((item: { text: string }) => item.text.includes("basisDifferential")));
		const reason = path.join(f.root, "review-reason.json");
		await fs.writeFile(reason, JSON.stringify({ reason: "Clarify the downside basis assumption" }), { mode: 0o600 });
		const changed = human(["decide", receipt.reviewId, receipt.packetDigest, "request_changes", reason]);
		assert.equal(changed.status, 0, changed.stderr);
		await client.close();
		client = await connected();
		const restored = await call("market_review_status", { reviewId: receipt.reviewId });
		assert.equal(restored.isError, false, JSON.stringify(restored));
		assert.equal((restored.structuredContent as { analysis: { state: string } }).analysis.state, "changes-requested");
		const forged = await call("record_market_scenarios", { ...receipt, grantId: "forged" });
		assert.equal(forged.isError, true);
		f.config.sourceGrant.revoked = true;
		await f.write();
		assert.equal((await call("read_market_inputs", { taskRef: f.ref() })).isError, true);
		assert.ok(!(await fs.readFile(f.config.auditFile, "utf8")).includes(f.secret));
	} finally {
		await client?.close();
		await f.close();
	}
});
