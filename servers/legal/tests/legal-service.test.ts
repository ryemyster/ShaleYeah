import assert from "node:assert/strict";
import { test } from "node:test";
import { LegalMemoService } from "../src/legal-service.js";
import { legalFixture, now, ref, who } from "./fixtures/legal.js";

test("three exact sources drive canonical unreviewed legal work from the proposed cited analysis", async () => {
	const f = legalFixture();
	const result = await f.service.draft(ref, f.proposal, "r1", who);
	assert.equal(result.legal.status, "ready-for-review");
	assert.equal(result.legal.legalClearance, false);
	assert.equal(result.work.status, "ready_for_review");
	assert.equal(result.work.review.status, "unreviewed");
	assert.equal(result.work.findings.length, 4);
	assert.ok(result.work.findings.every((finding) => finding.basis === "assumed"));
	assert.ok(result.work.findings.some((finding) => String(finding.value).includes("0%")));
	assert.deepEqual(result.work.inputs, f.current.task.inputs);
	assert.equal(result.work.evidence.length, 3);
	assert.equal(result.sourceArtifacts.length, 3);
	assert.deepEqual(result, await f.service.draft(ref, f.proposal, "r1", who));
});

test("quote lookup computes real UTF-8 spans and hashes while the model supplies only the selected text", async () => {
	const f = legalFixture();
	const target = {
		documentRef: { id: "document.contract", revision: "r1" },
		sectionId: "transfer",
		quote: "Café 🛢 LLC",
	};
	const selected = await f.service.cite(ref, target, who);
	assert.deepEqual(selected.citation, f.quotes.party);
	assert.equal(selected.applicability.status, "eligible-for-draft");
	await assert.rejects(() => f.service.cite(ref, { ...target, quote: "Cafe LLC" }, who));
	await assert.rejects(() =>
		f.service.cite(ref, { ...target, documentRef: { ...target.documentRef, revision: "wrong" } }, who),
	);
	const section = f.corpus.documents[0].sections[0];
	section.text += " Café 🛢 LLC";
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.bind();
	await assert.rejects(() => f.service.cite(ref, target, who), /ambiguous_quote/);
	const second = await f.service.cite(ref, { ...target, occurrence: 1 }, who);
	assert.ok(second.citation.startByte > selected.citation.endByte);
	await assert.rejects(() => f.service.cite(ref, { ...target, occurrence: 2 }, who));
});

test("discovery and provision paging are bounded and preserve source kinds and Unicode characters", async () => {
	const f = legalFixture();
	const inputs = await f.service.inspect(ref, who);
	assert.equal(inputs.matter.asOfDate, "2022-08-29");
	assert.equal(inputs.documents.length, 3);
	assert.ok(inputs.documents.every((d) => d.sections.every((s) => !Object.hasOwn(s, "text"))));
	const provision = { documentRef: { id: "document.contract", revision: "r1" }, sectionId: "transfer" };
	const first = await f.service.readProvision(ref, provision, who, 0, 6);
	assert.equal(first.text, "Café 🛢");
	assert.equal(first.offsetUnit, "unicode-code-points");
	assert.equal(first.nextOffset, 6);
	const second = await f.service.readProvision(ref, provision, who, 6, 32);
	assert.ok((first.text + second.text).startsWith("Café 🛢 LLC"));
	const compared = await f.service.compare(ref, [provision], who);
	assert.equal(compared.provisions[0].sourceKind, "contract");
	assert.equal(compared.provisions[0].applicability.status, "eligible-for-draft");
	await assert.rejects(() => f.service.compare(ref, [provision, provision], who));
	await assert.rejects(() => f.service.readProvision(ref, { ...provision, sectionId: "missing" }, who));
	const page = await f.service.readSource(f.current.corpusSourceRef, who, 0, 40);
	assert.equal(page.nextOffset, 40);
	assert.equal(
		(await f.service.sourceMetadata(f.current.matterSourceRef, "export", who)).sourceArtifact.artifact.id,
		"evidence.matter",
	);
	assert.ok((await f.service.reviewSource("evidence.corpus", who)).bytes.byteLength > 0);
});

test("omitted questions and missing required documents remain real blockers in work projection", async () => {
	const f = legalFixture();
	f.proposal.issues = f.proposal.issues.filter(
		(issue: { questionRef: { id: string } }) => issue.questionRef.id !== "question.party",
	);
	const result = await f.service.draft(ref, f.proposal, "r1", who);
	assert.equal(result.work.status, "blocked");
	assert.ok(result.work.blockers.some((b) => b.code === "missing_input"));
	assert.equal(result.legal.coverage.missingQuestionRefs[0].id, "question.party");
	assert.equal(result.legal.legalClearance, false);
});

test("legal as-of dates do not substitute for fresh source observations or current read/export rights", async () => {
	const f = legalFixture();
	f.setClock(() => new Date(now.getTime() + 86401 * 1000));
	await assert.rejects(() => f.service.inspect(ref, who), /stale_source/);
	const g = legalFixture();
	g.setOperations(["read"]);
	assert.equal((await g.service.inspect(ref, who)).matter.asOfDate, "2022-08-29");
	await assert.rejects(() => g.service.draft(ref, g.proposal, "r1", who), /source_use_denied/);
	g.revoke();
	await assert.rejects(() => g.service.readSource(g.current.corpusSourceRef, who));
});

test("tampered bytes, foreign actors, changed task revisions and unsafe source content fail closed", async () => {
	const f = legalFixture();
	const tampered = new LegalMemoService({
		...f.options,
		fetchSource: async (r, p, op) => {
			const source = await f.fetchSource(r, p, op);
			source.bytes[0] ^= 1;
			return source;
		},
	});
	await assert.rejects(() => tampered.inspect(ref, who), /source_binding_mismatch/);
	for (const principal of [
		{ ...who, customerId: "foreign" },
		{ ...who, employeeId: "foreign" },
		{ ...who, scopes: [] },
	])
		await assert.rejects(() => f.service.inspect(ref, principal), /access_denied/);
	f.current.task.revision = "changed";
	await assert.rejects(() => f.service.inspect(ref, who), /revision_mismatch/);
	const secret = legalFixture();
	secret.setGuard(async () => false);
	await assert.rejects(() => secret.service.inspect(ref, who), /unsafe_content/);
});

test("authority, content and clock are rechecked after asynchronous output scanning", async () => {
	for (const mutate of [
		(f: ReturnType<typeof legalFixture>) => {
			f.revoke();
		},
		(f: ReturnType<typeof legalFixture>) => {
			f.current.task.revision = "changed";
		},
		(f: ReturnType<typeof legalFixture>) => {
			f.texts.set("corpus", `${f.texts.get("corpus")} `);
		},
		(f: ReturnType<typeof legalFixture>) => {
			f.setClock(() => new Date(now.getTime() + 86401 * 1000));
		},
	]) {
		const f = legalFixture();
		f.setGuard(async (text) => {
			if (text.includes('"kind":"work-product"')) mutate(f);
			return true;
		});
		await assert.rejects(() => f.service.draft(ref, f.proposal, "r1", who));
	}
	const f = legalFixture();
	f.setGuard(async (text) => !text.includes("model-secret"));
	f.proposal.title = "model-secret";
	await assert.rejects(() => f.service.draft(ref, f.proposal, "r1", who), /unsafe_content/);
});

test("cancelled reads and invalid paging or configuration cannot produce a useful memo", async () => {
	const f = legalFixture(),
		controller = new AbortController();
	controller.abort();
	await assert.rejects(() => f.service.inspect(ref, who, controller.signal), /cancelled/);
	await assert.rejects(() => f.service.readSource(f.current.corpusSourceRef, who, -1, 40));
	await assert.rejects(() => f.service.readSource(f.current.corpusSourceRef, who, 0, 32001));
	assert.throws(() => new LegalMemoService({ ...f.options, maxSourceAgeSeconds: 0 }));
	f.current.task.inputs.pop();
	await assert.rejects(() => f.service.inspect(ref, who), /source_binding_mismatch/);
});

test("invalid page bounds are rejected before source access or credential resolution", async () => {
	const f = legalFixture();
	let reads = 0;
	const service = new LegalMemoService({
		...f.options,
		fetchSource: async (r, p, op) => {
			reads++;
			return f.fetchSource(r, p, op);
		},
	});
	await assert.rejects(() => service.readSource(f.current.corpusSourceRef, who, -1, 40), /invalid_pagination/);
	assert.equal(reads, 0);
	await assert.rejects(
		() =>
			service.readProvision(
				ref,
				{ documentRef: { id: "document.contract", revision: "r1" }, sectionId: "transfer" },
				who,
				0,
				32001,
			),
		/invalid_pagination/,
	);
	assert.equal(reads, 0);
});
