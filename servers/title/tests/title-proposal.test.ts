import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { buildTitlePacket } from "../src/title-packet.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./fixtures/source-oracles.json", import.meta.url), "utf8"));
function fixture() {
	const f = structuredClone(frozen);
	const cite = (index: number, sectionId: string) => {
		const doc = f.corpus.documents[index];
		const section = doc.sections.find((item: { sectionId: string }) => item.sectionId === sectionId);
		assert.ok(section);
		const bytes = Buffer.from(section.text, "utf8");
		return {
			instrumentRef: structuredClone(doc.instrumentRef),
			sectionId,
			startByte: 0,
			endByte: bytes.byteLength,
			quote: section.text,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	};
	const roots = cite(0, "opening"),
		transfer = cite(1, "transfer");
	const royalty = cite(2, "royalty"),
		orri = cite(2, "orri"),
		lease = cite(0, "lease");
	const proposal = {
		version: "0.1.0",
		title: "Supplied tract ownership and exceptions for review",
		observations: [
			{
				observationRef: { id: "observation.ownership", revision: "r1" },
				questionId: "ownership",
				kind: "observation",
				statement: "The supplied shallow operating transfer leaves record title and deep operating rights separate.",
				citations: [roots, transfer],
			},
			{
				observationRef: { id: "observation.chain", revision: "r1" },
				questionId: "chain",
				kind: "question",
				statement:
					"Review the supplied starting claim and recording links; this does not establish complete public-record coverage.",
				citations: [roots, transfer, royalty],
			},
			{
				observationRef: { id: "observation.burdens", revision: "r1" },
				questionId: "burdens",
				kind: "observation",
				statement: "The supplied royalty and ORRI have different explicit share bases.",
				citations: [royalty, orri],
			},
			{
				observationRef: { id: "observation.lease", revision: "r1" },
				questionId: "lease",
				kind: "question",
				statement: "Review the supplied term date; no lease validity or extension authority is claimed.",
				citations: [lease],
			},
		],
	};
	return { ...f, proposal };
}
const run = (f = fixture()) => buildTitlePacket(f.examination, f.corpus, f.policy, f.proposal);

test("agent observations retain exact supplied citations while the backend supplies canonical ownership arithmetic", () => {
	const f = fixture(),
		packet = run(f);
	assert.equal(packet.status, "ready-for-review");
	assert.deepEqual(packet.netRevenue, [f.expected.control.nri]);
	assert.deepEqual(packet.observations, f.proposal.observations);
	assert.deepEqual(packet.coverage.missingQuestionIds, []);
	assert.deepEqual(packet.coverage.missingCitedInstrumentRefs, []);
	assert.equal(packet.titleClearance, false);
	assert.equal(packet.professionalAcceptance, false);
});

test("Unicode citations use actual UTF-8 byte spans rather than string character counts", () => {
	const f = fixture(),
		citation = f.proposal.observations[0].citations[0];
	assert.ok(citation.endByte > citation.quote.length);
	citation.endByte = citation.quote.length;
	assert.throws(() => run(f), /invalid_citation/);
});

test("forged text, hash and instrument revision cannot pass an exact citation check", () => {
	for (const change of ["text", "hash", "revision"]) {
		const f = fixture(),
			citation = f.proposal.observations[0].citations[0];
		if (change === "text") citation.quote = "The agent owns all title.";
		if (change === "hash") citation.sha256 = "0".repeat(64);
		if (change === "revision") citation.instrumentRef.revision = "r0";
		assert.throws(() => run(f), /invalid_citation/, change);
	}
});

test("an omitted question or required cited recording remains a real blocker", () => {
	const question = fixture();
	question.proposal.observations.pop();
	const a = run(question);
	assert.equal(a.status, "needs-input");
	assert.deepEqual(a.coverage.missingQuestionIds, ["lease"]);
	const source = fixture();
	for (const row of source.proposal.observations)
		row.citations = row.citations.filter((c) => c.instrumentRef.id !== "instrument.burdens");
	const b = run(source);
	assert.equal(b.status, "needs-input");
	assert.deepEqual(b.coverage.missingCitedInstrumentRefs, [{ id: "instrument.burdens", revision: "r1" }]);
});

test("invented question identity, duplicate observations and model-selected truth or output paths are rejected", () => {
	const unknown = fixture();
	unknown.proposal.observations[0].questionId = "invented";
	assert.throws(() => run(unknown), /invalid_proposal/);
	const duplicate = fixture();
	duplicate.proposal.observations.push(structuredClone(duplicate.proposal.observations[0]));
	assert.throws(() => run(duplicate), /invalid_proposal/);
	for (const extra of [{ titleClearance: true }, { netRevenue: "1/1" }, { outputPath: "/tmp/model-selected" }]) {
		const f = fixture();
		Object.assign(f.proposal, extra);
		assert.throws(() => run(f), /invalid_proposal/);
	}
});

test("a proposal cannot remove a declared source conflict or grant title authority", () => {
	const f = fixture();
	f.policy.declaredConflicts.push({
		conflictRef: { id: "conflict.fixture", revision: "r1" },
		instrumentRefs: [{ id: "instrument.transfer", revision: "r1" }],
		statement: "A supplied conflicting claim requires a qualified reviewer and fresh source inputs.",
	});
	const packet = run(f);
	assert.equal(packet.status, "needs-input");
	assert.ok(packet.exceptions.some((item) => item.code === "declared_conflict"));
	assert.equal(packet.titleClearance, false);
	assert.equal(packet.reviewStatus, "unreviewed");
});
