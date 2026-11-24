import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type ArtifactRef, type TaskAssignment, validateSourceContract } from "@shaleyeah/contracts";
import { type ForecastSource, ProductionForecastService } from "../../src/forecast-service.js";

export const now = new Date("2026-01-02T12:00:00Z");
export const scope = {
	customerId: "operator-fixture",
	assetId: "asset-fixture",
	taskId: "task.reservoir",
	employeeId: "employee.reservoir-engineer",
};
export const who: SourcePrincipal = {
	subjectId: "reservoir-run",
	customerId: scope.customerId,
	employeeId: scope.employeeId,
	scopes: ["reservoir:read", "reservoir:review", "reservoir:forecast", "source:read"],
};
export const ref = { id: scope.taskId, revision: "r1" };

/** Independent synthetic point-rate exports. Dates advance by the declared 365-day year. */
export function forecastFixture() {
	const history = {
		version: "0.1.0",
		formation: "Synthetic formation",
		sourceGrain: "well",
		observationKind: "instantaneous-rate",
		product: "oil",
		rateUnit: "bbl/day",
		timeBasis: { unit: "year", daysPerUnit: 365 },
		timeConvention: "calendar-elapsed",
		wells: [
			{
				wellRef: { id: "well.fixture-1", revision: "completion-r1" },
				evidenceKind: "synthetic",
				origin: "2023-01-01T00:00:00Z",
				observations: [0, 1, 2, 3].map((elapsedTime) => ({
					elapsedTime,
					observedAt: new Date(Date.parse("2023-01-01T00:00:00Z") + elapsedTime * 365 * 86400000).toISOString(),
					rate: 100 / (1 + 0.1 * elapsedTime),
					operation: "producing",
				})),
			},
		],
	};
	const basis = {
		version: "0.1.0",
		formation: history.formation,
		product: history.product,
		rateUnit: history.rateUnit,
		timeBasis: history.timeBasis,
		timeConvention: history.timeConvention,
		sourceGrain: "well",
		wells: history.wells.map((well) => ({ ...well.wellRef })),
		operatingBasis: "Operator-declared constant completion/operating regime over this synthetic window",
		limitations: ["Synthetic control; no reserves or professional certification"],
	};
	const definition = (id: string, bFactor: number) => ({
		id,
		revision: "r1",
		bFactor,
		horizon: 5,
		economicLimitRate: 0,
		forecastTimes: [0, 1, 3, 5],
		fitUntil: 2,
		minimumTrainingObservations: 3,
		minimumHoldoutObservations: 1,
		maxFitRelativeRmse: 0.01,
		maxHoldoutRelativeRmse: 0.1,
	});
	const assumptions = { version: "0.1.0", forecasts: [definition("base", 1), definition("alternative", 0)] };
	const texts = new Map([
		["history", JSON.stringify(history)],
		["basis", JSON.stringify(basis)],
		["assumptions", JSON.stringify(assumptions)],
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
		outcome: "Compare explicit source-linked production forecasts",
		requiredCapabilities: ["reservoir.forecast"],
		inputs: [],
		constraints: ["No reserves certification or field-control authority"],
		status: "assigned",
		workProductRefs: [],
		reviewDecisionRefs: [],
	};
	const reference = (key: string): ArtifactRef => {
		const hash = createHash("sha256").update(texts.get(key)!).digest("hex");
		return { id: `evidence.${key}`, revision: hash, uri: `urn:sha256:${hash}` };
	};
	const current = {
		task,
		historySourceRef: ref as { id: string; revision: string },
		basisSourceRef: ref as { id: string; revision: string },
		assumptionsSourceRef: ref as { id: string; revision: string },
	};
	function bind() {
		current.task.inputs = [...texts.keys()].map(reference);
		for (const key of ["history", "basis", "assumptions"] as const)
			current[`${key}SourceRef`] = { id: reference(key).id, revision: reference(key).revision };
	}
	bind();
	function fetched(id: string): ForecastSource {
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
			units: key === "history" ? [{ field: "rate", unit: history.rateUnit, origin: "operator-declared" }] : [],
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
		maxObservationAgeSeconds: 7 * 86400,
		clock: () => clock(),
	};
	return {
		service: new ProductionForecastService(options),
		options,
		current,
		history,
		basis,
		assumptions,
		texts,
		bind,
		fetched,
		fetchSource,
		revoke: (id = "evidence.history") => revoked.add(id),
		setGuard: (value: (text: string) => Promise<boolean>) => {
			guard = value;
		},
		setClock: (value: () => Date) => {
			clock = value;
		},
	};
}
