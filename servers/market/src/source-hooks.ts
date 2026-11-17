import { createHash } from "node:crypto";
import type { SourcePrincipal } from "@shaleyeah/connectors";
import { type Scope, validateSourceContract } from "@shaleyeah/contracts";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { marketRefSchema } from "./market-scenario.js";
import { MarketServiceError, type MarketServiceOptions, type MarketSource } from "./market-service.js";

const identity = z.string().min(1).max(128);
const scopeSchema = z
	.object({ customerId: identity, assetId: identity, taskId: identity, employeeId: identity })
	.strict();
const grantSchema = z
	.object({
		subjectId: identity,
		scope: scopeSchema,
		taskRevision: marketRefSchema.shape.revision,
		sourceIds: z.array(marketRefSchema.shape.id).min(1).max(3),
		operations: z
			.array(z.enum(["read", "export"]))
			.min(1)
			.max(2),
		expiresAt: z.iso.datetime(),
		revoked: z.boolean(),
	})
	.strict();

export interface MarketSnapshotHookOptions {
	scope: Scope;
	taskRevision: string;
	currentGrant: () => Promise<unknown>;
	/** Host-selected normalization and endpoint; never chosen by model arguments. */
	readSnapshot: (request: {
		reference: { id: string; revision: string };
		credential?: string;
		signal?: AbortSignal;
	}) => Promise<MarketSource>;
	credentialRef?: string;
	resolveCredential?: (reference: string, principal: SourcePrincipal) => Promise<string>;
	contentGuard: (text: string) => Promise<boolean>;
	audit: (event: { stage: "started" | "succeeded" | "denied"; sourceId: string; revision: string }) => Promise<void>;
	maxBytes: number;
	maxAgeSeconds: number;
	clock?: () => Date;
}

/** Normalized snapshot seam; vendor-native mappings and licensed redistribution require separate verification. */
export function createMarketSnapshotHook(options: MarketSnapshotHookOptions): MarketServiceOptions["fetchSource"] {
	const scope = scopeSchema.parse(options.scope),
		taskRevision = marketRefSchema.shape.revision.parse(options.taskRevision);
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
		throw new MarketServiceError("configuration");
	const now = () => {
		const value = (options.clock?.() ?? new Date()).getTime();
		if (!Number.isFinite(value)) throw new MarketServiceError("configuration");
		return value;
	};
	return async (reference, who, operation, signal) => {
		const ref = marketRefSchema.parse(reference);
		const audit = (stage: "started" | "succeeded" | "denied") =>
			options.audit({ stage, sourceId: ref.id, revision: ref.revision });
		try {
			const current = async () => {
				if (signal?.aborted) throw new MarketServiceError("cancelled");
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
					throw new MarketServiceError("source_use_denied");
				return grant;
			};
			const grant = await current();
			await audit("started");
			const credential = options.credentialRef
				? await options.resolveCredential!(options.credentialRef, who)
				: undefined;
			if (options.credentialRef && (typeof credential !== "string" || !credential || credential.length > 65536))
				throw new MarketServiceError("credential_unavailable");
			if (reviewJson(grant) !== reviewJson(await current())) throw new MarketServiceError("revision_mismatch");
			const fetched = await options.readSnapshot({ reference: ref, credential, signal });
			const source = validateSourceContract(structuredClone(fetched.artifact), {
				expectedScope: scope,
				expectedTaskRevision: taskRevision,
			});
			if (
				source.kind !== "source-artifact" ||
				source.format !== "json" ||
				!["public-download", "internal-api"].includes(source.sourceKind) ||
				source.adapterRef.id !== "normalized-market-snapshot" ||
				source.adapterRef.version !== "0.1.0" ||
				source.artifact.id !== ref.id ||
				source.artifact.revision !== ref.revision ||
				!(fetched.bytes instanceof Uint8Array) ||
				fetched.bytes.byteLength > options.maxBytes ||
				fetched.bytes.byteLength !== source.byteLength ||
				createHash("sha256").update(fetched.bytes).digest("hex") !== source.evidence.hash.value
			)
				throw new MarketServiceError("source_binding_mismatch");
			const bytes = Uint8Array.from(fetched.bytes),
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes),
				metadata = reviewJson(source);
			if (
				(credential && (text.includes(credential) || metadata.includes(credential))) ||
				!(await options.contentGuard(text)) ||
				!(await options.contentGuard(metadata))
			)
				throw new MarketServiceError("unsafe_content");
			const fresh = () => {
				const timestamp = now(),
					asOf = Date.parse(source.evidence.asOf),
					retrievedAt = Date.parse(source.retrievedAt);
				if (
					timestamp < asOf ||
					timestamp - asOf > options.maxAgeSeconds * 1000 ||
					retrievedAt > timestamp ||
					retrievedAt < asOf
				)
					throw new MarketServiceError("stale_source");
			};
			if (reviewJson(grant) !== reviewJson(await current())) throw new MarketServiceError("revision_mismatch");
			fresh();
			await audit("succeeded");
			if (reviewJson(grant) !== reviewJson(await current())) throw new MarketServiceError("revision_mismatch");
			fresh();
			return { bytes, artifact: source };
		} catch (error) {
			try {
				await audit("denied");
			} catch {
				throw new MarketServiceError("verification_unavailable");
			}
			if (error instanceof MarketServiceError) throw error;
			throw new MarketServiceError("verification_unavailable");
		}
	};
}
