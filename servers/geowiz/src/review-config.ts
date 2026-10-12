import { constants } from "node:fs";
import fs from "node:fs/promises";
import { z } from "zod";
import { parseReviewPolicy, ReviewError, ReviewWorkflow } from "./review-workflow.js";
import { createFileSourceAudit, loadSourceBinding, readPrivateSourceConfig } from "./source-config.js";

const configSchema = z
	.object({
		directory: z.string().min(1),
		sourceConfigFile: z.string().min(1),
		sourceAuditFile: z.string().min(1),
		policy: z.unknown(),
		localReviewer: z.object({ uid: z.number().int().nonnegative(), subjectId: z.string().min(1).max(128) }).strict(),
		sensitiveFiles: z.array(z.string().min(1)).min(1).max(32),
	})
	.strict();
async function readSecret(file: string) {
	const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const stat = await handle.stat();
		if (
			!stat.isFile() ||
			stat.nlink !== 1 ||
			stat.mode & 0o077 ||
			(process.getuid && stat.uid !== process.getuid()) ||
			stat.size < 8 ||
			stat.size > 4096
		)
			throw new ReviewError("secret_policy");
		const bytes = Buffer.alloc(4097);
		let length = 0;
		while (length < bytes.length) {
			const next = await handle.read(bytes, length, bytes.length - length, length);
			if (!next.bytesRead) break;
			length += next.bytesRead;
		}
		const after = await handle.stat();
		if (length !== stat.size || stat.ctimeMs !== after.ctimeMs || stat.mtimeMs !== after.mtimeMs)
			throw new ReviewError("secret_policy");
		return bytes.subarray(0, length).toString("utf8").trim();
	} finally {
		await handle.close();
	}
}

/** Restricted single-operator launcher. Remote hosts supply a verified reviewer to the same API. */
export async function loadReviewBinding(file: string) {
	const read = async () => configSchema.parse(await readPrivateSourceConfig(file));
	const config = await read();
	const source = await loadSourceBinding(config.sourceConfigFile, createFileSourceAudit(config.sourceAuditFile));
	const workflow = new ReviewWorkflow(config.directory, {
		sources: source.runtime,
		currentPolicy: async () => {
			const current = await read();
			if (
				current.directory !== config.directory ||
				current.sourceConfigFile !== config.sourceConfigFile ||
				current.sourceAuditFile !== config.sourceAuditFile
			)
				throw new ReviewError("configuration_changed");
			return parseReviewPolicy(current.policy);
		},
		contentGuard: async (text) => {
			const current = await read();
			const secrets = await Promise.all(current.sensitiveFiles.map(readSecret));
			return (
				secrets.every((secret) => secret.length >= 8 && !text.includes(secret)) &&
				!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
			);
		},
	});
	return {
		workflow,
		reviewer: async () => {
			const current = await read();
			const policy = parseReviewPolicy(current.policy);
			if (
				!process.getuid ||
				process.getuid() !== current.localReviewer.uid ||
				!policy.reviewerIds.includes(current.localReviewer.subjectId)
			)
				throw new ReviewError("authority_denied");
			return {
				subjectId: current.localReviewer.subjectId,
				customerId: policy.task.scope.customerId,
				employeeId: policy.task.scope.employeeId,
				scopes: ["geowiz:human-review"],
			};
		},
	};
}
