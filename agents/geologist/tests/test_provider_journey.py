"""Real ADK and protected Geowiz, with explicit offline native-provider transports.

These controls qualify plumbing and role/HITL boundaries, not professional model quality.
"""

import asyncio
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from secrets import token_urlsafe

import httpx
import httpx2
import pytest
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig
from test_model_provider import profile

from app import geowiz_mcp
from app.agent import create_geologist_agent
from app.model_provider import native_adapter, parse_reference_config

REPO = Path(__file__).resolve().parents[3]


def reference(provider, directory):
    value = {"version": "0.1.0", "agent": profile(provider), "synthesis": profile(provider, "synthesis"), "judge": None}
    keys = {}
    for purpose in ("agent", "synthesis"):
        keys[purpose] = token_urlsafe(32)
        file = directory / f"{purpose}-key"
        file.write_text(keys[purpose])
        file.chmod(0o600)
        value[purpose]["credentialRef"] = f"file:{file}"
        value[purpose]["limits"].update(timeoutMs=10_000, maxInputChars=65_536)
    return parse_reference_config(value), value, keys


@asynccontextmanager
async def protected_geowiz(directory, config_value):
    token_file = directory / "access-token"
    token = token_urlsafe(32)
    token_file.write_text(token)
    token_file.chmod(0o600)
    model_file = directory / "models.json"
    model_file.write_text(json.dumps(config_value))
    model_file.chmod(0o600)
    audit_file, receipt_file = directory / "audit.jsonl", directory / "provider-receipt.jsonl"
    config_file = directory / "http.json"
    config_file.write_text(json.dumps({
        "bindHost": "127.0.0.1", "allowedHosts": ["127.0.0.1"], "allowedOrigins": [],
        "principal": {"subjectId": "fixture-operator", "customerId": "fixture", "employeeId": "geologist", "scopes": ["mcp:connect", "geowiz:analyze"]},
        "policy": {"id": "provider-reference", "version": "r1", "connectionScopes": ["mcp:connect"], "toolScopes": {"get_model_profile": ["geowiz:analyze"], "analyze_formation": ["geowiz:analyze"]}, "resourceScopes": {}},
        "accessTokenFile": str(token_file), "auditFile": str(audit_file), "modelConfigFile": str(model_file), "dataPath": str(directory / "data"),
    }))
    config_file.chmod(0o600)
    process = await asyncio.create_subprocess_exec("node", "--import", str(REPO / "servers/geowiz/tests/fixtures/provider-fetch.mjs"), str(REPO / "servers/geowiz/examples/local-http.mjs"),
        env={**os.environ, "PORT": "0", "GEOWIZ_HTTP_CONFIG_FILE": str(config_file), "GEOWIZ_PROVIDER_FIXTURE_RECEIPT_FILE": str(receipt_file)}, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    output = []
    ready = asyncio.get_running_loop().create_future()

    async def read_output():
        while line := await process.stdout.readline():
            text = line.decode(errors="replace")
            output.append(text)
            match = re.search(r"HTTP transport listening on port (\d+)", text)
            if match and not ready.done():
                ready.set_result(int(match.group(1)))
        if not ready.done():
            ready.set_exception(RuntimeError("Fixture Geowiz did not open its listener"))

    reader = asyncio.create_task(read_output())
    try:
        port = await asyncio.wait_for(ready, timeout=10)
        yield MCPClientConfig(endpoint=f"http://127.0.0.1:{port}/mcp", credential=FileBearerCredential(token_file), allow_loopback_http=True), receipt_file, audit_file, output
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except TimeoutError:
                process.kill()
                await process.wait()
        await reader
        assert token not in "".join(output)


async def run_fixture(config, key, backend, tool_name, arguments, case_id, trace_directory=None, backend_calls=None):
    package = httpx if config.agent["provider"] == "gemini" else httpx2
    calls = []

    async def respond(request):
        body = json.loads(request.content)
        assert request.headers["x-goog-api-key" if package is httpx else "x-api-key"] == key
        calls.append(body)
        if len(calls) == 1:
            part = {"functionCall": {"name": tool_name, "args": arguments}} if package is httpx else {"type": "tool_use", "id": "fixture-call", "name": tool_name, "input": arguments}
        else:
            text = "Controlled fixture. Human review and approval required."
            part = {"text": text} if package is httpx else {"type": "text", "text": text}
        if package is httpx:
            payload = {"candidates": [{"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}], "modelVersion": "fixture-native-001"}
        else:
            payload = {"id": "fixture", "type": "message", "role": "assistant", "model": "fixture-native-001", "content": [part], "stop_reason": "tool_use" if len(calls) == 1 else "end_turn", "usage": {"input_tokens": 12, "output_tokens": 16}}
        return package.Response(200, json=payload)

    agent = create_geologist_agent(config, backend_config=backend, adapter_factory=lambda settings, secret: native_adapter(settings, secret, transport=package.MockTransport(respond)))
    service = InMemorySessionService()
    session = await service.create_session(app_name="provider_fixture", user_id="fixture", session_id=case_id)
    runner = Runner(agent=agent, app_name="provider_fixture", session_service=service)
    message = types.Content(role="user", parts=[types.Part(text=f"Offline contract control: {case_id}")])
    try:
        events = [event async for event in runner.run_async(user_id=session.user_id, session_id=session.id, new_message=message)]
    finally:
        await runner.close()
    assert calls and len(calls) <= config.agent["limits"]["maxRequests"]
    assert any(part.function_call and part.function_call.name == tool_name for event in events if event.content for part in event.content.parts)
    if trace_directory:
        trace_directory.mkdir(parents=True, exist_ok=True)
        contents = [{"author": "user", "content": message.model_dump(exclude_none=True)}]
        contents += [{"author": event.author, "content": event.content.model_dump(exclude_none=True)} for event in events if event.content]
        finals = [event.content.model_dump(exclude_none=True) for event in events if event.content and any(part.text for part in event.content.parts)]
        value = {"eval_cases": [{"eval_case_id": case_id, "prompt": message.model_dump(exclude_none=True), "responses": [{"response": finals[-1] if finals else contents[-1]["content"]}], "agent_data": {"agents": {"geologist": {"agent_id": "geologist", "agent_type": "LlmAgent"}}, "turns": [{"turn_index": 0, "events": contents}]}, "runtime_evidence": {"pending_confirmation": any(event.actions.requested_tool_confirmations for event in events), "write_dispatches": sum(name == "save_finding" for name, _arguments in backend_calls) if backend_calls is not None else None}, "provider_fixture": {"provider": config.agent["provider"], "model": config.agent["model"], "revision": config.agent["revision"], "qualityQualified": False}}]}
        (trace_directory / f"{config.agent['provider']}-{case_id}.json").write_text(json.dumps(value))
    return events, calls


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
async def test_adk_to_actual_protected_geowiz_observes_both_model_boundaries(provider, tmp_path):
    config, value, keys = reference(provider, tmp_path)
    trace_path = os.getenv("GEOLOGIST_PROVIDER_TRACE_DIR")
    async with protected_geowiz(tmp_path, value) as (backend, receipt, audit, output):
        events, calls = await run_fixture(config, keys["agent"], backend, "analyze_geowiz_formation", {"file_path": str(REPO / "servers/geowiz/tests/sample-files/sample.las")}, "control_analyze_formation", Path(trace_path) if trace_path else None)
        responses = [part.function_response.response for event in events if event.content for part in event.content.parts if part.function_response and part.function_response.name == "analyze_geowiz_formation"]
        assert responses and responses[0]["isError"] is False
        metadata = responses[0]["structuredContent"]["analysis"]["modelMetadata"]
        assert metadata["provider"] == provider and metadata["model"] == config.synthesis["model"]
        assert metadata["reportedModelRevision"] == "fixture-native-001"
        assert len(calls) == 2
        receipts = [json.loads(line) for line in receipt.read_text().splitlines()]
        assert len(receipts) == 1 and receipts[0]["provider"] == provider
        security = [json.loads(line) for line in audit.read_text().splitlines()]
        assert sum(event["operation"] == "tools/call" and event["decision"] == "allow" for event in security) == 2
        artifact = json.dumps(responses) + audit.read_text() + "".join(output)
        assert all(key not in artifact for key in keys.values())
        assert "credentialRef" not in artifact


ROLE_CASES = [
    ("control_assess_las_quality", "assess_geowiz_quality", {"file_path": "fixture.las"}),
    ("control_process_well_logs", "process_geowiz_well_logs", {"file_path": "fixture.las", "page_size": 25}),
    ("control_process_gis", "process_geowiz_gis", {"file_path": "fixture.geojson"}),
    ("control_process_access_database", "process_geowiz_access_database", {"file_path": "fixture.accdb", "page_size": 25}),
    ("control_process_document", "process_geowiz_document", {"file_path": "fixture.pdf", "extraction_type": "technical"}),
    ("control_process_seismic_data", "process_geowiz_seismic_data", {"file_path": "fixture.segy"}),
    ("control_process_aries_database", "process_geowiz_aries_database", {"file_path": "fixture.adb"}),
    ("boundary_save_without_approval", "save_geowiz_finding", {"finding_type": "formation", "title": "Draft", "summary": "Review", "confidence": 0.1, "data_source": "fixture.las"}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
@pytest.mark.parametrize("case_id, tool, arguments", ROLE_CASES)
async def test_native_adk_preserves_all_role_tools_and_save_approval(provider, case_id, tool, arguments, tmp_path, monkeypatch):
    config, _value, keys = reference(provider, tmp_path)
    observed = []

    async def installed_client(_settings, name, values):
        observed.append((name, values))
        return {"structuredContent": {"success": True, "analysis": {"fixture": True}}, "isError": False, "content": []}

    monkeypatch.setattr(geowiz_mcp, "call_tool", installed_client)
    backend = MCPClientConfig(endpoint="http://127.0.0.1:3001/mcp", credential=FileBearerCredential(tmp_path / "agent-key"), allow_loopback_http=True)
    trace_path = os.getenv("GEOLOGIST_PROVIDER_TRACE_DIR")
    events, _calls = await run_fixture(config, keys["agent"], backend, tool, arguments, case_id, Path(trace_path) if trace_path else None, observed)
    if tool == "save_geowiz_finding":
        assert observed == []
        assert any(event.actions.requested_tool_confirmations for event in events)
    else:
        assert len(observed) == 1
        assert observed[0][0] == tool.replace("_geowiz", "")
        assert observed[0][1]["filePath"] == arguments["file_path"]
