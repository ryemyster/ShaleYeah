import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { forecastFixture, now, who } from "./forecast.js";

export async function localBindingFixture(options: { unsafeSource?: boolean; liveClock?: boolean } = {}) {
	const f = forecastFixture(),
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "curve-smith-binding-")));
	const inputs = path.join(root, "inputs"),
		state = path.join(root, "state"),
		file = path.join(root, "binding.json"),
		secretFile = path.join(root, "access-key");
	await fs.mkdir(inputs, { mode: 0o700 });
	await fs.mkdir(state, { mode: 0o700 });
	if (options.liveClock) {
		const end = Date.now() - 3600000;
		for (const well of f.history.wells) {
			const origin = end - well.observations.at(-1)!.elapsedTime * f.history.timeBasis.daysPerUnit * 86400000;
			well.origin = new Date(origin).toISOString();
			for (const point of well.observations)
				point.observedAt = new Date(
					origin + point.elapsedTime * f.history.timeBasis.daysPerUnit * 86400000,
				).toISOString();
		}
		f.texts.set("history", JSON.stringify(f.history));
		f.bind();
	}
	const secret = "synthetic-access-value-only";
	if (options.unsafeSource) {
		f.texts.set("assumptions", `category,statement\nprivate,${secret}\n`);
		f.bind();
	}
	await fs.writeFile(secretFile, secret, { mode: 0o600 });
	for (const [key, text] of f.texts) await fs.writeFile(path.join(inputs, `${key}.json`), text, { mode: 0o600 });
	const policy = {
		version: "0.1.0",
		id: "review.reservoir-engineer",
		revision: "r1",
		qualification: "fixture",
		task: f.current.task,
		requester: who,
		reviewerIds: ["human-owner"],
		operation: "record_forecast",
		destination: "private-production-forecasts",
		expiresAt: "2026-01-02T13:00:00Z",
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
		correlation: { runId: "reservoir-engineer.fixture", traceId: "a".repeat(32) },
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
		maxObservationAgeSeconds: 604800,
		maxSourceAgeSeconds: 86400,
		review: { policy, localReviewer: { uid: process.getuid!(), subjectId: "human-owner" } },
	};
	const write = () => fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
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
