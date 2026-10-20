import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { FetchedSource, SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { EconomicScenarioService } from "../../src/scenario-service.js";

export const now = new Date("2026-10-19T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.economist",
	employeeId: "employee.economist",
};
export const who: SourcePrincipal = {
	subjectId: "economist-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["economics:read", "economics:review", "economics:scenario", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };
export const basisKeys = [
	"assumptionsRef",
	"forecastRef",
	"priceDeckRef",
	"costRef",
	"ownershipRef",
	"taxRoyaltyRef",
] as const;
const sourceIds = ["assumptions", "forecast", "prices", "costs", "ownership", "fiscal"];

/** Synthetic operator exports, not vendor data or qualified petroleum assumptions. */
export function fixture() {
	const texts = new Map([
		[
			"cash-flows",
			"scenarioId,scenarioRevision,period,netCashFlow\nbase,r1,0,-100\nbase,r1,1,110\nlow,r1,0,-100\nlow,r1,1,90\n",
		],
		["assumptions", "category,statement\nbasis,Net entity nominal money units; human review required\n"],
		["forecast", "scenarioId,period,oilVolume,unit\nbase,1,10,bbl\nlow,1,10,bbl\n"],
		["prices", "scenarioId,period,price,currency,unit\nbase,1,50,USD,bbl\nlow,1,45,USD,bbl\n"],
		[
			"costs",
			"scenarioId,period,netOperatingExpense,netCapital,currency\nbase,0,0,100,USD\nbase,1,90,0,USD\nlow,0,0,100,USD\nlow,1,90,0,USD\n",
		],
		["ownership", "scenarioId,workingInterest,revenueInterest\nbase,0.5,0.4\nlow,0.5,0.4\n"],
		[
			"fiscal",
			"scenarioId,period,netTax,netRoyalty,currency\nbase,0,0,0,USD\nbase,1,0,0,USD\nlow,0,0,0,USD\nlow,1,0,0,USD\n",
		],
	]);
	const revoked = new Set<string>();
	let guard = async (_text: string) => true;
	const task: TaskAssignment = {
		contractVersion: "0.1.0",
		kind: "task-assignment",
		id: ref.id,
		revision: ref.revision,
		scope,
		outcome: "Compare explicit net cash-flow scenarios",
		requiredCapabilities: ["economics.scenario"],
		inputs: [],
		constraints: ["No capital commitment"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const basis = {
		version: "0.1.0",
		assumptionsRef: reference("assumptions"),
		forecastRef: reference("forecast"),
		priceDeckRef: reference("prices"),
		priceDeckAsOf: "2026-10-19T00:00:00Z",
		costRef: reference("costs"),
		ownershipRef: reference("ownership"),
		taxRoyaltyRef: reference("fiscal"),
		workingInterest: 0.5,
		revenueInterest: 0.4,
		cashFlowBasis: "net-entity",
		moneyScale: 1,
		nominalReal: "nominal",
		startDate: "2026-10-19",
		limitations: ["Synthetic control; no fiscal certification"],
	};
	// Basis references are versioned identities; URIs belong to the task's artifact list.
	for (const key of basisKeys) delete (basis[key] as Partial<ArtifactRef>).uri;
	const definition = (id: string) => ({
		id,
		revision: "r1",
		currency: "USD",
		periodUnit: "year",
		discountRate: 0.1,
		basis: structuredClone(basis),
	});
	const current = {
		task,
		cashFlowSourceRef: { id: reference("cash-flows").id, revision: reference("cash-flows").revision },
		scenarios: [definition("base"), definition("low")],
	};
	function bind() {
		current.task.inputs = [...texts.keys()].map(reference);
		current.cashFlowSourceRef = { id: reference("cash-flows").id, revision: reference("cash-flows").revision };
		for (const scenario of current.scenarios)
			basisKeys.forEach((key, i) => {
				scenario.basis[key] = { id: reference(sourceIds[i]).id, revision: reference(sourceIds[i]).revision };
			});
	}
	bind();
	function fetched(id: string): FetchedSource {
		const key = id.replace(/^evidence\./, ""),
			text = texts.get(key);
		if (text === undefined) throw new Error("source_unavailable");
		const bytes = Buffer.from(text),
			artifact = reference(key);
		const parsed = validateSourceContract({
			contractVersion: "0.1.0",
			kind: "source-artifact",
			scope,
			taskRevision: current.task.revision,
			artifact,
			evidence: {
				id,
				revision: artifact.revision,
				uri: `urn:operator:${key}`,
				hash: { algorithm: "sha256", value: artifact.revision },
				asOf: "2026-10-19T00:00:00Z",
				accessClassification: "restricted",
				usagePolicy: { id: "policy.operator-data", version: "r1" },
			},
			connectorRef: { id: "connector.operator", revision: "r1" },
			adapterRef: { id: "operator-file", version: "0.1.0" },
			sourceKind: "operator-file",
			retrievedAt: now.toISOString(),
			format: "csv",
			parserRef: { id: "csv-parse", version: "7.0.3" },
			jurisdiction: "US-TX",
			units: key === "cash-flows" ? [{ field: "netCashFlow", unit: "USD", origin: "operator-declared" }] : [],
			byteLength: bytes.byteLength,
			accessNotes: "Operator-only",
			licenseNotes: "Synthetic fixture",
			revisionOrigin: "operator-declared",
		});
		if (parsed.kind !== "source-artifact") throw new Error("invalid_fixture");
		return { bytes, artifact: parsed };
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
	const service = new EconomicScenarioService({
		current: async () => ({
			...current,
			authorityRevision: createHash("sha256")
				.update(JSON.stringify([...revoked]))
				.digest("hex"),
		}),
		fetchSource,
		contentGuard: (text) => guard(text),
		maxPriceAgeSeconds: 86400,
		maxSourceAgeSeconds: 86400,
		clock: () => now,
	});
	return {
		service,
		current,
		basis,
		fetched,
		fetchSource,
		setGuard: (value: (text: string) => Promise<boolean>) => {
			guard = value;
		},
		texts,
		bind,
		revoke: (id = "evidence.cash-flows") => revoked.add(id),
	};
}
