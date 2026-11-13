import assert from "node:assert/strict";
import { test } from "node:test";
import { SourceAccessError } from "@shaleyeah/connectors";
import { MarketServiceError } from "../src/index.js";
import { employeeFixture, now, scope, who } from "./fixtures/employee.js";

const failure = (error: unknown) => error instanceof Error && error.name === "MarketServiceError";
test("a raw series retrieval in the future cannot hide behind current source-wrapper timestamps", async () => {
	const f = employeeFixture();
	f.input.series.series[0].retrievedAt = "2026-11-14T00:00:00.000Z";
	f.texts.set("series", JSON.stringify(f.input.series));
	f.bind();
	await assert.rejects(f.service.draft(f.ref(), f.proposal, "w1", who), {
		name: "MarketServiceError",
		code: "invalid_source_time",
	});
});
test("current source inventory and draft carry exact inputs, evidence and unreviewed common work", async () => {
	const f = employeeFixture();
	const inventory = await f.service.inspect(f.ref(), who);
	assert.equal(inventory.sourceArtifacts.length, 3);
	assert.equal(inventory.series[0].observations, undefined, "source rows load on demand");
	const packet = await f.service.draft(f.ref(), f.proposal, "w1", who);
	assert.equal(packet.market.status, "ready-for-review");
	assert.equal(packet.market.comparison.rows[0].realizedValue, 2.8);
	assert.equal(packet.work.kind, "work-product");
	assert.equal(packet.work.status, "ready_for_review");
	assert.deepEqual(packet.work.scope, scope);
	assert.deepEqual(packet.work.inputs, f.current.task.inputs);
	assert.deepEqual(packet.work.review, { status: "unreviewed", decisionRefs: [] });
	assert.deepEqual(packet.work.evidence.map((e) => e.id).sort(), [
		"evidence.assumptions",
		"evidence.mandate",
		"evidence.series",
	]);
	assert.equal(packet.market.commercialAuthority, false);
	assert.ok(packet.work.findings.some((finding) => finding.basis === "assumed" && finding.value === 3.8));
});

test("customer, employee and missing role/source scopes are denied", async () => {
	const f = employeeFixture();
	for (const principal of [
		{ ...who, customerId: "foreign" },
		{ ...who, employeeId: "foreign" },
		{ ...who, scopes: ["market:read"] },
		{ ...who, scopes: ["source:read"] },
	])
		await assert.rejects(f.service.inspect(f.ref(), principal), failure);
});

test("cross-asset metadata and changed source bytes cannot support a draft", async () => {
	const f = employeeFixture();
	f.setFetcher(async (ref) => {
		const source = f.fetched(ref.id);
		source.artifact = structuredClone(source.artifact);
		source.artifact.scope.assetId = "foreign-asset";
		return source;
	});
	await assert.rejects(f.service.draft(f.ref(), f.proposal, "w1", who), failure);
	f.setFetcher(async (ref) => ({ ...f.fetched(ref.id), bytes: Buffer.from("changed without a source revision") }));
	await assert.rejects(f.service.inspect(f.ref(), who), failure);
});

test("read-only source rights allow inventory but cannot export a work packet", async () => {
	const f = employeeFixture();
	f.setOperations(["read"]);
	assert.equal((await f.service.inspect(f.ref(), who)).sourceArtifacts.length, 3);
	await assert.rejects(f.service.draft(f.ref(), f.proposal, "w1", who), failure);
	await assert.rejects(f.service.sourceMetadata(f.current.seriesSourceRef, "export", who), failure);
});

test("read-only calculation returns actual comparable values without a recorded work product", async () => {
	const f = employeeFixture();
	f.setOperations(["read"]);
	const calculated = await f.service.calculate(f.ref(), who);
	assert.equal(calculated.market.comparison.rows[0].realizedValue, 2.8);
	assert.equal(calculated.market.scenarios[0].price, 3.8);
	assert.equal(calculated.market.reviewStatus, "unreviewed");
	assert.equal(calculated.market.commercialAuthority, false);
	assert.equal("work" in calculated, false);
});

test("source revocation during the final content scan prevents delivery", async () => {
	const f = employeeFixture();
	f.setGuard(async (text) => {
		if (text.includes('"kind":"work-product"')) f.revoke();
		return true;
	});
	await assert.rejects(f.service.draft(f.ref(), f.proposal, "w1", who), failure);
});

test("source age is rechecked after asynchronous scanning", async () => {
	const f = employeeFixture();
	f.setGuard(async (text) => {
		if (text.includes('"kind":"work-product"')) f.setClock(() => new Date(now.getTime() + 2 * 86400000));
		return true;
	});
	await assert.rejects(f.service.draft(f.ref(), f.proposal, "w1", who), failure);
});

test("changed task/input revisions invalidate the earlier task reference", async () => {
	const f = employeeFixture(),
		earlier = f.ref();
	f.replaceSource("assumptions", JSON.stringify({ ...f.input.assumptions, asOf: "2026-11-13T01:00:00.000Z" }));
	await assert.rejects(f.service.draft(earlier, f.proposal, "w1", who), failure);
	assert.equal((await f.service.draft(f.ref(), f.proposal, "w2", who)).work.taskRevision, "r2");
});

test("bounded source pages and current metadata resolve only bound input references", async () => {
	const f = employeeFixture();
	const page = await f.service.readSource(f.current.seriesSourceRef, who, 0, 24);
	assert.equal(Array.from(page.text).length, 24);
	assert.equal(page.nextOffset, 24);
	assert.deepEqual(page.sourceArtifact.artifact, f.fetched("evidence.series").artifact.artifact);
	assert.equal((await f.service.sourceMetadata(f.current.seriesSourceRef, "read", who)).operation, "read");
	const reviewed = await f.service.reviewSource("evidence.series", who);
	assert.deepEqual(reviewed.artifact.artifact, f.fetched("evidence.series").artifact.artifact);
	assert.deepEqual(reviewed.bytes, Uint8Array.from(f.fetched("evidence.series").bytes));
	await assert.rejects(f.service.readSource({ id: "/arbitrary/path", revision: "r1" }, who), failure);
	await assert.rejects(f.service.readSource(f.current.seriesSourceRef, who, -1, 10), failure);
});

test("malformed source JSON and failed access callbacks return safe errors", async () => {
	const f = employeeFixture();
	f.replaceSource("series", "private-malformed-source{");
	await assert.rejects(
		f.service.inspect(f.ref(), who),
		(error) => failure(error) && !(error as Error).message.includes("private-malformed"),
	);
	f.setFetcher(async () => {
		throw new Error("private-secret-token-and-path");
	});
	await assert.rejects(
		f.service.inspect(f.ref(), who),
		(error) => failure(error) && !(error as Error).message.includes("private-secret"),
	);
});

test("a required period gap produces blocked common work instead of false readiness", async () => {
	const f = employeeFixture();
	f.input.series.series[1].observations.pop();
	f.replaceSource("series", JSON.stringify(f.input.series));
	const packet = await f.service.draft(f.ref(), f.proposal, "w1", who);
	assert.equal(packet.market.status, "blocked");
	assert.equal(packet.work.status, "blocked");
	assert.ok(packet.work.blockers.length > 0);
});

test("safe source-rights failures retain their denial code", async () => {
	const f = employeeFixture();
	for (const error of [new MarketServiceError("source_use_denied"), new SourceAccessError("access_denied")]) {
		f.setFetcher(async () => {
			throw error;
		});
		await assert.rejects(f.service.inspect(f.ref(), who), { name: "MarketServiceError", code: error.code });
	}
});

test("invalid proposals are argument failures instead of provider outages", async () => {
	const f = employeeFixture();
	await assert.rejects(f.service.draft(f.ref(), { ...f.proposal, price: 999999 }, "w1", who), {
		name: "MarketServiceError",
		code: "invalid_arguments",
	});
});
