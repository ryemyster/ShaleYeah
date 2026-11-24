/* Generated from employee-events 0.1.0. Run pnpm generate; do not edit. */

/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventIdentifier".
 */
export type EventIdentifier = string;

export interface EmployeeEvent {
	schemaVersion: "0.1.0";
	kind: "employee-event";
	eventId: EventIdentifier;
	streamId: EventIdentifier;
	eventType: "task" | "agent" | "context" | "work-product" | "evaluation" | "review" | "tool" | "model" | "source";
	status:
		| "started"
		| "succeeded"
		| "failed"
		| "blocked"
		| "retried"
		| "review-required"
		| "infra-error"
		| "approved"
		| "rejected"
		| "revision-requested";
	observedAt: string;
	occurredAt?: string;
	producer: EventProducer;
	sequence: number;
	context: EmployeeEventContext;
	spanId?: string;
	parentEventId?: EventIdentifier;
	/**
	 * @maxItems 64
	 */
	refs: EventReference[];
	toolName?: EventIdentifier;
	errorCode?: EventIdentifier;
	attempt?: number;
	effectUnknown?: boolean;
	versions?: EventVersions;
	measurements?: EventMeasurements;
	modelConfidence?: number | null;
	redaction: EventRedaction;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventProducer".
 */
export interface EventProducer {
	id: EventIdentifier;
	version: EventIdentifier;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EmployeeEventContext".
 */
export interface EmployeeEventContext {
	runId: EventIdentifier;
	traceId: string;
	scope: EventScope;
	taskRevision: EventIdentifier;
	qualification: "fixture" | "live";
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventScope".
 */
export interface EventScope {
	customerId: EventIdentifier;
	assetId: EventIdentifier;
	taskId: EventIdentifier;
	employeeId: EventIdentifier;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventReference".
 */
export interface EventReference {
	kind: "task" | "context" | "work-product" | "evaluation" | "review" | "source" | "profile";
	id: EventIdentifier;
	revision: EventIdentifier;
	sha256: string;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventVersions".
 */
export interface EventVersions {
	model?: EventModel;
	runtime?: EventRuntime;
	harness?: EventRuntime;
	judge?: EventModel;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventModel".
 */
export interface EventModel {
	provider: EventIdentifier;
	id: EventIdentifier;
	revision: EventIdentifier;
	reportedRevision?: EventIdentifier;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventRuntime".
 */
export interface EventRuntime {
	id: EventIdentifier;
	version: EventIdentifier;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventMeasurements".
 */
export interface EventMeasurements {
	modelLatencyMs?: number;
	toolLatencyMs?: number;
	humanReviewSeconds?: number;
	corrections?: number;
	reworkCount?: number;
	taskCompleted?: boolean;
	escalationQuality?: number;
	toolFailures?: number;
}
/**
 * This interface was referenced by `EmployeeEvent`'s JSON-Schema
 * via the `definition` "EventRedaction".
 */
export interface EventRedaction {
	policy: EventProducer;
	droppedFields: number;
	redactedValues: number;
}
