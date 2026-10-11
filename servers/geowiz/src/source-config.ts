import { constants } from "node:fs";
import fs from "node:fs/promises";
import {
	createConnectorRuntime,
	operatorFileAdapter,
	SourceAccessError,
	type SourceAuditEvent,
} from "@shaleyeah/connectors";
import { validateConnectorConfiguration } from "@shaleyeah/contracts";

/** Local private-file bootstrap. Other runtimes inject their own policy/secret services. */
export async function readPrivateSourceConfig(file: string): Promise<unknown> {
	let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
	try {
		handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		const before = await handle.stat();
		if (
			!before.isFile() ||
			before.mode & 0o077 ||
			(process.getuid && before.uid !== process.getuid()) ||
			before.size > 65536
		)
			throw new SourceAccessError("access_denied");
		const bytes = Buffer.alloc(65537);
		let length = 0;
		while (length < bytes.length) {
			const read = await handle.read(bytes, length, bytes.length - length, length);
			if (!read.bytesRead) break;
			length += read.bytesRead;
		}
		const after = await handle.stat();
		if (length !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
			throw new SourceAccessError("revision_mismatch");
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
	} catch {
		throw new SourceAccessError("access_denied");
	} finally {
		await handle?.close();
	}
}

export async function loadSourceBinding(file: string, audit: (event: SourceAuditEvent) => Promise<void>) {
	const config = validateConnectorConfiguration(await readPrivateSourceConfig(file));
	const runtime = createConnectorRuntime(config, {
		installedAdapters: [operatorFileAdapter],
		audit,
		currentGrant: async () => {
			const current = validateConnectorConfiguration(await readPrivateSourceConfig(file));
			if (
				current.manifest.id !== config.manifest.id ||
				current.manifest.revision !== config.manifest.revision ||
				current.taskRevision !== config.taskRevision
			)
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
			if (!stat.isFile() || stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid()))
				throw new SourceAccessError("access_denied");
			await handle.writeFile(`${JSON.stringify(event)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
	};
}
