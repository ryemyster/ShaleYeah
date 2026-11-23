import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { TitlePacketService, type TitleSource } from "../../src/title-service.js";

const frozen = JSON.parse(fs.readFileSync(new URL("./source-oracles.json", import.meta.url), "utf8"));
export const now = new Date("2026-11-18T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.title",
	employeeId: "employee.title-analyst",
};
export const who: SourcePrincipal = {
	subjectId: "title-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["title:read", "title:review", "title:record", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };

export function titleFixture({ liveClock = false } = {}) {
	const { examination, corpus, policy: calculationPolicy } = structuredClone(frozen);
	let clock = () => (liveClock ? new Date() : now);
	const observedAt = clock().toISOString();
	const texts = new Map<string, string>([
		["examination", JSON.stringify(examination)],
		["corpus", JSON.stringify(corpus)],
		["policy", JSON.stringify(calculationPolicy)],
	]);
	const quote = (index: number, sectionId: string) => {
		const doc = corpus.documents[index],
			section = doc.sections.find((s: { sectionId: string }) => s.sectionId === sectionId);
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
	const roots = quote(0, "opening"),
		transfer = quote(1, "transfer"),
		royalty = quote(2, "royalty");
	const orri = quote(2, "orri"),
		lease = quote(0, "lease");
	const proposal = {
		version: "0.1.0",
		title: "Supplied tract ownership and exceptions for review",
		observations: [
			{
				observationRef: { id: "observation.ownership", revision: "r1" },
				questionId: "ownership",
				kind: "observation",
				statement: "The supplied shallow operating transfer preserves separate record title and deep operating rights.",
				citations: [roots, transfer],
			},
			{
				observationRef: { id: "observation.chain", revision: "r1" },
				questionId: "chain",
				kind: "question",
				statement: "Review the supplied starting claim and recording links; public-record coverage is unverified.",
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
	const revoked = new Set<string>();
	let operations: ("read" | "export")[] = ["read", "export"];
	let guard = async (_text: string) => true;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: ref.id,
		revision: ref.revision,
		scope,
		outcome: "Prepare an instrument-cited ownership/exception packet for a separately enrolled title reviewer",
		requiredCapabilities: ["title.packet"],
		inputs: [],
		constraints: ["No title clearance, filing or transfer authority"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const current = { task, examinationSourceRef: ref, corpusSourceRef: ref, policySourceRef: ref };
	function bind() {
		task.inputs = [...texts.keys()].map(reference);
		for (const key of ["examination", "corpus", "policy"] as const)
			current[`${key}SourceRef`] = { id: reference(key).id, revision: reference(key).revision };
	}
	bind();
	function fetched(id: string): TitleSource {
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
			accessNotes: "Operator and enrolled title reviewer only",
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
		service: new TitlePacketService(options),
		options,
		current,
		examination,
		corpus,
		calculationPolicy,
		proposal,
		texts,
		bind,
		fetched,
		fetchSource,
		quotes: { roots, transfer, royalty, orri, lease },
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
