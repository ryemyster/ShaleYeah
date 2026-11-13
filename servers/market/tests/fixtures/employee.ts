import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import type { ArtifactRef, TaskAssignment } from "@shaleyeah/contracts";
import { MarketScenarioService, type MarketServiceOptions, type MarketSource } from "../../src/market-service.js";

export const now = new Date("2026-11-13T12:00:00.000Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.market",
	employeeId: "employee.market-analyst",
};
export const who: SourcePrincipal = {
	subjectId: "market-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["market:read", "market:review", "market:record", "source:read"],
};
export function employeeFixture() {
	const frozen = JSON.parse(fs.readFileSync(new URL("./market-scenario-oracles.json", import.meta.url), "utf8"));
	const input = structuredClone(frozen.input);
	const texts = new Map<string, string>(
		["mandate", "series", "assumptions"].map((key) => [key, JSON.stringify(input[key])]),
	);
	const revoked = new Set<string>();
	let operations: ("read" | "export")[] = ["read", "export"];
	let guard = async (_text: string) => true;
	let clock = () => now;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: scope.taskId,
		revision: "r1",
		scope,
		outcome: "Prepare dated market scenarios for the enrolled commercial owner",
		requiredCapabilities: ["market.scenario"],
		inputs: [],
		constraints: ["No trades, contracts, bids or capital authority"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const selected = (key: string) => ({ id: reference(key).id, revision: reference(key).revision });
	const current = {
		task,
		mandateSourceRef: selected("mandate"),
		seriesSourceRef: selected("series"),
		assumptionsSourceRef: selected("assumptions"),
	};
	function bind() {
		current.task.inputs = [...texts.keys()].map(reference);
		for (const key of ["mandate", "series", "assumptions"] as const) current[`${key}SourceRef`] = selected(key);
	}
	bind();
	function fetched(id: string): MarketSource {
		const key = id.replace(/^evidence\./, "");
		const text = texts.get(key);
		if (text === undefined) throw new Error("private missing-source detail");
		const bytes = Buffer.from(text),
			artifact = reference(key);
		return {
			bytes,
			artifact: {
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
					asOf: "2026-11-13T00:00:00.000Z",
					accessClassification: "restricted",
					usagePolicy: { id: "policy.operator-data", version: "r1" },
				},
				connectorRef: { id: "connector.operator", revision: "r1" },
				adapterRef: { id: "operator-file", version: "0.1.0" },
				sourceKind: "operator-file",
				retrievedAt: now.toISOString(),
				format: "json",
				parserRef: { id: "json", version: "1" },
				jurisdiction: "US",
				units: [],
				byteLength: bytes.byteLength,
				accessNotes: "Operator and enrolled commercial reviewer only",
				licenseNotes: "Synthetic fixture",
				revisionOrigin: "operator-declared",
			},
		};
	}
	let fetcher: MarketServiceOptions["fetchSource"] = async (ref, principal, operation) => {
		if (principal.subjectId !== who.subjectId || revoked.has(ref.id) || !operations.includes(operation))
			throw new Error("fixture private source access detail");
		return fetched(ref.id);
	};
	const options: MarketServiceOptions = {
		current: async () => ({
			...current,
			authorityRevision: createHash("sha256")
				.update(JSON.stringify({ revoked: [...revoked], operations, inputs: [...texts] }))
				.digest("hex"),
		}),
		fetchSource: (...args) => fetcher(...args),
		contentGuard: (text) => guard(text),
		maxSourceAgeSeconds: 86400,
		clock: () => clock(),
	};
	return {
		service: new MarketScenarioService(options),
		options,
		current,
		input,
		proposal: input.proposal,
		texts,
		fetched,
		bind,
		ref: () => ({ id: task.id, revision: task.revision }),
		revoke: (id = "evidence.series") => revoked.add(id),
		setOperations: (value: typeof operations) => {
			operations = value;
		},
		setGuard: (value: typeof guard) => {
			guard = value;
		},
		setClock: (value: typeof clock) => {
			clock = value;
		},
		setFetcher: (value: typeof fetcher) => {
			fetcher = value;
		},
		replaceSource: (key: string, text: string) => {
			texts.set(key, text);
			task.revision = `r${Number(task.revision.slice(1)) + 1}`;
			bind();
		},
	};
}
