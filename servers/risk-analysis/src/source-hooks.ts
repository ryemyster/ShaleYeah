import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type Scope, validateSourceContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { RiskAssessmentError, type RiskAssessmentOptions, type RiskSource, riskRefSchema } from "./risk-service.js";

const identity = z.string().min(1).max(128);
const scopeSchema = z
	.object({ customerId: identity, assetId: identity, taskId: identity, employeeId: identity })
	.strict();
const grantSchema = z
	.object({
		subjectId: z.string().min(1).max(128),
		scope: scopeSchema,
		taskRevision: riskRefSchema.shape.revision,
		sourceIds: z.array(riskRefSchema.shape.id).min(1).max(16),
		operations: z
			.array(z.enum(["read", "export"]))
			.min(1)
			.max(2),
		expiresAt: z.iso.datetime(),
		revoked: z.boolean(),
	})
	.strict();

export interface RiskSnapshotHookOptions {
	scope: Scope;
	taskRevision: string;
	currentGrant: () => Promise<unknown>;
	/** Host-selected source mapping; no endpoint, credential or arbitrary code is taken from tool arguments. */
	readSnapshot: (request: {
		reference: { id: string; revision: string };
		credential?: string;
		signal?: AbortSignal;
	}) => Promise<RiskSource>;
	credentialRef?: string;
	resolveCredential?: (reference: string, principal: SourcePrincipal) => Promise<string>;
	contentGuard: (text: string) => Promise<boolean>;
	audit: (event: { stage: "started" | "succeeded" | "denied"; sourceId: string; revision: string }) => Promise<void>;
	maxBytes: number;
	maxAgeSeconds: number;
	clock?: () => Date;
}

/** Installed normalized JSON snapshot seam. It qualifies no vendor-native API, mapping or redistribution rights. */
export function createRiskSnapshotHook(options: RiskSnapshotHookOptions): RiskAssessmentOptions["fetchSource"] {
	const scope = scopeSchema.parse(options.scope),
		taskRevision = riskRefSchema.shape.revision.parse(options.taskRevision);
	if (
		!Number.isSafeInteger(options.maxBytes) ||
		options.maxBytes < 1 ||
		options.maxBytes > 8_000_000 ||
		!Number.isSafeInteger(options.maxAgeSeconds) ||
		options.maxAgeSeconds < 1 ||
		options.maxAgeSeconds > 31536000 ||
		[options.currentGrant, options.readSnapshot, options.contentGuard, options.audit].some(
			(fn) => typeof fn !== "function",
		) ||
		Boolean(options.credentialRef) !== Boolean(options.resolveCredential)
	)
		throw new RiskAssessmentError("configuration");
	const now = () => {
		const value = (options.clock?.() ?? new Date()).getTime();
		if (!Number.isFinite(value)) throw new RiskAssessmentError("configuration");
		return value;
	};
	return async (reference, who, operation, signal) => {
		const ref = riskRefSchema.parse(reference);
		const audit = (stage: "started" | "succeeded" | "denied") =>
			options.audit({ stage, sourceId: ref.id, revision: ref.revision });
		try {
			const current = async () => {
				if (signal?.aborted) throw new RiskAssessmentError("cancelled");
				const grant = grantSchema.parse(structuredClone(await options.currentGrant()));
				if (
					grant.revoked ||
					Date.parse(grant.expiresAt) <= now() ||
					grant.subjectId !== who.subjectId ||
					who.customerId !== scope.customerId ||
					who.employeeId !== scope.employeeId ||
					reviewJson(grant.scope) !== reviewJson(scope) ||
					grant.taskRevision !== taskRevision ||
					!grant.sourceIds.includes(ref.id) ||
					!grant.operations.includes(operation) ||
					!who.scopes.includes("source:read")
				)
					throw new RiskAssessmentError("source_use_denied");
				return grant;
			};
			const grant = await current();
			await audit("started");
			const credential = options.credentialRef
				? await options.resolveCredential!(options.credentialRef, who)
				: undefined;
			if (options.credentialRef && (typeof credential !== "string" || !credential || credential.length > 65536))
				throw new RiskAssessmentError("credential_unavailable");
			if (reviewJson(grant) !== reviewJson(await current())) throw new RiskAssessmentError("revision_mismatch");
			const fetched = await options.readSnapshot({ reference: ref, credential, signal });
			const source = validateSourceContract(structuredClone(fetched.artifact), {
				expectedScope: scope,
				expectedTaskRevision: taskRevision,
			});
			if (
				source.kind !== "source-artifact" ||
				source.format !== "json" ||
				!["public-download", "internal-api"].includes(source.sourceKind) ||
				source.adapterRef.id !== "normalized-risk-snapshot" ||
				source.adapterRef.version !== "0.1.0" ||
				source.artifact.id !== ref.id ||
				source.artifact.revision !== ref.revision ||
				!(fetched.bytes instanceof Uint8Array) ||
				fetched.bytes.byteLength > options.maxBytes ||
				fetched.bytes.byteLength !== source.byteLength ||
				createHash("sha256").update(fetched.bytes).digest("hex") !== source.evidence.hash.value
			)
				throw new RiskAssessmentError("source_binding_mismatch");
			const bytes = Uint8Array.from(fetched.bytes),
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes),
				metadata = reviewJson(source);
			if (
				(credential && (text.includes(credential) || metadata.includes(credential))) ||
				!(await options.contentGuard(text)) ||
				!(await options.contentGuard(metadata))
			)
				throw new RiskAssessmentError("unsafe_content");
			const fresh = () => {
				const age = now() - Date.parse(source.evidence.asOf);
				if (age < 0 || age > options.maxAgeSeconds * 1000) throw new RiskAssessmentError("stale_source");
			};
			if (reviewJson(grant) !== reviewJson(await current())) throw new RiskAssessmentError("revision_mismatch");
			fresh();
			await audit("succeeded");
			if (reviewJson(grant) !== reviewJson(await current())) throw new RiskAssessmentError("revision_mismatch");
			fresh();
			return { bytes, artifact: source };
		} catch (error) {
			try {
				await audit("denied");
			} catch {
				throw new RiskAssessmentError("verification_unavailable");
			}
			if (error instanceof RiskAssessmentError) throw error;
			throw new RiskAssessmentError("verification_unavailable");
		}
	};
}
