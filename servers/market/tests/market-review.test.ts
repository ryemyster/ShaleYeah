import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { MarketReviewWorkflow } from "../src/index.js";
import { who } from "./fixtures/employee.js";
import { reviewFixture } from "./fixtures/review.js";

test("enrolled commercial owner inspects three sources, approves the exact scenarios and resumes once after restart", async () => {
	const f = await reviewFixture();
	let reopened: MarketReviewWorkflow | undefined;
	try {
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		await assert.rejects(f.workflow.inspect(prepared.reviewId, who), /authority_denied/);
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.sources.length, 3);
		assert.equal(packet.packet.market.commercialAuthority, false);
		assert.equal(packet.packet.market.reviewStatus, "unreviewed");
		assert.ok(packet.packet.sources.some((source) => source.text.includes("requiredPeriods")));
		assert.ok(packet.packet.sources.some((source) => source.text.includes("heatContent")));
		assert.ok(packet.packet.sources.some((source) => source.text.includes("basisDifferential")));
		await assert.rejects(
			f.workflow.decide(prepared.reviewId, prepared.packetDigest, "approve", "Self approval", who),
			/authority_denied/,
		);
		const approved = await f.workflow.decide(
			prepared.reviewId,
			prepared.packetDigest,
			"approve",
			"Reviewed exact source periods, units and commercial scenario assumptions for private recording",
			f.reviewer,
		);
		f.workflow.close();
		reopened = new MarketReviewWorkflow(f.directory, f.options);
		const request = { reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId };
		const outcome = await reopened.execute(request, who);
		assert.equal(outcome.stored, true);
		assert.match(outcome.uri, /^urn:market:/);
		assert.deepEqual(await reopened.execute(request, who), outcome);
		assert.equal(reopened.findingCount(), 1);
		f.revoke();
		await assert.rejects(reopened.execute(request, who));
	} finally {
		reopened?.close();
		f.close();
	}
});

test("forged scenario prices, normalized observations, source metadata, authority or findings cannot create a review", async () => {
	const f = await reviewFixture();
	try {
		for (const alter of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.market.scenarios[0].price = 999999;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.market.comparison.rows[0].realizedValue = 999999;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.market.seriesMetadata[0].location = "Foreign benchmark";
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				Object.assign(c.market, { commercialAuthority: true });
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.work.findings[0].value = 999999;
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				Object.assign(c.market.proposal, { price: 999999 });
			},
		]) {
			const candidate = await f.candidate();
			alter(candidate);
			await assert.rejects(f.workflow.prepare(candidate, who, null), /source_fidelity_mismatch/);
		}
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});

test("the agent's own interpretation is retained as an unreviewed proposal", async () => {
	const f = await reviewFixture();
	try {
		f.proposal.summary =
			"The supplied realized observations are below Henry Hub after the declared heat-content conversion. The future deck remains an operator scenario for commercial review.";
		const prepared = await f.workflow.prepare(await f.candidate(), who, null);
		const packet = await f.workflow.inspect(prepared.reviewId, f.reviewer);
		assert.equal(packet.packet.market.proposal.summary, f.proposal.summary);
		assert.equal(packet.packet.market.commercialAuthority, false);
	} finally {
		f.close();
	}
});

test("request changes and rejection cannot execute or revive a superseded scenario revision", async () => {
	const f = await reviewFixture();
	try {
		const first = await f.workflow.prepare(await f.candidate(), who, null);
		await f.workflow.decide(
			first.reviewId,
			first.packetDigest,
			"request_changes",
			"Explain the benchmark choice and scenario assumptions",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: first.reviewId, packetDigest: first.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
		const second = await f.workflow.prepare(await f.candidate("r2"), who, first.packetDigest);
		await assert.rejects(
			f.workflow.decide(first.reviewId, first.packetDigest, "approve", "Old packet", f.reviewer),
			/revision_mismatch/,
		);
		await f.workflow.decide(
			second.reviewId,
			second.packetDigest,
			"reject",
			"Commercial assumptions need revision",
			f.reviewer,
		);
		await assert.rejects(
			f.workflow.execute({ reviewId: second.reviewId, packetDigest: second.packetDigest, grantId: "forged" }, who),
			/approval_required/,
		);
	} finally {
		f.close();
	}
});

test("changed source bytes or reviewer enrollment invalidates an existing commercial approval", async () => {
	for (const change of ["source", "reviewer"] as const) {
		const f = await reviewFixture();
		try {
			const pending = await f.workflow.prepare(await f.candidate(), who, null);
			const approved = await f.workflow.decide(
				pending.reviewId,
				pending.packetDigest,
				"approve",
				"Exact private scenario packet",
				f.reviewer,
			);
			if (change === "source") {
				const revised = structuredClone(f.input.assumptions);
				revised.scenarios[0].benchmarkPrice = 20;
				f.texts.set("assumptions", JSON.stringify(revised));
				f.bind();
			} else {
				f.policy.reviewerIds = [];
			}
			await assert.rejects(
				f.workflow.execute(
					{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
					who,
				),
			);
		} finally {
			f.close();
		}
	}
});

test("model eval claims cannot replace installed qualification or the required executing gates", async () => {
	const f = await reviewFixture();
	let unqualified: MarketReviewWorkflow | undefined;
	try {
		unqualified = new MarketReviewWorkflow(`${f.directory}-unqualified`, {
			...f.options,
			qualificationGuard: undefined,
		});
		const pending = await unqualified.prepare(await f.candidate(), who, null);
		await assert.rejects(
			unqualified.decide(pending.reviewId, pending.packetDigest, "approve", "Model claimed pass", f.reviewer),
			/qualification/,
		);
		f.policy.requiredGates = [];
		await assert.rejects(f.workflow.prepare(await f.candidate(), who, null), /required_gates/);
	} finally {
		unqualified?.close();
		rmSync(`${f.directory}-unqualified`, { recursive: true, force: true });
		f.close();
	}
});

test("market review context must bind each source and its working artifact without promoting shared knowledge", async () => {
	const f = await reviewFixture();
	try {
		for (const alter of [
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.selectedEvidence.pop();
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.selectedEvidence[1] = c.context.selectedEvidence[0];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.workingArtifactRefs = [];
			},
			(c: Awaited<ReturnType<typeof f.candidate>>) => {
				c.context.sharedKnowledge.push({
					artifact: { id: "knowledge.shared", revision: "r1", uri: "urn:knowledge:shared" },
					origin: c.work.scope,
					evidence: structuredClone(c.work.evidence),
					reviewDecisionRef: { id: "decision.forged", revision: "r1" },
					usagePolicy: f.policy.allowedUsagePolicies[0],
					retentionPolicy: f.policy.retentionPolicy,
				});
			},
		]) {
			const candidate = await f.candidate();
			alter(candidate);
			await assert.rejects(f.workflow.prepare(candidate, who, null), /context_binding_mismatch/);
		}
	} finally {
		f.close();
	}
});

test("qualification for a different work hash cannot authorize the packet", async () => {
	const f = await reviewFixture();
	let changed: MarketReviewWorkflow | undefined;
	try {
		const guard = f.options.qualificationGuard!;
		changed = new MarketReviewWorkflow(`${f.directory}-different-work`, {
			...f.options,
			qualificationGuard: async (input) => {
				const decision = (await guard(input)) as { promotionBinding: { workHash: string } };
				decision.promotionBinding.workHash = "0".repeat(64);
				return decision;
			},
		});
		const pending = await changed.prepare(await f.candidate(), who, null);
		await assert.rejects(
			changed.decide(pending.reviewId, pending.packetDigest, "approve", "Wrong qualified work", f.reviewer),
			/qualification_binding_mismatch/,
		);
	} finally {
		changed?.close();
		rmSync(`${f.directory}-different-work`, { recursive: true, force: true });
		f.close();
	}
});

test("an expired approval grant cannot record a market packet", async () => {
	const f = await reviewFixture();
	try {
		const pending = await f.workflow.prepare(await f.candidate(), who, null);
		const approved = await f.workflow.decide(
			pending.reviewId,
			pending.packetDigest,
			"approve",
			"Time limited private recording",
			f.reviewer,
		);
		f.setReviewClock(() => new Date("2026-11-13T12:11:00Z"));
		await assert.rejects(
			f.workflow.execute(
				{ reviewId: approved.reviewId, packetDigest: approved.packetDigest, grantId: approved.grantId },
				who,
			),
			/expired/,
		);
		assert.equal(f.workflow.findingCount(), 0);
	} finally {
		f.close();
	}
});
