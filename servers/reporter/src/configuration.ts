import path from "node:path";
import type { TaskAssignment } from "@shaleyeah/contracts";
import {
	createFileModelCredentialResolver,
	createModelRuntime,
	createQualificationGuard,
	ReviewError,
	readPrivateJson,
	readPrivateReferenceModelConfig,
	reviewJson,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { reportRequirementsSchema } from "./report-assembly.js";
import { parseReportReviewPolicy, ReportReviewWorkflow } from "./review-workflow.js";
import { businessEvidence, type ReviewedReceipt, ReviewedSources } from "./reviewed-sources.js";

const schema = z
	.object({
		version: z.literal("0.1.0"),
		sourceAuthority: z.literal("operator-attested-export"),
		directory: z.string().min(1),
		policy: z.unknown(),
		requirements: reportRequirementsSchema,
		sources: z.array(z.unknown()).min(1).max(32),
		localReviewer: z.object({ uid: z.number().int().nonnegative(), subjectId: z.string().min(1).max(128) }).strict(),
		sensitiveFiles: z.array(z.string().min(1)).max(32),
		qualificationConfigFile: z.string().min(1).optional(),
		modelsFile: z.string().min(1).optional(),
		maxSourceAgeSeconds: z.number().int().min(1).max(31536000).default(31536000),
		contextMetadataGrants: z.array(z.unknown()).max(1024).default([]),
	})
	.strict();
/** Owner-only local exports attest the upstream review and sharing records.
 * Remote hosts inject their authenticated artifact authority through ReviewedSources instead.
 */
export async function loadReporterBinding(file: string) {
	const read = async () => schema.parse(await readPrivateJson(file, 8_000_000));
	const initial = await read();
	const policy = parseReportReviewPolicy(initial.policy);
	if (
		![
			initial.directory,
			...initial.sensitiveFiles,
			...(initial.qualificationConfigFile ? [initial.qualificationConfigFile] : []),
			...(initial.modelsFile ? [initial.modelsFile] : []),
		].every(path.isAbsolute)
	)
		throw new ReviewError("configuration");
	const models = initial.modelsFile ? await readPrivateReferenceModelConfig(initial.modelsFile) : undefined;
	const current = async () => {
		const value = await read();
		if (
			value.directory !== initial.directory ||
			value.qualificationConfigFile !== initial.qualificationConfigFile ||
			value.modelsFile !== initial.modelsFile
		)
			throw new ReviewError("configuration_changed");
		const active = parseReportReviewPolicy(value.policy);
		if (
			reviewJson(active.task.scope) !== reviewJson(policy.task.scope) ||
			reviewJson(active.requester) !== reviewJson(policy.requester) ||
			value.maxSourceAgeSeconds !== initial.maxSourceAgeSeconds
		)
			throw new ReviewError("configuration_changed");
		return value;
	};
	const resolve = createFileModelCredentialResolver({
		customerId: policy.task.scope.customerId,
		employeeId: policy.task.scope.employeeId,
	});
	const contentGuard = async (text: string) => {
		const value = await current();
		const secrets = await Promise.all(
			value.sensitiveFiles.map((file) =>
				resolve(
					{ customerId: policy.task.scope.customerId, employeeId: policy.task.scope.employeeId },
					`file:${file}`,
					"synthesis",
				),
			),
		);
		if (models) secrets.push(await resolve(models.synthesis.owner, models.synthesis.credentialRef, "synthesis"));
		return (
			!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) &&
			secrets.every((secret) => !text.includes(secret))
		);
	};
	const sources = new ReviewedSources({
		scope: policy.task.scope,
		maxSourceAgeSeconds: initial.maxSourceAgeSeconds,
		contentGuard,
		current: async (id) => {
			const value = await current();
			const active = parseReportReviewPolicy(value.policy);
			if (active.revoked || Date.parse(active.expiresAt) <= Date.now()) throw new ReviewError("access_denied");
			const found = value.sources.find((source) => {
				const receipt = source as ReviewedReceipt;
				return receipt.work.artifact.id === id || businessEvidence(receipt.work).id === id;
			});
			if (!found) throw new ReviewError("source_unavailable");
			return found;
		},
		currentMetadata: async (id) => {
			const value = await current();
			return value.contextMetadataGrants.find((grant) => (grant as { evidence?: { id: string } })?.evidence?.id === id);
		},
	});
	const currentRequirements = async () => (await current()).requirements;
	const reviewWorkflow = new ReportReviewWorkflow(initial.directory, {
		sources,
		contentGuard,
		currentRequirements,
		currentPolicy: async () => (await current()).policy,
		qualificationGuard: initial.qualificationConfigFile
			? createQualificationGuard(initial.qualificationConfigFile)
			: undefined,
	});
	try {
		if (
			models &&
			(models.synthesis.owner.customerId !== policy.task.scope.customerId ||
				models.synthesis.owner.employeeId !== policy.task.scope.employeeId)
		)
			throw new ReviewError("model_owner");
		return {
			sources,
			reviewWorkflow,
			currentRequirements,
			currentTask: async () => parseReportReviewPolicy((await current()).policy).task as TaskAssignment,
			localPrincipal: policy.requester,
			modelRuntime: models ? createModelRuntime(models.synthesis, { resolveCredential: resolve }) : undefined,
			reviewer: async () => {
				const value = await current();
				const active = parseReportReviewPolicy(value.policy);
				if (
					!process.getuid ||
					process.getuid() !== value.localReviewer.uid ||
					!active.reviewerIds.includes(value.localReviewer.subjectId)
				)
					throw new ReviewError("authority_denied");
				return {
					subjectId: value.localReviewer.subjectId,
					customerId: active.task.scope.customerId,
					employeeId: active.task.scope.employeeId,
					scopes: ["reporter:human-review"],
				};
			},
		};
	} catch (error) {
		reviewWorkflow.close();
		throw error;
	}
}
