import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EventValidationError, redactEvent, validateEvent, validateEventContext } from "../src/events.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/employee-events.json", import.meta.url), "utf8"));
const event = () => structuredClone(fixture.event);

test("unknown raw content is dropped without accessing its getter", () => {
	const value = event();
	Object.defineProperty(value, "prompt", {
		enumerable: true,
		get() {
			throw new Error("private-body-must-not-be-read");
		},
	});
	const safe = redactEvent(value);
	assert.equal(safe.redaction.droppedFields, 1);
	assert.equal(Object.hasOwn(safe, "prompt"), false);
});

test("portable observation control and absent measurements", () => {
	const value = event();
	assert.deepEqual(validateEvent(value, fixture.context), value);
	assert.equal(value.modelConfidence, 0);
	delete value.measurements;
	delete value.modelConfidence;
	assert.equal(validateEvent(value).measurements, undefined);
});

for (const [field, value] of [
	["schemaVersion", "2.0.0"],
	["kind", "tool-output"],
	["sequence", true],
	["sequence", 0],
	["sequence", 2 ** 53],
	["observedAt", "yesterday"],
	["status", "PASS"],
	["eventType", "prompt"],
	["eventId", "line\nbreak"],
	["spanId", "0".repeat(16)],
	["spanId", "short"],
	["toolName", "../?secret=key"],
] as const)
	test(`invalid ${field} is value-free`, () => {
		const record = event();
		record[field] = value;
		assert.throws(
			() => validateEvent(record),
			(error: unknown) => error instanceof EventValidationError && !error.message.includes(String(value)),
		);
	});

for (const field of ["customerId", "assetId", "taskId", "employeeId"])
	test(`owner ${field} stays bound`, () => {
		const record = event();
		record.context.scope[field] = "another-owner";
		assert.throws(() => validateEvent(record, fixture.context), /event_scope_mismatch/);
	});
for (const field of ["runId", "taskRevision", "qualification"])
	test(`${field} stays bound`, () => {
		const record = event();
		record.context[field] = field === "qualification" ? "live" : "another";
		assert.throws(() => validateEvent(record, fixture.context), EventValidationError);
	});
for (const value of [true, -1, NaN, Infinity, "estimated"])
	test(`invalid observed human timing ${value}`, () => {
		const record = event();
		record.measurements.humanReviewSeconds = value;
		assert.throws(() => validateEvent(record), EventValidationError);
	});

test("unknown bodies and source locations are forbidden", () => {
	const record = event();
	record.arguments = { credential: "credential-do-not-emit" };
	assert.throws(() => validateEvent(record), EventValidationError);
	delete record.arguments;
	record.refs[0].uri = "https://source.invalid/?token=private";
	assert.throws(() => validateEvent(record), EventValidationError);
});
test("reference hashes and duplicates remain truthful", () => {
	const record = event();
	record.refs[0].sha256 = "guessed";
	assert.throws(() => validateEvent(record), EventValidationError);
	const duplicate = event();
	duplicate.refs.push(structuredClone(duplicate.refs[0]));
	assert.throws(() => validateEvent(duplicate), EventValidationError);
});
test("model prose cannot log an approved tool", () => {
	const record = event();
	record.status = "approved";
	assert.throws(() => validateEvent(record), EventValidationError);
	record.eventType = "review";
	assert.equal(validateEvent(record).status, "approved");
});
test("zero trace and unknown context are rejected", () => {
	const context = structuredClone(fixture.context);
	context.traceId = "0".repeat(32);
	assert.throws(() => validateEventContext(context), EventValidationError);
	context.traceId = fixture.context.traceId;
	context.authority = "model-approved";
	assert.throws(() => validateEventContext(context), EventValidationError);
});
test("redaction happens before emission and detaches nested values", () => {
	const record = event();
	record.prompt = "raw prompt credential-do-not-emit";
	record.arguments = { key: "credential-do-not-emit" };
	record.refs[0].body = "confidential source body";
	record.refs[0].uri = "file:///private/well.las";
	record.versions.model.credential = "credential-do-not-emit";
	record.toolName = "credential-do-not-emit";
	const safe = redactEvent(record, ["credential-do-not-emit"]);
	assert.ok(!JSON.stringify(safe).includes("credential-do-not-emit"));
	assert.ok(!JSON.stringify(safe).includes("confidential source body"));
	assert.ok(!JSON.stringify(safe).includes("file:///private"));
	assert.equal(safe.toolName, "redacted");
	assert.equal(safe.redaction.droppedFields, 5);
	assert.equal(safe.redaction.redactedValues, 1);
	assert.equal(record.toolName, "credential-do-not-emit");
	safe.context.scope.customerId = "mutated";
	assert.equal(record.context.scope.customerId, "operator-fixture");
});
test("redaction never changes the owner to hide a secret", () => {
	const record = event();
	record.context.scope.customerId = "credential-do-not-emit";
	assert.throws(() => redactEvent(record, ["credential-do-not-emit"]), /unsafe_event/);
});
for (const values of [["x"], [""], ["x".repeat(4097)], Array.from({ length: 129 }, (_, i) => `secret-value-${i}`)])
	test("redaction configuration is bounded", () =>
		assert.throws(() => redactEvent(event(), values), EventValidationError));
test("cycles and oversize are rejected without raw diagnostics", () => {
	const record = event();
	record.refs = [record];
	assert.throws(() => redactEvent(record), EventValidationError);
	const huge = event();
	huge.refs = Array(65).fill(huge.refs[0]);
	assert.throws(() => redactEvent(huge), EventValidationError);
});

test("native lifecycle and uncertain dispatch are explicit", () => {
	const record = event();
	record.eventType = "agent";
	record.attempt = 1;
	record.effectUnknown = true;
	assert.equal(validateEvent(record).effectUnknown, true);
	record.attempt = 0;
	assert.throws(() => validateEvent(record), EventValidationError);
});

test("producer stream is required to disambiguate restarts", () => {
	const record = event();
	delete record.streamId;
	assert.throws(() => validateEvent(record), EventValidationError);
});
for (const [field, value] of [
	["eventId", "event-1\n"],
	["spanId", `${"1".repeat(16)}\n`],
])
	test(`trailing newline in ${field} is rejected`, () => {
		const record = event();
		record[field] = value;
		assert.throws(() => validateEvent(record), EventValidationError);
	});
