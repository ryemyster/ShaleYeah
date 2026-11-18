import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateContract, validateSourceContract } from "@shaleyeah/contracts";
import {
	bindMCPEvents,
	createFileModelCredentialResolver,
	createJsonlSink,
	createQualificationGuard,
	EventEmitter,
	readPrivateJson,
	readPrivateText,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { parseRiskReviewPolicy, RiskReviewWorkflow } from "./review-workflow.js";
import { RiskAssessmentError, RiskAssessmentService, riskRefSchema } from "./risk-service.js";

const enrolled = z.object({ uid: z.number().int().nonnegative(), subjectId: z.string().min(1).max(128) }).strict();
const schema = z
	.object({
		version: z.literal("0.1.0"),
		sourceAuthority: z.literal("operator-attested-export"),
		qualification: z.enum(["fixture", "live"]),
		directory: z.string().min(1).max(4096),
		auditFile: z.string().min(1).max(4096),
		correlation: z.object({ runId: z.string().min(1).max(128), traceId: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
		task: z.unknown(),
		registerSourceRef: riskRefSchema,
		policySourceRef: riskRefSchema,
		scenariosSourceRef: riskRefSchema,
		sources: z
			.array(z.object({ file: z.string().min(1).max(4096), artifact: z.unknown() }).strict())
			.min(3)
			.max(3),
		sourceGrant: z
			.object({
				subjectId: z.string().min(1).max(128),
				sourceIds: z.array(z.string().min(1).max(128)).min(1).max(3),
				expiresAt: z.iso.datetime(),
				revoked: z.boolean(),
			})
			.strict(),
		sourceOperations: z
			.array(z.enum(["read", "export"]))
			.min(1)
			.max(2),
		localOperator: enrolled,
		sensitiveFiles: z.array(z.string().min(1).max(4096)).max(32),
		maxSourceAgeSeconds: z.number().int().min(1).max(31536000),
		review: z
			.object({
				policy: z.unknown(),
				localReviewer: enrolled,
				qualificationConfigFile: z.string().min(1).max(4096).optional(),
			})
			.strict()
			.optional(),
	})
	.strict();

/** Private local exports attest upstream source rights. Hosted operators inject their own current authorities. */
export async function loadRiskBinding(file: string, options: { clock?: () => Date } = {}) {
	const read = async () => schema.parse(await readPrivateJson(file, 8_000_000));
	const initial = await read(),
		task = validateContract(initial.task);
	if (task.kind !== "task-assignment") throw new RiskAssessmentError("task_required");
	const sourceRecords = initial.sources.map((entry) =>
		validateSourceContract(entry.artifact, { expectedScope: task.scope, expectedTaskRevision: task.revision }),
	);
	const owner = { customerId: task.scope.customerId, employeeId: task.scope.employeeId };
	if (
		!path.isAbsolute(file) ||
		![
			initial.directory,
			initial.auditFile,
			...initial.sensitiveFiles,
			...initial.sources.map((entry) => entry.file),
			...(initial.review?.qualificationConfigFile ? [initial.review.qualificationConfigFile] : []),
		].every(path.isAbsolute) ||
		path.dirname(initial.auditFile) !== initial.directory
	)
		throw new RiskAssessmentError("configuration");
	if (
		sourceRecords.some((record) => record.kind !== "source-artifact" || record.format !== "json") ||
		new Set(sourceRecords.map((record) => (record.kind === "source-artifact" ? record.artifact.id : ""))).size !== 3
	)
		throw new RiskAssessmentError("configuration");
	const current = async () => {
		const value = await read(),
			activeTask = validateContract(value.task);
		if (
			activeTask.kind !== "task-assignment" ||
			reviewJson(activeTask) !== reviewJson(task) ||
			value.directory !== initial.directory ||
			value.auditFile !== initial.auditFile ||
			value.qualification !== initial.qualification ||
			value.maxSourceAgeSeconds !== initial.maxSourceAgeSeconds ||
			reviewJson(value.correlation) !== reviewJson(initial.correlation) ||
			reviewJson(value.localOperator) !== reviewJson(initial.localOperator) ||
			reviewJson(value.sources) !== reviewJson(initial.sources) ||
			reviewJson(value.sensitiveFiles) !== reviewJson(initial.sensitiveFiles) ||
			Boolean(value.review) !== Boolean(initial.review) ||
			value.review?.qualificationConfigFile !== initial.review?.qualificationConfigFile
		)
			throw new RiskAssessmentError("configuration_changed");
		if (
			!process.getuid ||
			process.getuid() !== value.localOperator.uid ||
			value.sourceGrant.subjectId !== value.localOperator.subjectId
		)
			throw new RiskAssessmentError("access_denied");
		if (
			value.sourceGrant.revoked ||
			Date.parse(value.sourceGrant.expiresAt) <= (options.clock?.() ?? new Date()).getTime()
		)
			throw new RiskAssessmentError("authority_denied");
		if (value.review) {
			const policy = parseRiskReviewPolicy(value.review.policy);
			if (
				reviewJson(policy.task) !== reviewJson(task) ||
				policy.qualification !== value.qualification ||
				policy.requester.subjectId !== value.localOperator.subjectId
			)
				throw new RiskAssessmentError("configuration");
		}
		return { ...value, task: activeTask };
	};
	await current();
	await fs.mkdir(initial.directory, { recursive: true, mode: 0o700 });
	const directory = await fs.lstat(initial.directory);
	if (
		!directory.isDirectory() ||
		directory.isSymbolicLink() ||
		directory.mode & 0o077 ||
		(process.getuid && directory.uid !== process.getuid()) ||
		(await fs.realpath(initial.directory)) !== initial.directory
	)
		throw new RiskAssessmentError("storage_policy");
	const resolve = createFileModelCredentialResolver(owner);
	const secrets = async () =>
		Promise.all(
			(await current()).sensitiveFiles.map((secretFile) => resolve(owner, `file:${secretFile}`, "synthesis")),
		);
	const contentGuard = async (text: string) =>
		!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) &&
		(await secrets()).every((secret) => !text.includes(secret));
	const emitter = new EventEmitter({
		context: {
			scope: task.scope,
			taskRevision: task.revision,
			...initial.correlation,
			qualification: initial.qualification,
		},
		producer: { id: "risk-analysis", version: "0.1.0" },
		sink: createJsonlSink(initial.auditFile),
		required: true,
		sensitiveValues: await secrets(),
		clock: options.clock ? () => options.clock!().toISOString() : undefined,
	});
	const service = new RiskAssessmentService({
		current: async () => {
			const value = await current();
			return {
				task: value.task,
				registerSourceRef: value.registerSourceRef,
				policySourceRef: value.policySourceRef,
				scenariosSourceRef: value.scenariosSourceRef,
				authorityRevision: createHash("sha256")
					.update(reviewJson({ grant: value.sourceGrant, sourceOperations: value.sourceOperations }))
					.digest("hex"),
			};
		},
		fetchSource: async (reference, who, operation, signal) => {
			const value = await current();
			if (
				who.subjectId !== value.localOperator.subjectId ||
				who.customerId !== owner.customerId ||
				who.employeeId !== owner.employeeId ||
				!value.sourceOperations.includes(operation)
			)
				throw new RiskAssessmentError("source_use_denied");
			if (
				!who.scopes.includes("source:read") ||
				!who.scopes.includes("risk:read") ||
				!value.sourceGrant.sourceIds.includes(reference.id)
			)
				throw new RiskAssessmentError("access_denied");
			const entry = value.sources.find((entry) => {
				const source = validateSourceContract(entry.artifact);
				return (
					source.kind === "source-artifact" &&
					source.artifact.id === reference.id &&
					source.artifact.revision === reference.revision
				);
			});
			if (!entry) throw new RiskAssessmentError("revision_mismatch");
			const artifact = validateSourceContract(entry.artifact, {
				expectedScope: task.scope,
				expectedTaskRevision: task.revision,
			});
			if (artifact.kind !== "source-artifact" || artifact.format !== "json")
				throw new RiskAssessmentError("source_unavailable");
			await emitter.emit("source", "started", {
				refs: [
					{ kind: "source", id: reference.id, revision: reference.revision, sha256: artifact.evidence.hash.value },
				],
			});
			const bytes = Buffer.from(await readPrivateText(entry.file, 8_000_000));
			if (signal?.aborted) throw new RiskAssessmentError("cancelled");
			if (
				createHash("sha256").update(bytes).digest("hex") !== artifact.evidence.hash.value ||
				bytes.byteLength !== artifact.byteLength
			)
				throw new RiskAssessmentError("revision_mismatch");
			await emitter.emit("source", "succeeded", {
				refs: [
					{ kind: "source", id: reference.id, revision: reference.revision, sha256: artifact.evidence.hash.value },
				],
			});
			const after = await current();
			if (!after.sourceOperations.includes(operation) || !after.sourceGrant.sourceIds.includes(reference.id))
				throw new RiskAssessmentError("source_use_denied");
			const result = { bytes, artifact };
			return result;
		},
		contentGuard,
		maxSourceAgeSeconds: initial.maxSourceAgeSeconds,
		clock: options.clock,
	});
	let workflow: RiskReviewWorkflow | undefined;
	try {
		if (initial.review)
			workflow = new RiskReviewWorkflow(path.join(initial.directory, "review"), {
				service,
				currentPolicy: async () => (await current()).review!.policy,
				contentGuard,
				clock: options.clock,
				qualificationGuard: initial.review.qualificationConfigFile
					? createQualificationGuard(initial.review.qualificationConfigFile)
					: undefined,
			});
		return {
			service,
			reviewWorkflow: workflow,
			localPrincipal: initial.review
				? parseRiskReviewPolicy(initial.review.policy).requester
				: {
						subjectId: initial.localOperator.subjectId,
						...owner,
						scopes: ["risk:read", "source:read"],
					},
			reviewer: initial.review
				? async () => {
						const review = (await current()).review!,
							policy = parseRiskReviewPolicy(review.policy);
						if (
							!process.getuid ||
							process.getuid() !== review.localReviewer.uid ||
							!policy.reviewerIds.includes(review.localReviewer.subjectId)
						)
							throw new RiskAssessmentError("authority_denied");
						return { subjectId: review.localReviewer.subjectId, ...owner, scopes: ["risk:human-review"] };
					}
				: undefined,
			events: bindMCPEvents(emitter),
			dataPath: initial.directory,
			close: () => workflow?.close(),
		};
	} catch (error) {
		workflow?.close();
		throw error;
	}
}
