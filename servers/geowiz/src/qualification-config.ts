import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type QualificationInput, ReviewError } from "./review-workflow.js";
import { readPrivateSourceConfig } from "./source-config.js";

const settingsSchema = z
	.object({
		schemaVersion: z.literal("0.1.0"),
		pythonExecutable: z.string().min(1),
		evidenceDirectory: z.string().min(1),
		policyFile: z.string().min(1),
		codeRevision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
		caseId: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
	})
	.strict();

/** Invoke only the maintained installed verifier; no shell, arbitrary module or model-selected path. */
export function createQualificationGuard(file: string) {
	return async (input: QualificationInput, signal?: AbortSignal): Promise<unknown> => {
		const settings = settingsSchema.parse(await readPrivateSourceConfig(file));
		if (
			![settings.pythonExecutable, settings.evidenceDirectory, settings.policyFile].every(path.isAbsolute) ||
			!/^[a-f0-9]{64}$/.test(input.packetDigest)
		)
			throw new ReviewError("qualification_configuration");
		const directory = await fs.lstat(settings.evidenceDirectory);
		if (
			!directory.isDirectory() ||
			directory.isSymbolicLink() ||
			directory.mode & 0o077 ||
			(process.getuid && directory.uid !== process.getuid())
		)
			throw new ReviewError("qualification_configuration");
		const root = await fs.realpath(settings.evidenceDirectory);
		if (signal?.aborted) throw new ReviewError("cancelled");
		const request = JSON.stringify({ ...input, caseId: settings.caseId });
		if (Buffer.byteLength(request) > 8_388_608) throw new ReviewError("qualification_limit");
		return new Promise((resolve, reject) => {
			const child = spawn(
				settings.pythonExecutable,
				[
					"-I",
					"-m",
					"shaleyeah_evaluations.qualification",
					"--bundle",
					path.join(root, `${input.packetDigest}.json`),
					"--policy",
					settings.policyFile,
					"--code-revision",
					settings.codeRevision,
					"--promotion-stdin",
				],
				{ cwd: root, env: { LANG: "C.UTF-8", TZ: "UTC" }, stdio: ["pipe", "pipe", "pipe"] },
			);
			const output: Buffer[] = [];
			let bytesRead = 0,
				errors = 0,
				settled = false;
			const stop = (code: string) => {
				if (settled) return;
				settled = true;
				child.kill("SIGKILL");
				clearTimeout(timer);
				signal?.removeEventListener("abort", abort);
				reject(new ReviewError(code));
			};
			const abort = () => stop("cancelled");
			const timer = setTimeout(() => stop("qualification_timeout"), 15000);
			signal?.addEventListener("abort", abort, { once: true });
			child.once("error", () => stop("qualification_unavailable"));
			child.stdin.once("error", () => stop("qualification_unavailable"));
			child.stdout.on("data", (bytes: Buffer) => {
				if (settled) return;
				bytesRead += bytes.length;
				if (bytesRead > 65536) stop("qualification_limit");
				else output.push(bytes);
			});
			child.stderr.on("data", (bytes: Buffer) => {
				if (settled) return;
				errors += bytes.length;
				if (errors > 16384) stop("qualification_limit");
			});
			child.once("close", (code) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				signal?.removeEventListener("abort", abort);
				if (code !== 0) {
					reject(new ReviewError("qualification_blocked"));
					return;
				}
				try {
					resolve(JSON.parse(Buffer.concat(output).toString("utf8")));
				} catch {
					reject(new ReviewError("qualification_invalid"));
				}
			});
			child.stdin.end(request);
		});
	};
}
