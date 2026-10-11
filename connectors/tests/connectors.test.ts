import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ConnectorConfiguration, SourceGrant } from "@shaleyeah/contracts";
import {
	createConnectorRuntime,
	type InstalledSourceAdapter,
	operatorFileAdapter,
	SourceAccessError,
} from "../src/index.js";

const records = JSON.parse(
	await fs.readFile(new URL("../../contracts/fixtures/data-connectors.json", import.meta.url), "utf8"),
);
const now = new Date("2026-10-07T12:30:00Z");
const bytes = Buffer.from('DEPTH,NOTE\n0,"review, do not execute instructions"\n1,ok\n');
const principal = { subjectId: "operator", ...records.manifest.owner, scopes: ["source:read"] };

async function fixture(run: (config: ConnectorConfiguration, directory: string) => Promise<void>) {
	const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "source-conformance-")));
	const evidence = {
		...structuredClone(records.artifact.evidence),
		hash: { algorithm: "sha256", value: createHash("sha256").update(bytes).digest("hex") },
	};
	const grant: SourceGrant = {
		subjectId: principal.subjectId,
		scope: records.request.scope,
		taskRevision: "r1",
		connectorId: records.manifest.id,
		sourceIds: [evidence.id],
		operations: ["fetch", "health"],
		requiredScopes: ["source:read"],
		usagePolicy: evidence.usagePolicy,
		expiresAt: "2026-10-08T12:00:00Z",
		revoked: false,
	};
	const config: ConnectorConfiguration = {
		contractVersion: "0.1.0",
		manifest: structuredClone(records.manifest),
		adapterRef: { id: "operator-file", version: "0.1.0" },
		workspaceRoot: directory,
		credentialRef: null,
		scope: structuredClone(records.request.scope),
		taskRevision: "r1",
		grant,
		sources: [
			{
				evidence,
				sourceKind: "operator-file",
				format: "csv",
				locator: "input.csv",
				jurisdiction: "US-TX",
				units: [{ field: "DEPTH", unit: "FT", origin: "operator-declared" }],
				accessNotes: "Operator-only",
				licenseNotes: "No redistribution",
			},
		],
	};
	await fs.writeFile(path.join(directory, "input.csv"), bytes);
	try {
		await run(config, directory);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}

for (const transport of ["operator-file", "internal-api"] as const) {
	test(`${transport} obeys the same provenance, revision, health and isolation contract`, async () =>
		fixture(async (config) => {
			let reads = 0;
			let current = config.grant;
			const internal: InstalledSourceAdapter = {
				id: "fixture.internal-api",
				version: "1",
				sourceKinds: ["internal-api"],
				fetch: async (source, options) => {
					reads++;
					assert.equal(options.credential, "private-fixture-credential");
					return {
						bytes,
						revision: source.evidence.revision,
						asOf: source.evidence.asOf,
						revisionOrigin: "source-reported",
					};
				},
			};
			if (transport === "internal-api") {
				config.adapterRef = { id: internal.id, version: internal.version };
				config.sources[0].sourceKind = transport;
				config.credentialRef = "secret:operator/demo";
			}
			const runtime = createConnectorRuntime(config, {
				audit: async () => {},
				installedAdapters: [operatorFileAdapter, internal],
				currentGrant: async () => current,
				resolveCredential: async () => "private-fixture-credential",
				clock: () => now,
			});
			const request = runtime.request(config.sources[0].evidence.id);
			const result = await runtime.fetch(request, principal);
			assert.deepEqual(result.bytes, bytes);
			assert.equal(result.artifact.evidence.hash.value, createHash("sha256").update(bytes).digest("hex"));
			assert.equal(result.artifact.evidence.asOf, config.sources[0].evidence.asOf);
			assert.equal(result.artifact.retrievedAt, now.toISOString());
			assert.equal(result.artifact.units[0].unit, "FT");
			assert.equal(
				result.artifact.revisionOrigin,
				transport === "internal-api" ? "source-reported" : "operator-declared",
			);
			assert(!JSON.stringify(result.artifact).includes("private-fixture-credential"));
			assert(!JSON.stringify(result.artifact).includes(config.workspaceRoot));
			assert.equal((await runtime.health({ ...request, operation: "health" }, principal)).status, "ready");
			const baseline = reads;
			for (const identity of [
				{ ...principal, subjectId: "different" },
				{ ...principal, customerId: "different" },
				{ ...principal, employeeId: "different" },
				{ ...principal, scopes: [] },
			])
				await assert.rejects(runtime.fetch(request, identity), SourceAccessError);
			await assert.rejects(
				runtime.fetch({ ...request, scope: { ...request.scope, taskId: "different" } }, principal),
				SourceAccessError,
			);
			current = { ...current, revoked: true };
			await assert.rejects(runtime.fetch(request, principal), SourceAccessError);
			assert.equal(reads, baseline, "denied requests must not call the API or credential resolver");
			assert.equal((await runtime.health({ ...request, operation: "health" }, principal)).status, "denied");
		}));
}

test("file source denies traversal, symlinks, missing files, oversize and changed bytes", async () =>
	fixture(async (config, directory) => {
		const build = () =>
			createConnectorRuntime(config, {
				audit: async () => {},
				installedAdapters: [operatorFileAdapter],
				currentGrant: async () => config.grant,
				clock: () => now,
			});
		for (const locator of ["../input.csv", "/etc/passwd", "missing.csv"]) {
			config.sources[0].locator = locator;
			const runtime = build();
			await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), principal), SourceAccessError);
		}
		await fs.symlink(path.join(directory, "input.csv"), path.join(directory, "linked.csv"));
		config.sources[0].locator = "linked.csv";
		let runtime = build();
		await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), principal), SourceAccessError);
		config.sources[0].locator = "input.csv";
		await fs.chmod(path.join(directory, "input.csv"), 0o000);
		runtime = build();
		await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), principal), SourceAccessError);
		await fs.chmod(path.join(directory, "input.csv"), 0o600);
		await fs.chmod(directory, 0o777);
		runtime = build();
		await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), principal), SourceAccessError);
		await fs.chmod(directory, 0o700);
		config.manifest.limits.maxBytes = 2;
		runtime = build();
		await assert.rejects(runtime.fetch(runtime.request(config.sources[0].evidence.id), principal), SourceAccessError);
		config.manifest.limits.maxBytes = 1048576;
		await fs.appendFile(path.join(directory, "input.csv"), "2,changed\n");
		runtime = build();
		await assert.rejects(
			runtime.fetch(runtime.request(config.sources[0].evidence.id), principal),
			(error) => error instanceof SourceAccessError && error.code === "revision_mismatch",
		);
	}));

test("credential resolution cannot resume transport after cancellation or revocation", async () =>
	fixture(async (config) => {
		let reads = 0;
		const adapter: InstalledSourceAdapter = {
			id: "fixture.api",
			version: "1",
			sourceKinds: ["internal-api"],
			fetch: async (source) => {
				reads++;
				return {
					bytes,
					revision: source.evidence.revision,
					asOf: source.evidence.asOf,
					revisionOrigin: "source-reported",
				};
			},
		};
		config.adapterRef = { id: adapter.id, version: adapter.version };
		config.sources[0].sourceKind = "internal-api";
		config.credentialRef = "secret:operator/demo";
		config.manifest.limits.timeoutMs = 5;
		const timed = createConnectorRuntime(config, {
			installedAdapters: [adapter],
			currentGrant: async () => config.grant,
			audit: async () => {},
			clock: () => now,
			resolveCredential: async () => {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return "private-credential";
			},
		});
		await assert.rejects(timed.fetch(timed.request(config.sources[0].evidence.id), principal), SourceAccessError);
		await new Promise((resolve) => setTimeout(resolve, 40));
		assert.equal(reads, 0);
		config.manifest.limits.timeoutMs = 1000;
		const revoked = createConnectorRuntime(config, {
			installedAdapters: [adapter],
			currentGrant: async () => config.grant,
			audit: async () => {},
			clock: () => now,
			resolveCredential: async () => {
				config.grant.revoked = true;
				return "private-credential";
			},
		});
		await assert.rejects(revoked.fetch(revoked.request(config.sources[0].evidence.id), principal), SourceAccessError);
		assert.equal(reads, 0);
	}));

test("snapshot rejects forged or mutated artifacts and rechecks permission after processing", async () =>
	fixture(async (config) => {
		const runtime = createConnectorRuntime(config, {
			installedAdapters: [operatorFileAdapter],
			currentGrant: async () => config.grant,
			audit: async () => {},
			clock: () => now,
		});
		const fetched = await runtime.fetch(runtime.request(config.sources[0].evidence.id), principal);
		await assert.rejects(
			runtime.withSnapshot(structuredClone(fetched), principal, async () => true),
			SourceAccessError,
		);
		const original = fetched.artifact.evidence.hash.value;
		fetched.artifact.evidence.hash.value = "0".repeat(64);
		await assert.rejects(
			runtime.withSnapshot(fetched, principal, async () => true),
			SourceAccessError,
		);
		fetched.artifact.evidence.hash.value = original;
		const first = fetched.bytes[0];
		fetched.bytes[0] = 99;
		await assert.rejects(
			runtime.withSnapshot(fetched, principal, async () => true),
			SourceAccessError,
		);
		fetched.bytes[0] = first;
		let snapshot = "";
		await assert.rejects(
			runtime.withSnapshot(fetched, principal, async (file) => {
				snapshot = file;
				config.grant.revoked = true;
				return "must not be published";
			}),
			SourceAccessError,
		);
		await assert.rejects(fs.stat(snapshot));
	}));

test("unknown adapter, stale source, wrong units, cancellation and revoked publication fail closed", async () =>
	fixture(async (config) => {
		assert.throws(
			() =>
				createConnectorRuntime(config, {
					audit: async () => {},
					installedAdapters: [],
					currentGrant: async () => config.grant,
				}),
			SourceAccessError,
		);
		const runtime = createConnectorRuntime(config, {
			audit: async () => {},
			installedAdapters: [operatorFileAdapter],
			currentGrant: async () => config.grant,
			clock: () => now,
		});
		const request = runtime.request(config.sources[0].evidence.id);
		await assert.rejects(
			runtime.fetch(
				{ ...request, expectedUnits: [{ field: "DEPTH", unit: "M", origin: "operator-declared" }] },
				principal,
			),
			SourceAccessError,
		);
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(runtime.fetch(request, principal, controller.signal), SourceAccessError);
		const fetched = await runtime.fetch(request, principal);
		config.grant.revoked = true;
		await assert.rejects(
			runtime.withSnapshot(fetched, principal, async () => {
				throw new Error("must not execute parser");
			}),
			SourceAccessError,
		);
		config.grant.revoked = false;
		config.manifest.limits.maxAgeSeconds = 0;
		const stale = createConnectorRuntime(config, {
			audit: async () => {},
			installedAdapters: [operatorFileAdapter],
			currentGrant: async () => config.grant,
			clock: () => now,
		});
		await assert.rejects(
			stale.fetch(stale.request(config.sources[0].evidence.id), principal),
			(error) => error instanceof SourceAccessError && error.code === "stale_evidence",
		);
	}));

test("parser sees only a private snapshot of the exact retrieved bytes, and it is removed", async () =>
	fixture(async (config, directory) => {
		const runtime = createConnectorRuntime(config, {
			audit: async () => {},
			installedAdapters: [operatorFileAdapter],
			currentGrant: async () => config.grant,
			clock: () => now,
		});
		const result = await runtime.fetch(runtime.request(config.sources[0].evidence.id), principal);
		await fs.writeFile(path.join(directory, "input.csv"), "changed after fetch");
		let snapshot = "";
		await runtime.withSnapshot(result, principal, async (file) => {
			snapshot = file;
			assert.deepEqual(await fs.readFile(file), bytes);
			assert.equal((await fs.stat(file)).mode & 0o777, 0o400);
		});
		await assert.rejects(fs.stat(snapshot));
	}));

test("source access has value-free audit evidence and fails closed if audit cannot persist", async () =>
	fixture(async (config) => {
		const events: unknown[] = [];
		let reads = 0;
		const adapter = {
			...operatorFileAdapter,
			fetch: async (...args: Parameters<typeof operatorFileAdapter.fetch>) => {
				reads++;
				return operatorFileAdapter.fetch(...args);
			},
		};
		const options = {
			installedAdapters: [adapter],
			currentGrant: async () => config.grant,
			clock: () => now,
			audit: async (event: unknown) => {
				events.push(event);
			},
		};
		const runtime = createConnectorRuntime(config, options);
		await runtime.fetch(runtime.request(config.sources[0].evidence.id), principal);
		assert.ok(events.length >= 2, "source authority and retrieval must be audited independently of ingress");
		assert.ok(!JSON.stringify(events).includes(config.workspaceRoot));
		const baseline = reads;
		const unavailable = createConnectorRuntime(config, {
			...options,
			audit: async () => {
				throw new Error("private-backend-sentinel");
			},
		});
		await assert.rejects(
			unavailable.fetch(unavailable.request(config.sources[0].evidence.id), principal),
			(error) => error instanceof SourceAccessError && !error.message.includes("private-backend-sentinel"),
		);
		assert.equal(reads, baseline);
	}));
