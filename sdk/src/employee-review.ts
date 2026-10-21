import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	type ContextManifest,
	type ReviewDecision,
	type ReviewRequest,
	type SharedKnowledgeRef,
	type TaskAssignment,
	validateContract,
	type WorkProduct,
} from "@shaleyeah/contracts";
import { redactEvent } from "@shaleyeah/contracts/events";
import { z } from "zod";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9_.:/-]+$/);
const versioned = z.object({ id, version: id }).strict();
const principalSchema = z
	.object({ subjectId: id, customerId: id, employeeId: id, scopes: z.array(id).min(1).max(256) })
	.strict();
const policySchema = z
	.object({
		version: z.literal("0.1.0"),
		qualification: z.enum(["fixture", "live"]).default("fixture"),
		id,
		revision: id,
		task: z.unknown(),
		requester: principalSchema,
		reviewerIds: z.array(id).min(1).max(32),
		operation: id,
		destination: id,
		expiresAt: z.iso.datetime(),
		grantTtlSeconds: z.number().int().min(1).max(86400),
		maxPacketBytes: z.number().int().min(1024).max(8_000_000),
		maxRecords: z.number().int().min(1).max(10000),
		revoked: z.boolean(),
		requiredGates: z.array(z.enum(["no-blockers", "evidence-present", "eval-present"])),
		allowedUsagePolicies: z.array(versioned).min(1).max(32),
		contextPolicy: versioned,
		retentionPolicy: versioned,
	})
	.strict();
export type ReviewPolicy = Omit<z.infer<typeof policySchema>, "task"> & { task: TaskAssignment };
export const reviewExecutionSchema = z
	.object({ reviewId: id, packetDigest: z.string().regex(/^[a-f0-9]{64}$/), grantId: id })
	.strict();
const reviewMeasurements = z
	.object({
		humanReviewSeconds: z.number().min(0).max(86400).optional(),
		corrections: z.number().int().min(0).max(1000000).optional(),
	})
	.strict();
export interface ReviewCandidate {
	work: unknown;
	context: unknown;
	evaluations: { id: string; revision: string; result: string; failures: string[] }[];
	[key: string]: unknown;
}
type Candidate = ReviewCandidate & { work: WorkProduct; context: ContextManifest };
export interface ReviewPrincipal {
	subjectId: string;
	customerId: string;
	employeeId: string;
	scopes: readonly string[];
}
export interface ReviewSourceSnapshot {
	artifact: {
		artifact: WorkProduct["artifact"];
		evidence: WorkProduct["evidence"][number];
		retrievedAt?: string;
		sharedKnowledge?: SharedKnowledgeRef;
	};
	bytes: Uint8Array;
}
export interface ReviewSources {
	request(id: string): unknown;
	fetch(request: unknown, principal: ReviewPrincipal, signal?: AbortSignal): Promise<ReviewSourceSnapshot>;
}
export interface ReviewRoleAdapter {
	id: string;
	operation: string;
	destination: string;
	humanScope: string;
	employeeScopes: string[];
	packetVersion: string;
	requestedDecision: string;
	payloadKey: string;
	parseCandidate(input: unknown): ReviewCandidate;
	payload(candidate: ReviewCandidate): unknown;
	sourceId(candidate: ReviewCandidate): string;
	validateCandidate?(candidate: ReviewCandidate, policy: ReviewPolicy, sources: ReviewSourceSnapshot[]): Promise<void>;
	validateContext?(context: ContextManifest, work: WorkProduct, sources: ReviewSourceSnapshot[]): void;
}
type State = "awaiting-review" | "changes-requested" | "approved" | "completed" | "rejected" | "superseded" | "expired";
interface Packet extends Candidate {
	version: string;
	task: TaskAssignment;
	requester: ReviewPrincipal;
	policyDigest: string;
	sources: { artifact: ReviewSourceSnapshot["artifact"]; text: string }[];
	action: { operation: string; destination: string; arguments: unknown };
	request: ReviewRequest;
	expiresAt: string;
}
interface Row {
	id: string;
	digest: string;
	namespace: string;
	packet: string | null;
	state: State;
	grant: string | null;
	decision: string | null;
	outcome: string | null;
	expires: string;
	qualification_hash: string | null;
}
export interface QualificationInput {
	packetDigest: string;
	workProduct: WorkProduct;
	qualification: "fixture" | "live";
}
export interface EmployeeReviewOptions {
	/** Trusted verifier, never selected from role/model arguments. Required before approve/execute. */
	qualificationGuard?: (input: QualificationInput, signal?: AbortSignal) => Promise<unknown>;
	maxAuditRecords?: number;
	sources: ReviewSources;
	currentPolicy: () => Promise<unknown>;
	/** Trusted host scanner: reject secrets before persistence or any preview. No model-selected guard. */
	contentGuard: (text: string) => Promise<boolean>;
	clock?: () => Date;
	/** Host test/failure-injection seam; never part of the wire/config protocol. */
	beforeCommit?: (stage: string) => void;
}
export class ReviewError extends Error {
	constructor(public readonly code: string) {
		super(`Employee review blocked: ${code}`);
		this.name = "ReviewError";
	}
}
function deny(code: string): never {
	throw new ReviewError(code);
}
/** Versioned JSON representation, sorted object keys, ordered arrays, finite JSON values only. */
export function reviewJson(value: unknown, depth = 0): string {
	if (depth > 64) deny("invalid_packet");
	if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => reviewJson(item, depth + 1)).join(",")}]`;
	if (typeof value === "object" && value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${reviewJson((value as Record<string, unknown>)[key], depth + 1)}`)
			.join(",")}}`;
	}
	return deny("invalid_packet");
}
const digest = (value: unknown) => createHash("sha256").update(reviewJson(value)).digest("hex");
const equal = (left: unknown, right: unknown) => reviewJson(left) === reviewJson(right);
const expired = (timestamp: string, now: string) => Date.parse(timestamp) <= Date.parse(now);

export function parseEmployeeReviewPolicy(value: unknown, role: ReviewRoleAdapter): ReviewPolicy {
	const parsed = policySchema.parse(value);
	if (!role || parsed.operation !== role.operation || parsed.destination !== role.destination) deny("invalid_policy");
	const task = validateContract(parsed.task);
	if (
		task.kind !== "task-assignment" ||
		parsed.requester.customerId !== task.scope.customerId ||
		parsed.requester.employeeId !== task.scope.employeeId ||
		parsed.reviewerIds.includes(parsed.requester.subjectId)
	)
		deny("invalid_policy");
	return { ...parsed, task };
}

/** Durable bounded supervision state. The executing backend owns this store; ADK messages grant nothing. */
export class EmployeeReviewWorkflow {
	private readonly db: DatabaseSync;
	private readonly root: string;
	private readonly rootIdentity: { dev: number; ino: number };
	private readonly fileIdentity: { dev: number; ino: number };
	private closed = false;
	constructor(
		directory: string,
		private readonly options: EmployeeReviewOptions,
		private readonly role: ReviewRoleAdapter,
	) {
		if (
			!role ||
			typeof role.parseCandidate !== "function" ||
			typeof role.payload !== "function" ||
			typeof role.sourceId !== "function" ||
			!role.employeeScopes.length ||
			typeof options.contentGuard !== "function" ||
			typeof options.currentPolicy !== "function"
		)
			deny("configuration");
		if (
			!Number.isSafeInteger(options.maxAuditRecords ?? 100000) ||
			(options.maxAuditRecords ?? 100000) < 1 ||
			(options.maxAuditRecords ?? 100000) > 1000000
		)
			deny("configuration");
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		const root = lstatSync(directory);
		if (
			!root.isDirectory() ||
			root.isSymbolicLink() ||
			root.mode & 0o077 ||
			(process.getuid && root.uid !== process.getuid())
		)
			deny("storage_policy");
		this.root = realpathSync(directory);
		this.rootIdentity = { dev: root.dev, ino: root.ino };
		const file = path.join(this.root, "review.sqlite");
		const fd = openSync(
			file,
			constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
			0o600,
		);
		try {
			const stat = fstatSync(fd);
			if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid()))
				deny("storage_policy");
			this.fileIdentity = { dev: stat.dev, ino: stat.ino };
		} finally {
			closeSync(fd);
		}
		this.db = new DatabaseSync(file);
		this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, digest TEXT NOT NULL, namespace TEXT NOT NULL, packet TEXT, state TEXT NOT NULL, grant TEXT, decision TEXT, outcome TEXT, expires TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS heads(namespace TEXT PRIMARY KEY, digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS artifacts(identity TEXT PRIMARY KEY, digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS findings(id TEXT PRIMARY KEY, review_id TEXT UNIQUE NOT NULL, body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, body TEXT NOT NULL);`);
		if (
			!this.db
				.prepare("PRAGMA table_info(reviews)")
				.all()
				.some((column) => column.name === "qualification_hash")
		)
			this.db.exec("ALTER TABLE reviews ADD COLUMN qualification_hash TEXT");
		this.storage();
	}
	close() {
		if (!this.closed) {
			this.db.close();
			this.closed = true;
		}
	}
	private now() {
		return (this.options.clock?.() ?? new Date()).toISOString();
	}
	private storage() {
		if (this.closed) deny("storage_unavailable");
		for (const [file, identity, directory] of [
			[this.root, this.rootIdentity, true],
			[path.join(this.root, "review.sqlite"), this.fileIdentity, false],
		] as const) {
			const stat = lstatSync(file);
			if (
				stat.dev !== identity.dev ||
				stat.ino !== identity.ino ||
				stat.isSymbolicLink() ||
				stat.mode & 0o077 ||
				(process.getuid && stat.uid !== process.getuid()) ||
				(directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)
			)
				deny("storage_policy");
		}
	}
	private transaction<T>(stage: string, run: () => T): T {
		this.storage();
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const value = run();
			this.options.beforeCommit?.(stage);
			this.db.exec("COMMIT");
			return value;
		} catch (error) {
			this.db.exec("ROLLBACK");
			if (error instanceof ReviewError) throw error;
			return deny("audit_unavailable");
		}
	}
	private audit(operation: string, outcome: string, who: ReviewPrincipal, reviewId?: string) {
		if (
			Number(this.db.prepare("SELECT COUNT(*) AS count FROM audit").get()?.count) >=
			(this.options.maxAuditRecords ?? 100000)
		)
			deny("audit_capacity");
		const row = reviewId ? this.db.prepare("SELECT namespace,digest FROM reviews WHERE id=?").get(reviewId) : undefined;
		const event = {
			id: randomUUID(),
			observedAt: this.now(),
			operation,
			outcome,
			principalRef: digest({ subjectId: who.subjectId, customerId: who.customerId }),
			...(reviewId ? { reviewRef: digest(reviewId) } : {}),
			...(row ? { scopeRef: row.namespace, packetDigest: row.digest } : {}),
		};
		this.db.prepare("INSERT INTO audit VALUES (?, ?)").run(event.id, reviewJson(event));
	}
	private async guarded<T>(operation: string, who: ReviewPrincipal, run: () => Promise<T>): Promise<T> {
		try {
			return await run();
		} catch (error) {
			const code = error instanceof ReviewError ? error.code : "verification_unavailable";
			this.transaction("deny", () => this.audit(operation, code, who));
			return deny(code);
		}
	}
	private async policy() {
		this.storage();
		const policy = parseEmployeeReviewPolicy(await this.options.currentPolicy(), this.role);
		if (
			policy.revoked ||
			expired(policy.expiresAt, this.now()) ||
			["cancelled", "failed", "completed"].includes(policy.task.status)
		)
			deny("authority_denied");
		return policy;
	}
	private namespace(policy: ReviewPolicy) {
		return digest({ scope: policy.task.scope, subjectId: policy.requester.subjectId });
	}
	private identity(who: ReviewPrincipal, policy: ReviewPolicy, human: boolean) {
		const principal = principalSchema.parse(who);
		if (
			principal.customerId !== policy.task.scope.customerId ||
			principal.employeeId !== policy.task.scope.employeeId ||
			(human
				? !policy.reviewerIds.includes(principal.subjectId) || !principal.scopes.includes(this.role.humanScope)
				: principal.subjectId !== policy.requester.subjectId ||
					policy.requester.scopes.some((scope) => !principal.scopes.includes(scope)) ||
					this.role.employeeScopes.some(
						(scope) => !principal.scopes.includes(scope) || !policy.requester.scopes.includes(scope),
					))
		)
			deny("authority_denied");
	}
	private row(reviewId: string): Row {
		id.parse(reviewId);
		this.storage();
		const row = this.db.prepare("SELECT * FROM reviews WHERE id=?").get(reviewId) as unknown as Row | undefined;
		if (!row) deny("review_unavailable");
		return row;
	}
	private head(namespace: string): string | null {
		return (
			(this.db.prepare("SELECT digest FROM heads WHERE namespace=?").get(namespace)?.digest as string | undefined) ??
			null
		);
	}
	private packet(row: Row): Packet {
		if (!row.packet) deny("expired");
		const packet: Packet = JSON.parse(row.packet);
		if (digest(packet) !== row.digest) deny("integrity_mismatch");
		return packet;
	}
	private receipt(row: Row) {
		return {
			reviewId: row.id,
			packetDigest: row.digest,
			state: row.state,
			expiresAt: row.expires,
			...(row.grant && ["approved", "completed"].includes(row.state) ? { grantId: row.grant } : {}),
			...(row.outcome ? { outcome: JSON.parse(row.outcome) } : {}),
		};
	}
	private async fresh(row: Row, policy: ReviewPolicy, signal?: AbortSignal) {
		const packet = this.packet(row);
		if (
			packet.version !== this.role.packetVersion ||
			row.namespace !== this.namespace(policy) ||
			packet.policyDigest !== digest(policy) ||
			row.digest !== this.head(row.namespace)
		)
			deny("revision_mismatch");
		if (expired(row.expires, this.now()) || expired(packet.context.retention.expiresAt, this.now())) deny("expired");
		const sources = await this.sources(packet.work, policy, signal);
		this.validateContext(
			packet.context,
			packet.work,
			sources.map(({ artifact, text }) => ({ artifact, bytes: new TextEncoder().encode(text) })),
		);
		if (this.role.validateCandidate)
			await this.role.validateCandidate(
				{
					work: packet.work,
					context: packet.context,
					evaluations: packet.evaluations,
					[this.role.payloadKey]: packet[this.role.payloadKey],
				},
				policy,
				sources.map(({ artifact, text }) => ({ artifact, bytes: new TextEncoder().encode(text) })),
			);
		const stable = (values: Packet["sources"]) =>
			values.map(({ artifact, text }) => ({ artifact: { ...artifact, retrievedAt: artifact.evidence.asOf }, text }));
		if (!equal(stable(sources), stable(packet.sources))) deny("source_changed");
		if (!(await this.options.contentGuard(reviewJson(packet)))) deny("unsafe_content");
		// No asynchronous action follows this final policy check before the local transaction.
		if (!equal(await this.policy(), policy)) deny("revision_mismatch");
		return packet;
	}
	private async sources(work: WorkProduct, policy: ReviewPolicy, signal?: AbortSignal) {
		if (!work.evidence.length || work.evidence.length > 32) deny("missing_evidence");
		const sources = [];
		let totalBytes = 0;
		for (const evidence of work.evidence) {
			if (!policy.allowedUsagePolicies.some((permitted) => equal(permitted, evidence.usagePolicy)))
				deny("source_use_denied");
			const fetched = await this.options.sources.fetch(
				this.options.sources.request(evidence.id),
				policy.requester,
				signal,
			);
			totalBytes += fetched.bytes.byteLength;
			if (totalBytes > policy.maxPacketBytes) deny("packet_limit");
			if (!equal(fetched.artifact.evidence, evidence)) deny("source_changed");
			sources.push({
				artifact: fetched.artifact,
				text: new TextDecoder("utf-8", { fatal: true }).decode(fetched.bytes),
			});
		}
		return sources;
	}
	private validateContext(context: ContextManifest, work: WorkProduct, sources: ReviewSourceSnapshot[]) {
		if (this.role.validateContext) this.role.validateContext(context, work, sources);
		else if (!equal(context.selectedEvidence, work.evidence) || context.sharedKnowledge.length)
			deny("unverified_inputs");
	}
	async prepare(input: unknown, who: ReviewPrincipal, expectedHead: string | null, signal?: AbortSignal) {
		return this.guarded("prepare", who, async () => {
			if (signal?.aborted) deny("cancelled");
			const policy = await this.policy();
			this.identity(who, policy, false);
			if (Buffer.byteLength(reviewJson(input)) > policy.maxPacketBytes) deny("packet_limit");
			const candidate = this.role.parseCandidate(input);
			const expected = { expectedScope: policy.task.scope, expectedTaskRevision: policy.task.revision };
			const work = validateContract(candidate.work, expected);
			const context = validateContract(candidate.context, expected);
			if (
				work.kind !== "work-product" ||
				context.kind !== "context-manifest" ||
				work.status !== "ready_for_review" ||
				work.review.status !== "unreviewed" ||
				work.review.decisionRefs.length
			)
				deny("invalid_draft");
			if (
				!equal(work.inputs, policy.task.inputs) ||
				!equal(context.contextPolicy, policy.contextPolicy) ||
				!equal(context.retention.policy, policy.retentionPolicy) ||
				context.workingArtifactRefs.some((ref) => !equal(ref, work.artifact)) ||
				expired(context.retention.expiresAt, this.now())
			)
				deny("unverified_inputs");
			const sources = await this.sources(work, policy, signal);
			this.validateContext(
				context,
				work,
				sources.map(({ artifact, text }) => ({ artifact, bytes: new TextEncoder().encode(text) })),
			);
			if (this.role.validateCandidate)
				await this.role.validateCandidate(
					{ ...candidate, work, context },
					policy,
					sources.map(({ artifact, text }) => ({ artifact, bytes: new TextEncoder().encode(text) })),
				);
			if (
				!equal(
					sources.map((source) => source.artifact.artifact),
					policy.task.inputs,
				) ||
				!work.evidence.some((source) => source.id === this.role.sourceId(candidate))
			)
				deny("unverified_inputs");
			const request: ReviewRequest = {
				contractVersion: "0.1.0",
				kind: "review-request",
				id: `review.${randomUUID()}`,
				revision: "r1",
				scope: policy.task.scope,
				taskRevision: policy.task.revision,
				productRef: work.artifact,
				requestedDecision: this.role.requestedDecision,
				reviewerPolicy: { id: policy.id, version: policy.revision },
				createdAt: this.now(),
			};
			validateContract(request);
			const expiresAt = new Date(
				Math.min(
					Date.parse(policy.expiresAt),
					Date.parse(context.retention.expiresAt),
					Date.parse(this.now()) + policy.grantTtlSeconds * 1000,
				),
			).toISOString();
			const packet: Packet = {
				...candidate,
				work,
				context,
				version: this.role.packetVersion,
				task: policy.task,
				requester: policy.requester,
				policyDigest: digest(policy),
				sources,
				action: {
					operation: this.role.operation,
					destination: policy.destination,
					arguments: this.role.payload(candidate),
				},
				request,
				expiresAt,
			};
			const bytes = reviewJson(packet);
			if (Buffer.byteLength(bytes) > policy.maxPacketBytes) deny("packet_limit");
			if (!(await this.options.contentGuard(bytes))) deny("unsafe_content");
			if (!equal(await this.policy(), policy)) deny("revision_mismatch");
			if (signal?.aborted) deny("cancelled");
			return this.transaction("prepare", () => {
				const namespace = this.namespace(policy);
				if (this.head(namespace) !== expectedHead) deny("revision_mismatch");
				if (Number(this.db.prepare("SELECT COUNT(*) AS count FROM reviews").get()?.count) >= policy.maxRecords)
					deny("store_limit");
				const identity = digest({ namespace, id: work.artifact.id, revision: work.artifact.revision });
				const known = this.db.prepare("SELECT digest FROM artifacts WHERE identity=?").get(identity);
				if (known && known.digest !== digest(work)) deny("immutable_revision");
				this.db.prepare("INSERT OR IGNORE INTO artifacts VALUES (?,?)").run(identity, digest(work));
				this.db
					.prepare("UPDATE reviews SET state='superseded', grant=NULL WHERE namespace=? AND state!='completed'")
					.run(namespace);
				const packetDigest = digest(packet);
				this.db
					.prepare(
						"INSERT INTO reviews(id,digest,namespace,packet,state,grant,decision,outcome,expires) VALUES (?,?,?,?,?,NULL,NULL,NULL,?)",
					)
					.run(request.id, packetDigest, namespace, bytes, "awaiting-review", expiresAt);
				this.db
					.prepare("INSERT INTO heads VALUES (?,?) ON CONFLICT(namespace) DO UPDATE SET digest=excluded.digest")
					.run(namespace, packetDigest);
				this.audit("prepare", "awaiting-review", who, request.id);
				return this.receipt(this.row(request.id));
			});
		});
	}
	async inspect(reviewId: string, reviewer: ReviewPrincipal) {
		return this.guarded("inspect", reviewer, async () => {
			const policy = await this.policy();
			this.identity(reviewer, policy, true);
			const row = this.row(reviewId);
			const packet = await this.fresh(row, policy);
			this.transaction("inspect", () => {
				if (this.head(row.namespace) !== row.digest || expired(row.expires, this.now())) deny("revision_mismatch");
				this.audit("inspect", "allowed", reviewer, reviewId);
			});
			return { ...this.receipt(row), packet, ...(row.decision ? { decision: JSON.parse(row.decision) } : {}) };
		});
	}
	private async qualify(row: Row, packet: Packet, policy: ReviewPolicy, signal?: AbortSignal) {
		if (!this.options.qualificationGuard) deny("qualification_required");
		const value = await this.options.qualificationGuard(
			{ packetDigest: row.digest, workProduct: packet.work, qualification: policy.qualification },
			signal,
		);
		const receipt = z
			.object({
				schemaVersion: z.literal("0.1.0"),
				kind: z.literal("qualification-decision"),
				status: z.literal("passed"),
				promotionAllowed: z.literal(true),
				qualification: z.enum(["fixture", "live"]),
				codeRevision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
				profileHash: z.string().regex(/^[a-f0-9]{64}$/),
				policyHash: z.string().regex(/^[a-f0-9]{64}$/),
				expiresAt: z.iso.datetime({ offset: true }),
				promotionBinding: z
					.object({
						packetDigest: z.string(),
						workHash: z.string(),
						scope: z.unknown(),
						taskRevision: z.string(),
						productRef: z.unknown(),
						reportHash: z.string().regex(/^[a-f0-9]{64}$/),
					})
					.strict(),
			})
			.passthrough()
			.safeParse(value);
		if (!receipt.success) deny("qualification_blocked");
		const result = receipt.data;
		if (
			result.qualification !== policy.qualification ||
			expired(result.expiresAt, this.now()) ||
			result.promotionBinding.packetDigest !== row.digest ||
			result.promotionBinding.workHash !== digest(packet.work) ||
			!equal(result.promotionBinding.scope, packet.task.scope) ||
			result.promotionBinding.taskRevision !== packet.task.revision ||
			!equal(result.promotionBinding.productRef, {
				id: packet.work.artifact.id,
				revision: packet.work.artifact.revision,
			})
		)
			deny("qualification_binding_mismatch");
		if (Buffer.byteLength(reviewJson(result)) > 65536 || !(await this.options.contentGuard(reviewJson(result))))
			deny("unsafe_content");
		return { hash: digest(result), expiresAt: new Date(result.expiresAt).toISOString() };
	}
	async decide(
		reviewId: string,
		packetDigest: string,
		choice: ReviewDecision["decision"],
		reason: string,
		reviewer: ReviewPrincipal,
		measurements: { humanReviewSeconds?: number; corrections?: number } = {},
	) {
		return this.guarded("decide", reviewer, async () => {
			const policy = await this.policy();
			this.identity(reviewer, policy, true);
			z.enum(["approve", "reject", "request_changes"]).parse(choice);
			z.string().min(1).max(2048).parse(reason);
			const measured = reviewMeasurements.parse(measurements);
			const row = this.row(reviewId);
			const packet = await this.fresh(row, policy);
			if (row.digest !== packetDigest || row.state !== "awaiting-review") deny("revision_mismatch");
			if (!(await this.options.contentGuard(reason))) deny("unsafe_content");
			if (
				choice === "approve" &&
				policy.requiredGates.some((gate) =>
					gate === "no-blockers"
						? packet.work.blockers.length > 0 || packet.context.blockers.length > 0
						: gate === "evidence-present"
							? !packet.work.evidence.length
							: !packet.evaluations.length,
				)
			)
				deny("required_gate_failed");
			const qualification = choice === "approve" ? await this.qualify(row, packet, policy) : undefined;
			if (qualification) await this.fresh(row, policy);
			if (!equal(await this.policy(), policy)) deny("revision_mismatch");
			return this.transaction("decide", () => {
				if (
					this.row(reviewId).state !== "awaiting-review" ||
					this.head(row.namespace) !== row.digest ||
					expired(row.expires, this.now())
				)
					deny("revision_mismatch");
				const decision: ReviewDecision = {
					contractVersion: "0.1.0",
					kind: "review-decision",
					id: `decision.${randomUUID()}`,
					revision: "r1",
					scope: packet.task.scope,
					taskRevision: packet.task.revision,
					requestRef: { id: packet.request.id, revision: packet.request.revision },
					productRef: packet.work.artifact,
					decision: choice,
					reviewer: { principalId: reviewer.subjectId, authorityPolicy: packet.request.reviewerPolicy },
					reason,
					decidedAt: this.now(),
					auditRef: { id: `audit.${randomUUID()}`, revision: "r1" },
				};
				validateContract(decision);
				const state = choice === "approve" ? "approved" : choice === "reject" ? "rejected" : "changes-requested";
				this.db
					.prepare("UPDATE reviews SET state=?,grant=?,decision=?,qualification_hash=?,expires=? WHERE id=?")
					.run(
						state,
						choice === "approve" ? `grant.${randomUUID()}` : null,
						reviewJson(decision),
						qualification?.hash ?? null,
						qualification
							? new Date(Math.min(Date.parse(row.expires), Date.parse(qualification.expiresAt))).toISOString()
							: row.expires,
						reviewId,
					);
				this.audit("decide", state, reviewer, reviewId);
				if (
					Number(this.db.prepare("SELECT COUNT(*) AS count FROM audit").get()?.count) >=
					(this.options.maxAuditRecords ?? 100000)
				)
					deny("audit_capacity");
				const event = redactEvent({
					schemaVersion: "0.1.0",
					kind: "employee-event",
					eventId: decision.auditRef.id,
					streamId: reviewId,
					eventType: "review",
					status: choice === "approve" ? "approved" : choice === "reject" ? "rejected" : "revision-requested",
					observedAt: decision.decidedAt,
					producer: { id: `${this.role.id}-review`, version: "0.1.0" },
					sequence: 1,
					context: {
						runId: reviewId,
						traceId: digest(reviewId).slice(0, 32),
						scope: packet.task.scope,
						taskRevision: packet.task.revision,
						qualification: policy.qualification,
					},
					refs: [
						{
							kind: "review",
							id: packet.request.id,
							revision: packet.request.revision,
							sha256: digest(packet.request),
						},
						{ kind: "review", id: decision.id, revision: decision.revision, sha256: digest(decision) },
					],
					measurements: {
						...measured,
						reworkCount:
							Number(
								this.db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE namespace=?").get(row.namespace)?.count,
							) - 1,
					},
				});
				this.db.prepare("INSERT INTO audit VALUES (?,?)").run(decision.auditRef.id, reviewJson(event));
				return this.receipt(this.row(reviewId));
			});
		});
	}
	async status(reviewId: string | undefined, who: ReviewPrincipal) {
		return this.guarded("status", who, async () => {
			const policy = await this.policy();
			this.identity(who, policy, false);
			const currentId =
				reviewId ??
				this.db
					.prepare("SELECT id FROM reviews WHERE namespace=? AND digest=?")
					.get(this.namespace(policy), this.head(this.namespace(policy)))?.id;
			if (typeof currentId !== "string") deny("review_unavailable");
			const row = this.row(currentId);
			if (row.namespace !== this.namespace(policy)) deny("authority_denied");
			await this.fresh(row, policy);
			this.transaction("status", () => {
				if (this.head(row.namespace) !== row.digest || expired(row.expires, this.now())) deny("revision_mismatch");
				this.audit("status", row.state, who, row.id);
			});
			return this.receipt(row);
		});
	}
	async execute(input: unknown, who: ReviewPrincipal, signal?: AbortSignal) {
		return this.guarded(this.role.operation, who, async () => {
			if (signal?.aborted) deny("cancelled");
			const request = reviewExecutionSchema.parse(input);
			const policy = await this.policy();
			this.identity(who, policy, false);
			const row = this.row(request.reviewId);
			const packet = await this.fresh(row, policy, signal);
			if (
				row.digest !== request.packetDigest ||
				row.grant !== request.grantId ||
				!["approved", "completed"].includes(row.state) ||
				!row.decision
			)
				deny("approval_required");
			const decision: ReviewDecision = JSON.parse(row.decision);
			if (decision.decision !== "approve" || !policy.reviewerIds.includes(decision.reviewer.principalId))
				deny("authority_denied");
			const qualification = await this.qualify(row, packet, policy, signal);
			if (qualification.hash !== row.qualification_hash) deny("qualification_changed");
			await this.fresh(row, policy, signal);
			return this.transaction("execute", () => {
				if (signal?.aborted) deny("cancelled");
				const current = this.row(row.id);
				if (
					current.digest !== this.head(row.namespace) ||
					current.grant !== request.grantId ||
					!["approved", "completed"].includes(current.state) ||
					expired(current.expires, this.now())
				)
					deny("revision_mismatch");
				if (current.outcome) return JSON.parse(current.outcome) as { findingId: string; stored: boolean; uri: string };
				const result = { findingId: `finding.${row.id}`, stored: true, uri: `urn:${this.role.id}:${row.id}` };
				this.audit(this.role.operation, "prepared", who, row.id);
				this.db.prepare("INSERT INTO findings VALUES (?,?,?)").run(
					result.findingId,
					row.id,
					reviewJson({
						[this.role.payloadKey]: packet.action.arguments,
						work: packet.work,
						request: packet.request,
						decision,
						packetDigest: row.digest,
						savedAt: this.now(),
					}),
				);
				this.db.prepare("UPDATE reviews SET state='completed',outcome=? WHERE id=?").run(reviewJson(result), row.id);
				this.audit(this.role.operation, "completed", who, row.id);
				return result;
			});
		});
	}
	async purgeExpired(reviewer: ReviewPrincipal) {
		return this.guarded("purge", reviewer, async () => {
			const policy = parseEmployeeReviewPolicy(await this.options.currentPolicy(), this.role);
			this.identity(reviewer, policy, true);
			const count = this.transaction("purge", () => {
				const rows = this.db
					.prepare("SELECT id FROM reviews WHERE namespace=? AND expires<=? AND packet IS NOT NULL")
					.all(this.namespace(policy), this.now());
				for (const row of rows) {
					this.db.prepare("DELETE FROM findings WHERE review_id=?").run(row.id!);
					this.db
						.prepare("UPDATE reviews SET packet=NULL,decision=NULL,grant=NULL,state='expired' WHERE id=?")
						.run(row.id!);
				}
				this.audit("purge", "completed", reviewer);
				return rows.length;
			});
			this.db.exec("VACUUM");
			return count;
		});
	}
	findingCount() {
		this.storage();
		return Number(this.db.prepare("SELECT COUNT(*) AS count FROM findings").get()?.count);
	}
	auditRecords(limit = 1000, afterRow = 0): Record<string, unknown>[] {
		this.storage();
		if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(afterRow) || afterRow < 0)
			deny("invalid_limit");
		return this.db
			.prepare("SELECT body FROM audit WHERE rowid>? ORDER BY rowid LIMIT ?")
			.all(afterRow, limit)
			.map((row) => JSON.parse(row.body as string));
	}
}
