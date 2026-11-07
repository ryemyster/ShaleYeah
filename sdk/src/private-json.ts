import { constants } from "node:fs";
import fs from "node:fs/promises";
export class PrivateConfigError extends Error {
	constructor() {
		super("Private configuration unavailable");
	}
}
export async function readPrivateText(file: string, maximum = 65536): Promise<string> {
	if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 8_388_608) throw new PrivateConfigError();
	let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
	try {
		handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		const before = await handle.stat();
		if (
			!before.isFile() ||
			before.nlink !== 1 ||
			before.mode & 0o077 ||
			(process.getuid && before.uid !== process.getuid()) ||
			before.size > maximum
		)
			throw new PrivateConfigError();
		const bytes = Buffer.alloc(maximum + 1);
		let length = 0;
		while (length < bytes.length) {
			const read = await handle.read(bytes, length, bytes.length - length, length);
			if (!read.bytesRead) break;
			length += read.bytesRead;
		}
		const after = await handle.stat();
		if (length !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
			throw new PrivateConfigError();
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
	} catch {
		throw new PrivateConfigError();
	} finally {
		await handle?.close();
	}
}

export async function readPrivateJson(file: string, maximum = 65536): Promise<unknown> {
	try {
		return JSON.parse(await readPrivateText(file, maximum));
	} catch {
		throw new PrivateConfigError();
	}
}
