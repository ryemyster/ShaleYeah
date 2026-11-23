import { type ExecFileOptions, execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

const execute = promisify(execFile);
const prefix = "TITLE_NATIVE_PHASE ";
const phases = new Set([
	"imports-complete",
	"settings-loaded",
	"catalog-open",
	"catalog-seed",
	"runtime-open",
	"native-run",
	"source-authority",
	"source-authority-complete",
	"model-count",
	"model-generate",
	"restart",
	"resume",
	"revoked",
	"grade",
	"output-write",
	"cleanup",
	"completed",
]);
const systemCodes = new Set(["ENOENT", "EACCES", "EPERM", "ABORT_ERR", "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"]);

function safePhases(stderr: string) {
	const result = {
		phase: null as string | null,
		lastWorkPhase: null as string | null,
		failureType: null as string | null,
		fixtureLine: null as number | null,
		contextLimitHit: null as boolean | null,
		inputBytes: null as number | null,
		provider: null as string | null,
		runtimeElapsedMs: null as number | null,
		sourceCalls: null as number | null,
		modelCalls: null as number | null,
		countCalls: null as number | null,
	};
	for (const line of stderr.split("\n")) {
		const frame = /^\s+File "[^"\n]*[/\\]context-step\.py", line ([0-9]{1,6}), in [A-Za-z_<>][A-Za-z0-9_<>]*$/.exec(
			line,
		);
		if (frame) result.fixtureLine = Number(frame[1]);
		const failure =
			/^(AssertionError|ContextError|EvaluationError|MCPClientError|ValueError|KeyError|RuntimeError|StopIteration|TypeError)(?::|$)/.exec(
				line,
			);
		if (failure) result.failureType = failure[1];
		if (line.startsWith("AssertionError: {")) {
			try {
				const value = JSON.parse(line.slice("AssertionError: ".length));
				if (typeof value.contextLimitHit === "boolean") result.contextLimitHit = value.contextLimitHit;
				if (Number.isSafeInteger(value.inputBytes) && value.inputBytes >= 0 && value.inputBytes <= 8_000_000)
					result.inputBytes = value.inputBytes;
			} catch {
				// Only the fixed boolean and bounded byte measurement may leave stderr.
			}
		}
		if (!line.startsWith(prefix)) continue;
		try {
			const value = JSON.parse(line.slice(prefix.length));
			if (!value || typeof value !== "object" || !phases.has(value.phase)) continue;
			result.phase = value.phase;
			if (value.phase !== "cleanup" && value.phase !== "completed") result.lastWorkPhase = value.phase;
			if (["gemini", "anthropic"].includes(value.provider)) result.provider = value.provider;
			if (Number.isFinite(value.runtimeElapsedMs) && value.runtimeElapsedMs >= 0 && value.runtimeElapsedMs <= 86400000)
				result.runtimeElapsedMs = value.runtimeElapsedMs;
			for (const key of ["sourceCalls", "modelCalls", "countCalls"] as const) {
				if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1000000) result[key] = value[key];
			}
		} catch {
			// Other stderr is intentionally excluded from the public test failure.
		}
	}
	return result;
}

type ChildFailure = Error & { code?: string | number; signal?: string; killed?: boolean; stderr?: string };

/** Preserve real execution and deadlines, reporting only safe failure metadata. */
export async function runNativeChild(command: string, args: string[], options: ExecFileOptions) {
	const started = performance.now();
	try {
		const result = await execute(command, args, { ...options, encoding: "utf8" });
		return {
			...result,
			diagnostics: {
				...safePhases(result.stderr),
				elapsedMs: Math.round(performance.now() - started),
				deadlineMs: Number.isFinite(options.timeout) ? options.timeout : null,
				code: 0,
				signal: null,
				killed: false,
			},
		};
	} catch (cause) {
		const error = cause as ChildFailure;
		const diagnostics = {
			...safePhases(typeof error.stderr === "string" ? error.stderr : ""),
			elapsedMs: Math.round(performance.now() - started),
			deadlineMs: Number.isFinite(options.timeout) ? options.timeout : null,
			code:
				typeof error.code === "number" || (typeof error.code === "string" && systemCodes.has(error.code))
					? error.code
					: null,
			signal: typeof error.signal === "string" && /^SIG[A-Z0-9]+$/.test(error.signal) ? error.signal : null,
			killed: error.killed === true,
		};
		throw new Error(`Title native child failed: ${JSON.stringify(diagnostics)}`);
	}
}
