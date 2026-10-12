import assert from "node:assert/strict";
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { EmployeeEvent, EmployeeEventContext } from "@shaleyeah/contracts/events";
import { createJsonlSink, EventEmitter, EventExportError, loadJsonlEmitter } from "../src/events.js";

const context: EmployeeEventContext = {
	runId: "diligence-run-1",
	traceId: "1234567890abcdef1234567890abcdef",
	scope: { customerId: "operator-fixture", assetId: "well-fixture", taskId: "task-fixture", employeeId: "geologist" },
	taskRevision: "r1",
	qualification: "fixture",
};
const producer = { id: "geowiz", version: "1.0.0" };

test("correlated trace preserves hashes, failure and separate human measures", async () => {
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer,
		sink: async (record) => {
			records.push(structuredClone(record));
		},
	});
	const first = await emitter.emit("task", "started");
	await emitter.emit("context", "succeeded", {
		refs: [{ kind: "context", id: "context-1", revision: "r1", sha256: "b".repeat(64) }],
		parentEventId: first.eventId,
	});
	await emitter.emit("model", "succeeded", { measurements: { modelLatencyMs: 12 }, modelConfidence: 0 });
	await emitter.emit("work-product", "succeeded", {
		refs: [{ kind: "work-product", id: "work-1", revision: "r1", sha256: "c".repeat(64) }],
	});
	await emitter.emit("evaluation", "blocked");
	await emitter.emit("review", "revision-requested", {
		measurements: { humanReviewSeconds: 45, corrections: 1, reworkCount: 1 },
	});
	assert.deepEqual(
		records.map((record) => record.sequence),
		[1, 2, 3, 4, 5, 6],
	);
	assert.equal(new Set(records.map((record) => record.eventId)).size, 6);
	assert.ok(records.every((record) => JSON.stringify(record.context) === JSON.stringify(context)));
	assert.equal(records[1].parentEventId, first.eventId);
	assert.equal(records[2].modelConfidence, 0);
	assert.equal(records[2].measurements?.humanReviewSeconds, undefined);
	assert.equal(records[5].measurements?.modelLatencyMs, undefined);
	const directory = await mkdtemp(join(tmpdir(), "shale-event-"));
	try {
		const file = join(directory, "events.jsonl");
		const local = new EventEmitter({ context, producer, sink: createJsonlSink(file) });
		await local.emit("tool", "failed", { toolName: "assess_quality", errorCode: "source_unavailable" });
		assert.equal(JSON.parse(await readFile(file, "utf8")).status, "failed");
		assert.equal((await stat(file)).mode & 0o077, 0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("required sink failure blocks dispatch and uses value-free errors", async () => {
	const emitter = new EventEmitter({
		context,
		producer,
		required: true,
		sink: async () => {
			throw new Error("private-secret-value");
		},
	});
	let dispatched = false;
	await assert.rejects(
		async () => {
			await emitter.emit("tool", "started");
			dispatched = true;
		},
		(error: unknown) => error instanceof EventExportError && !error.message.includes("private-secret-value"),
	);
	assert.equal(dispatched, false);
	assert.equal(emitter.health.failures, 1);
	assert.equal(emitter.health.lastErrorCode, "audit_unavailable");
});
test("optional exporter outage is visible without claiming delivery", async () => {
	const emitter = new EventEmitter({
		context,
		producer,
		required: false,
		sink: async () => {
			throw new Error("private-secret-value");
		},
	});
	assert.equal((await emitter.emit("tool", "failed")).emitted, false);
	assert.equal(emitter.health.failures, 1);
});
test("export timeout is bounded", async () => {
	const emitter = new EventEmitter({ context, producer, timeoutMs: 10, sink: () => new Promise(() => {}) });
	await assert.rejects(emitter.emit("tool", "started"), EventExportError);
	assert.equal(emitter.health.failures, 1);
});
test("backward clock and concurrent calls retain producer order", async () => {
	const times = ["2026-10-11T22:00:00Z", "2026-10-11T21:59:00Z"];
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer,
		clock: () => times.shift()!,
		sink: async (record) => {
			records.push(record);
		},
	});
	await Promise.all([emitter.emit("tool", "started"), emitter.emit("tool", "retried")]);
	assert.deepEqual(
		records.map((record) => record.sequence),
		[1, 2],
	);
	assert.ok(records[1].observedAt < records[0].observedAt);
});
test("caller and exporter mutation never changes the next owner", async () => {
	const bound = structuredClone(context);
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context: bound,
		producer,
		sink: async (record) => {
			records.push(structuredClone(record));
			record.context.scope.customerId = "sink-mutated";
		},
	});
	bound.scope.customerId = "caller-mutated";
	await emitter.emit("task", "started", { context: { authority: "model-approved" } } as never);
	await emitter.emit("task", "succeeded");
	const publicContext = emitter.context;
	publicContext.scope.customerId = "public-mutated";
	assert.deepEqual(emitter.context, context);
	assert.ok(records.every((record) => record.context.scope.customerId === context.scope.customerId));
});
test("injected SIEM sees only redacted metadata", async () => {
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer,
		sensitiveValues: ["private-secret-value"],
		sink: async (record) => {
			records.push(record);
		},
	});
	await emitter.emit("tool", "failed", {
		toolName: "private-secret-value",
		arguments: { secret: "private-secret-value" },
		prompt: "confidential source body",
	} as never);
	assert.ok(!JSON.stringify(records).includes("private-secret-value"));
	assert.ok(!JSON.stringify(records).includes("confidential source body"));
	assert.equal(records[0].redaction.droppedFields, 2);
	assert.equal(records[0].redaction.redactedValues, 1);
});
for (const kind of ["shared", "symlink", "directory", "hardlink"])
	test(`local export refuses ${kind} target`, async () => {
		const directory = await mkdtemp(join(tmpdir(), "shale-event-"));
		try {
			let file = join(directory, "events.jsonl");
			if (kind === "directory") await mkdir(file);
			else {
				await writeFile(file, "", { mode: 0o600 });
				if (kind === "shared") await chmod(file, 0o644);
				if (kind === "symlink") {
					await symlink(file, join(directory, "link.jsonl"));
					file = join(directory, "link.jsonl");
				}
				if (kind === "hardlink") await link(file, join(directory, "other.jsonl"));
			}
			const emitter = new EventEmitter({ context, producer, sink: createJsonlSink(file) });
			await assert.rejects(emitter.emit("task", "started"), EventExportError);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
test("different employees have isolated sequence and context", async () => {
	const other = structuredClone(context);
	other.scope.customerId = "other-operator";
	const records: EmployeeEvent[] = [];
	const emitters = [context, other].map(
		(bound) =>
			new EventEmitter({
				context: bound,
				producer,
				sink: async (record) => {
					records.push(record);
				},
			}),
	);
	await Promise.all(emitters.map((emitter) => emitter.emit("task", "started")));
	assert.deepEqual(
		new Set(records.map((record) => record.context.scope.customerId)),
		new Set(["operator-fixture", "other-operator"]),
	);
	assert.deepEqual(
		records.map((record) => record.sequence),
		[1, 1],
	);
});

test("queued events retain references observed at submission", async () => {
	let release!: () => void;
	let started!: () => void;
	const waiting = new Promise<void>((resolve) => {
		started = resolve;
	});
	const pause = new Promise<void>((resolve) => {
		release = resolve;
	});
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer,
		sink: async (record) => {
			if (!records.length) {
				started();
				await pause;
			}
			records.push(record);
		},
	});
	const first = emitter.emit("task", "started");
	await waiting;
	const refs = [{ kind: "source", id: "source-1", revision: "r1", sha256: "a".repeat(64) }];
	const second = emitter.emit("source", "succeeded", { refs } as never);
	refs[0].sha256 = "b".repeat(64);
	release();
	await Promise.all([first, second]);
	assert.equal(records[1].refs[0].sha256, "a".repeat(64));
});
test("unknown content is removed before any serialization or copying", async () => {
	const records: EmployeeEvent[] = [];
	const emitter = new EventEmitter({
		context,
		producer,
		sink: async (record) => {
			records.push(record);
		},
	});
	await emitter.emit("tool", "failed", { arguments: { callback: () => "private-secret-value" } } as never);
	assert.equal(records.length, 1);
	assert.equal(records[0].redaction.droppedFields, 1);
});

test("same employee restart uses distinct producer streams", async () => {
	const records: EmployeeEvent[] = [];
	for (let index = 0; index < 2; index++) {
		await new EventEmitter({
			context,
			producer,
			sink: async (record) => {
				records.push(record);
			},
		}).emit("task", "started");
	}
	assert.equal(new Set(records.map((record) => record.streamId)).size, 2);
	assert.deepEqual(
		records.map((record) => record.sequence),
		[1, 1],
	);
});

test("private operator JSON loads the local binding and rejects unsafe settings", async () => {
	const directory = await mkdtemp(join(tmpdir(), "shale-event-settings-"));
	try {
		const config = join(directory, "events.json");
		const output = join(directory, "out.jsonl");
		const settings = { version: "0.1.0", context, producer, jsonlFile: output, required: true, timeoutMs: 5000 };
		await writeFile(config, JSON.stringify(settings), { mode: 0o600 });
		await (await loadJsonlEmitter(config)).emit("task", "started");
		assert.deepEqual(JSON.parse(await readFile(output, "utf8")).context, context);
		for (const change of [
			{ version: "2" },
			{ jsonlFile: "relative.jsonl" },
			{ required: "false" },
			{ timeoutMs: 0 },
			{ secret: "private-do-not-emit" },
		]) {
			await writeFile(config, JSON.stringify({ ...settings, ...change }));
			await assert.rejects(loadJsonlEmitter(config), /invalid_event_configuration/);
		}
		await chmod(config, 0o644);
		await assert.rejects(loadJsonlEmitter(config), /invalid_event_configuration/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
