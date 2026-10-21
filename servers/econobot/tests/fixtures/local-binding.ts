import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fixture, now, who } from "./scenario.js";

export async function localBindingFixture(options: { unsafeSource?: boolean; liveClock?: boolean } = {}) {
	const f = fixture(),
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "econobot-binding-")));
	const inputs = path.join(root, "inputs"),
		state = path.join(root, "state"),
		file = path.join(root, "binding.json"),
		secretFile = path.join(root, "access-key");
	await fs.mkdir(inputs, { mode: 0o700 });
	await fs.mkdir(state, { mode: 0o700 });
	const secret = "synthetic-access-value-only";
	if (options.unsafeSource) {
		f.texts.set("assumptions", `category,statement\nprivate,${secret}\n`);
		f.bind();
	}
	await fs.writeFile(secretFile, secret, { mode: 0o600 });
	for (const [key, text] of f.texts) await fs.writeFile(path.join(inputs, `${key}.csv`), text, { mode: 0o600 });
	const owner = { customerId: who.customerId, employeeId: who.employeeId };
	const policy = {
		version: "0.1.0",
		id: "review.economist",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: ["human-owner"],
		operation: "record_scenario",
		destination: "private-economic-scenarios",
		expiresAt: "2026-10-19T13:00:00Z",
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [{ id: "policy.operator-data", version: "r1" }],
		contextPolicy: { id: "policy.employee-context", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
		revoked: false,
	};
	const connectorConfiguration = {
		contractVersion: "0.1.0",
		manifest: {
			contractVersion: "0.1.0",
			kind: "data-connector-manifest",
			id: "connector.operator",
			revision: "r1",
			owner,
			sourceKinds: ["operator-file"],
			formats: ["csv"],
			allowedOperations: ["fetch", "health"],
			requiredScopes: ["source:read"],
			limits: { maxBytes: 1_000_000, maxAgeSeconds: 86400, timeoutMs: 2000 },
		},
		adapterRef: { id: "operator-file", version: "0.1.0" },
		workspaceRoot: inputs,
		credentialRef: null,
		scope: f.current.task.scope,
		taskRevision: f.current.task.revision,
		grant: {
			subjectId: who.subjectId,
			scope: f.current.task.scope,
			taskRevision: f.current.task.revision,
			connectorId: "connector.operator",
			sourceIds: f.current.task.inputs.map((item) => item.id),
			operations: ["fetch", "health"],
			requiredScopes: ["source:read"],
			usagePolicy: { id: "policy.operator-data", version: "r1" },
			expiresAt: policy.expiresAt,
			revoked: false,
		},
		sources: [...f.texts.keys()].map((key) => {
			const source = f.fetched(`evidence.${key}`).artifact;
			return {
				evidence: source.evidence,
				sourceKind: "operator-file",
				format: "csv",
				locator: `${key}.csv`,
				jurisdiction: "US-TX",
				units: source.units,
				accessNotes: "Operator-only",
				licenseNotes: "Synthetic fixture; no vendor data",
			};
		}),
	};
	const config = {
		version: "0.1.0",
		sourceAuthority: "operator-attested-export",
		qualification: "fixture",
		directory: state,
		auditFile: path.join(state, "events.jsonl"),
		correlation: { runId: "economist.fixture", traceId: "a".repeat(32) },
		...f.current,
		connectorConfiguration,
		sourceOperations: ["read", "export"],
		localOperator: { uid: process.getuid!(), subjectId: who.subjectId },
		sensitiveFiles: [secretFile],
		maxPriceAgeSeconds: 86400,
		maxSourceAgeSeconds: 86400,
		review: { policy, localReviewer: { uid: process.getuid!(), subjectId: "human-owner" } },
	};
	const write = () => fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
	if (options.liveClock) {
		const timestamp = new Date().toISOString(),
			expires = new Date(Date.now() + 3600000).toISOString();
		for (const source of config.connectorConfiguration.sources) source.evidence.asOf = timestamp;
		for (const scenario of config.scenarios) scenario.basis.priceDeckAsOf = timestamp;
		config.connectorConfiguration.grant.expiresAt = expires;
		config.review.policy.expiresAt = expires;
	}
	await write();
	return {
		...f,
		root,
		inputs,
		file,
		config,
		secret,
		write,
		clock: options.liveClock ? () => new Date() : () => now,
		close: () => fs.rm(root, { recursive: true, force: true }),
	};
}
