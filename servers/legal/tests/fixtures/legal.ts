import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { LegalMemoService, type LegalSource } from "../../src/legal-service.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./source-oracles.json", import.meta.url), "utf8"));
export const now = new Date("2026-11-12T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.legal",
	employeeId: "employee.legal-analyst",
};
export const who: SourcePrincipal = {
	subjectId: "legal-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["legal:read", "legal:review", "legal:record", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };

export function legalFixture() {
	const { matter, corpus, policy: scopePolicy, proposal, quotes } = structuredClone(frozen);
	const texts = new Map<string, string>([
		["matter", JSON.stringify(matter)],
		["corpus", JSON.stringify(corpus)],
		["policy", JSON.stringify(scopePolicy)],
	]);
	const revoked = new Set<string>();
	let operations: ("read" | "export")[] = ["read", "export"];
	let guard = async (_text: string) => true;
	let clock = () => now;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: ref.id,
		revision: ref.revision,
		scope,
		outcome: "Prepare a source-cited requirement/exception memo for an enrolled human legal reviewer",
		requiredCapabilities: ["legal.memo"],
		inputs: [],
		constraints: ["No model legal clearance, signatures or filings"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const current = { task, matterSourceRef: ref, corpusSourceRef: ref, policySourceRef: ref };
	function bind() {
		current.task.inputs = [...texts.keys()].map(reference);
		for (const key of ["matter", "corpus", "policy"] as const)
			current[`${key}SourceRef`] = { id: reference(key).id, revision: reference(key).revision };
	}
	bind();
	function fetched(id: string): LegalSource {
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
				asOf: "2026-11-12T00:00:00Z",
				accessClassification: "restricted",
				usagePolicy: { id: "policy.operator-data", version: "r1" },
			},
			connectorRef: { id: "connector.operator", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			retrievedAt: now.toISOString(),
			format: "json",
			parserRef: { id: "json", version: "1" },
			jurisdiction: "US-MI",
			units: [],
			byteLength: bytes.byteLength,
			accessNotes: "Operator and enrolled legal reviewer only",
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
		if (!operations.includes(operation)) throw new Error("source_use_denied");
		if (revoked.has(reference.id)) throw new Error("source_unavailable");
		return fetched(reference.id);
	};
	const options = {
		current: async () => ({
			...current,
			authorityRevision: createHash("sha256")
				.update(JSON.stringify({ revoked: [...revoked], operations, inputs: [...texts] }))
				.digest("hex"),
		}),
		fetchSource,
		contentGuard: (text: string) => guard(text),
		maxSourceAgeSeconds: 86400,
		clock: () => clock(),
	};
	return {
		service: new LegalMemoService(options),
		options,
		current,
		matter,
		corpus,
		scopePolicy,
		proposal,
		quotes,
		texts,
		bind,
		fetched,
		fetchSource,
		revoke: (id = "evidence.corpus") => revoked.add(id),
		setGuard: (value: typeof guard) => {
			guard = value;
		},
		setClock: (value: typeof clock) => {
			clock = value;
		},
		setOperations: (value: typeof operations) => {
			operations = value;
		},
	};
}
