import json

import pytest
from shaleyeah_mcp import MCPClientConfig, MCPClientError


async def credential():
    raise AssertionError("Mocked role mapping must not resolve credentials")


@pytest.mark.asyncio
async def test_native_tool_results_do_not_repeat_complete_structured_packets_as_text(monkeypatch):
    from app import econobot_mcp

    payload = {
        "success": True,
        "analysis": {"cashFlows": [-100, 110], "reviewStatus": "unreviewed"},
    }
    result = {
        "isError": False,
        "structuredContent": payload,
        "content": [{"type": "text", "text": json.dumps(payload)}],
    }

    async def client(*args, **kwargs):
        return result

    monkeypatch.setattr(econobot_mcp, "call_tool", client)
    tools = econobot_mcp.EconomistTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential)
    )
    actual = await tools.read_scenario_inputs("task.eco", "r1")
    assert actual["structuredContent"] == payload
    assert "content" not in actual
    assert "content" in result, "The adapter must not mutate the client receipt"
    result.update(isError=True, structuredContent={"success": False})
    assert (await tools.read_scenario_inputs("task.eco", "r1"))["content"] == result["content"]


@pytest.mark.asyncio
async def test_role_tools_preserve_task_scenario_and_exact_review_references(monkeypatch):
    from app import econobot_mcp

    calls = []

    async def client(config, name, arguments, **kwargs):
        calls.append((config.endpoint, name, arguments))
        return {
            "isError": False,
            "structuredContent": {"success": True, "analysis": {"irr": {"value": None}}},
        }

    monkeypatch.setattr(econobot_mcp, "call_tool", client)
    tools = econobot_mcp.EconomistTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential)
    )
    await tools.read_scenario_inputs("task.eco", "r1")
    await tools.read_scenario_source("source.prices", "r2", 10, 200)
    result = await tools.calculate_scenario("task.eco", "r1", "scenario.base", "r2")
    assert result["structuredContent"]["analysis"]["irr"]["value"] is None
    await tools.compare_scenarios("task.eco", "r1", ["scenario.base", "scenario.low"])
    await tools.draft_scenario("task.eco", "r1", ["scenario.base", "scenario.low"], "r3")
    await tools.prepare_scenario_review('{"work":{}}', "a" * 64)
    await tools.scenario_review_status("review.eco")
    await tools.scenario_review_status()
    await tools.record_scenario("review.eco", "b" * 64, "grant.eco")
    assert [name for _, name, _ in calls] == [
        "read_scenario_inputs",
        "read_scenario_source",
        "calculate_scenario",
        "compare_scenarios",
        "draft_scenario",
        "prepare_review",
        "get_review_status",
        "get_review_status",
        "record_scenario",
    ]
    assert calls[1][2] == {
        "sourceRef": {"id": "source.prices", "revision": "r2"},
        "offset": 10,
        "maxChars": 200,
    }
    assert calls[2][2] == {
        "taskRef": {"id": "task.eco", "revision": "r1"},
        "scenarioRef": {"id": "scenario.base", "revision": "r2"},
    }
    assert calls[4][2] == {
        "taskRef": {"id": "task.eco", "revision": "r1"},
        "scenarioIds": ["scenario.base", "scenario.low"],
        "revision": "r3",
    }
    assert calls[-1][2] == {
        "reviewId": "review.eco",
        "packetDigest": "b" * 64,
        "grantId": "grant.eco",
    }


@pytest.mark.asyncio
async def test_forged_work_cannot_enter_context_before_backend_fidelity_verification(monkeypatch):
    from app import econobot_mcp

    class Hooks:
        async def review_context(self, work):
            raise AssertionError("Unverified model work must not enter the catalog")

    async def client(config, name, arguments, **kwargs):
        assert name == "draft_scenario"
        return {
            "isError": False,
            "structuredContent": {
                "success": True,
                "analysis": {"work": {"artifact": {"revision": "r1"}}, "scenario": {}},
            },
        }

    monkeypatch.setattr(econobot_mcp, "call_tool", client)
    tools = econobot_mcp.EconomistTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        context_hooks=Hooks(),
    )
    candidate = {
        "work": {"artifact": {"revision": "r1"}, "findings": [{"value": 999999}]},
        "scenario": {
            "taskRef": {"id": "task.eco", "revision": "r1"},
            "scenarioIds": ["scenario.base"],
        },
        "evaluations": [],
    }
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_scenario_review(json.dumps(candidate))
    assert caught.value.code == "source_fidelity_mismatch"


@pytest.mark.asyncio
async def test_review_binds_host_context_and_records_exact_pending_checkpoint(monkeypatch):
    from app import econobot_mcp

    work = {"artifact": {"id": "work.eco", "revision": "r1"}}
    scenario = {
        "taskRef": {"id": "task.eco", "revision": "r1"},
        "scenarioIds": ["scenario.base"],
    }
    manifest = {"kind": "context-manifest", "scope": {"employeeId": "employee.eco"}}
    receipt = {"reviewId": "review.eco", "state": "awaiting-review"}
    recorded = []

    class Hooks:
        async def review_context(self, actual_work):
            assert actual_work == work
            return manifest

        async def record_review(self, actual):
            recorded.append(actual)

    async def client(config, name, arguments, **kwargs):
        if name == "draft_scenario":
            return {
                "isError": False,
                "structuredContent": {
                    "success": True,
                    "analysis": {"work": work, "scenario": scenario},
                },
            }
        assert arguments["candidate"]["context"] == manifest
        return {"isError": False, "structuredContent": {"success": True, "analysis": receipt}}

    monkeypatch.setattr(econobot_mcp, "call_tool", client)
    tools = econobot_mcp.EconomistTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        context_hooks=Hooks(),
    )
    candidate = {"work": work, "scenario": scenario, "evaluations": []}
    await tools.prepare_scenario_review(json.dumps(candidate))
    assert recorded == [receipt]
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_scenario_review(json.dumps({**candidate, "context": {"forged": True}}))
    assert caught.value.code == "context_binding_mismatch"


@pytest.mark.asyncio
async def test_supervisor_executes_only_the_bound_approved_private_scenario():
    from app.review_supervision import ReviewSupervisor

    calls = []

    async def client(config, name, arguments):
        calls.append((name, arguments))
        analysis = (
            {
                "reviewId": "review.eco",
                "state": "approved",
                "packetDigest": "a" * 64,
                "grantId": "grant.eco",
            }
            if name == "get_review_status"
            else {"stored": True}
        )
        return {"structuredContent": {"success": True, "analysis": analysis}}

    supervisor = ReviewSupervisor(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=credential),
        client=client,
    )
    assert (await supervisor.resume("review.eco"))["state"] == "completed"
    assert calls[-1] == (
        "record_scenario",
        {"reviewId": "review.eco", "packetDigest": "a" * 64, "grantId": "grant.eco"},
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("candidate", ['{"work":{},"work":{}}', '{"work":NaN}', "[]"])
async def test_invalid_review_json_never_dispatches(monkeypatch, candidate):
    from app import econobot_mcp

    async def forbidden(*args, **kwargs):
        raise AssertionError("Invalid model JSON must not contact the backend")

    monkeypatch.setattr(econobot_mcp, "call_tool", forbidden)
    tools = econobot_mcp.EconomistTools(
        MCPClientConfig(endpoint="https://operator.example/mcp", credential=forbidden)
    )
    with pytest.raises(MCPClientError) as caught:
        await tools.prepare_scenario_review(candidate)
    assert caught.value.code == "invalid_arguments"
