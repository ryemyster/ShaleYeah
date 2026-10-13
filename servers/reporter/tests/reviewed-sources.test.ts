import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ReviewedSources } from "../src/reviewed-sources.js";

const records = JSON.parse(readFileSync(new URL("fixtures/employee.json", import.meta.url), "utf8"));
const scope = { ...records.task.scope, employeeId: "employee.reporter" };
const who = {
	subjectId: "reporter-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["reporter:sources"],
};
function receipt() {
	return {
		work: structuredClone(records.finalWork),
		task: structuredClone(records.task),
		request: structuredClone(records.reviewRequest),
		decision: structuredClone(records.approveDecision),
		recipientScope: scope,
		current: true,
		expiresAt: "2026-11-01T00:00:00Z",
		operations: ["read", "export"],
		subjectId: who.subjectId,
		usagePolicy: { id: "policy.reviewed-business-artifact", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
	};
}
test("trusted review and sharing receipts produce an explicit business artifact, not a raw connector", async () => {
	const value = receipt();
	const sources = new ReviewedSources({
		scope,
		current: async () => value,
		contentGuard: async () => true,
		clock: () => new Date("2026-10-13T00:00:00Z"),
		maxSourceAgeSeconds: 31536000,
	});
	const fetched = await sources.fetch(sources.request(value.work.artifact.id), who);
	assert.equal(fetched.artifact.kind, "reviewed-business-artifact");
	assert.equal(fetched.artifact.artifact.id, value.work.artifact.id);
	assert.equal(fetched.artifact.sourceFormat, undefined);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(fetched.bytes)), value.work);
	assert.equal(fetched.artifact.evidence.accessClassification, "restricted");
});
test("approval prose or flags cannot replace the exact authoritative review", async () => {
	for (const mutation of [
		"decision",
		"request",
		"recipient",
		"revoked",
		"expired",
		"confidential",
		"secret",
		"stale",
	]) {
		const value = receipt();
		if (mutation === "decision") value.decision.productRef.revision = "r2";
		if (mutation === "request") value.decision.requestRef.id = "other";
		if (mutation === "recipient") value.recipientScope = { ...scope, customerId: "other" };
		if (mutation === "revoked") value.current = false;
		if (mutation === "expired") value.expiresAt = "2026-10-01T00:00:00Z";
		if (mutation === "confidential") value.operations = ["read"];
		if (mutation === "stale") value.work.evidence[0].asOf = "2020-01-01T00:00:00Z";
		const sources = new ReviewedSources({
			scope,
			current: async () => value,
			contentGuard: async () => mutation !== "secret",
			clock: () => new Date("2026-10-13T00:00:00Z"),
			maxSourceAgeSeconds: 31536000,
		});
		await assert.rejects(
			() => sources.fetch(sources.request(value.work.artifact.id), who),
			/Reporter source blocked/,
			mutation,
		);
	}
});
test("source authority is re-read after restart and before each export", async () => {
	const value = receipt();
	const options = {
		scope,
		current: async () => value,
		contentGuard: async () => true,
		clock: () => new Date("2026-10-13T00:00:00Z"),
		maxSourceAgeSeconds: 31536000,
	};
	await new ReviewedSources(options).fetch(value.work.artifact.id, who);
	value.current = false;
	await assert.rejects(() => new ReviewedSources(options).fetch(value.work.artifact.id, who), /access_denied/);
});
