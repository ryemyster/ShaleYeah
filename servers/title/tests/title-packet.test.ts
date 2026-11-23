import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { reconcileTitle } from "../src/title-packet.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./fixtures/source-oracles.json", import.meta.url), "utf8"));
const inputs = () => structuredClone(frozen);
const run = (f = inputs()) => reconcileTitle(f.examination, f.corpus, f.policy);
const checkBlocked = (result: ReturnType<typeof reconcileTitle>, code: string) => {
	assert.equal(result.status, "needs-input");
	assert.ok(
		result.exceptions.some((item) => item.code === code),
		code,
	);
	assert.equal(result.titleClearance, false);
};

function secondTransfer(basis: "fraction-of-grantor" | "fraction-of-whole", share = "1/2") {
	const f = inputs();
	const instrument = structuredClone(f.corpus.documents[1]);
	instrument.instrumentRef = { id: "instrument.second", revision: "r1" };
	instrument.recordingId = "FICTION-003";
	instrument.sequence = 3;
	instrument.predecessorRefs = [{ id: "instrument.transfer", revision: "r1" }];
	Object.assign(instrument.transfers[0], {
		transferId: "transfer.ac",
		granteeId: "party.c",
		basis,
		share,
	});
	instrument.sections[0].text = `Fictional supplied transfer: party.a conveys ${share} (${basis}) of shallow operating rights to party.c; no other rights are conveyed.`;
	f.corpus.documents.push(instrument);
	f.examination.requiredInstrumentRefs.push(instrument.instrumentRef);
	return f;
}

test("exact supplied instruments keep record title, depth-scoped operating rights and explicit whole-relative burdens separate", () => {
	const result = run();
	assert.equal(result.status, "ready-for-review");
	for (const [interestKind, expected] of [
		["record-title", frozen.expected.control.recordTitle],
		["operating-rights", frozen.expected.control.operatingRights],
	] as const) {
		for (const [bandId, parties] of Object.entries(expected)) {
			const actual = Object.fromEntries(
				result.holdings
					.filter((row) => row.interestKind === interestKind && row.bandId === bandId)
					.map((row) => [row.partyId, row.share]),
			);
			assert.deepEqual(actual, parties);
		}
	}
	assert.deepEqual(result.netRevenue, [frozen.expected.control.nri]);
	assert.equal(result.titleClearance, false);
	assert.equal(result.professionalAcceptance, false);
	assert.equal(result.reviewStatus, "unreviewed");
});

test("a supplied WI-relative ORRI has a different exact result from the same fraction of the whole", () => {
	const f = inputs();
	f.corpus.documents[2].burdens[1].basis = "working-interest";
	f.corpus.documents[2].sections[1].text =
		"Fictional supplied ORRI: 1/16 of Cobalt Example LLC's working interest in the shallow band.";
	const result = run(f);
	assert.equal(result.status, "ready-for-review");
	assert.equal(result.netRevenue[0].overridingBurden, "1/32");
	assert.equal(result.netRevenue[0].netRevenueInterest, "11/32");
});

test("an explicit zero burden stays zero and is not an absent term", () => {
	const f = inputs();
	f.corpus.documents[2].burdens[1].share = "0/1";
	f.corpus.documents[2].sections[1].text = "Fictional supplied ORRI burden is exactly 0/1 of the whole.";
	const result = run(f);
	assert.equal(result.status, "ready-for-review");
	assert.equal(result.netRevenue[0].overridingBurden, "0/1");
	assert.equal(result.netRevenue[0].netRevenueInterest, "3/8");
});

test("fraction of grantor and fraction of whole use the actual remaining grantor balance", () => {
	for (const [basis, remaining, received] of [
		["fraction-of-grantor", "1/4", "1/4"],
		["fraction-of-whole", "0/1", "1/2"],
	] as const) {
		const result = run(secondTransfer(basis));
		assert.equal(result.status, "ready-for-review");
		const row = (party: string) =>
			result.holdings.find(
				(item) => item.partyId === party && item.bandId === "shallow" && item.interestKind === "operating-rights",
			);
		assert.equal(row("party.a")?.share, remaining);
		assert.equal(row("party.c")?.share, received);
		assert.equal(
			result.holdings.find(
				(item) => item.partyId === "party.a" && item.bandId === "deep" && item.interestKind === "operating-rights",
			)?.share,
			"1/1",
		);
	}
});

test("an unknown share basis is an explicit blocker rather than an invented ownership number", () => {
	const f = inputs();
	f.corpus.documents[1].transfers[0].basis = null;
	f.corpus.documents[1].sections[0].text = "Fictional ambiguous one-half interest; no share basis is declared.";
	checkBlocked(run(f), "unknown_share_basis");
});

test("missing required instruments and predecessors cannot establish a complete supplied chain", () => {
	const f = inputs();
	f.corpus.documents.splice(1, 1);
	const result = run(f);
	checkBlocked(result, "missing_instrument");
	checkBlocked(result, "missing_predecessor");
});

test("duplicate recordings and over-conveyance fail without choosing a preferred claim or clamping shares", () => {
	const duplicate = inputs();
	duplicate.corpus.documents[2].recordingId = duplicate.corpus.documents[1].recordingId;
	checkBlocked(run(duplicate), "duplicate_recording");
	checkBlocked(run(secondTransfer("fraction-of-whole", "3/4")), "over_conveyance");
});

test("a different tract, depth unit or future instrument cannot silently support this examination", () => {
	const tract = inputs();
	tract.corpus.documents[1].tractRef.id = "tract.foreign";
	checkBlocked(run(tract), "wrong_tract");
	const unit = inputs();
	unit.corpus.documents[1].transfers[0].depth.unit = "m";
	checkBlocked(run(unit), "depth_unit");
	const future = inputs();
	future.corpus.documents[1].effectiveDate = "2027-01-01";
	checkBlocked(run(future), "future_instrument");
});

test("unknown burden basis and unknown post-term holding remain missing input, never zero burden or a valid lease", () => {
	const burden = inputs();
	burden.corpus.documents[2].burdens[1].basis = null;
	checkBlocked(run(burden), "unknown_burden_basis");
	const lease = inputs();
	lease.corpus.documents[0].leaseTerms[0].primaryTermEnd = "2025-01-01";
	checkBlocked(run(lease), "unknown_lease_holding");
});
