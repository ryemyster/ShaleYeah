import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";
import { validateConnectorConfiguration, validateContract } from "@shaleyeah/contracts";
import {
	bindMCPEvents,
	createFileModelCredentialResolver,
	createJsonlSink,
	createQualificationGuard,
	EventEmitter,
	readPrivateJson,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { EconomicScenarioWorkflow, parseEconomicReviewPolicy } from "./review-workflow.js";
import {
	EconomicScenarioError,
	EconomicScenarioService,
	economicRefSchema,
	scenarioDefinitionSchema,
} from "./scenario-service.js";

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
		cashFlowSourceRef: economicRefSchema,
		scenarios: z.array(scenarioDefinitionSchema).min(1).max(100),
		connectorConfiguration: z.unknown(),
		sourceOperations: z
			.array(z.enum(["read", "export"]))
			.min(1)
			.max(2),
		localOperator: enrolled,
		sensitiveFiles: z.array(z.string().min(1).max(4096)).max(32),
		maxPriceAgeSeconds: z.number().int().min(1).max(31536000),
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
export async function loadEconomicBinding(file: string, options: { clock?: () => Date } = {}) {
	const read = async () => schema.parse(await readPrivateJson(file, 8_000_000));
	const initial = await read(),
		task = validateContract(initial.task);
	if (task.kind !== "task-assignment") throw new EconomicScenarioError("task_required");
	const initialConnector = validateConnectorConfiguration(initial.connectorConfiguration);
	const owner = { customerId: task.scope.customerId, employeeId: task.scope.employeeId };
	if (
		!path.isAbsolute(file) ||
		![
			initial.directory,
			initial.auditFile,
			...initial.sensitiveFiles,
			...(initial.review?.qualificationConfigFile ? [initial.review.qualificationConfigFile] : []),
		].every(path.isAbsolute) ||
		path.dirname(initial.auditFile) !== initial.directory
	)
		throw new EconomicScenarioError("configuration");
	if (
		reviewJson(initialConnector.scope) !== reviewJson(task.scope) ||
		initialConnector.taskRevision !== task.revision ||
		initialConnector.grant.subjectId !== initial.localOperator.subjectId
	)
		throw new EconomicScenarioError("configuration");
	const stableConnector = (value: typeof initialConnector) => {
		const { grant: _grant, ...binding } = value;
		return binding;
	};
	const current = async () => {
		const value = await read(),
			activeTask = validateContract(value.task),
			connector = validateConnectorConfiguration(value.connectorConfiguration);
		if (
			activeTask.kind !== "task-assignment" ||
			reviewJson(activeTask) !== reviewJson(task) ||
			value.directory !== initial.directory ||
			value.auditFile !== initial.auditFile ||
			value.qualification !== initial.qualification ||
			value.maxPriceAgeSeconds !== initial.maxPriceAgeSeconds ||
			value.maxSourceAgeSeconds !== initial.maxSourceAgeSeconds ||
			reviewJson(value.correlation) !== reviewJson(initial.correlation) ||
			reviewJson(value.localOperator) !== reviewJson(initial.localOperator) ||
			reviewJson(stableConnector(connector)) !== reviewJson(stableConnector(initialConnector)) ||
			Boolean(value.review) !== Boolean(initial.review) ||
			value.review?.qualificationConfigFile !== initial.review?.qualificationConfigFile
		)
			throw new EconomicScenarioError("configuration_changed");
		if (
			!process.getuid ||
			process.getuid() !== value.localOperator.uid ||
			connector.grant.subjectId !== value.localOperator.subjectId
		)
			throw new EconomicScenarioError("access_denied");
		if (connector.grant.revoked || Date.parse(connector.grant.expiresAt) <= (options.clock?.() ?? new Date()).getTime())
			throw new EconomicScenarioError("authority_denied");
		if (value.review) {
			const policy = parseEconomicReviewPolicy(value.review.policy);
			if (
				reviewJson(policy.task) !== reviewJson(task) ||
				policy.qualification !== value.qualification ||
				policy.requester.subjectId !== value.localOperator.subjectId
			)
				throw new EconomicScenarioError("configuration");
		}
		return { ...value, task: activeTask, connectorConfiguration: connector };
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
		throw new EconomicScenarioError("storage_policy");
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
		producer: { id: "econobot", version: "0.1.0" },
		sink: createJsonlSink(initial.auditFile),
		required: true,
		sensitiveValues: await secrets(),
		clock: options.clock ? () => options.clock!().toISOString() : undefined,
	});
	const sources = createConnectorRuntime(initialConnector, {
		installedAdapters: [operatorFileAdapter],
		currentGrant: async () => (await current()).connectorConfiguration.grant,
		clock: options.clock,
		audit: async (event) => {
			await emitter.emit(
				"source",
				event.stage === "denied" ? "blocked" : event.stage === "retrieved" ? "succeeded" : "started",
				{
					refs:
						event.sourceId && event.sourceRevision && event.contentHash
							? [
									{
										kind: "source",
										id: event.sourceId,
										revision: event.sourceRevision,
										sha256: event.contentHash,
									},
								]
							: [],
				},
			);
		},
	});
	const service = new EconomicScenarioService({
		current: async () => {
			const value = await current();
			return {
				task: value.task,
				cashFlowSourceRef: value.cashFlowSourceRef,
				scenarios: value.scenarios,
				authorityRevision: createHash("sha256")
					.update(reviewJson({ grant: value.connectorConfiguration.grant, sourceOperations: value.sourceOperations }))
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
				throw new EconomicScenarioError("source_use_denied");
			const request = sources.request(reference.id);
			const result = await sources.fetch(request, who, signal);
			if (result.artifact.artifact.revision !== reference.revision)
				throw new EconomicScenarioError("revision_mismatch");
			if (!(await current()).sourceOperations.includes(operation)) throw new EconomicScenarioError("source_use_denied");
			return result;
		},
		contentGuard,
		maxPriceAgeSeconds: initial.maxPriceAgeSeconds,
		maxSourceAgeSeconds: initial.maxSourceAgeSeconds,
		clock: options.clock,
	});
	let workflow: EconomicScenarioWorkflow | undefined;
	try {
		if (initial.review)
			workflow = new EconomicScenarioWorkflow(path.join(initial.directory, "review"), {
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
				? parseEconomicReviewPolicy(initial.review.policy).requester
				: {
						subjectId: initial.localOperator.subjectId,
						...owner,
						scopes: ["economics:read", ...initialConnector.manifest.requiredScopes],
					},
			reviewer: initial.review
				? async () => {
						const review = (await current()).review!,
							policy = parseEconomicReviewPolicy(review.policy);
						if (
							!process.getuid ||
							process.getuid() !== review.localReviewer.uid ||
							!policy.reviewerIds.includes(review.localReviewer.subjectId)
						)
							throw new EconomicScenarioError("authority_denied");
						return { subjectId: review.localReviewer.subjectId, ...owner, scopes: ["economics:human-review"] };
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
