import assert from "node:assert/strict";
import { test } from "node:test";
import { DrillingPacketService } from "../src/drilling-service.js";
import { drillingFixture, now, ref, who } from "./fixtures/drilling.js";

test("current source inventory and original evidence reads preserve explicit engineering identity and UTF-8 citations", async () => {
	const f = drillingFixture(),
		inputs = await f.service.inspect(ref, who);
	assert.deepEqual(inputs.design.wellRef, f.design.wellRef);
	assert.equal(inputs.evidence.length, 5);
	assert.ok(inputs.evidence.every((d) => d.sections.every((s) => !Object.hasOwn(s, "text"))));
	const selected = { evidenceRef: f.corpus.documents[0].evidenceRef, sectionId: "basis" };
	const page = await f.service.readEvidence(ref, selected, who, 0, 40);
	assert.equal(page.text, Array.from(f.corpus.documents[0].sections[0].text).slice(0, 40).join(""));
	assert.equal(page.offsetUnit, "unicode-code-points");
	const result = await f.service.cite(ref, { ...selected, quote: "Élodie 🛢" }, who);
	assert.ok(result.citation.endByte - result.citation.startByte > result.citation.quote.length);
	await assert.rejects(f.service.cite(ref, { ...selected, quote: "Approved to spud" }, who), /quote_unavailable/);
	f.corpus.documents[0].sections[0].text = "Repeated 🛢. Repeated 🛢.";
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.bind();
	await assert.rejects(f.service.cite(ref, { ...selected, quote: "Repeated 🛢." }, who), /ambiguous_quote/);
	assert.equal(
		(await f.service.cite(ref, { ...selected, quote: "Repeated 🛢.", occurrence: 1 }, who)).citation.startByte,
		15,
	);
	await assert.rejects(
		f.service.cite(ref, { ...selected, quote: "Repeated 🛢.", occurrence: 2 }, who),
		/quote_unavailable/,
	);
});

test("program, quoted-cost/schedule and hazard/offset views retain useful supplied capabilities and blockers", async () => {
	const f = drillingFixture();
	for (const view of ["program", "costs", "risks"] as const) {
		const result = await f.service.calculate(ref, view, who);
		assert.equal(result.view, view);
		assert.equal(result.drilling.operationalApproval, false);
		assert.equal(result.sourceArtifacts.length, 3);
		if ("programs" in result.drilling && result.drilling.programs)
			assert.equal(result.drilling.programs[0].casingDesignRef?.id, "casing.example");
		if ("costs" in result.drilling && result.drilling.costs)
			assert.equal(result.drilling.costs[0].totalExact, "450000/1");
		if ("hazards" in result.drilling && result.drilling.hazards)
			assert.equal(result.drilling.hazards[0].severity, "operator-high");
	}
	f.corpus.offsets = [];
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.bind();
	const missing = await f.service.draft(ref, f.proposal, "r1", who);
	assert.equal(missing.work.status, "blocked");
	assert.ok(missing.drilling.exceptions.some((e) => e.code === "missing_offset"));
	await assert.rejects(f.service.calculate(ref, "invented", who));
});

test("foreign actors, tampered bytes, denied export and unsafe content cannot obtain useful work", async () => {
	const f = drillingFixture();
	for (const actor of [
		{ ...who, customerId: "foreign" },
		{ ...who, employeeId: "foreign" },
		{ ...who, scopes: [] },
	])
		await assert.rejects(f.service.inspect(ref, actor), /access_denied/);
	const changed = new DrillingPacketService({
		...f.options,
		fetchSource: async (r, p, o) => {
			const result = await f.fetchSource(r, p, o);
			result.bytes[0] ^= 1;
			return result;
		},
	});
	await assert.rejects(changed.inspect(ref, who), /source_binding_mismatch/);
	f.setOperations(["read"]);
	assert.equal((await f.service.inspect(ref, who)).design.asOfDate, "2026-11-23");
	await assert.rejects(f.service.draft(ref, f.proposal, "r1", who), /source_use_denied/);
	f.setGuard(async () => false);
	await assert.rejects(f.service.inspect(ref, who), /unsafe_content/);
});

test("rights, bytes, task revision and freshness are checked again after asynchronous output scanning", async () => {
	for (const mutate of [
		(f: ReturnType<typeof drillingFixture>) => f.revoke(),
		(f: ReturnType<typeof drillingFixture>) => {
			f.current.task.revision = "changed";
		},
		(f: ReturnType<typeof drillingFixture>) => {
			f.texts.set("corpus", `${f.texts.get("corpus")} `);
		},
		(f: ReturnType<typeof drillingFixture>) => f.setClock(() => new Date(now.getTime() + 86401 * 1000)),
	]) {
		const f = drillingFixture();
		f.setGuard(async (text) => {
			if (text.includes('"kind":"work-product"')) mutate(f);
			return true;
		});
		await assert.rejects(f.service.draft(ref, f.proposal, "r1", who));
	}
});

test("invalid pagination and cancelled requests fail before reading evidence", async () => {
	const f = drillingFixture();
	let calls = 0;
	const service = new DrillingPacketService({
		...f.options,
		fetchSource: async (r, p, o) => {
			calls++;
			return f.fetchSource(r, p, o);
		},
	});
	await assert.rejects(service.readSource(f.current.corpusSourceRef, who, -1, 20), /invalid_pagination/);
	await assert.rejects(
		service.readEvidence(ref, { evidenceRef: f.corpus.documents[0].evidenceRef, sectionId: "basis" }, who, 0, 32001),
		/invalid_pagination/,
	);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(service.inspect(ref, who, controller.signal), /cancelled/);
	assert.equal(calls, 0);
	await assert.rejects(
		service.readEvidence(ref, { evidenceRef: { id: "missing", revision: "r1" }, sectionId: "missing" }, who),
		/evidence_unavailable/,
	);
	assert.throws(() => new DrillingPacketService({ ...f.options, maxSourceAgeSeconds: 0 }), /configuration/);
	f.current.task.inputs.pop();
	await assert.rejects(service.inspect(ref, who), /source_binding_mismatch/);
});
