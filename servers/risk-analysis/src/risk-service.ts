import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import {
	type ArtifactRef,
	type JsonSourceArtifact,
	validateContract,
	validateSourceContract,
} from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import {
	calculateJointRisk,
	jointScenariosSchema,
	parseJointRiskInputs,
	riskBlockers,
	riskRefSchema,
} from "./joint-scenarios.js";

export { riskRefSchema } from "./joint-scenarios.js";

const scenariosSchema = z
	.object({ version: z.literal("0.1.0"), models: z.array(jointScenariosSchema).min(1).max(32) })
	.strict();
const configSchema = z
	.object({
		task: z.unknown(),
		authorityRevision: z.string().regex(/^[a-f0-9]{64}$/),
		registerSourceRef: riskRefSchema,
		policySourceRef: riskRefSchema,
		scenariosSourceRef: riskRefSchema,
	})
	.strict();
export interface RiskSource {
	bytes: Uint8Array;
	artifact: JsonSourceArtifact;
}
export interface RiskAssessmentOptions {
	current: () => Promise<unknown>;
	fetchSource: (
		reference: { id: string; revision: string },
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) => Promise<RiskSource>;
	contentGuard: (text: string) => Promise<boolean>;
	maxSourceAgeSeconds: number;
	clock?: () => Date;
}
export class RiskAssessmentError extends Error {
	constructor(public readonly code: string) {
		super(`Risk assessment blocked: ${code}`);
	}
}
function deny(code: string): never {
	throw new RiskAssessmentError(code);
}
const same = (a: unknown, b: unknown) => reviewJson(a) === reviewJson(b);
const sameRef = (a: { id: string; revision: string }, b: { id: string; revision: string }) =>
	a.id === b.id && a.revision === b.revision;
const parse = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return deny("invalid_content");
	}
};

/** Current exact source truth. The executing review adapter rederives the same work before approval/save. */
export class RiskAssessmentService {
	constructor(private readonly options: RiskAssessmentOptions) {
		if (
			!Number.isSafeInteger(options.maxSourceAgeSeconds) ||
			options.maxSourceAgeSeconds < 1 ||
			options.maxSourceAgeSeconds > 31536000 ||
			[options.current, options.fetchSource, options.contentGuard].some((fn) => typeof fn !== "function")
		)
			deny("configuration");
	}
	private fresh(asOf: string) {
		const now = (this.options.clock?.() ?? new Date()).getTime(),
			age = now - Date.parse(asOf);
		if (!Number.isFinite(age) || age < 0 || age > this.options.maxSourceAgeSeconds * 1000) deny("stale_source");
	}
	private async configuration() {
		const config = configSchema.parse(structuredClone(await this.options.current()));
		const task = validateContract(config.task);
		if (task.kind !== "task-assignment" || ["completed", "cancelled", "failed"].includes(task.status))
			deny("task_unavailable");
		const refs = [config.registerSourceRef, config.policySourceRef, config.scenariosSourceRef];
		if (
			task.inputs.length !== 3 ||
			new Set(task.inputs.map((i) => i.id)).size !== 3 ||
			new Set(refs.map((r) => r.id)).size !== 3 ||
			refs.some((r) => !task.inputs.some((i) => sameRef(i, r)))
		)
			deny("source_binding_mismatch");
		return { ...config, task };
	}
	private async assertCurrent(
		config: Awaited<ReturnType<RiskAssessmentService["configuration"]>>,
		signal?: AbortSignal,
	) {
		if (!same(config, await this.configuration())) deny("revision_mismatch");
		if (signal?.aborted) deny("cancelled");
	}
	private async fetchBound(
		reference: ArtifactRef,
		config: Awaited<ReturnType<RiskAssessmentService["configuration"]>>,
		who: SourcePrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	) {
		if (signal?.aborted) deny("cancelled");
		if (
			who.customerId !== config.task.scope.customerId ||
			who.employeeId !== config.task.scope.employeeId ||
			!who.scopes.includes("risk:read") ||
			!who.scopes.includes("source:read")
		)
			deny("access_denied");
		const fetched = await this.options.fetchSource(
			{ id: reference.id, revision: reference.revision },
			who,
			operation,
			signal,
		);
		const source = validateSourceContract(structuredClone(fetched.artifact), {
			expectedScope: config.task.scope,
			expectedTaskRevision: config.task.revision,
		});
		if (source.kind !== "source-artifact" || source.format !== "json" || !same(source.artifact, reference))
			deny("source_binding_mismatch");
		if (
			!(fetched.bytes instanceof Uint8Array) ||
			fetched.bytes.byteLength > 8_000_000 ||
			fetched.bytes.byteLength !== source.byteLength ||
			createHash("sha256").update(fetched.bytes).digest("hex") !== source.evidence.hash.value
		)
			deny("source_binding_mismatch");
		const bytes = Uint8Array.from(fetched.bytes),
			text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		if (!(await this.options.contentGuard(text)) || !(await this.options.contentGuard(reviewJson(source))))
			deny("unsafe_content");
		this.fresh(source.evidence.asOf);
		if (signal?.aborted) deny("cancelled");
		return { source, bytes, text };
	}
	private async load(reference: unknown, who: SourcePrincipal, operation: "read" | "export", signal?: AbortSignal) {
		const ref = riskRefSchema.parse(reference),
			config = await this.configuration();
		if (!sameRef(ref, config.task)) deny("revision_mismatch");
		const snapshots: Awaited<ReturnType<RiskAssessmentService["fetchBound"]>>[] = [];
		let size = 0;
		for (const input of config.task.inputs) {
			const snapshot = await this.fetchBound(input, config, who, operation, signal);
			if ((size += snapshot.bytes.byteLength) > 8_000_000) deny("source_limit");
			snapshots.push(snapshot);
		}
		const snapshot = (ref: { id: string; revision: string }) => snapshots.find((s) => sameRef(s.source.artifact, ref))!;
		const registerInput = parse(snapshot(config.registerSourceRef).text),
			policyInput = parse(snapshot(config.policySourceRef).text);
		const scenarios = scenariosSchema.parse(parse(snapshot(config.scenariosSourceRef).text));
		if (new Set(scenarios.models.map((m) => m.modelRef.id)).size !== scenarios.models.length) deny("duplicate_model");
		const parsed = scenarios.models.map((model) => parseJointRiskInputs(registerInput, policyInput, model));
		const { register, policy } = parsed[0];
		if (
			!snapshot(config.scenariosSourceRef).source.units.some(
				(unit) =>
					unit.field === "residualLoss" && unit.unit === register.currency && unit.origin === "operator-declared",
			)
		)
			deny("unit_mismatch");
		await this.assertCurrent(config, signal);
		return { config, snapshots, register, policy, models: parsed.map((p) => p.model) };
	}
	private publicPacket(packet: Awaited<ReturnType<RiskAssessmentService["load"]>>) {
		return {
			taskRef: { id: packet.config.task.id, revision: packet.config.task.revision },
			sourceArtifact: packet.snapshots.find((s) => sameRef(s.source.artifact, packet.config.registerSourceRef))!.source,
			sourceArtifacts: packet.snapshots.map((s) => s.source),
		};
	}
	private async deliver<T>(
		packet: Awaited<ReturnType<RiskAssessmentService["load"]>>,
		result: T,
		signal?: AbortSignal,
	) {
		if (!(await this.options.contentGuard(reviewJson(result)))) deny("unsafe_content");
		await this.assertCurrent(packet.config, signal);
		for (const snapshot of packet.snapshots) this.fresh(snapshot.source.evidence.asOf);
		return result;
	}
	private calculation(packet: Awaited<ReturnType<RiskAssessmentService["load"]>>, reference: unknown) {
		const ref = riskRefSchema.parse(reference),
			model = packet.models.find((m) => sameRef(m.modelRef, ref));
		if (!model) deny("model_unavailable");
		return calculateJointRisk(packet.register, packet.policy, model);
	}
	async inspect(reference: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				register: {
					entryCount: packet.register.entries.length,
					currency: packet.register.currency,
					horizon: packet.register.horizon,
					entries: packet.register.entries.map((e) => ({
						riskRef: e.riskRef,
						category: e.category,
						evidenceState: e.evidenceState,
						severity: e.severity,
					})),
				},
				policy: packet.policy,
				models: packet.models.map((m) => ({
					modelRef: m.modelRef,
					method: m.method,
					stateCount: m.states.length,
					totalWeight: m.totalWeight,
				})),
				reviewStatus: "unreviewed",
				riskAccepted: false,
			},
			signal,
		);
	}
	async calculate(reference: unknown, model: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(packet, { ...this.publicPacket(packet), risk: this.calculation(packet, model) }, signal);
	}
	async compare(reference: unknown, models: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const selected = z.array(riskRefSchema).min(1).max(32).parse(models);
		if (new Set(selected.map((r) => r.id)).size !== selected.length) deny("duplicate_model");
		const packet = await this.load(reference, who, "read", signal);
		return this.deliver(
			packet,
			{
				...this.publicPacket(packet),
				analyses: selected.map((r) => this.calculation(packet, r)),
				reviewStatus: "unreviewed",
				riskAccepted: false,
			},
			signal,
		);
	}
	async draft(reference: unknown, model: unknown, revision: unknown, who: SourcePrincipal, signal?: AbortSignal) {
		const workRevision = riskRefSchema.shape.revision.parse(revision),
			packet = await this.load(reference, who, "export", signal);
		const risk = this.calculation(packet, model),
			evidenceIds = packet.snapshots.map((s) => s.source.evidence.id);
		const identity = createHash("sha256").update(reviewJson(packet.config.task.scope)).digest("hex");
		const assumptionId = `${risk.definition.modelRef.id}.basis`;
		const blockers = riskBlockers(risk.coverage, packet.policy).map((message) => ({
			code:
				message === "conflicting-evidence"
					? "conflicting_evidence"
					: message.endsWith("-limit")
						? "approval_required"
						: "missing_input",
			message,
			references: [],
		}));
		const work = validateContract({
			contractVersion: "0.1.0",
			kind: "work-product",
			scope: packet.config.task.scope,
			taskRevision: packet.config.task.revision,
			artifact: {
				id: `work.risk.${identity}`,
				revision: workRevision,
				uri: `urn:shaleyeah:risk:${identity}:${encodeURIComponent(workRevision)}`,
			},
			status: blockers.length ? "blocked" : "ready_for_review",
			inputs: packet.config.task.inputs,
			evidence: packet.snapshots.map((s) => s.source.evidence),
			findings: [
				{
					id: `${risk.definition.modelRef.id}.expected-loss`,
					basis: "assumed",
					value: risk.summary.expectedLoss,
					unit: risk.definition.currency,
					evidenceIds,
					assumptionIds: [assumptionId],
				},
			],
			assumptions: [
				{
					id: assumptionId,
					statement: `Complete declared joint scenarios; ${risk.definition.quantileConvention}. Probabilities and losses are assumptions; no field calibration. Full dependence basis and ${risk.limitations.length} limitations remain in the risk packet and exact source inputs.`,
					evidenceIds,
				},
			],
			uncertainty:
				"Conditional scenario appraisal, not calibrated field probabilities, NPV/IRR, compliance certification or investment approval. A separate enrolled human owns residual risk acceptance.",
			blockers,
			review: { status: "unreviewed", decisionRefs: [] },
		});
		if (work.kind !== "work-product") deny("invalid_work");
		return this.deliver(packet, { ...this.publicPacket(packet), work, risk }, signal);
	}
	private async source(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		const ref = riskRefSchema.parse(reference),
			config = await this.configuration();
		const input = config.task.inputs.find((i) => sameRef(i, ref));
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.fetchBound(input, config, who, operation, signal);
		await this.assertCurrent(config, signal);
		this.fresh(snapshot.source.evidence.asOf);
		return snapshot;
	}
	async readSource(reference: unknown, who: SourcePrincipal, offset = 0, maxChars = 16000, signal?: AbortSignal) {
		if (
			!Number.isSafeInteger(offset) ||
			offset < 0 ||
			!Number.isSafeInteger(maxChars) ||
			maxChars < 1 ||
			maxChars > 32000
		)
			deny("invalid_pagination");
		const snapshot = await this.source(reference, "read", who, signal);
		return {
			sourceArtifact: snapshot.source,
			text: snapshot.text.slice(offset, offset + maxChars),
			offset,
			nextOffset: offset + maxChars < snapshot.text.length ? offset + maxChars : null,
		};
	}
	async sourceMetadata(reference: unknown, operation: "read" | "export", who: SourcePrincipal, signal?: AbortSignal) {
		return { sourceArtifact: (await this.source(reference, operation, who, signal)).source, operation };
	}
	async reviewSource(id: string, who: SourcePrincipal, signal?: AbortSignal) {
		const config = await this.configuration(),
			input = config.task.inputs.find((i) => i.id === id);
		if (!input) deny("source_binding_mismatch");
		const snapshot = await this.source({ id: input.id, revision: input.revision }, "export", who, signal);
		return {
			artifact: {
				artifact: snapshot.source.artifact,
				evidence: snapshot.source.evidence,
				retrievedAt: snapshot.source.retrievedAt,
			},
			bytes: snapshot.bytes,
		};
	}
}
