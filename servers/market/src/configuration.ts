import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateContract, validateSourceContract } from "@shaleyeah/contracts";
import {
	bindMCPEvents,
	createFileModelCredentialResolver,
	createJsonlSink,
	createModelRuntime,
	createQualificationGuard,
	EventEmitter,
	type ModelRuntime,
	readPrivateJson,
	readPrivateReferenceModelConfig,
	readPrivateText,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { marketRefSchema } from "./market-scenario.js";
import { MarketScenarioService, MarketServiceError } from "./market-service.js";
import { MarketReviewWorkflow, parseMarketReviewPolicy } from "./review-workflow.js";

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
		mandateSourceRef: marketRefSchema,
		seriesSourceRef: marketRefSchema,
		assumptionsSourceRef: marketRefSchema,
		sources: z.array(z.object({ file: z.string().min(1).max(4096), artifact: z.unknown() }).strict()).length(3),
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
		modelConfigFile: z.string().min(1).max(4096).optional(),
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

/** Private exports attest upstream source rights; hosted operators supply their own current authority. */
export async function loadMarketBinding(file: string, options: { clock?: () => Date } = {}) {
	const read = async () => schema.parse(await readPrivateJson(file, 8_000_000));
	const initial = await read(),
		task = validateContract(initial.task);
	if (task.kind !== "task-assignment") throw new MarketServiceError("task_required");
	const sourceRecords = initial.sources.map((entry) =>
		validateSourceContract(entry.artifact, { expectedScope: task.scope, expectedTaskRevision: task.revision }),
	);
	const owner = { customerId: task.scope.customerId, employeeId: task.scope.employeeId };
	const modelConfig = initial.modelConfigFile
		? await readPrivateReferenceModelConfig(initial.modelConfigFile)
		: undefined;
	if (
		modelConfig &&
		(modelConfig.synthesis.owner.customerId !== owner.customerId ||
			modelConfig.synthesis.owner.employeeId !== owner.employeeId)
	)
		throw new MarketServiceError("configuration");
	if (
		!path.isAbsolute(file) ||
		![
			initial.directory,
			initial.auditFile,
			...initial.sensitiveFiles,
			...initial.sources.map((entry) => entry.file),
			...(initial.review?.qualificationConfigFile ? [initial.review.qualificationConfigFile] : []),
			...(initial.modelConfigFile ? [initial.modelConfigFile] : []),
		].every(path.isAbsolute) ||
		path.dirname(initial.auditFile) !== initial.directory
	)
		throw new MarketServiceError("configuration");
	if (
		sourceRecords.some((record) => record.kind !== "source-artifact" || record.format !== "json") ||
		new Set(sourceRecords.map((record) => (record.kind === "source-artifact" ? record.artifact.id : ""))).size !== 3
	)
		throw new MarketServiceError("configuration");
	const selection = (value: z.infer<typeof schema>) => [
		value.mandateSourceRef,
		value.seriesSourceRef,
		value.assumptionsSourceRef,
	];
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
			value.modelConfigFile !== initial.modelConfigFile ||
			reviewJson(value.correlation) !== reviewJson(initial.correlation) ||
			reviewJson(value.localOperator) !== reviewJson(initial.localOperator) ||
			reviewJson(value.sources) !== reviewJson(initial.sources) ||
			reviewJson(selection(value)) !== reviewJson(selection(initial)) ||
			reviewJson(value.sensitiveFiles) !== reviewJson(initial.sensitiveFiles) ||
			Boolean(value.review) !== Boolean(initial.review) ||
			value.review?.qualificationConfigFile !== initial.review?.qualificationConfigFile
		)
			throw new MarketServiceError("configuration_changed");
		if (
			initial.modelConfigFile &&
			reviewJson(await readPrivateReferenceModelConfig(initial.modelConfigFile)) !== reviewJson(modelConfig)
		)
			throw new MarketServiceError("configuration_changed");
		if (
			!process.getuid ||
			process.getuid() !== value.localOperator.uid ||
			value.sourceGrant.subjectId !== value.localOperator.subjectId
		)
			throw new MarketServiceError("access_denied");
		if (
			value.sourceGrant.revoked ||
			Date.parse(value.sourceGrant.expiresAt) <= (options.clock?.() ?? new Date()).getTime()
		)
			throw new MarketServiceError("authority_denied");
		if (value.review) {
			const policy = parseMarketReviewPolicy(value.review.policy);
			if (
				reviewJson(policy.task) !== reviewJson(task) ||
				policy.qualification !== value.qualification ||
				policy.requester.subjectId !== value.localOperator.subjectId
			)
				throw new MarketServiceError("configuration");
		}
		// Re-read bytes even if the operator did not change the declared source revision.
		const fileHashes: string[] = [];
		let totalBytes = 0;
		for (const entry of value.sources) {
			const source = validateSourceContract(entry.artifact),
				bytes = Buffer.from(await readPrivateText(entry.file, 8_000_000)),
				hash = createHash("sha256").update(bytes).digest("hex");
			totalBytes += bytes.byteLength;
			if (
				source.kind !== "source-artifact" ||
				hash !== source.evidence.hash.value ||
				bytes.byteLength !== source.byteLength
			)
				throw new MarketServiceError("revision_mismatch");
			if (totalBytes > 8_000_000) throw new MarketServiceError("source_limit");
			fileHashes.push(hash);
		}
		if (reviewJson(await read()) !== reviewJson(value)) throw new MarketServiceError("configuration_changed");
		if (Date.parse(value.sourceGrant.expiresAt) <= (options.clock?.() ?? new Date()).getTime())
			throw new MarketServiceError("authority_denied");
		return {
			...value,
			task: activeTask,
			authorityRevision: createHash("sha256")
				.update(reviewJson({ grant: value.sourceGrant, sourceOperations: value.sourceOperations, fileHashes }))
				.digest("hex"),
		};
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
		throw new MarketServiceError("storage_policy");
	const resolve = createFileModelCredentialResolver(owner);
	const modelReferences = modelConfig
		? [modelConfig.agent, modelConfig.synthesis, modelConfig.judge]
				.filter((profile) => profile !== null)
				.map((profile) => profile.credentialRef)
		: [];
	const secrets = async () =>
		Promise.all(
			[
				...new Set([...(await current()).sensitiveFiles.map((secretFile) => `file:${secretFile}`), ...modelReferences]),
			].map((reference) => resolve(owner, reference, "synthesis")),
		);
	const contentGuard = async (text: string) =>
		!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) &&
		(await secrets()).every((secret) => !text.includes(secret));
	const boundModel = (runtime: ModelRuntime): ModelRuntime => ({
		publicProfile: () => runtime.publicProfile(),
		fork: () => boundModel(runtime.fork?.() ?? runtime),
		generate: async (input, caller) => {
			await current();
			const result = await runtime.generate(input, caller);
			await current();
			return result;
		},
	});
	const emitter = new EventEmitter({
		context: {
			scope: task.scope,
			taskRevision: task.revision,
			...initial.correlation,
			qualification: initial.qualification,
		},
		producer: { id: "market", version: "0.1.0" },
		sink: createJsonlSink(initial.auditFile),
		required: true,
		sensitiveValues: await secrets(),
		clock: options.clock ? () => options.clock!().toISOString() : undefined,
	});
	const service = new MarketScenarioService({
		current: async () => {
			const value = await current();
			return {
				task: value.task,
				mandateSourceRef: value.mandateSourceRef,
				seriesSourceRef: value.seriesSourceRef,
				assumptionsSourceRef: value.assumptionsSourceRef,
				authorityRevision: value.authorityRevision,
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
				throw new MarketServiceError("source_use_denied");
			if (
				!who.scopes.includes("source:read") ||
				!who.scopes.includes("market:read") ||
				!value.sourceGrant.sourceIds.includes(reference.id)
			)
				throw new MarketServiceError("access_denied");
			const entry = value.sources.find((entry) => {
				const source = validateSourceContract(entry.artifact);
				return (
					source.kind === "source-artifact" &&
					source.artifact.id === reference.id &&
					source.artifact.revision === reference.revision
				);
			});
			if (!entry) throw new MarketServiceError("revision_mismatch");
			const artifact = validateSourceContract(entry.artifact, {
				expectedScope: task.scope,
				expectedTaskRevision: task.revision,
			});
			if (artifact.kind !== "source-artifact" || artifact.format !== "json")
				throw new MarketServiceError("source_unavailable");
			const refs = [
				{
					kind: "source" as const,
					id: reference.id,
					revision: reference.revision,
					sha256: artifact.evidence.hash.value,
				},
			];
			await emitter.emit("source", "started", { refs });
			const bytes = Buffer.from(await readPrivateText(entry.file, 8_000_000));
			if (signal?.aborted) throw new MarketServiceError("cancelled");
			if (
				createHash("sha256").update(bytes).digest("hex") !== artifact.evidence.hash.value ||
				bytes.byteLength !== artifact.byteLength
			)
				throw new MarketServiceError("revision_mismatch");
			await emitter.emit("source", "succeeded", { refs });
			const after = await current();
			if (!after.sourceOperations.includes(operation) || !after.sourceGrant.sourceIds.includes(reference.id))
				throw new MarketServiceError("source_use_denied");
			return { bytes, artifact };
		},
		contentGuard,
		maxSourceAgeSeconds: initial.maxSourceAgeSeconds,
		clock: options.clock,
	});
	let workflow: MarketReviewWorkflow | undefined;
	try {
		if (initial.review)
			workflow = new MarketReviewWorkflow(path.join(initial.directory, "review"), {
				service,
				currentPolicy: async () => (await current()).review!.policy,
				contentGuard,
				clock: options.clock,
				qualificationGuard: initial.review.qualificationConfigFile
					? createQualificationGuard(initial.review.qualificationConfigFile)
					: undefined,
			});
		return {
			modelRuntime: modelConfig
				? boundModel(createModelRuntime(modelConfig.synthesis, { resolveCredential: resolve }))
				: undefined,
			service,
			reviewWorkflow: workflow,
			localPrincipal: initial.review
				? parseMarketReviewPolicy(initial.review.policy).requester
				: { subjectId: initial.localOperator.subjectId, ...owner, scopes: ["market:read", "source:read"] },
			reviewer: initial.review
				? async () => {
						const review = (await current()).review!,
							policy = parseMarketReviewPolicy(review.policy);
						if (
							!process.getuid ||
							process.getuid() !== review.localReviewer.uid ||
							!policy.reviewerIds.includes(review.localReviewer.subjectId)
						)
							throw new MarketServiceError("authority_denied");
						return { subjectId: review.localReviewer.subjectId, ...owner, scopes: ["market:human-review"] };
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
