import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { buildDrillingPacket, reconcileDrilling, validateDrillingCitation } from "../src/drilling-packet.js";

const oracle = JSON.parse(fs.readFileSync(new URL("./fixtures/source-oracles.json", import.meta.url), "utf8"));
const labels = JSON.parse(fs.readFileSync(new URL("./fixtures/case-labels.json", import.meta.url), "utf8"));

function base() {
	return structuredClone(oracle);
}
function citation(doc: (typeof oracle.corpus.documents)[number]) {
	const section = doc.sections[0],
		bytes = Buffer.from(section.text);
	return {
		evidenceRef: doc.evidenceRef,
		sectionId: section.sectionId,
		startByte: 0,
		endByte: bytes.byteLength,
		quote: section.text,
		sha256: createHash("sha256").update(bytes).digest("hex"),
	};
}
function proposal(f: ReturnType<typeof base>) {
	return {
		version: "0.1.0",
		summary: "Supplied drilling options for engineer review",
		observations: f.design.questions.map((q: { id: string }) => ({
			observationRef: { id: `observation.${q.id}`, revision: "r1" },
			questionId: q.id,
			kind: "question",
			statement: "Review the supplied evidence and unresolved engineering assumptions.",
			citations: f.corpus.documents.map(citation),
		})),
	};
}
test("reconciles supplied design and exact cost/schedule basis without inventing engineering defaults", () => {
	const f = base(),
		packet = reconcileDrilling(f.design, f.corpus, f.policy);
	assert.equal(packet.targetMdMetres, f.expected.targetMdMetres);
	assert.equal(packet.targetTvdMetres, f.expected.targetTvdMetres);
	assert.equal(packet.costs[0].totalExact, f.expected.costTotalExact);
	assert.equal(packet.costs[0].totalCents, f.expected.costTotalCents);
	assert.deepEqual(
		packet.costs[0].lines.map((r: { amountExact: string }) => r.amountExact),
		f.expected.lineAmountsExact,
	);
	assert.equal(packet.schedules[0].totalDays, f.expected.scheduleTotalDays);
	assert.deepEqual(packet.exceptions, []);
	assert.equal(packet.professionalAcceptance, false);
	assert.equal(packet.operationalApproval, false);
});
for (const label of labels.filter((l: { metric: unknown }) => !l.metric))
	test(`frozen supplied-input case: ${label.id}`, () => {
		const f = base();
		for (const change of label.changes) {
			let value = f;
			for (const part of change.path.slice(0, -1)) value = value[part];
			value[change.path.at(-1)] = structuredClone(change.value);
		}
		const packet = reconcileDrilling(f.design, f.corpus, f.policy);
		for (const code of label.exceptionCodes)
			assert.ok(
				packet.exceptions.some((r: { code: string }) => r.code === code),
				`${label.id}: missing ${code}`,
			);
		assert.equal(packet.status, label.exceptionCodes.length ? "needs-input" : "ready-for-review");
		if (label.id === "control_metric_equivalent") assert.equal(packet.targetMdMetres, "3048/1");
		if (label.id === "edge_explicit_zero_quote") assert.equal(packet.costs[0].totalCents, "25000000");
		if (label.id === "edge_fractional_quote") assert.equal(packet.costs[0].totalExact, "50000001/200");
	});
test("validates original UTF-8 citation bytes and retains required question/evidence coverage", () => {
	const f = base(),
		p = proposal(f),
		packet = buildDrillingPacket(f.design, f.corpus, f.policy, p);
	assert.equal(packet.status, "ready-for-review");
	const c = citation(f.corpus.documents[0]);
	assert.deepEqual(validateDrillingCitation(f.corpus, c), c);
	assert.throws(() => validateDrillingCitation(f.corpus, { ...c, startByte: 1 }), /invalid_citation/);
	assert.throws(() => validateDrillingCitation(f.corpus, { ...c, quote: "Approved to spud" }), /invalid_citation/);
	p.observations[0].citations = [];
	assert.ok(
		buildDrillingPacket(f.design, f.corpus, f.policy, p).exceptions.some(
			(r: { code: string }) => r.code === "missing_question_coverage",
		),
	);
});
test("missing costs and schedule remain unknown; duplicates and unsupported claims cannot produce a complete estimate", () => {
	const f = base();
	f.corpus.costs = [];
	f.corpus.schedules = [];
	const packet = reconcileDrilling(f.design, f.corpus, f.policy);
	assert.equal(packet.costs[0].totalExact, null);
	assert.equal(packet.schedules[0].totalDays, null);
	f.corpus.documents.push(structuredClone(f.corpus.documents[0]));
	assert.ok(
		reconcileDrilling(f.design, f.corpus, f.policy).exceptions.some(
			(r: { code: string }) => r.code === "duplicate_evidence",
		),
	);
	assert.throws(
		() => reconcileDrilling({ ...f.design, operationalApproval: true }, f.corpus, f.policy),
		/invalid_inputs/,
	);
});
