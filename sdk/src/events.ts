import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
	type EmployeeEvent,
	type EmployeeEventContext,
	type EventProducer,
	EventValidationError,
	redactEvent,
	validateEvent,
} from "@shaleyeah/contracts/events";

export type { EmployeeEvent, EmployeeEventContext, EventProducer, EventReference } from "@shaleyeah/contracts/events";

export type EventSink = (event: EmployeeEvent) => Promise<void>;
export type EventDetails = Partial<
	Omit<
		EmployeeEvent,
		| "schemaVersion"
		| "kind"
		| "eventId"
		| "streamId"
		| "eventType"
		| "status"
		| "observedAt"
		| "producer"
		| "sequence"
		| "context"
		| "redaction"
	>
>;
export interface EmissionReceipt {
	eventId: string;
	sequence: number;
	emitted: boolean;
}
export interface EventEmitterOptions {
	context: EmployeeEventContext;
	producer: EventProducer;
	sink: EventSink;
	required?: boolean;
	timeoutMs?: number;
	sensitiveValues?: readonly string[];
	policy?: EventProducer;
	clock?: () => string;
}

export class EventExportError extends Error {
	readonly code = "audit_unavailable";
	constructor(public readonly eventId?: string) {
		super("Employee event export unavailable");
		this.name = "EventExportError";
	}
}

export class EventEmitter {
	private readonly boundContext: EmployeeEventContext;
	private readonly producer: EventProducer;
	private readonly sink: EventSink;
	private readonly timeoutMs: number;
	private readonly sensitiveValues: readonly string[];
	private readonly policy?: EventProducer;
	private readonly clock: () => string;
	readonly required: boolean;
	private sequence = 0;
	private readonly streamId = randomUUID();
	private tail: Promise<unknown> = Promise.resolve();
	private exportHealth: { failures: number; lastErrorCode: "audit_unavailable" | null } = {
		failures: 0,
		lastErrorCode: null,
	};

	constructor(options: EventEmitterOptions) {
		this.required = options.required ?? true;
		this.timeoutMs = options.timeoutMs ?? 5000;
		if (
			typeof this.required !== "boolean" ||
			!Number.isFinite(this.timeoutMs) ||
			this.timeoutMs <= 0 ||
			this.timeoutMs > 120000 ||
			typeof options.sink !== "function" ||
			(options.clock !== undefined && typeof options.clock !== "function")
		)
			throw new EventValidationError("invalid_export_configuration");
		this.boundContext = structuredClone(options.context);
		this.producer = structuredClone(options.producer);
		this.sink = options.sink;
		this.sensitiveValues = [...(options.sensitiveValues ?? [])];
		this.policy = options.policy ? structuredClone(options.policy) : undefined;
		this.clock = options.clock ?? (() => new Date().toISOString());
		this.record("configuration-check", "task", "started", {}, "2026-01-01T00:00:00Z", 1);
	}
	get context(): EmployeeEventContext {
		return structuredClone(this.boundContext);
	}
	get health() {
		return { ...this.exportHealth };
	}

	private record(
		eventId: string,
		eventType: EmployeeEvent["eventType"],
		status: EmployeeEvent["status"],
		details: EventDetails,
		observedAt: string,
		sequence: number,
	): EmployeeEvent {
		const safe = redactEvent(
			{
				...details,
				schemaVersion: "0.1.0",
				kind: "employee-event",
				eventId,
				eventType,
				status,
				observedAt,
				context: this.context,
				producer: { ...this.producer },
				sequence,
				streamId: this.streamId,
				refs: details.refs ?? [],
			},
			this.sensitiveValues,
			this.policy,
		);
		return validateEvent(safe, this.boundContext);
	}

	async emit(
		eventType: EmployeeEvent["eventType"],
		status: EmployeeEvent["status"],
		details: EventDetails = {},
	): Promise<EmissionReceipt> {
		// Redact before queueing: raw bodies never enter cloning/serialization diagnostics.
		this.sequence++;
		const eventId = randomUUID();
		let observedAt: string;
		try {
			observedAt = this.clock();
		} catch {
			throw new EventValidationError("invalid_event_clock");
		}
		const safe = this.record(eventId, eventType, status, details, observedAt, this.sequence);
		const receipt = { eventId, sequence: this.sequence, emitted: false };
		const result = this.tail.then(async () => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					Promise.resolve().then(() => this.sink(safe)),
					new Promise<never>((_, reject) => {
						timer = setTimeout(() => reject(new EventExportError(eventId)), this.timeoutMs);
					}),
				]);
				receipt.emitted = true;
				return receipt;
			} catch {
				this.exportHealth.failures++;
				this.exportHealth.lastErrorCode = "audit_unavailable";
				if (this.required) throw new EventExportError(eventId);
				return receipt;
			} finally {
				if (timer !== undefined) clearTimeout(timer);
			}
		});
		this.tail = result.catch(() => {});
		return result;
	}
}

export function createJsonlSink(file: string): EventSink {
	let tail: Promise<unknown> = Promise.resolve();
	return (event) => {
		const snapshot = structuredClone(validateEvent(event));
		const result = tail.then(async () => {
			try {
				const payload = `${JSON.stringify(validateEvent(snapshot))}\n`;
				if (!constants.O_NOFOLLOW) throw new EventExportError();
				const handle = await fs.open(
					file,
					constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
					0o600,
				);
				try {
					const info = await handle.stat();
					if (
						!info.isFile() ||
						info.mode & 0o077 ||
						info.nlink !== 1 ||
						(process.getuid && info.uid !== process.getuid())
					)
						throw new EventExportError();
					await handle.writeFile(payload);
					await handle.sync();
				} finally {
					await handle.close();
				}
			} catch {
				throw new EventExportError();
			}
		});
		tail = result.catch(() => {});
		return result;
	};
}

export async function loadJsonlEmitter(file: string, sensitiveValues: readonly string[] = []): Promise<EventEmitter> {
	try {
		if (!constants.O_NOFOLLOW) throw new Error();
		const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		let settings: Record<string, unknown>;
		try {
			const info = await handle.stat();
			if (!info.isFile() || info.mode & 0o077 || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid()))
				throw new Error();
			const bytes = Buffer.alloc(65537);
			let total = 0;
			while (total < bytes.length) {
				const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
				if (!bytesRead) break;
				total += bytesRead;
			}
			if (total > 65536) throw new Error();
			const parsed: unknown = JSON.parse(bytes.subarray(0, total).toString("utf8"));
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
			settings = parsed as Record<string, unknown>;
		} finally {
			await handle.close();
		}
		const keys = ["version", "context", "producer", "jsonlFile", "required", "timeoutMs"];
		if (
			!settings ||
			typeof settings !== "object" ||
			Array.isArray(settings) ||
			Object.keys(settings).length !== keys.length ||
			!keys.every((key) => Object.hasOwn(settings, key)) ||
			settings.version !== "0.1.0" ||
			typeof settings.jsonlFile !== "string" ||
			settings.jsonlFile.length > 4096 ||
			!path.isAbsolute(settings.jsonlFile) ||
			settings.jsonlFile.includes("\0") ||
			typeof settings.required !== "boolean" ||
			typeof settings.timeoutMs !== "number" ||
			!Number.isSafeInteger(settings.timeoutMs) ||
			settings.timeoutMs <= 0 ||
			settings.timeoutMs > 120000
		)
			throw new Error();
		return new EventEmitter({
			context: settings.context as EmployeeEventContext,
			producer: settings.producer as EventProducer,
			sink: createJsonlSink(settings.jsonlFile),
			required: settings.required,
			timeoutMs: settings.timeoutMs,
			sensitiveValues,
		});
	} catch {
		throw new EventValidationError("invalid_event_configuration");
	}
}
