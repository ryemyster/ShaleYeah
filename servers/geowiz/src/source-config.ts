import { constants } from "node:fs";
import fs from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import {
	createConnectorRuntime,
	operatorFileAdapter,
	SourceAccessError,
	type SourceAuditEvent,
} from "@shaleyeah/connectors";
import { validateConnectorConfiguration } from "@shaleyeah/contracts";
import { readPrivateJson } from "@shaleyeah/sdk";

/** Local private-file bootstrap. Other runtimes inject their own policy/secret services. */
export async function readPrivateSourceConfig(file: string): Promise<unknown> {
	try {
		return await readPrivateJson(file);
	} catch {
		throw new SourceAccessError("access_denied");
	}
}

export async function loadSourceBinding(file: string, audit: (event: SourceAuditEvent) => Promise<void>) {
	const config = validateConnectorConfiguration(await readPrivateSourceConfig(file));
	const runtime = createConnectorRuntime(config, {
		installedAdapters: [operatorFileAdapter],
		audit,
		currentGrant: async () => {
			const current = validateConnectorConfiguration(await readPrivateSourceConfig(file));
			if (!isDeepStrictEqual({ ...current, grant: null }, { ...config, grant: null }))
				throw new SourceAccessError("revision_mismatch");
			return current.grant;
		},
	});
	return {
		runtime,
		principal: {
			subjectId: config.grant.subjectId,
			customerId: config.scope.customerId,
			employeeId: config.scope.employeeId,
			scopes: [...new Set([...config.manifest.requiredScopes, ...config.grant.requiredScopes])],
		},
	};
}

export function createFileSourceAudit(file: string) {
	return async (event: SourceAuditEvent) => {
		const handle = await fs.open(
			file,
			constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
			0o600,
		);
		try {
			const stat = await handle.stat();
			if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid()))
				throw new SourceAccessError("access_denied");
			await handle.writeFile(`${JSON.stringify(event)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
	};
}
