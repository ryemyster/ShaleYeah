import { createHash } from "node:crypto";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { qaProjectionSchema } from "./tools/qa-data.js";
import type { QAScope, QASnapshot } from "./tools/qa-rules.js";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9._:-]+$/);
export const qaScopeSchema = z.object({ customerId: id, assetId: id, taskId: id, employeeId: id }).strict();
export const qaRefSchema = z.object({ id, revision: id, uri: z.string().min(1).max(2048).optional() }).strict();
export type QARef = z.infer<typeof qaRefSchema>;
export interface QAPrincipal {
	subjectId: string;
	customerId: string;
	employeeId: string;
	scopes: readonly string[];
}
export const qaEvidenceSchema = z
	.object({
		id,
		revision: id,
		uri: z
			.string()
			.min(1)
			.max(2048)
			.refine((uri) => {
				try {
					return ["urn:", "https:"].includes(new URL(uri).protocol);
				} catch {
					return false;
				}
			}),
		hash: z.object({ algorithm: z.literal("sha256"), value: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
		asOf: z.iso.datetime({ offset: true }),
		accessClassification: z.enum(["public", "internal", "restricted"]),
		usagePolicy: z.object({ id, version: id }).strict(),
	})
	.strict();
const entrySchema = z
	.object({
		snapshot: z
			.object({
				scope: qaScopeSchema,
				evidence: qaEvidenceSchema,
				bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.length > 0 && bytes.length <= 8_000_000),
				projection: qaProjectionSchema.optional(),
			})
			.strict(),
		grant: z
			.object({
				subjectId: id,
				scope: qaScopeSchema,
				taskRevision: id,
				operations: z
					.array(z.enum(["read", "export"]))
					.min(1)
					.max(2),
				current: z.boolean(),
				expiresAt: z.iso.datetime({ offset: true }),
			})
			.strict(),
	})
	.strict();
export class QAError extends Error {
	constructor(public readonly code: string) {
		super(
			code === "access_denied"
				? "QA forbidden: access_denied"
				: code === "timeout"
					? "QA request timeout"
					: `QA invalid operation: ${code}`,
		);
	}
}
const equal = (left: unknown, right: unknown) => reviewJson(left) === reviewJson(right);

/** A host-owned authority resolves each source reference; no model/caller supplies grants or bytes. */
export class QAInputs {
	private readonly scope: QAScope;
	constructor(
		private readonly options: {
			scope: QAScope;
			taskRevision: string;
			current: (id: string, principal: QAPrincipal) => Promise<unknown>;
			contentGuard: (text: string) => Promise<boolean>;
			clock?: () => Date;
		},
	) {
		this.scope = qaScopeSchema.parse(options.scope);
		id.parse(options.taskRevision);
		if (typeof options.current !== "function" || typeof options.contentGuard !== "function")
			throw new QAError("configuration");
	}
	private verified(value: unknown, ref: QARef, principal: QAPrincipal, operation: "read" | "export") {
		const parsed = entrySchema.safeParse(value);
		if (!parsed.success) throw new QAError("source_unavailable");
		const { snapshot, grant } = parsed.data;
		if (
			principal.customerId !== this.scope.customerId ||
			principal.employeeId !== this.scope.employeeId ||
			!principal.scopes.includes(operation === "read" ? "qa:read" : "qa:report") ||
			grant.subjectId !== principal.subjectId ||
			!equal(snapshot.scope, this.scope) ||
			!equal(grant.scope, this.scope) ||
			grant.taskRevision !== this.options.taskRevision ||
			!grant.current ||
			!grant.operations.includes("read") ||
			!grant.operations.includes(operation) ||
			Date.parse(grant.expiresAt) <= (this.options.clock?.() ?? new Date()).getTime()
		)
			throw new QAError("access_denied");
		if (
			snapshot.evidence.id !== ref.id ||
			snapshot.evidence.revision !== ref.revision ||
			(ref.uri !== undefined && snapshot.evidence.uri !== ref.uri)
		)
			throw new QAError("revision_mismatch");
		if (createHash("sha256").update(snapshot.bytes).digest("hex") !== snapshot.evidence.hash.value)
			throw new QAError("source_hash_mismatch");
		return parsed.data;
	}
	async fetch(
		refInput: QARef,
		principal: QAPrincipal,
		operation: "read" | "export",
		signal?: AbortSignal,
	): Promise<QASnapshot> {
		const ref = qaRefSchema.parse(refInput);
		if (!["read", "export"].includes(operation)) throw new QAError("access_denied");
		const cancelled = () => {
			if (signal?.aborted) throw new QAError("cancelled");
		};
		cancelled();
		const before = this.verified(await this.options.current(ref.id, principal), ref, principal, operation);
		const snapshot = structuredClone(before.snapshot);
		let text: string;
		try {
			text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes);
		} catch {
			throw new QAError("source_encoding");
		}
		if (!(await this.options.contentGuard(text))) throw new QAError("unsafe_content");
		cancelled();
		const after = this.verified(await this.options.current(ref.id, principal), ref, principal, operation);
		if (
			!equal(before.snapshot.evidence, after.snapshot.evidence) ||
			!equal(before.snapshot.projection ?? {}, after.snapshot.projection ?? {})
		)
			throw new QAError("revision_mismatch");
		return {
			...snapshot,
			retentionExpiresAt: new Date(
				Math.min(Date.parse(before.grant.expiresAt), Date.parse(after.grant.expiresAt)),
			).toISOString(),
		};
	}
}
