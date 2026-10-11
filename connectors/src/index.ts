import { createHash } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	type ConfiguredSource,
	type ConnectorConfiguration,
	type ConnectorStatus,
	type ContractErrorCode,
	ContractValidationError,
	type Scope,
	type SourceArtifact,
	type SourceFetchRequest,
	type SourceGrant,
	type SourceKind,
	validateConnectorConfiguration,
	validateSourceContract,
} from "@shaleyeah/contracts";
import { inspectContent } from "./content.js";

export interface SourcePrincipal {
	subjectId: string;
	customerId: string;
	employeeId: string;
	scopes: readonly string[];
}
export interface SourceBytes {
	bytes: Uint8Array;
	revision: string;
	asOf: string;
	revisionOrigin: "operator-declared" | "source-reported";
}
export interface InstalledSourceAdapter {
	id: string;
	version: string;
	sourceKinds: readonly SourceKind[];
	fetch(
		source: ConfiguredSource,
		options: { workspaceRoot: string; maxBytes: number; credential?: string; signal: AbortSignal },
	): Promise<SourceBytes>;
}
export interface ConnectorOptions {
	installedAdapters: readonly InstalledSourceAdapter[];
	/** Resolve current authority through a server-owned policy boundary on every access/publication. */
	currentGrant: () => Promise<SourceGrant>;
	audit: (event: SourceAuditEvent) => Promise<void>;
	resolveCredential?: (reference: string, scope: Scope, signal: AbortSignal) => Promise<string>;
	clock?: () => Date;
}
export interface SourceAuditEvent {
	kind: "source-access";
	stage: "authorize" | "retrieved" | "denied";
	scope: Scope;
	taskRevision: string;
	subjectId: string;
	connectorId: string;
	connectorRevision: string;
	sourceId: string | null;
	sourceRevision: string | null;
	contentHash: string | null;
	operation: "fetch" | "health";
	checkedAt: string;
	errorCode: ContractErrorCode | null;
}
export interface FetchedSource {
	artifact: SourceArtifact;
	bytes: Uint8Array;
}
export class SourceAccessError extends Error {
	constructor(public readonly code: ContractErrorCode) {
		super(`Source access rejected: ${code}`);
		this.name = "SourceAccessError";
	}
}
function reject(code: ContractErrorCode): never {
	throw new SourceAccessError(code);
}
function same(left: object, right: object): boolean {
	return (
		Object.entries(left).every(([key, value]) => (right as Record<string, unknown>)[key] === value) &&
		Object.keys(left).length === Object.keys(right).length
	);
}
function cancelled(signal?: AbortSignal): void {
	if (signal?.aborted) reject("source_unavailable");
}

async function bounded<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
	cancelled(signal);
	let stop: () => void = () => {};
	const abort = new Promise<never>((_resolve, fail) => {
		stop = () => fail(new SourceAccessError("source_unavailable"));
		signal.addEventListener("abort", stop, { once: true });
	});
	try {
		return await Promise.race([run(), abort]);
	} finally {
		signal.removeEventListener("abort", stop);
	}
}

/** Reviewed installed adapter: no plugin downloads, remote URL interpretation or implicit path grants. */
export const operatorFileAdapter: InstalledSourceAdapter = {
	id: "operator-file",
	version: "0.1.0",
	sourceKinds: ["operator-file", "licensed-export"],
	async fetch(source, options) {
		if (!constants.O_NOFOLLOW) reject("unsupported_capability");
		const root = path.resolve(options.workspaceRoot);
		if (!path.isAbsolute(options.workspaceRoot) || (await fs.realpath(root)) !== root) reject("access_denied");
		const rootStat = await fs.lstat(root);
		if (!rootStat.isDirectory() || rootStat.mode & 0o022 || (process.getuid && rootStat.uid !== process.getuid()))
			reject("access_denied");
		if (path.isAbsolute(source.locator) || source.locator.split(/[\\/]/).includes("..")) reject("access_denied");
		const file = path.resolve(root, source.locator);
		if (!file.startsWith(`${root}${path.sep}`)) reject("access_denied");
		let parent = root;
		for (const segment of path.relative(root, file).split(path.sep)) {
			parent = path.join(parent, segment);
			const stat = await fs.lstat(parent);
			if (stat.isSymbolicLink()) reject("access_denied");
			if (stat.isDirectory() && (stat.mode & 0o022 || (process.getuid && stat.uid !== process.getuid())))
				reject("access_denied");
		}
		cancelled(options.signal);
		const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			const before = await handle.stat();
			if (!before.isFile() || !(before.mode & 0o444) || before.size < 1 || before.size > options.maxBytes)
				reject("source_unavailable");
			const bytes = Buffer.alloc(Math.min(options.maxBytes + 1, before.size + 1));
			let length = 0;
			while (length < bytes.length) {
				cancelled(options.signal);
				const read = await handle.read(bytes, length, bytes.length - length, length);
				if (!read.bytesRead) break;
				length += read.bytesRead;
			}
			const after = await handle.stat();
			const current = await fs.stat(file);
			if (
				length !== before.size ||
				after.size !== before.size ||
				after.mtimeMs !== before.mtimeMs ||
				after.ctimeMs !== before.ctimeMs ||
				current.ino !== before.ino ||
				current.dev !== before.dev ||
				(await fs.realpath(file)) !== file
			)
				reject("revision_mismatch");
			return {
				bytes: bytes.subarray(0, length),
				revision: source.evidence.revision,
				asOf: source.evidence.asOf,
				revisionOrigin: "operator-declared",
			};
		} finally {
			await handle.close();
		}
	},
};

export function createConnectorRuntime(value: unknown, options: ConnectorOptions) {
	const config: ConnectorConfiguration = structuredClone(validateConnectorConfiguration(value));
	const installed = options.installedAdapters.find(
		(item) => item.id === config.adapterRef.id && item.version === config.adapterRef.version,
	);
	if (!installed || config.sources.some((source) => !installed.sourceKinds.includes(source.sourceKind)))
		reject("unsupported_capability");
	const adapter = installed;
	const issued = new WeakMap<FetchedSource, string>();
	const clock = options.clock ?? (() => new Date());
	async function emit(
		stage: SourceAuditEvent["stage"],
		input: SourceFetchRequest,
		principal: SourcePrincipal,
		errorCode: ContractErrorCode | null = null,
		signal?: AbortSignal,
	) {
		const source = config.sources.find((source) => source.evidence.id === input.sourceRef?.id);
		const event: SourceAuditEvent = {
			kind: "source-access",
			stage,
			scope: structuredClone(config.scope),
			taskRevision: config.taskRevision,
			subjectId: principal.subjectId,
			connectorId: config.manifest.id,
			connectorRevision: config.manifest.revision,
			sourceId: source?.evidence.id ?? null,
			sourceRevision: source?.evidence.revision ?? null,
			contentHash: stage === "retrieved" ? (source?.evidence.hash.value ?? null) : null,
			operation: input.operation === "health" ? "health" : "fetch",
			checkedAt: clock().toISOString(),
			errorCode,
		};
		try {
			await bounded(() => options.audit(event), signal ?? AbortSignal.timeout(config.manifest.limits.timeoutMs));
		} catch {
			reject("source_unavailable");
		}
	}
	function sourceFor(id: string): ConfiguredSource {
		const source = config.sources.find((item) => item.evidence.id === id);
		if (!source) reject("access_denied");
		return source;
	}
	async function authorize(
		request: SourceFetchRequest,
		principal: SourcePrincipal,
		signal?: AbortSignal,
	): Promise<ConfiguredSource> {
		cancelled(signal);
		const parsed = validateSourceContract(request, {
			expectedScope: config.scope,
			expectedTaskRevision: config.taskRevision,
		});
		if (parsed.kind !== "source-fetch-request") reject("invalid_contract");
		if (
			principal.customerId !== config.scope.customerId ||
			principal.employeeId !== config.scope.employeeId ||
			request.connectorRef.id !== config.manifest.id ||
			request.connectorRef.revision !== config.manifest.revision
		)
			reject("access_denied");
		const grant = await bounded(options.currentGrant, signal ?? AbortSignal.timeout(config.manifest.limits.timeoutMs));
		cancelled(signal);
		// Validate the new grant using the same private schema without allowing it to replace source descriptors.
		validateConnectorConfiguration({ ...config, grant });
		if (
			grant.revoked ||
			Date.parse(grant.expiresAt) <= clock().getTime() ||
			grant.subjectId !== principal.subjectId ||
			!same(grant.scope, request.scope) ||
			grant.taskRevision !== request.taskRevision ||
			!grant.sourceIds.includes(request.sourceRef.id) ||
			!grant.operations.includes(request.operation) ||
			!config.manifest.allowedOperations.includes(request.operation) ||
			[...grant.requiredScopes, ...config.manifest.requiredScopes].some((scope) => !principal.scopes.includes(scope))
		)
			reject("access_denied");
		const source = sourceFor(request.sourceRef.id);
		if (source.evidence.revision !== request.sourceRef.revision) reject("revision_mismatch");
		if (!same(source.evidence.usagePolicy, grant.usagePolicy)) reject("access_denied");
		await emit("authorize", request, principal, null, signal);
		return source;
	}
	function request(id: string): SourceFetchRequest {
		const source = sourceFor(id);
		return {
			kind: "source-fetch-request",
			contractVersion: "0.1.0",
			scope: structuredClone(config.scope),
			taskRevision: config.taskRevision,
			connectorRef: { id: config.manifest.id, revision: config.manifest.revision },
			sourceRef: { id, revision: source.evidence.revision },
			operation: "fetch",
			expectedUnits: structuredClone(source.units),
		};
	}
	async function fetchSource(
		input: SourceFetchRequest,
		principal: SourcePrincipal,
		signal?: AbortSignal,
	): Promise<FetchedSource> {
		const deadline = AbortSignal.timeout(config.manifest.limits.timeoutMs);
		const execution = signal ? AbortSignal.any([signal, deadline]) : deadline;
		try {
			return await bounded(async () => {
				const source = await authorize(input, principal, execution);
				const asOf = Date.parse(source.evidence.asOf);
				const age = clock().getTime() - asOf;
				if (age < 0 || age > config.manifest.limits.maxAgeSeconds * 1000) reject("stale_evidence");
				const credential = config.credentialRef
					? await options.resolveCredential?.(config.credentialRef, structuredClone(config.scope), execution)
					: undefined;
				cancelled(execution);
				if (config.credentialRef && !credential) reject("access_denied");
				await authorize(input, principal, execution);
				const raw = await adapter.fetch(structuredClone(source), {
					workspaceRoot: config.workspaceRoot,
					maxBytes: config.manifest.limits.maxBytes,
					credential,
					signal: execution,
				});
				cancelled(execution);
				if (
					!(raw.bytes instanceof Uint8Array) ||
					!raw.bytes.byteLength ||
					raw.bytes.byteLength > config.manifest.limits.maxBytes
				)
					reject("source_unavailable");
				const bytes = Buffer.from(raw.bytes);
				const hash = createHash("sha256").update(bytes).digest("hex");
				if (
					hash !== source.evidence.hash.value ||
					raw.revision !== source.evidence.revision ||
					raw.asOf !== source.evidence.asOf
				)
					reject("revision_mismatch");
				const inspected = inspectContent(bytes, source);
				if (input.expectedUnits.some((expected) => !inspected.units.some((actual) => same(expected, actual))))
					reject("conflicting_evidence");
				await authorize(input, principal, execution);
				const artifact = validateSourceContract({
					kind: "source-artifact",
					contractVersion: "0.1.0",
					scope: config.scope,
					taskRevision: config.taskRevision,
					connectorRef: input.connectorRef,
					adapterRef: config.adapterRef,
					sourceKind: source.sourceKind,
					evidence: source.evidence,
					artifact: { id: source.evidence.id, revision: hash, uri: `urn:sha256:${hash}` },
					retrievedAt: clock().toISOString(),
					format: source.format,
					...inspected,
					jurisdiction: source.jurisdiction,
					byteLength: bytes.byteLength,
					accessNotes: source.accessNotes,
					licenseNotes: source.licenseNotes,
					revisionOrigin: raw.revisionOrigin,
				});
				if (artifact.kind !== "source-artifact") reject("invalid_contract");
				await emit("retrieved", input, principal, null, execution);
				const result = { artifact, bytes };
				issued.set(result, JSON.stringify(artifact));
				return result;
			}, execution);
		} catch (error) {
			const code =
				error instanceof SourceAccessError || error instanceof ContractValidationError
					? error.code
					: "source_unavailable";
			await emit("denied", input, principal, code);
			reject(code);
		}
	}
	async function health(
		input: SourceFetchRequest,
		principal: SourcePrincipal,
		signal?: AbortSignal,
	): Promise<ConnectorStatus> {
		let errorCode: ContractErrorCode | null = null;
		try {
			if (input.operation !== "health") reject("invalid_contract");
			await fetchSource(input, principal, signal);
		} catch (error) {
			errorCode = error instanceof SourceAccessError ? error.code : "source_unavailable";
		}
		const record = validateSourceContract({
			kind: "connector-status",
			contractVersion: "0.1.0",
			scope: input.scope,
			taskRevision: input.taskRevision,
			connectorRef: input.connectorRef,
			sourceRef: input.sourceRef,
			checkedAt: clock().toISOString(),
			status:
				errorCode === null
					? "ready"
					: ["access_denied", "authority_denied", "scope_mismatch"].includes(errorCode)
						? "denied"
						: "unavailable",
			errorCode,
		});
		if (record.kind !== "connector-status") reject("invalid_contract");
		return record;
	}
	async function withSnapshot<T>(
		result: FetchedSource,
		principal: SourcePrincipal,
		run: (file: string) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		if (issued.get(result) !== JSON.stringify(result.artifact)) reject("invalid_contract");
		const input = request(result.artifact.evidence.id);
		await authorize(input, principal, signal);
		if (createHash("sha256").update(result.bytes).digest("hex") !== result.artifact.evidence.hash.value)
			reject("revision_mismatch");
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shaleyeah-source-"));
		try {
			await fs.chmod(directory, 0o700);
			const file = path.join(directory, `input.${result.artifact.format}`);
			await fs.writeFile(file, result.bytes, { mode: 0o400, flag: "wx" });
			const output = await run(file);
			await authorize(input, principal, signal);
			return output;
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	}
	function requestForPath(locator: string): SourceFetchRequest {
		const source = config.sources.find(
			(item) =>
				item.evidence.id === locator ||
				item.locator === locator ||
				path.resolve(config.workspaceRoot, item.locator) === locator,
		);
		if (!source) reject("access_denied");
		return request(source.evidence.id);
	}
	return { request, requestForPath, fetch: fetchSource, health, withSnapshot };
}
export type ConnectorRuntime = ReturnType<typeof createConnectorRuntime>;
