import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { buildLegalMemo, LegalMemoError } from "../src/legal-memo.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./fixtures/source-oracles.json", import.meta.url), "utf8"));
const fixture = () => structuredClone(frozen);
const build = (f: ReturnType<typeof fixture>) => buildLegalMemo(f.matter, f.corpus, f.policy, f.proposal);
const authority = (f: ReturnType<typeof fixture>) =>
	f.proposal.issues.find((item: { questionRef: { id: string } }) => item.questionRef.id === "question.authority");
const applicability = (memo: ReturnType<typeof build>) =>
	Object.fromEntries(memo.applicability.map((item) => [`${item.documentRef.id}/${item.sectionId}`, item.reasons]));
const denied = (run: () => unknown, code: string) =>
	assert.throws(run, (error) => error instanceof LegalMemoError && error.code === code);

test("a source-linked contract and historical requirement memo preserves zero, names and unreviewed authority", () => {
	const f = fixture(),
		before = JSON.stringify(f);
	const memo = build(f);
	assert.equal(memo.status, "ready-for-review");
	assert.equal(memo.reviewStatus, "unreviewed");
	assert.equal(memo.legalClearance, false);
	assert.equal(memo.professionalAcceptance, false);
	assert.equal(memo.applicability.find((item) => item.documentRef.id === "document.contract")?.sourceKind, "contract");
	assert.equal(
		memo.applicability.find((item) => item.documentRef.id === "document.mi-primary")?.sourceKind,
		"primary-law",
	);
	assert.equal(
		memo.applicability.find((item) => item.documentRef.id === "document.prior-counsel")?.sourceKind,
		"counsel-note",
	);
	assert.deepEqual(memo.matterRef, f.matter.matterRef);
	assert.deepEqual(memo.issues, f.proposal.issues);
	assert.ok(memo.issues.some((item) => item.statement.includes("0%")));
	assert.deepEqual(applicability(memo), f.expectedApplicability["state-as-of-effective"]);
	assert.deepEqual(memo, build(f));
	assert.equal(JSON.stringify(f), before);
});

test("UTF-8 byte citations preserve the exact Unicode party and reject partial characters or altered quotations", () => {
	const f = fixture();
	const party = f.proposal.issues.find(
		(item: { questionRef: { id: string } }) => item.questionRef.id === "question.party",
	);
	assert.equal(party.citations[0].quote, "Café 🛢 LLC");
	assert.equal(party.citations[0].startByte, 0);
	assert.equal(party.citations[0].endByte, 14);
	assert.deepEqual(build(f).issues, f.proposal.issues);
	for (const change of [
		(c: (typeof party.citations)[0]) => {
			c.startByte = 4;
		},
		(c: (typeof party.citations)[0]) => {
			c.endByte = 13;
		},
		(c: (typeof party.citations)[0]) => {
			c.quote = "Cafe LLC";
		},
		(c: (typeof party.citations)[0]) => {
			c.sha256 = "0".repeat(64);
		},
		(c: (typeof party.citations)[0]) => {
			c.documentRef.revision = "foreign";
		},
		(c: (typeof party.citations)[0]) => {
			c.sectionId = "invented";
		},
	]) {
		const altered = fixture();
		change(
			altered.proposal.issues.find((item: { questionRef: { id: string } }) => item.questionRef.id === "question.party")
				.citations[0],
		);
		denied(() => build(altered), "invalid_citation");
	}
});

test("the day before a source takes effect cannot become an affirmative requirement", () => {
	const f = fixture();
	f.matter.asOfDate = "2022-08-28";
	denied(() => build(f), "invalid_applicability");
	authority(f).kind = "question";
	authority(f).statement = "The supplied rule is not yet effective for this date; obtain the earlier authority source.";
	const memo = build(f);
	assert.equal(memo.status, "needs-input");
	assert.deepEqual(applicability(memo), f.expectedApplicability["day-before-effective"]);
	assert.equal(memo.legalClearance, false);
});

test("territorial exceptions apply to individual provisions within the same document", () => {
	const f = fixture();
	f.matter.territoryId = "indian-country";
	denied(() => build(f), "invalid_applicability");
	authority(f).citations = [f.quotes["indian-exception"]];
	authority(f).statement = "The supplied exception retains EPA authority for the declared Indian-country scenario.";
	const memo = build(f);
	assert.equal(memo.status, "ready-for-review");
	assert.deepEqual(applicability(memo), f.expectedApplicability["indian-country-as-of-effective"]);
	assert.equal(memo.professionalAcceptance, false);
});

test("unknown dates, expired source intervals and a different jurisdiction cannot justify a requirement", () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.matter.jurisdictionId = "US-CO";
		},
		(f: ReturnType<typeof fixture>) => {
			f.matter.activityId = "production-only";
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents[1].sections[0].effectiveFrom = null;
		},
		(f: ReturnType<typeof fixture>) => {
			const s = f.corpus.documents[1].sections[0];
			s.effectiveFrom = "2022-01-01";
			s.effectiveUntilExclusive = "2022-08-29";
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents[1].sections[0].sourceStatus = "unverified";
		},
	]) {
		const f = fixture();
		change(f);
		denied(() => build(f), "invalid_applicability");
	}
});

test("an omitted question or required source is an explicit input gap, never a complete memo", () => {
	const f = fixture();
	f.proposal.issues = f.proposal.issues.filter(
		(item: { questionRef: { id: string } }) => item.questionRef.id !== "question.party",
	);
	const incomplete = build(f);
	assert.equal(incomplete.status, "needs-input");
	assert.deepEqual(incomplete.coverage.missingQuestionRefs, [{ id: "question.party", revision: "r1" }]);
	const absent = fixture();
	absent.policy.questions[0].requiredDocumentRefs.push({ id: "document.absent-permit", revision: "r1" });
	assert.equal(build(absent).status, "needs-input");
});

test("declared counsel/source conflict is retained with both exact provisions for human review", () => {
	const f = fixture();
	const conflictRef = { id: "conflict.primary-counsel", revision: "r1" };
	f.policy.conflicts = [
		{
			conflictRef,
			questionRef: { id: "question.authority", revision: "r1" },
			provisions: [f.quotes["state-grant"], f.quotes["prior-counsel"]].map(({ documentRef, sectionId }) => ({
				documentRef,
				sectionId,
			})),
		},
	];
	const missing = build(f);
	assert.equal(missing.status, "needs-input");
	assert.deepEqual(missing.coverage.missingConflictRefs, [conflictRef]);
	f.proposal.issues.push({
		issueRef: { id: "issue.retained-conflict", revision: "r1" },
		questionRef: { id: "question.authority", revision: "r1" },
		kind: "conflict",
		statement:
			"Counsel must reconcile the earlier internal note with the later primary excerpt; no legal clearance is granted.",
		citations: [f.quotes["state-grant"], f.quotes["prior-counsel"]],
	});
	const retained = build(f);
	assert.equal(retained.status, "ready-for-review");
	assert.deepEqual(retained.coverage.missingConflictRefs, []);
	assert.equal(retained.legalClearance, false);
	assert.ok(retained.issues.some((item) => item.kind === "conflict" && item.citations.length === 2));
});

test("model-supplied clearance, invented references and malformed calendars fail closed", () => {
	for (const [change, code] of [
		[
			(f: ReturnType<typeof fixture>) => {
				f.proposal.legalClearance = true;
			},
			"invalid_proposal",
		],
		[
			(f: ReturnType<typeof fixture>) => {
				f.proposal.issues[0].kind = "legal-clearance";
			},
			"invalid_proposal",
		],
		[
			(f: ReturnType<typeof fixture>) => {
				f.proposal.issues[0].questionRef.id = "question.foreign";
			},
			"invalid_proposal",
		],
		[
			(f: ReturnType<typeof fixture>) => {
				f.matter.asOfDate = "2022-02-30";
			},
			"invalid_inputs",
		],
		[
			(f: ReturnType<typeof fixture>) => {
				f.corpus.documents[0].sections[0].effectiveUntilExclusive = "2021-12-31";
			},
			"invalid_inputs",
		],
	] as const) {
		const f = fixture();
		change(f);
		denied(() => build(f), code);
	}
});

test("ambiguous identities and mismatched trusted question bindings cannot produce a memo", () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.matter.questions.push(structuredClone(f.matter.questions[0]));
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents.push(structuredClone(f.corpus.documents[0]));
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents[0].sections.push(structuredClone(f.corpus.documents[0].sections[0]));
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents[0].sections[0].territoryIds.push("state");
		},
		(f: ReturnType<typeof fixture>) => {
			f.policy.questions[0].questionRef.revision = "different";
		},
		(f: ReturnType<typeof fixture>) => {
			f.policy.questions[0].requiredDocumentRefs.push(structuredClone(f.policy.questions[0].requiredDocumentRefs[0]));
		},
		(f: ReturnType<typeof fixture>) => {
			f.policy.questions.pop();
		},
		(f: ReturnType<typeof fixture>) => {
			f.corpus.documents[0].sections[0].text = "\ud800";
		},
	]) {
		const f = fixture();
		change(f);
		denied(() => build(f), "invalid_inputs");
	}
});

test("unsupported conclusions need actual citations and a conflict needs two distinct provisions", () => {
	const empty = fixture();
	empty.proposal.issues[0].citations = [];
	denied(() => build(empty), "invalid_citation");
	const duplicate = fixture();
	duplicate.proposal.issues[0].citations.push(structuredClone(duplicate.proposal.issues[0].citations[0]));
	denied(() => build(duplicate), "invalid_citation");
	const conflict = fixture();
	conflict.proposal.issues[0].kind = "conflict";
	denied(() => build(conflict), "invalid_proposal");
	const repeated = fixture();
	repeated.proposal.issues.push(structuredClone(repeated.proposal.issues[0]));
	denied(() => build(repeated), "invalid_proposal");
});

test("two revisions of one contract remain distinct when an old clause is retained as historical context", () => {
	const f = fixture();
	const earlier = structuredClone(f.corpus.documents[0]);
	earlier.documentRef.revision = "r0";
	for (const section of earlier.sections) {
		section.effectiveFrom = "2021-01-01";
		section.effectiveUntilExclusive = "2022-01-01";
	}
	earlier.sections.find((section: { sectionId: string }) => section.sectionId === "royalty").text =
		"The royalty stated in this supplied contract is 1%.";
	f.corpus.documents.unshift(earlier);
	f.policy.questions
		.find((question: { questionRef: { id: string } }) => question.questionRef.id === "question.royalty")
		.requiredDocumentRefs.push(earlier.documentRef);
	const previousQuote = {
		...f.quotes.royalty,
		documentRef: earlier.documentRef,
		quote: "1%",
		sha256: createHash("sha256").update("1%").digest("hex"),
	};
	f.proposal.issues.push({
		issueRef: { id: "issue.contract-history", revision: "r1" },
		questionRef: { id: "question.royalty", revision: "r1" },
		kind: "conflict",
		statement: "The supplied revisions differ; preserve the earlier clause as historical context for counsel.",
		citations: [previousQuote, f.quotes.royalty],
	});
	const memo = build(f);
	assert.equal(memo.status, "ready-for-review");
	assert.deepEqual(memo.coverage.missingSources, []);
	assert.ok(
		memo.applicability.some(
			(row) =>
				row.documentRef.id === "document.contract" &&
				row.documentRef.revision === "r0" &&
				row.sectionId === "royalty" &&
				row.reasons.includes("expired"),
		),
	);
	assert.ok(
		memo.applicability.some(
			(row) =>
				row.documentRef.id === "document.contract" &&
				row.documentRef.revision === "r1" &&
				row.sectionId === "royalty" &&
				row.status === "eligible-for-draft",
		),
	);
	assert.equal(memo.legalClearance, false);
});
