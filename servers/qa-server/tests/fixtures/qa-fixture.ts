import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { reviewJson } from "@shaleyeah/sdk";
import { QAInputs } from "../../src/qa-inputs.js";
import { QAService } from "../../src/qa-service.js";
import { QAResultStore } from "../../src/qa-store.js";
import { qaProfileSchema } from "../../src/tools/qa-rules.js";

export function fixture() {
	const scope = { customerId: "customer", assetId: "well", taskId: "task", employeeId: "employee.qa" };
	const principal = {
		subjectId: "qa-run",
		customerId: scope.customerId,
		employeeId: scope.employeeId,
		scopes: ["qa:read", "qa:run", "qa:report"],
	};
	const ref = { id: "source.one", revision: "r1", uri: "urn:fixture:source.one" };
	const body = {
		schemaVersion: "0.1.0",
		kind: "normalized-qa-data",
		rows: [
			{
				id: "row.1",
				assetId: "well",
				wellId: "wellbore.1",
				period: "2026-10",
				asOf: "2026-10-13T00:00:00Z",
				fields: { netPay: { value: 0, unit: "ft", basis: "measured" } },
			},
		],
	};
	const bytes = new TextEncoder().encode(JSON.stringify(body));
	const source = {
		snapshot: {
			scope,
			bytes,
			evidence: {
				...ref,
				hash: { algorithm: "sha256", value: createHash("sha256").update(bytes).digest("hex") },
				asOf: "2026-10-13T00:00:00Z",
				accessClassification: "restricted",
				usagePolicy: { id: "policy.data", version: "r1" },
			},
		},
		grant: {
			subjectId: principal.subjectId,
			scope,
			taskRevision: "r1",
			operations: ["read", "export"],
			current: true,
			expiresAt: "2026-10-13T01:00:00Z",
		},
	};
	const task = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: "task",
		revision: "r1",
		scope,
		outcome: "Check permitted observed data",
		requiredCapabilities: ["qa.check"],
		inputs: [ref],
		constraints: [],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const profile = {
		schemaVersion: "0.1.0",
		id: "profile.qa",
		revision: "r1",
		rules: [
			{
				id: "rule.complete",
				revision: "r1",
				type: "completeness",
				sourceId: ref.id,
				field: "netPay",
				severity: "critical",
				repairOwner: "data-owner",
				applicable: true,
			},
		],
	};
	const grant = {
		subjectId: principal.subjectId,
		scope,
		taskRevision: task.revision,
		profileRef: { id: profile.id, revision: profile.revision },
		profileHash: createHash("sha256")
			.update(reviewJson(qaProfileSchema.parse(profile)))
			.digest("hex"),
		operations: ["run", "read", "report"],
		current: true,
		expiresAt: source.grant.expiresAt,
	};
	let instant = "2026-10-13T00:00:00Z";
	const directory = mkdtempSync(path.join(os.tmpdir(), "qa-service-")),
		clock = () => new Date(instant);
	const inputs = new QAInputs({
		scope,
		taskRevision: task.revision,
		current: async () => source,
		contentGuard: async () => true,
		clock,
	});
	const store = new QAResultStore(directory, { clock });
	const audits: unknown[] = [];
	const options = {
		current: async () => ({ task, profile, grant }),
		inputs,
		store,
		contentGuard: async () => true,
		audit: async (entry: unknown) => {
			audits.push(entry);
		},
		clock,
	};
	return {
		principal,
		ref,
		source,
		task,
		profile,
		grant,
		options,
		directory,
		store,
		audits,
		request: {
			taskRef: { id: task.id, revision: task.revision },
			profileRef: { id: profile.id, revision: profile.revision },
		},
		service: new QAService(options),
		setTime: (value: string) => {
			instant = value;
		},
		close: () => {
			store.close();
			rmSync(directory, { recursive: true });
		},
	};
}
