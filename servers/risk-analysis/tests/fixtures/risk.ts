import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { RiskAssessmentService, type RiskSource } from "../../src/risk-service.js";
import { jointRiskFixture } from "./joint-risk.js";

export const now = new Date("2026-01-02T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.risk",
	employeeId: "employee.risk-analyst",
};
export const who: SourcePrincipal = {
	subjectId: "risk-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["risk:read", "risk:review", "risk:assess", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };
export function riskFixture(name = "dependent") {
	const { register, policy, model } = jointRiskFixture(name);
	const alternative = structuredClone(model);
	alternative.modelRef = { id: "joint.stress", revision: "r1" };
	for (const state of alternative.states) state.residualLoss *= 2;
	const scenarios = { version: "0.1.0", models: [model, alternative] };
	const texts = new Map([
		["register", JSON.stringify(register)],
		["policy", JSON.stringify(policy)],
		["scenarios", JSON.stringify(scenarios)],
	]);
	const revoked = new Set<string>();
	let guard = async (_text: string) => true;
	let clock = () => now;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: ref.id,
		revision: ref.revision,
		scope,
		outcome: "Appraise declared source-bound joint risk scenarios for the human owner",
		requiredCapabilities: ["risk.assess"],
		inputs: [],
		constraints: ["No self-approved residual risk or capital commitment"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const current = { task, registerSourceRef: ref, policySourceRef: ref, scenariosSourceRef: ref };
	function bind() {
		current.task.inputs = [...texts.keys()].map(reference);
		for (const key of ["register", "policy", "scenarios"] as const)
			current[`${key}SourceRef`] = { id: reference(key).id, revision: reference(key).revision };
	}
	bind();
	function fetched(id: string): RiskSource {
		const key = id.replace(/^evidence\./, ""),
			text = texts.get(key);
		if (text === undefined) throw new Error("source_unavailable");
		const bytes = Buffer.from(text),
			artifact = reference(key);
		const source = validateSourceContract({
			contractVersion: "0.2.0",
			kind: "source-artifact",
			scope,
			taskRevision: task.revision,
			artifact,
			evidence: {
				id,
				revision: artifact.revision,
				uri: `urn:operator:${key}`,
				hash: { algorithm: "sha256", value: artifact.revision },
				asOf: "2026-01-02T00:00:00Z",
				accessClassification: "restricted",
				usagePolicy: { id: "policy.operator-data", version: "r1" },
			},
			connectorRef: { id: "connector.operator", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			retrievedAt: now.toISOString(),
			format: "json",
			parserRef: { id: "json", version: "1" },
			jurisdiction: "US-TX",
			units:
				key === "scenarios" ? [{ field: "residualLoss", unit: register.currency, origin: "operator-declared" }] : [],
			byteLength: bytes.byteLength,
			accessNotes: "Operator-only",
			licenseNotes: "Synthetic fixture",
			revisionOrigin: "operator-declared",
		});
		if (source.kind !== "source-artifact" || source.format !== "json") throw new Error("invalid_fixture");
		return { bytes, artifact: source };
	}
	const fetchSource = async (
		reference: { id: string; revision: string },
		principal: SourcePrincipal,
		operation: "read" | "export",
	) => {
		assert.deepEqual(principal, who);
		assert.ok(["read", "export"].includes(operation));
		if (revoked.has(reference.id)) throw new Error("source_unavailable");
		return fetched(reference.id);
	};
	const currentSnapshot = async () => ({
		...current,
		authorityRevision: createHash("sha256")
			.update(JSON.stringify([...revoked]))
			.digest("hex"),
	});
	const options = {
		current: currentSnapshot,
		fetchSource,
		contentGuard: (text: string) => guard(text),
		maxSourceAgeSeconds: 86400,
		clock: () => clock(),
	};
	return {
		service: new RiskAssessmentService(options),
		options,
		current,
		register,
		policy,
		scenarios,
		texts,
		bind,
		fetched,
		fetchSource,
		revoke: (id = "evidence.register") => revoked.add(id),
		setGuard: (value: typeof guard) => {
			guard = value;
		},
		setClock: (value: typeof clock) => {
			clock = value;
		},
	};
}
