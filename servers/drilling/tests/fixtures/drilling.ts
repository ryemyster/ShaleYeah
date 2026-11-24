import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { DrillingPacketService, type DrillingSource } from "../../src/drilling-service.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./source-oracles.json", import.meta.url), "utf8"));
export const now = new Date("2026-11-23T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.drilling",
	employeeId: "employee.drilling-engineer",
};
export const who: SourcePrincipal = {
	subjectId: "drilling-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["drilling:read", "drilling:review", "drilling:record", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };

export function drillingFixture({ liveClock = false } = {}) {
	const { design, corpus, policy: calculationPolicy } = structuredClone(frozen);
	let clock = () => (liveClock ? new Date() : now);
	const observedAt = clock().toISOString();
	const texts = new Map<string, string>([
		["design", JSON.stringify(design)],
		["corpus", JSON.stringify(corpus)],
		["policy", JSON.stringify(calculationPolicy)],
	]);
	const quote = (index: number, sectionId: string) => {
		const doc = corpus.documents[index],
			section = doc.sections.find((s: { sectionId: string }) => s.sectionId === sectionId);
		const bytes = Buffer.from(section.text, "utf8");
		return {
			evidenceRef: structuredClone(doc.evidenceRef),
			sectionId,
			startByte: 0,
			endByte: bytes.byteLength,
			quote: section.text,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	};
	const designQuote = quote(0, "basis"),
		offset = quote(1, "offset"),
		cost = quote(2, "quote"),
		hazard = quote(3, "hazard"),
		schedule = quote(4, "schedule");
	const proposal = {
		version: "0.1.0",
		summary: "Supplied drilling options for engineer review",
		observations: design.questions.map((q: { id: string }) => ({
			observationRef: { id: `observation.${q.id}`, revision: "r1" },
			questionId: q.id,
			kind: "question",
			statement: "Review the supplied design, quoted scope, hazards and offset applicability; no field authority.",
			citations: q.id === "program" ? [designQuote, schedule] : q.id === "costs" ? [cost, schedule] : [offset, hazard],
		})),
	};
	const revoked = new Set<string>();
	let operations: ("read" | "export")[] = ["read", "export"];
	let guard = async (_text: string) => true;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: ref.id,
		revision: ref.revision,
		scope,
		outcome: "Prepare supplied drilling options and evidence for a separately enrolled engineer",
		requiredCapabilities: ["drilling.packet"],
		inputs: [],
		constraints: ["No spud, field operations, well-control or capital authority"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const current = { task, designSourceRef: ref, corpusSourceRef: ref, policySourceRef: ref };
	function bind() {
		task.inputs = [...texts.keys()].map(reference);
		for (const key of ["design", "corpus", "policy"] as const)
			current[`${key}SourceRef`] = { id: reference(key).id, revision: reference(key).revision };
	}
	bind();
	function fetched(id: string): DrillingSource {
		const key = id.replace(/^evidence[.]/, ""),
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
				asOf: observedAt,
				accessClassification: "restricted",
				usagePolicy: { id: "policy.operator-data", version: "r1" },
			},
			connectorRef: { id: "connector.operator", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			retrievedAt: observedAt,
			format: "json",
			parserRef: { id: "json", version: "1" },
			jurisdiction: "fixture-only",
			units: [],
			byteLength: bytes.byteLength,
			accessNotes: "Operator and enrolled drilling reviewer only",
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
		service: new DrillingPacketService(options),
		options,
		current,
		design,
		corpus,
		calculationPolicy,
		proposal,
		texts,
		bind,
		fetched,
		fetchSource,
		quotes: { design: designQuote, offset, cost, hazard, schedule },
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
