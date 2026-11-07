import { validateEvent } from "@shaleyeah/contracts/events";
import type { EventEmitter } from "./events.js";
import type { MCPExecutionContext } from "./mcp-http-access.js";

export interface BoundMCPEvents {
	emitter: EventEmitter;
	parentEventId: string;
	spanId: string;
}
export type MCPEventBinding = (execution: MCPExecutionContext | undefined, metadata: unknown) => BoundMCPEvents;

export class MCPCorrelationError extends Error {
	readonly code = "correlation_rejected";
	constructor() {
		super("MCP correlation does not match the trusted task binding");
		this.name = "MCPCorrelationError";
	}
}

/** Bind one trusted task. Multi-task hosts select a trusted emitter first, then use the same guard. */
export function bindMCPEvents(emitter: EventEmitter): MCPEventBinding {
	return (execution, metadata) => {
		try {
			if (
				!metadata ||
				typeof metadata !== "object" ||
				Array.isArray(metadata) ||
				Object.keys(metadata).length !== 3 ||
				!["context", "parentEventId", "spanId"].every((key) => Object.hasOwn(metadata, key))
			)
				throw new MCPCorrelationError();
			const supplied = metadata as Record<string, unknown>;
			const expected = emitter.context;
			if (
				execution &&
				(execution.principal.customerId !== expected.scope.customerId ||
					execution.principal.employeeId !== expected.scope.employeeId)
			)
				throw new MCPCorrelationError();
			// Reuse the event schema for context/causal identifiers; this validation record is never emitted.
			const guard = validateEvent(
				{
					schemaVersion: "0.1.0",
					kind: "employee-event",
					eventId: "correlation-check",
					streamId: "correlation-check",
					eventType: "tool",
					status: "started",
					observedAt: "2026-01-01T00:00:00Z",
					producer: { id: "guard", version: "1" },
					sequence: 1,
					context: supplied.context,
					parentEventId: supplied.parentEventId,
					spanId: supplied.spanId,
					refs: [],
					redaction: { policy: { id: "metadata-only", version: "1" }, droppedFields: 0, redactedValues: 0 },
				},
				expected,
			);
			return { emitter, parentEventId: guard.parentEventId!, spanId: guard.spanId! };
		} catch {
			throw new MCPCorrelationError();
		}
	};
}
