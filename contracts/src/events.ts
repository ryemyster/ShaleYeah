import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { EmployeeEvent, EmployeeEventContext, EventProducer } from "./event-generated.js";

export type * from "./event-generated.js";

export const EVENT_SCHEMA_VERSION = "0.1.0";
export const EVENT_SCHEMA = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/employee-events-0.1.0.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const check = ajv.compile<EmployeeEvent>(EVENT_SCHEMA);
const contextCheck = ajv.compile<EmployeeEventContext>({ $ref: `${EVENT_SCHEMA.$id}#/$defs/EmployeeEventContext` });
const policyCheck = ajv.compile<EventProducer>({ $ref: `${EVENT_SCHEMA.$id}#/$defs/EventProducer` });

export class EventValidationError extends Error {
	constructor(public readonly code: string) {
		super(`Employee event rejected: ${code}`);
		this.name = "EventValidationError";
	}
}
function fail(code = "invalid_event"): never {
	throw new EventValidationError(code);
}

function boundedJson(value: unknown, depth = 0, ancestors = new Set<object>()): boolean {
	if (depth > 8) return false;
	if (value === null || typeof value === "boolean") return true;
	if (typeof value === "string") return value.length <= 65536;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value !== "object" || ancestors.has(value)) return false;
	if (
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) !== Object.prototype &&
		Object.getPrototypeOf(value) !== null
	)
		return false;
	if (Object.getOwnPropertySymbols(value).length || Object.keys(value).length > 256) return false;
	ancestors.add(value);
	const valid = Array.isArray(value)
		? Array.from(value).every((item) => boundedJson(item, depth + 1, ancestors))
		: Object.entries(value).every(([key, item]) => key.length <= 128 && boundedJson(item, depth + 1, ancestors));
	ancestors.delete(value);
	return valid;
}

export function validateEventContext(value: unknown): EmployeeEventContext {
	if (!boundedJson(value) || !contextCheck(value) || value.traceId === "0".repeat(32)) fail();
	return value;
}

export function validateEvent(value: unknown, expectedContext?: EmployeeEventContext): EmployeeEvent {
	if (!boundedJson(value)) fail();
	if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion !== EVENT_SCHEMA_VERSION)
		fail("unsupported_event_version");
	if (!check(value) || Buffer.byteLength(JSON.stringify(value)) > 65536) fail();
	validateEventContext(value.context);
	if (value.spanId === "0".repeat(16)) fail();
	if (["approved", "rejected", "revision-requested"].includes(value.status) && value.eventType !== "review") fail();
	if (new Set(value.refs.map((item) => JSON.stringify([item.kind, item.id, item.revision]))).size !== value.refs.length)
		fail();
	if (expectedContext) {
		validateEventContext(expectedContext);
		const actual = value.context;
		if (
			actual.runId !== expectedContext.runId ||
			actual.traceId !== expectedContext.traceId ||
			actual.taskRevision !== expectedContext.taskRevision ||
			actual.qualification !== expectedContext.qualification ||
			Object.entries(expectedContext.scope).some(
				([key, item]) => actual.scope[key as keyof typeof actual.scope] !== item,
			)
		)
			fail("event_scope_mismatch");
	}
	return value;
}

interface Shape {
	$ref?: string;
	type?: string | string[];
	properties?: Record<string, Shape>;
	items?: Shape;
	maxItems?: number;
}

export function redactEvent(
	value: unknown,
	sensitiveValues: readonly string[] = [],
	policy: EventProducer = { id: "metadata-only", version: "1" },
): EmployeeEvent {
	if (
		!Array.isArray(sensitiveValues) ||
		sensitiveValues.length > 128 ||
		sensitiveValues.some((secret) => typeof secret !== "string" || secret.length < 8 || secret.length > 4096)
	)
		fail("invalid_redaction_policy");
	if (!boundedJson(policy) || !policyCheck(policy)) fail("invalid_redaction_policy");
	if (Object.values(policy).some((text) => sensitiveValues.some((secret) => text.includes(secret))))
		fail("unsafe_event");
	let droppedFields = 0;
	let redactedValues = 0;
	const clean = (item: unknown, initial: Shape, path: string): unknown => {
		const definition = initial.$ref?.split("/").at(-1);
		const shape: Shape = definition ? EVENT_SCHEMA.$defs[definition] : initial;
		if (shape.type === "object") {
			if (
				!item ||
				typeof item !== "object" ||
				Array.isArray(item) ||
				(Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) ||
				Object.getOwnPropertySymbols(item).length ||
				Object.keys(item).length > 256
			)
				fail();
			const result: Record<string, unknown> = {};
			const properties = shape.properties;
			if (!properties) fail();
			for (const key of Object.keys(item)) {
				if (!Object.hasOwn(properties, key)) droppedFields++;
				else if (path !== "" || key !== "redaction")
					result[key] = clean((item as Record<string, unknown>)[key], properties[key], `${path}/${key}`);
			}
			return result;
		}
		if (shape.type === "array") {
			if (!Array.isArray(item) || item.length > (shape.maxItems ?? 64)) fail();
			const itemShape = shape.items;
			if (!itemShape) fail();
			return Array.from(item, (child) => clean(child, itemShape, `${path}/item`));
		}
		if (typeof item === "string" && sensitiveValues.some((secret) => item.includes(secret))) {
			if (path.startsWith("/context/")) fail("unsafe_event");
			redactedValues++;
			return "redacted";
		}
		if (!boundedJson(item) || (item !== null && typeof item === "object")) fail();
		return item;
	};
	const safe = clean(value, EVENT_SCHEMA, "") as Record<string, unknown>;
	safe.redaction = { policy: { ...policy }, droppedFields, redactedValues };
	return validateEvent(safe);
}
