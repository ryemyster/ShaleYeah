import assert from "node:assert/strict";
import { test } from "node:test";
import { TitlePacketService } from "../src/title-service.js";
import { now, ref, titleFixture, who } from "./fixtures/title.js";

test("three current source exports drive exact unreviewed Title facts and proposed observations", async () => {
	const f = titleFixture(),
		actual = await f.service.draft(ref, f.proposal, "r1", who);
	assert.equal(actual.title.status, "ready-for-review");
	assert.equal(actual.title.netRevenue[0].netRevenueInterest, "5/16");
	assert.equal(actual.title.titleClearance, false);
	assert.equal(actual.work.status, "ready_for_review");
	assert.deepEqual(actual.work.review, { status: "unreviewed", decisionRefs: [] });
	assert.equal(actual.sourceArtifacts.length, 3);
	assert.deepEqual(actual.work.inputs, f.current.task.inputs);
	assert.ok(actual.work.findings.some((row) => row.value === "5/16"));
	assert.deepEqual(actual, await f.service.draft(ref, f.proposal, "r1", who));
});

test("instrument lookup and quote lookup use bounded original Unicode text and real byte hashes", async () => {
	const f = titleFixture(),
		target = { instrumentRef: { id: "instrument.opening", revision: "r1" }, sectionId: "opening" };
	const inputs = await f.service.inspect(ref, who);
	assert.equal(inputs.examination.tractRef.id, "tract.fictional");
	assert.equal(inputs.instruments.length, 3);
	assert.deepEqual(inputs.instruments[0].tractRef, f.examination.tractRef);
	assert.ok(inputs.instruments.every((row) => row.sections.every((part) => !Object.hasOwn(part, "text"))));
	const page = await f.service.readInstrument(ref, target, who, 0, 60);
	assert.equal(page.offsetUnit, "unicode-code-points");
	assert.equal(page.text, Array.from(f.corpus.documents[0].sections[0].text).slice(0, 60).join(""));
	const citation = await f.service.cite(ref, { ...target, quote: "Élodie 🛢 LLC" }, who);
	assert.ok(citation.citation.endByte - citation.citation.startByte > citation.citation.quote.length);
	await assert.rejects(() => f.service.cite(ref, { ...target, quote: "Invented owner" }, who), /quote_unavailable/);
	const source = await f.service.readSource(f.current.corpusSourceRef, who, 0, 40);
	assert.equal(source.nextOffset, 40);
	assert.equal((await f.service.sourceMetadata(f.current.examinationSourceRef, "export", who)).operation, "export");
	assert.ok((await f.service.reviewSource("evidence.corpus", who)).bytes.byteLength > 0);
});

test("source-backed ownership, chain, burden and lease views never use description or county defaults", async () => {
	const f = titleFixture();
	for (const view of ["ownership", "chain", "burdens", "lease"] as const) {
		const result = await f.service.calculate(ref, view, who);
		assert.equal(result.view, view);
		assert.equal(result.title.titleClearance, false);
		assert.equal(result.sourceArtifacts.length, 3);
		if (view === "ownership" || view === "burdens") assert.equal(result.title.netRevenue[0].netRevenueInterest, "5/16");
		if (view === "chain") assert.equal(result.title.chain.length, 3);
		if (view === "lease") assert.equal(result.title.leaseTerms[0].primaryTermEnd, "2027-01-01");
	}
	await assert.rejects(() => f.service.calculate(ref, "invented", who));
});

test("missing proposal coverage or input conflicts become blocked common work, not cleared title", async () => {
	const f = titleFixture();
	f.proposal.observations.pop();
	const result = await f.service.draft(ref, f.proposal, "r1", who);
	assert.equal(result.work.status, "blocked");
	assert.ok(result.work.blockers.some((row) => row.code === "missing_input"));
	assert.deepEqual(result.title.coverage.missingQuestionIds, ["lease"]);
	assert.equal(result.title.titleClearance, false);
});

test("a wrong-tract instrument cannot appear as an accepted burden in the calculation view", async () => {
	const f = titleFixture();
	f.corpus.documents[2].tractRef.id = "tract.foreign";
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.bind();
	const result = await f.service.calculate(ref, "burdens", who);
	assert.equal(result.title.status, "needs-input");
	assert.deepEqual(result.title.burdens, []);
	assert.deepEqual(result.title.netRevenue, []);
});

test("historical examination dates do not replace fresh source observations or read/export rights", async () => {
	const f = titleFixture();
	f.setClock(() => new Date(now.getTime() + 86401 * 1000));
	await assert.rejects(() => f.service.inspect(ref, who), /stale_source/);
	const g = titleFixture();
	g.setOperations(["read"]);
	assert.equal((await g.service.inspect(ref, who)).examination.asOfDate, "2026-01-15");
	await assert.rejects(() => g.service.draft(ref, g.proposal, "r1", who), /source_use_denied/);
	g.revoke();
	await assert.rejects(() => g.service.readSource(g.current.corpusSourceRef, who));
});

test("tampered bytes, foreign actors, changed task identity and unsafe content fail before useful output", async () => {
	const f = titleFixture();
	const tampered = new TitlePacketService({
		...f.options,
		fetchSource: async (r, p, op) => {
			const source = await f.fetchSource(r, p, op);
			source.bytes[0] ^= 1;
			return source;
		},
	});
	await assert.rejects(() => tampered.inspect(ref, who), /source_binding_mismatch/);
	for (const actor of [
		{ ...who, customerId: "foreign" },
		{ ...who, employeeId: "foreign" },
		{ ...who, scopes: [] },
	])
		await assert.rejects(() => f.service.inspect(ref, actor), /access_denied/);
	f.current.task.revision = "changed";
	await assert.rejects(() => f.service.inspect(ref, who), /revision_mismatch/);
	const secret = titleFixture();
	secret.setGuard(async () => false);
	await assert.rejects(() => secret.service.inspect(ref, who), /unsafe_content/);
});

test("rights, current bytes and freshness are checked again after asynchronous output scanning", async () => {
	for (const mutate of [
		(f: ReturnType<typeof titleFixture>) => {
			f.revoke();
		},
		(f: ReturnType<typeof titleFixture>) => {
			f.current.task.revision = "changed";
		},
		(f: ReturnType<typeof titleFixture>) => {
			f.texts.set("corpus", `${f.texts.get("corpus")} `);
		},
		(f: ReturnType<typeof titleFixture>) => {
			f.setClock(() => new Date(now.getTime() + 86401 * 1000));
		},
	]) {
		const f = titleFixture();
		f.setGuard(async (text) => {
			if (text.includes('"kind":"work-product"')) mutate(f);
			return true;
		});
		await assert.rejects(() => f.service.draft(ref, f.proposal, "r1", who));
	}
});

test("cancellation, invalid pagination and incomplete source binding cannot access a useful packet", async () => {
	const f = titleFixture(),
		controller = new AbortController();
	controller.abort();
	await assert.rejects(() => f.service.inspect(ref, who, controller.signal), /cancelled/);
	let reads = 0;
	const counted = new TitlePacketService({
		...f.options,
		fetchSource: async (r, p, op) => {
			reads++;
			return f.fetchSource(r, p, op);
		},
	});
	await assert.rejects(() => counted.readSource(f.current.corpusSourceRef, who, -1, 20), /invalid_pagination/);
	await assert.rejects(
		() =>
			counted.readInstrument(
				ref,
				{ instrumentRef: { id: "instrument.opening", revision: "r1" }, sectionId: "opening" },
				who,
				0,
				32001,
			),
		/invalid_pagination/,
	);
	assert.equal(reads, 0);
	assert.throws(() => new TitlePacketService({ ...f.options, maxSourceAgeSeconds: 0 }));
	f.current.task.inputs.pop();
	await assert.rejects(() => f.service.inspect(ref, who), /source_binding_mismatch/);
});
