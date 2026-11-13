"""Portable event emitters; exports receive validated metadata, never raw content."""

import asyncio
import copy
import json
import math
import os
import stat
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path

from shaleyeah_contracts.events import EventValidationError, redact_event, validate_event


class EventExportError(RuntimeError):
    def __init__(self, event_id=None):
        self.code = "audit_unavailable"
        self.event_id = event_id
        super().__init__("Employee event export unavailable")


class EventEmitter:
    def __init__(self, context, producer, sink, *, required=True, timeout_seconds=5, sensitive_values=(), policy=None, clock=None):
        if (
            type(required) is not bool or not callable(sink)
            or type(timeout_seconds) not in (int, float) or not math.isfinite(timeout_seconds)
            or not 0 < timeout_seconds <= 120 or (clock is not None and not callable(clock))
        ):
            raise EventValidationError("invalid_export_configuration")
        self._context = copy.deepcopy(context)
        self._producer = copy.deepcopy(producer)
        self._policy = copy.deepcopy(policy)
        self._sensitive = tuple(sensitive_values)
        self._sink = sink
        self._required = required
        self._timeout = timeout_seconds
        self._clock = clock or (lambda: datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"))
        self._sequence = 0
        self._stream_id = str(uuid.uuid4())
        self._lock = asyncio.Lock()
        self._health = {"failures": 0, "lastErrorCode": None}
        # Validate bindings before an invocation can use them, without contacting an exporter.
        self._record("configuration-check", "task", "started", {}, "2026-01-01T00:00:00Z", 1)

    @property
    def context(self):
        return copy.deepcopy(self._context)

    @property
    def required(self):
        return self._required

    @property
    def health(self):
        return dict(self._health)

    def _record(self, event_id, event_type, status, details, observed_at, sequence):
        record = {
            **details, "schemaVersion": "0.1.0", "kind": "employee-event",
            "eventId": event_id, "eventType": event_type, "status": status, "observedAt": observed_at,
            "context": self.context, "producer": copy.deepcopy(self._producer), "sequence": sequence,
            "streamId": self._stream_id,
        }
        record.setdefault("refs", [])
        safe = redact_event(record, sensitive_values=self._sensitive, policy=self._policy)
        return validate_event(safe, expected_context=self._context)

    async def emit(self, event_type, status, **details):
        # Redact before queueing: a waiting caller cannot mutate references or trigger copying of raw bodies.
        self._sequence += 1
        event_id = str(uuid.uuid4())
        try:
            observed_at = self._clock()
        except Exception:
            raise EventValidationError("invalid_event_clock") from None
        safe = self._record(event_id, event_type, status, details, observed_at, self._sequence)
        receipt = {"eventId": event_id, "sequence": self._sequence, "emitted": False}
        async with self._lock:
            try:
                await asyncio.wait_for(self._sink(safe), self._timeout)
            except Exception:
                self._health["failures"] += 1
                self._health["lastErrorCode"] = "audit_unavailable"
                if self._required:
                    raise EventExportError(event_id) from None
                return receipt
            receipt["emitted"] = True
            return receipt


def create_jsonl_sink(file):
    """One writer per private producer file; protect its parent directory too."""
    writer_lock = threading.Lock()

    def write(record):
        payload = (json.dumps(validate_event(record), allow_nan=False, separators=(",", ":")) + "\n").encode()
        with writer_lock:
            if not hasattr(os, "O_NOFOLLOW"):
                raise EventExportError()
            fd = os.open(file, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
            try:
                info = os.fstat(fd)
                if (
                    not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_nlink != 1
                    or (hasattr(os, "getuid") and info.st_uid != os.getuid())
                ):
                    raise EventExportError()
                offset = 0
                while offset < len(payload):
                    written = os.write(fd, payload[offset:])
                    if written <= 0:
                        raise EventExportError()
                    offset += written
                os.fsync(fd)
            finally:
                os.close(fd)

    async def sink(record):
        try:
            await asyncio.to_thread(write, record)
        except Exception:
            raise EventExportError() from None

    return sink


def load_jsonl_emitter(file, *, sensitive_values=()):
    """Read bounded owner-only settings; the JSONL path belongs to the host."""
    try:
        if not hasattr(os, "O_NOFOLLOW"):
            raise ValueError()
        fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_nlink != 1 or (hasattr(os, "getuid") and info.st_uid != os.getuid()):
                raise ValueError()
            with os.fdopen(fd, "rb", closefd=False) as source:
                data = source.read(65537)
            if len(data) > 65536:
                raise ValueError()
            settings = json.loads(data)
        finally:
            os.close(fd)
        if (
            type(settings) is not dict or set(settings) != {"version", "context", "producer", "jsonlFile", "required", "timeoutMs"}
            or settings["version"] != "0.1.0" or type(settings["jsonlFile"]) is not str
            or len(settings["jsonlFile"]) > 4096 or "\0" in settings["jsonlFile"] or not Path(settings["jsonlFile"]).is_absolute()
            or type(settings["required"]) is not bool or type(settings["timeoutMs"]) is not int
            or not 0 < settings["timeoutMs"] <= 120000
        ):
            raise ValueError()
        return EventEmitter(settings["context"], settings["producer"], create_jsonl_sink(settings["jsonlFile"]),
            required=settings["required"], timeout_seconds=settings["timeoutMs"] / 1000, sensitive_values=sensitive_values)
    except Exception:
        raise EventValidationError("invalid_event_configuration") from None
