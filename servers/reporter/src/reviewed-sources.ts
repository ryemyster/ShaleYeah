import { createHash } from "node:crypto";
import {
	type ReviewDecision,
	type ReviewRequest,
	type Scope,
	type TaskAssignment,
	type VersionedRef,
	validateContract,
	type WorkProduct,
} from "@shaleyeah/contracts";
import { type ReviewPrincipal, type ReviewSources, reviewJson } from "@shaleyeah/sdk";

export interface ReviewedReceipt {
	work: WorkProduct;
	task: TaskAssignment;
	request: ReviewRequest;
	decision: ReviewDecision;
	recipientScope: Scope;
	subjectId: string;
	current: boolean;
	expiresAt: string;
	operations: ("read" | "export")[];
	usagePolicy: VersionedRef;
	retentionPolicy: VersionedRef;
}
export class ReviewedSourceError extends Error {
	constructor(public readonly code: string) {
		super(`Reporter source blocked: ${code}`);
	}
}
const equal = (a: unknown, b: unknown) => reviewJson(a) === reviewJson(b);
export const businessEvidence = (work: WorkProduct) => ({
	id: `source.${createHash("sha256").update(reviewJson(work.artifact)).digest("hex").slice(0, 24)}.work`,
	uri: work.artifact.uri,
	revision: work.artifact.revision,
	hash: { algorithm: "sha256" as const, value: createHash("sha256").update(reviewJson(work)).digest("hex") },
	asOf: work.evidence.reduce(
		(oldest, item) => (Date.parse(item.asOf) < Date.parse(oldest) ? item.asOf : oldest),
		work.evidence[0]?.asOf ?? "",
	),
	accessClassification: "restricted" as const,
	usagePolicy: { id: "policy.reviewed-business-artifact", version: "r1" },
});

/** The installed authority adapter authenticates origin review and recipient rights.
 * Models supply references, never receipts, file paths, approval flags or authority callbacks.
 */
export class ReviewedSources implements ReviewSources {
	constructor(
		private readonly options: {
			scope: Scope;
			current: (id: string, principal: ReviewPrincipal) => Promise<unknown>;
			currentMetadata?: (id: string, principal: ReviewPrincipal) => Promise<unknown>;
			contentGuard: (text: string) => Promise<boolean>;
			clock?: () => Date;
			maxSourceAgeSeconds: number;
		},
	) {
		if (
			!Number.isSafeInteger(options.maxSourceAgeSeconds) ||
			options.maxSourceAgeSeconds < 1 ||
			options.maxSourceAgeSeconds > 31536000 ||
			typeof options.current !== "function" ||
			typeof options.contentGuard !== "function"
		)
			throw new ReviewedSourceError("configuration");
	}
	request(id: string) {
		if (!/^[a-z][a-z0-9._:-]{0,127}$/.test(id)) throw new ReviewedSourceError("invalid_reference");
		return id;
	}
	async metadata(id: string, principal: ReviewPrincipal, operation: "read" | "export") {
		this.request(id);
		if (!["read", "export"].includes(operation)) throw new ReviewedSourceError("access_denied");
		try {
			const receipt = await this.verified(id, principal);
			const evidence = businessEvidence(receipt.work);
			if (id === evidence.id)
				return {
					subjectId: principal.subjectId,
					scope: this.options.scope,
					allowed: true,
					operations: receipt.operations,
					evidence,
					retentionExpiresAt: receipt.expiresAt,
					metadataOnly: true,
				};
		} catch {
			/* An underlying evidence reference needs the separate grant below. */
		}
		if (!this.options.currentMetadata) throw new ReviewedSourceError("access_denied");
		try {
			const grant = (await this.options.currentMetadata(id, principal)) as {
				workRef: WorkProduct["artifact"];
				evidence: WorkProduct["evidence"][number];
				subjectId: string;
				recipientScope: Scope;
				operations: string[];
				current: boolean;
				expiresAt: string;
			};
			const receipt = await this.verified(grant.workRef.id, principal);
			const now = (this.options.clock?.() ?? new Date()).getTime();
			if (
				grant.current !== true ||
				grant.subjectId !== principal.subjectId ||
				!equal(grant.recipientScope, this.options.scope) ||
				!equal(grant.workRef, receipt.work.artifact) ||
				grant.evidence.id !== id ||
				!receipt.work.evidence.some((evidence) => equal(evidence, grant.evidence)) ||
				!Array.isArray(grant.operations) ||
				grant.operations.some((op) => !["read", "export"].includes(op)) ||
				!grant.operations.includes(operation) ||
				!Number.isFinite(Date.parse(grant.expiresAt)) ||
				Date.parse(grant.expiresAt) <= now
			)
				throw new ReviewedSourceError("access_denied");
			return {
				subjectId: principal.subjectId,
				scope: this.options.scope,
				allowed: true,
				operations: grant.operations,
				evidence: grant.evidence,
				retentionExpiresAt: new Date(
					Math.min(Date.parse(grant.expiresAt), Date.parse(receipt.expiresAt)),
				).toISOString(),
				metadataOnly: true,
			};
		} catch (error) {
			if (error instanceof ReviewedSourceError) throw error;
			throw new ReviewedSourceError("access_denied");
		}
	}
	async verified(id: string, principal: ReviewPrincipal, signal?: AbortSignal): Promise<ReviewedReceipt> {
		try {
			this.request(id);
			if (signal?.aborted) throw new ReviewedSourceError("cancelled");
			const now = (this.options.clock?.() ?? new Date()).getTime();
			const receipt = (await this.options.current(id, principal)) as ReviewedReceipt;
			const { work, task, request, decision } = receipt;
			for (const record of [work, task, request, decision]) validateContract(record);
			if (
				work.kind !== "work-product" ||
				task.kind !== "task-assignment" ||
				request.kind !== "review-request" ||
				decision.kind !== "review-decision" ||
				work.status !== "final" ||
				work.review.status !== "approved" ||
				decision.decision !== "approve"
			)
				throw new ReviewedSourceError("approval_required");
			if (
				receipt.current !== true ||
				receipt.subjectId !== principal.subjectId ||
				principal.customerId !== this.options.scope.customerId ||
				principal.employeeId !== this.options.scope.employeeId ||
				!principal.scopes.includes("reporter:sources") ||
				!equal(receipt.recipientScope, this.options.scope) ||
				work.scope.customerId !== this.options.scope.customerId ||
				work.scope.assetId !== this.options.scope.assetId ||
				(work.artifact.id !== id && businessEvidence(work).id !== id) ||
				!receipt.operations.includes("read") ||
				!receipt.operations.includes("export")
			)
				throw new ReviewedSourceError("access_denied");
			if (!Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= now)
				throw new ReviewedSourceError("expired");
			if (
				!equal(work.scope, task.scope) ||
				!equal(request.scope, work.scope) ||
				!equal(decision.scope, work.scope) ||
				work.taskRevision !== task.revision ||
				request.taskRevision !== work.taskRevision ||
				decision.taskRevision !== work.taskRevision ||
				!equal(request.productRef, work.artifact) ||
				!equal(decision.productRef, work.artifact) ||
				!equal(decision.requestRef, { id: request.id, revision: request.revision }) ||
				!equal(decision.reviewer.authorityPolicy, request.reviewerPolicy) ||
				!work.review.decisionRefs.some((ref) => equal(ref, { id: decision.id, revision: decision.revision }))
			)
				throw new ReviewedSourceError("revision_mismatch");
			if (
				!equal(receipt.usagePolicy, { id: "policy.reviewed-business-artifact", version: "r1" }) ||
				!receipt.retentionPolicy?.id ||
				!receipt.retentionPolicy.version
			)
				throw new ReviewedSourceError("source_use_denied");
			if (
				!work.evidence.length ||
				work.evidence.some(
					(item) =>
						!Number.isFinite(Date.parse(item.asOf)) ||
						now < Date.parse(item.asOf) ||
						now - Date.parse(item.asOf) > this.options.maxSourceAgeSeconds * 1000,
				)
			)
				throw new ReviewedSourceError("stale_evidence");
			const bytes = reviewJson(receipt);
			if (Buffer.byteLength(bytes) > 8_000_000 || !(await this.options.contentGuard(bytes)))
				throw new ReviewedSourceError("unsafe_content");
			if (signal?.aborted) throw new ReviewedSourceError("cancelled");
			return structuredClone(receipt);
		} catch (error) {
			if (error instanceof ReviewedSourceError) throw error;
			throw new ReviewedSourceError("source_unavailable");
		}
	}
	async fetch(request: unknown, principal: ReviewPrincipal, signal?: AbortSignal) {
		if (typeof request !== "string") throw new ReviewedSourceError("invalid_reference");
		const receipt = await this.verified(request, principal, signal);
		return {
			artifact: {
				kind: "reviewed-business-artifact" as const,
				artifact: receipt.work.artifact,
				evidence: businessEvidence(receipt.work),
				sharedKnowledge: {
					artifact: receipt.work.artifact,
					origin: receipt.work.scope,
					evidence: receipt.work.evidence,
					reviewDecisionRef: { id: receipt.decision.id, revision: receipt.decision.revision },
					usagePolicy: receipt.usagePolicy,
					retentionPolicy: receipt.retentionPolicy,
				},
			},
			bytes: new TextEncoder().encode(reviewJson(receipt.work)),
		};
	}
}
