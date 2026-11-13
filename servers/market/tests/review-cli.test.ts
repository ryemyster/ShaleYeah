import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { loadMarketBinding } from "../src/configuration.js";
import { localBindingFixture } from "./fixtures/local-binding.js";

const execute = promisify(execFile);
async function prepared() {
	const f = await localBindingFixture({ liveClock: true });
	const binding = await loadMarketBinding(f.file);
	const draft = await binding.service.draft(f.ref(), f.proposal, "r1", binding.localPrincipal);
	const pending = await binding.reviewWorkflow!.prepare(f.candidate(draft), binding.localPrincipal, null);
	const run = (args: string[]) =>
		execute(process.execPath, ["examples/review.mjs", ...args], {
			env: { PATH: process.env.PATH ?? "", MARKET_CONFIG_FILE: f.file },
			timeout: 30000,
		});
	return { ...f, binding, pending, run };
}

test("the commercial owner CLI inspects private exact sources and requests changes without printing source text", async () => {
	const f = await prepared();
	try {
		const target = path.join(f.root, "inspected.json"),
			inspected = await f.run(["inspect", f.pending.reviewId, target]);
		assert.equal(JSON.parse(inspected.stdout).packetDigest, f.pending.packetDigest);
		assert.ok(!inspected.stdout.includes("heatContent"));
		const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
		try {
			assert.equal((await handle.stat()).mode & 0o077, 0);
			const packet = JSON.parse(await handle.readFile("utf8"));
			assert.equal(packet.packet.sources.length, 3);
			assert.equal(packet.packet.market.commercialAuthority, false);
			assert.ok(packet.packet.sources.some((source: { text: string }) => source.text.includes("heatContent")));
		} finally {
			await handle.close();
		}
		const reason = path.join(f.root, "reason.json");
		await fs.writeFile(
			reason,
			JSON.stringify({
				reason: "Clarify the regional basis and future downside assumption",
				humanReviewSeconds: 12,
				corrections: 1,
			}),
			{ mode: 0o600 },
		);
		const changed = await f.run(["decide", f.pending.reviewId, f.pending.packetDigest, "request_changes", reason]);
		assert.equal(JSON.parse(changed.stdout).state, "changes-requested");
		assert.equal(
			(await f.binding.reviewWorkflow!.status(f.pending.reviewId, f.binding.localPrincipal)).state,
			"changes-requested",
		);
	} finally {
		f.binding.close();
		await f.close();
	}
});

test("the commercial CLI preserves existing files and cannot approve an invented digest or an unqualified packet", async () => {
	const f = await prepared();
	try {
		await f.run(["inspect", f.pending.reviewId, path.join(f.root, "verified-preview.json")]);
		const target = path.join(f.root, "existing.json");
		await fs.writeFile(target, "preserve", { mode: 0o600 });
		await assert.rejects(f.run(["inspect", f.pending.reviewId, target]));
		assert.equal(await fs.readFile(target, "utf8"), "preserve");
		const reason = path.join(f.root, "reason.json");
		await fs.writeFile(reason, JSON.stringify({ reason: "Exact private commercial packet reviewed" }), { mode: 0o600 });
		for (const digest of ["0".repeat(64), f.pending.packetDigest])
			await assert.rejects(f.run(["decide", f.pending.reviewId, digest, "approve", reason]));
		assert.equal(
			(await f.binding.reviewWorkflow!.status(f.pending.reviewId, f.binding.localPrincipal)).state,
			"awaiting-review",
		);
	} finally {
		f.binding.close();
		await f.close();
	}
});
