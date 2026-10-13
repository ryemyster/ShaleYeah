import path from "node:path";
import { validateContract } from "@shaleyeah/contracts";
import {
	bindMCPEvents,
	createFileModelCredentialResolver,
	createJsonlSink,
	createModelRuntime,
	EventEmitter,
	readPrivateJson,
	readPrivateReferenceModelConfig,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { QAError, QAInputs, qaEvidenceSchema, qaScopeSchema } from "./qa-inputs.js";
import { QAService, qaGrantSchema } from "./qa-service.js";
import { QAResultStore } from "./qa-store.js";
import { qaProjectionSchema } from "./tools/qa-data.js";
import { qaProfileSchema } from "./tools/qa-rules.js";

const schema = z
	.object({
		version: z.literal("0.1.0"),
		sourceAuthority: z.literal("operator-attested-export"),
		qualification: z.enum(["fixture", "live"]).default("fixture"),
		correlation: z.object({ runId: z.string().min(1).max(128), traceId: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
		directory: z.string().min(1).max(4096),
		auditFile: z.string().min(1).max(4096),
		task: z.unknown(),
		profile: qaProfileSchema,
		grant: qaGrantSchema,
		sources: z
			.array(
				z
					.object({
						snapshot: z
							.object({
								scope: qaScopeSchema,
								evidence: qaEvidenceSchema,
								bytesBase64: z.string().min(4).max(8_000_000),
								projection: qaProjectionSchema.optional(),
							})
							.strict(),
						grant: z.unknown(),
					})
					.strict(),
			)
			.max(64),
		localOperator: z.object({ uid: z.number().int().nonnegative(), subjectId: z.string().min(1).max(128) }).strict(),
		sensitiveFiles: z.array(z.string().min(1).max(4096)).max(32),
		modelsFile: z.string().min(1).max(4096).optional(),
		retentionSeconds: z.number().int().min(1).max(86400).default(3600),
	})
	.strict();

/** A private operator export attests upstream task/source rights. Remote hosts inject live authorities into QAInputs/QAService. */
export async function loadQABinding(file: string, options: { clock?: () => Date } = {}) {
	const read = async () => schema.parse(await readPrivateJson(file, 8_000_000));
	const initial = await read(),
		task = validateContract(initial.task);
	if (task.kind !== "task-assignment") throw new QAError("task_required");
	if (
		!path.isAbsolute(file) ||
		![
			initial.directory,
			initial.auditFile,
			...initial.sensitiveFiles,
			...(initial.modelsFile ? [initial.modelsFile] : []),
		].every(path.isAbsolute) ||
		path.dirname(initial.auditFile) !== initial.directory
	)
		throw new QAError("configuration");
	const current = async () => {
		const value = await read(),
			active = validateContract(value.task);
		if (
			active.kind !== "task-assignment" ||
			reviewJson(active.scope) !== reviewJson(task.scope) ||
			active.revision !== task.revision ||
			value.directory !== initial.directory ||
			value.auditFile !== initial.auditFile ||
			value.retentionSeconds !== initial.retentionSeconds ||
			value.modelsFile !== initial.modelsFile ||
			value.qualification !== initial.qualification ||
			reviewJson(value.correlation) !== reviewJson(initial.correlation)
		)
			throw new QAError("configuration_changed");
		if (
			!process.getuid ||
			process.getuid() !== value.localOperator.uid ||
			value.localOperator.subjectId !== initial.grant.subjectId
		)
			throw new QAError("access_denied");
		return value;
	};
	const owner = { customerId: task.scope.customerId, employeeId: task.scope.employeeId };
	const resolve = createFileModelCredentialResolver(owner);
	const models = initial.modelsFile ? await readPrivateReferenceModelConfig(initial.modelsFile) : undefined;
	if (models && reviewJson(models.synthesis.owner) !== reviewJson(owner)) throw new QAError("access_denied");
	const contentGuard = async (text: string) => {
		const value = await current();
		const secrets = await Promise.all(
			value.sensitiveFiles.map((secretFile) => resolve(owner, `file:${secretFile}`, "synthesis")),
		);
		if (models) secrets.push(await resolve(owner, models.synthesis.credentialRef, "synthesis"));
		return (
			!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) &&
			secrets.every((secret) => !text.includes(secret))
		);
	};
	const inputs = new QAInputs({
		scope: task.scope,
		taskRevision: task.revision,
		clock: options.clock,
		contentGuard,
		current: async (id) => {
			const value = await current();
			const matches = value.sources.filter((entry) => entry.snapshot.evidence.id === id);
			if (matches.length > 1) throw new QAError("configuration");
			if (!matches.length) return undefined;
			const { bytesBase64, ...metadata } = matches[0].snapshot;
			const bytes = Buffer.from(bytesBase64, "base64");
			if (bytes.toString("base64") !== bytesBase64) throw new QAError("source_encoding");
			return { snapshot: { ...metadata, bytes }, grant: matches[0].grant };
		},
	});
	await current();
	const store = new QAResultStore(initial.directory, { clock: options.clock });
	try {
		const emitter = new EventEmitter({
			context: {
				scope: task.scope,
				taskRevision: task.revision,
				runId: initial.correlation.runId,
				traceId: initial.correlation.traceId,
				qualification: initial.qualification,
			},
			producer: { id: "qa", version: "0.1.0" },
			sink: createJsonlSink(initial.auditFile),
			required: true,
		});
		const service = new QAService({
			inputs,
			store,
			contentGuard,
			clock: options.clock,
			retentionSeconds: initial.retentionSeconds,
			modelRuntime: models ? createModelRuntime(models.synthesis, { resolveCredential: resolve }) : undefined,
			current: async () => {
				const value = await current();
				return { task: value.task, profile: value.profile, grant: value.grant };
			},
			audit: async (entry) => {
				const event = z
					.object({ operation: z.enum(["run", "report"]), resultHash: z.string().regex(/^[a-f0-9]{64}$/) })
					.parse(entry);
				await emitter.emit(
					event.operation === "run" ? "evaluation" : "work-product",
					event.operation === "run" ? "succeeded" : "started",
					{
						refs: [
							{
								kind: "evaluation",
								id: `qa.observed.${event.resultHash.slice(0, 40)}`,
								revision: "r1",
								sha256: event.resultHash,
							},
						],
					},
				);
			},
		});
		return {
			service,
			localPrincipal: {
				subjectId: initial.grant.subjectId,
				...owner,
				scopes: initial.grant.operations.map((operation) => `qa:${operation}`),
			},
			events: bindMCPEvents(emitter),
			dataPath: initial.directory,
			close: () => store.close(),
		};
	} catch (error) {
		store.close();
		throw error;
	}
}
