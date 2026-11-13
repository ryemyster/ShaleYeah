import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { employeeFixture, now, who } from "./employee.js";

export async function localBindingFixture(options: { unsafeSource?: boolean; liveClock?: boolean } = {}) {
	const f = employeeFixture(),
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "market-binding-")));
	const inputs = path.join(root, "inputs"),
		state = path.join(root, "state"),
		file = path.join(root, "binding.json"),
		secretFile = path.join(root, "access-key");
	await fs.mkdir(inputs, { mode: 0o700 });
	await fs.mkdir(state, { mode: 0o700 });
	const secret = "synthetic-market-access-value-only";
	if (options.unsafeSource) {
		f.input.mandate.region = secret;
		f.texts.set("mandate", JSON.stringify(f.input.mandate));
		f.bind();
	}
	await fs.writeFile(secretFile, secret, { mode: 0o600 });
	for (const [key, text] of f.texts) await fs.writeFile(path.join(inputs, `${key}.json`), text, { mode: 0o600 });
	const policy = {
		version: "0.1.0",
		id: "review.market-analyst",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: ["human-commercial-owner"],
		operation: "record_market_scenarios",
		destination: "private-market-scenarios",
		expiresAt: "2026-11-13T13:00:00Z",
		grantTtlSeconds: 600,
		maxPacketBytes: 2_000_000,
		maxRecords: 20,
		requiredGates: ["no-blockers", "evidence-present", "eval-present"],
		allowedUsagePolicies: [{ id: "policy.operator-data", version: "r1" }],
		contextPolicy: { id: "policy.employee-context", version: "r1" },
		retentionPolicy: { id: "policy.retention", version: "r1" },
		revoked: false,
	};
	const config = {
		version: "0.1.0",
		sourceAuthority: "operator-attested-export",
		qualification: "fixture",
		directory: state,
		auditFile: path.join(state, "events.jsonl"),
		correlation: { runId: "market-analyst.fixture", traceId: "a".repeat(32) },
		...f.current,
		sources: [...f.texts.keys()].map((key) => ({
			file: path.join(inputs, `${key}.json`),
			artifact: f.fetched(`evidence.${key}`).artifact,
		})),
		sourceGrant: {
			subjectId: who.subjectId,
			sourceIds: f.current.task.inputs.map((item) => item.id),
			expiresAt: policy.expiresAt,
			revoked: false,
		},
		sourceOperations: ["read", "export"],
		localOperator: { uid: process.getuid!(), subjectId: who.subjectId },
		sensitiveFiles: [secretFile],
		maxSourceAgeSeconds: 86400,
		review: { policy, localReviewer: { uid: process.getuid!(), subjectId: "human-commercial-owner" } },
	};
	if (options.liveClock) {
		const timestamp = new Date().toISOString(),
			expires = new Date(Date.now() + 3600000).toISOString();
		for (const source of config.sources) {
			source.artifact.evidence.asOf = timestamp;
			source.artifact.retrievedAt = timestamp;
		}
		config.sourceGrant.expiresAt = expires;
		config.review.policy.expiresAt = expires;
	}
	const write = () => fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
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
		candidate: (draft: { work: import("@shaleyeah/contracts").WorkProduct; market: unknown }) => ({
			work: draft.work,
			market: draft.market,
			context: {
				contractVersion: "0.1.0",
				kind: "context-manifest",
				id: "context.market-analyst",
				revision: draft.work.artifact.revision,
				scope: draft.work.scope,
				taskRevision: draft.work.taskRevision,
				contextPolicy: policy.contextPolicy,
				selectedEvidence: draft.work.evidence,
				workingArtifactRefs: [draft.work.artifact],
				sharedKnowledge: [],
				assembledAt: (options.liveClock ? new Date() : now).toISOString(),
				retention: { policy: policy.retentionPolicy, expiresAt: policy.expiresAt },
				budget: { maxItems: 16, maxBytes: 100000, maxTokens: 16000 },
				blockers: [],
			},
			evaluations: [{ id: "eval.market-analyst", revision: "r1", result: "fixture", failures: [] }],
		}),
		close: () => fs.rm(root, { recursive: true, force: true }),
	};
}
