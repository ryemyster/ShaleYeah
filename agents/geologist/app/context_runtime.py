"""Native ADK runner/session adapter for one authenticated, scoped employee task."""

from __future__ import annotations

import copy
import fcntl
import hashlib
import inspect
import os
from contextlib import aclosing

from google.adk.apps import App
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.adk.sessions.base_session_service import GetSessionConfig, ListSessionsResponse
from google.genai import types

from app.agent import create_geologist_agent
from app.employee_events import GeologistEvents
from app.geowiz_mcp import _backend_config, _missing_credential
from app.model_provider import resolve_file_credential
from app.working_context import ContextError, _guard, canonical, private_file


def _request_hash(request):
    return hashlib.sha256(
        canonical(
            {
                "request": request.model_dump_json(exclude_none=True),
                "usesTools": bool(request.tools_dict),
            }
        )
    ).hexdigest()


class ScopedSessions(DatabaseSessionService):
    """Framework identifiers select a session only after business authority succeeds."""

    def __init__(self, file, catalog, app_name, user_id, session_id, event_guard):
        super().__init__(db_url="sqlite+aiosqlite:///" + str(file), echo=False)
        self.catalog = catalog
        self.identity = {"app_name": app_name, "user_id": user_id, "session_id": session_id}
        self.event_guard = event_guard

    async def _gate(self, operation, app_name, user_id, session_id=None):
        if (
            app_name != self.identity["app_name"]
            or user_id != self.identity["user_id"]
            or (session_id is not None and session_id != self.identity["session_id"])
        ):
            raise ContextError("scope_mismatch")
        await self.catalog._authorize(operation)

    @staticmethod
    def _state(value):
        if type(value) is not dict or any(
            key
            not in {
                "taskRevision",
                "contextManifestRef",
                "contextArtifactRefs",
                "nativeEventCount",
                "temp:model_requests",
                "temp:context_blocked",
            }
            for key in value
        ):
            raise ContextError("invalid_session_state")
        _guard(value)

    async def create_session(self, *, app_name, user_id, state=None, session_id=None):
        if session_id is None:
            raise ContextError("scope_mismatch")
        await self._gate("write", app_name, user_id, session_id)
        self._state(state or {})
        return await super().create_session(
            app_name=app_name, user_id=user_id, state=state, session_id=session_id
        )

    async def get_session(self, *, app_name, user_id, session_id, config=None):
        await self._gate("read", app_name, user_id, session_id)
        # A current catalog check happens before SQLite materializes even session metadata.
        _, _, _, omitted = await self.catalog._snapshot()
        if omitted:
            raise ContextError("history_unavailable")
        metadata = await super().get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            config=GetSessionConfig(num_recent_events=0),
        )
        if metadata is None:
            return None
        self._state(metadata.state)
        task = await self.catalog._task()
        if metadata.state.get("taskRevision") != task["revision"]:
            raise ContextError("revision_mismatch")
        # Native metadata contains only IDs/revisions. Older history/backup references
        # must still resolve before the second read loads any conversation content.
        await self.catalog.authorize_history(metadata.state.get("contextArtifactRefs", []))
        if config and config.num_recent_events == 0:
            return metadata
        return await super().get_session(
            app_name=app_name, user_id=user_id, session_id=session_id, config=config
        )

    async def list_sessions(self, *, app_name, user_id=None):
        await self._gate("read", app_name, user_id)
        session = await self.get_session(
            **self.identity, config=GetSessionConfig(num_recent_events=0)
        )
        return ListSessionsResponse(sessions=[session] if session else [])

    async def append_event(self, session, event):
        await self._gate("write", session.app_name, session.user_id, session.id)
        self._state(event.actions.state_delta)
        await self.catalog.authorize_history(session.state.get("contextArtifactRefs", []))
        count = session.state.get("nativeEventCount", 0)
        if type(count) is not int or count >= self.catalog.policy["maxRecords"]:
            raise ContextError("record_limit")
        event.actions.state_delta["nativeEventCount"] = count + 1
        await self.event_guard(event.model_dump(mode="json", exclude_none=True))
        return await super().append_event(session, event)

    async def delete_session(self, *, app_name, user_id, session_id):
        await self._gate("delete", app_name, user_id, session_id)
        return await super().delete_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )


class GeologistRuntime:
    """Owns a catalog and one native session; no new reasoning/orchestration loop."""

    @classmethod
    async def open(
        cls,
        catalog,
        config,
        *,
        backend_config=None,
        resolve_credential=resolve_file_credential,
        adapter_factory=None,
        events=None,
    ):
        self = cls()
        self.catalog, self.config = catalog, copy.deepcopy(config)
        config = self.config
        self._host_content_guard = catalog.content_guard
        self._backend = backend_config or _backend_config()
        self._resolve, self._events = (
            resolve_credential,
            GeologistEvents(events, config.agent) if events else None,
        )
        self._running, self._packet, self._count_calls = False, None, 0
        self._sealed_request = None
        if any(
            profile["owner"] != {key: catalog.scope[key] for key in ("customerId", "employeeId")}
            for profile in (config.agent, config.synthesis)
        ):
            raise ContextError("scope_mismatch")
        if catalog.policy["reservedTokens"] < config.agent["limits"]["maxOutputTokens"]:
            raise ContextError("invalid_configuration")
        await catalog._authorize("read")
        await catalog._authorize("write")
        self.app_name = "geologist_" + catalog.namespace[:24]
        self.user_id = "principal-" + hashlib.sha256(canonical(catalog.principal)).hexdigest()[:32]
        self.session_id = "task-" + catalog.namespace[:32]
        self._lock = os.open(
            private_file(catalog.root, "runtime-" + catalog.namespace + ".lock"),
            os.O_RDWR | os.O_NOFOLLOW,
        )
        try:
            fcntl.flock(self._lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(self._lock)
            raise ContextError("writer_unavailable") from None
        try:
            self.sessions = ScopedSessions(
                private_file(catalog.root, "sessions.sqlite"),
                catalog,
                self.app_name,
                self.user_id,
                self.session_id,
                self.guard_content,
            )
            options = {
                "backend_config": self._backend,
                "resolve_credential": resolve_credential,
                "events": events,
                "context_hooks": self,
            }
            if adapter_factory is not None:
                options["adapter_factory"] = adapter_factory
            self.agent = create_geologist_agent(config, **options)
            self.model = self.agent.model
            self.runner = Runner(
                app=App(name=self.app_name, root_agent=self.agent), session_service=self.sessions
            )
            catalog.content_guard = self.guard_content
            return self
        except BaseException:
            if hasattr(self, "sessions"):
                await self.sessions.close()
            os.close(self._lock)
            raise

    async def guard_content(self, value):
        _guard(value)
        serialized = canonical(value).decode()
        if len(serialized.encode()) > self.catalog.policy["maxRecordBytes"]:
            raise ContextError("record_limit")
        if self._host_content_guard is not None:
            guarded = self._host_content_guard(copy.deepcopy(value))
            if inspect.isawaitable(guarded):
                await guarded
        try:
            for profile in (self.config.agent, self.config.synthesis):
                if profile["credentialRef"] in serialized:
                    raise ContextError("secret_in_context")
            # The remote synthesis key belongs to the executing tool, not this employee.
            profile = self.config.agent
            key = await self._resolve(
                copy.deepcopy(profile["owner"]), profile["credentialRef"], profile["purpose"]
            )
            if (
                not isinstance(key, str)
                or not 8 <= len(key) <= 4096
                or any(character.isspace() for character in key)
            ):
                raise ContextError("credential_unavailable")
            if key in serialized:
                raise ContextError("secret_in_context")
            if self._backend.credential is not _missing_credential:
                key = await self._backend.credential()
                if not isinstance(key, str) or not key:
                    raise ContextError("credential_unavailable")
                if key in serialized:
                    raise ContextError("secret_in_context")
        except ContextError:
            raise
        except Exception:
            raise ContextError("credential_unavailable") from None

    async def _count(self, request):
        self._count_calls += 1
        if self._count_calls > self.catalog.policy["maxCountCalls"]:
            raise ContextError("counter_budget")
        await self.guard_content(request.model_dump(mode="json", exclude_none=True))
        return await self.model.count_tokens(request)

    async def before_model(self, callback_context, llm_request):
        prepared = self.model.prepare_request(llm_request)
        packet = await self.catalog.assemble(prepared, self._count)
        self._packet = packet
        await self.catalog.record_selection(packet)
        if self._events:
            await self._events.record_context(packet["manifest"])
        if packet["status"] != "ready":
            callback_context.state["temp:context_blocked"] = True
            return LlmResponse(
                content=types.Content(
                    role="model",
                    parts=[
                        types.Part(
                            text="Context blocked; narrow the task or restore permitted current inputs."
                        )
                    ],
                ),
                custom_metadata={
                    "contextBlocked": True,
                    "contextManifestRef": {
                        "id": packet["manifest"]["id"],
                        "revision": packet["manifest"]["revision"],
                    },
                },
            )
        self._sealed_request = _request_hash(packet["request"])
        llm_request.contents = copy.deepcopy(packet["request"].contents)
        llm_request.config = packet["request"].config.model_copy(deep=True)
        llm_request.model = packet["request"].model
        callback_context.state["contextManifestRef"] = {
            "id": packet["manifest"]["id"],
            "revision": packet["manifest"]["revision"],
        }
        previous = callback_context.state.get("contextArtifactRefs", [])
        current = [
            {"id": row["id"], "revision": row["revision"]}
            for body in packet["records"].values()
            if (row := self.catalog._record_metadata(body)) is not None
        ]
        callback_context.state["contextArtifactRefs"] = sorted(
            {(ref["id"], ref["revision"]): ref for ref in [*previous, *current]}.values(),
            key=lambda ref: (ref["id"], ref["revision"]),
        )

    async def before_dispatch(self, request):
        if self._packet is None or _request_hash(request) != self._sealed_request:
            raise ContextError("revision_mismatch")
        await self.catalog.authorize_packet(self._packet)

    async def after_tool(self, tool, args, tool_context, tool_response):
        del tool, args, tool_context
        if type(tool_response) is not dict or tool_response.get("isError"):
            return
        payload = tool_response.get("structuredContent", {})
        analysis = payload.get("analysis", {}) if type(payload) is dict else {}
        source = analysis.get("sourceArtifact") if type(analysis) is dict else None
        if source is not None:
            ref = source["artifact"]
            await self.catalog.put_source(source, expected=self.catalog._head(ref["id"]))

    async def run(self, text):
        if self._running:
            raise ContextError("writer_unavailable")
        self._running = True
        self._packet, self._count_calls = None, 0
        self._sealed_request = None
        try:
            await self.catalog._authorize("assemble")
            if not isinstance(text, str) or not text.strip():
                raise ContextError("invalid_contract")
            session = await self.sessions.get_session(
                app_name=self.app_name, user_id=self.user_id, session_id=self.session_id
            )
            await self.guard_content({"text": text})
            if session is None:
                task = await self.catalog._task()
                session = await self.sessions.create_session(
                    app_name=self.app_name,
                    user_id=self.user_id,
                    session_id=self.session_id,
                    state={"taskRevision": task["revision"]},
                )
            message = types.Content(role="user", parts=[types.Part(text=text)])
            async with aclosing(
                self.runner.run_async(
                    user_id=self.user_id, session_id=self.session_id, new_message=message
                )
            ) as stream:
                events = [event async for event in stream]
            return {
                "status": self._packet["status"] if self._packet else "blocked",
                "context": self._packet,
                "events": events,
            }
        except ContextError as error:
            return {"status": "blocked", "code": error.code, "context": self._packet, "events": []}
        finally:
            self._running = False

    async def delete(self, ref):
        await self.catalog._authorize("delete")
        if self._running:
            raise ContextError("writer_unavailable")
        # Purge native conversation first; a crash may lose history, never resurrect it.
        await self.sessions.delete_session(
            app_name=self.app_name, user_id=self.user_id, session_id=self.session_id
        )
        await self.catalog.delete(ref)

    async def reset_history(self):
        """Authorized history deletion preserves the separate task/checkpoint catalog."""
        if self._running:
            raise ContextError("writer_unavailable")
        await self.sessions.delete_session(
            app_name=self.app_name, user_id=self.user_id, session_id=self.session_id
        )

    async def purge_expired(self):
        await self.reset_history()
        return await self.catalog.purge_expired()

    async def close(self):
        try:
            await self.runner.close()
            await self.sessions.close()
        finally:
            await self.catalog.close()
            os.close(self._lock)
