import { constants } from "node:fs";
import fs from "node:fs/promises";
import { createFileModelCredentialResolver, createModelRuntime, parseReferenceModelConfig } from "@shaleyeah/sdk";
import { GeowizServer } from "../dist/index.js";

// This local example uses owned private files. Remote issuers and other secret/audit adapters are injected through the SDK API.
async function privateFile(file, flags, mode) {
	if (!constants.O_NOFOLLOW || typeof file !== "string") throw new Error("Private-file adapter unavailable");
	const handle = await fs.open(file, flags | constants.O_NOFOLLOW, mode);
	try {
		const stat = await handle.stat();
		if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid()))
			throw new Error("Private-file policy denied");
		return handle;
	} catch (error) {
		await handle.close();
		throw error;
	}
}

async function readPrivate(file, maximum) {
	const handle = await privateFile(file, constants.O_RDONLY);
	try {
		const bytes = Buffer.alloc(maximum + 1);
		let total = 0;
		while (total < bytes.length) {
			const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
			if (!bytesRead) break;
			total += bytesRead;
		}
		if (total > maximum) throw new Error("Private configuration exceeds its limit");
		return bytes.subarray(0, total).toString("utf8");
	} finally {
		await handle.close();
	}
}

let server;
let auditFile;
let pending = Promise.resolve();
let queued = 0;
try {
	const config = JSON.parse(await readPrivate(process.env.GEOWIZ_HTTP_CONFIG_FILE, 65_536));
	const accessToken = (await readPrivate(config.accessTokenFile, 4096)).trim();
	auditFile = await privateFile(config.auditFile, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600);
	const { accessTokenFile: _tokenFile, auditFile: _auditFile, modelConfigFile, dataPath, ...settings } = config;
	const modelConfig = modelConfigFile
		? parseReferenceModelConfig(JSON.parse(await readPrivate(modelConfigFile, 65_536)))
		: undefined;
	const modelRuntime = modelConfig
		? createModelRuntime(modelConfig.synthesis, {
				resolveCredential: createFileModelCredentialResolver(modelConfig.synthesis.owner),
			})
		: undefined;
	process.env.PORT ??= "3001";
	server = new GeowizServer({
		dataPath,
		modelRuntime,
		http: {
			access: {
				...settings,
				mode: "local",
				accessToken,
				audit(event) {
					if (queued >= 128) throw new Error("Local access audit capacity reached");
					queued++;
					pending = pending.then(async () => {
						await auditFile.writeFile(`${JSON.stringify(event)}\n`);
						await auditFile.sync();
					});
					return pending.finally(() => {
						queued--;
					});
				},
			},
		},
	});
	await server.initialize();
	const close = async () => {
		await server.stop();
		await pending.catch(() => {});
		await auditFile.close();
		process.exit(0);
	};
	process.once("SIGINT", () => {
		void close();
	});
	process.once("SIGTERM", () => {
		void close();
	});
} catch {
	await server?.stop().catch(() => {});
	await auditFile?.close().catch(() => {});
	console.error("Geowiz local HTTP setup failed. Check the private configuration, file permissions and access policy.");
	process.exitCode = 1;
}
