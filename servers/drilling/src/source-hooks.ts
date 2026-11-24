import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type Scope, validateSourceContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { drillingRefSchema } from "./drilling-packet.js";
import { DrillingServiceError, type DrillingServiceOptions, type DrillingSource } from "./drilling-service.js";

const identity = z.string().min(1).max(128);
const scopeSchema = z
	.object({ customerId: identity, assetId: identity, taskId: identity, employeeId: identity })
	.strict();
const grantSchema = z
	.object({
		subjectId: z.string().min(1).max(128),
		scope: scopeSchema,
		taskRevision: drillingRefSchema.shape.revision,
		sourceIds: z.array(drillingRefSchema.shape.id).min(1).max(16),
		operations: z
			.array(z.enum(["read", "export"]))
			.min(1)
			.max(2),
		expiresAt: z.iso.datetime(),
		revoked: z.boolean(),
	})
	.strict();

export interface DrillingSnapshotHookOptions {
	scope: Scope;
	taskRevision: string;
	currentGrant: () => Promise<unknown>;
	/** Host-selected source mapping; no endpoint, credential or arbitrary code is taken from tool arguments. */
	readSnapshot: (request: {
		reference: { id: string; revision: string };
		credential?: string;
		signal?: AbortSignal;
	}) => Promise<DrillingSource>;
	credentialRef?: string;
	resolveCredential?: (reference: string, principal: SourcePrincipal) => Promise<string>;
	contentGuard: (text: string) => Promise<boolean>;
	audit: (event: { stage: "started" | "succeeded" | "denied"; sourceId: string; revision: string }) => Promise<void>;
	maxBytes: number;
	maxAgeSeconds: number;
	clock?: () => Date;
}

/** Installed normalized JSON snapshot seam. It qualifies no vendor-native API, mapping or redistribution rights. */
export function createDrillingSnapshotHook(
	options: DrillingSnapshotHookOptions,
): DrillingServiceOptions["fetchSource"] {
	const scope = scopeSchema.parse(options.scope),
		taskRevision = drillingRefSchema.shape.revision.parse(options.taskRevision);
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
		throw new DrillingServiceError("configuration");
	const now = () => {
		const value = (options.clock?.() ?? new Date()).getTime();
		if (!Number.isFinite(value)) throw new DrillingServiceError("configuration");
		return value;
	};
	return async (reference, who, operation, signal) => {
		const ref = drillingRefSchema.parse(reference);
		const audit = (stage: "started" | "succeeded" | "denied") =>
			options.audit({ stage, sourceId: ref.id, revision: ref.revision });
		try {
			const current = async () => {
				if (signal?.aborted) throw new DrillingServiceError("cancelled");
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
					throw new DrillingServiceError("source_use_denied");
				return grant;
			};
			const grant = await current();
			await audit("started");
			const credential = options.credentialRef
				? await options.resolveCredential!(options.credentialRef, who)
				: undefined;
			if (options.credentialRef && (typeof credential !== "string" || !credential || credential.length > 65536))
				throw new DrillingServiceError("credential_unavailable");
			if (reviewJson(grant) !== reviewJson(await current())) throw new DrillingServiceError("revision_mismatch");
			const fetched = await options.readSnapshot({ reference: ref, credential, signal });
			const source = validateSourceContract(structuredClone(fetched.artifact), {
				expectedScope: scope,
				expectedTaskRevision: taskRevision,
			});
			const suppliedBytes = fetched.bytes;
			if (!(suppliedBytes instanceof Uint8Array) || suppliedBytes.byteLength > options.maxBytes)
				throw new DrillingServiceError("source_binding_mismatch");
			const bytes = Uint8Array.from(suppliedBytes);
			if (
				source.kind !== "source-artifact" ||
				source.format !== "json" ||
				!["public-download", "internal-api"].includes(source.sourceKind) ||
				source.adapterRef.id !== "normalized-drilling-snapshot" ||
				source.adapterRef.version !== "0.1.0" ||
				source.artifact.id !== ref.id ||
				source.artifact.revision !== ref.revision ||
				bytes.byteLength !== source.byteLength ||
				createHash("sha256").update(bytes).digest("hex") !== source.evidence.hash.value
			)
				throw new DrillingServiceError("source_binding_mismatch");
			const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes),
				metadata = reviewJson(source);
			if (
				(credential && (text.includes(credential) || metadata.includes(credential))) ||
				!(await options.contentGuard(text)) ||
				!(await options.contentGuard(metadata))
			)
				throw new DrillingServiceError("unsafe_content");
			const fresh = () => {
				const age = now() - Date.parse(source.evidence.asOf);
				if (age < 0 || age > options.maxAgeSeconds * 1000) throw new DrillingServiceError("stale_source");
			};
			if (reviewJson(grant) !== reviewJson(await current())) throw new DrillingServiceError("revision_mismatch");
			fresh();
			await audit("succeeded");
			if (reviewJson(grant) !== reviewJson(await current())) throw new DrillingServiceError("revision_mismatch");
			fresh();
			return { bytes, artifact: source };
		} catch (error) {
			try {
				await audit("denied");
			} catch {
				throw new DrillingServiceError("verification_unavailable");
			}
			if (error instanceof DrillingServiceError) throw error;
			throw new DrillingServiceError("verification_unavailable");
		}
	};
}
