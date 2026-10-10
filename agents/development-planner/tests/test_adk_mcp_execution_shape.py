import pytest

from app import development_mcp
from app.agent import development_backend_status, plan_development_tool_call, root_agent


def test_python_mcp_client_module_exists_for_development_execution() -> None:
    assert development_mcp.DEVELOPMENT_DEFAULT_URL == "http://localhost:3011"
    assert hasattr(development_mcp, "call_development_tool")
    assert hasattr(development_mcp, "create_development_plan")
    assert hasattr(development_mcp, "estimate_project_timeline")
    assert hasattr(development_mcp, "monitor_development_progress")


def test_adk_root_agent_exposes_migrated_development_execution_tools() -> None:
    tool_names = {tool.__name__ for tool in root_agent.tools}

    assert root_agent.name == "development_planner"
    assert {
        "development_backend_status",
        "plan_development_tool_call",
        "create_development_plan",
        "estimate_project_timeline",
        "monitor_development_progress",
    }.issubset(tool_names)


def test_development_status_and_planner_mark_architecture_and_hitl_boundaries() -> None:
    status = development_backend_status()
    planned = plan_development_tool_call("build a Wolfcamp development schedule", "schedule")

    assert status["backend"] == "development"
    assert status["architectureMode"] == "stand-alone-with-progressive-disclosure-skills"
    assert status["independentBackend"] is True
    assert planned["toolName"] == "estimate_project_timeline"
    assert planned["executionBoundary"] == "adk-mcp"
    assert planned["requiresReviewForFinalDevelopmentPlan"] is True
    assert planned["requiresReviewForDevelopmentSanction"] is True
    assert planned["requiresReviewForCapitalApproval"] is True


@pytest.mark.asyncio
async def test_create_development_plan_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(development_mcp, "call_development_tool", fake_call)

    result = await development_mcp.create_development_plan(
        project={
            "name": "Wolfcamp North",
            "location": "Lea County",
            "reserves": 12500000,
            "wellCount": 12,
        },
        timeline="18 months",
        constraints={"budget": 90000000, "technical": ["facility bottleneck"]},
        output_path="plans/wolfcamp.json",
        match_threshold=0.9,
    )

    assert result == {"ok": True}
    assert calls == [
        (
            "create_development_plan",
            {
                "project": {
                    "name": "Wolfcamp North",
                    "location": "Lea County",
                    "reserves": 12500000,
                    "wellCount": 12,
                },
                "timeline": "18 months",
                "constraints": {"budget": 90000000, "technical": ["facility bottleneck"]},
                "outputPath": "plans/wolfcamp.json",
                "matchThreshold": 0.9,
            },
        )
    ]


@pytest.mark.asyncio
async def test_estimate_project_timeline_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(development_mcp, "call_development_tool", fake_call)

    await development_mcp.estimate_project_timeline(
        project_name="Wolfcamp North",
        well_count=12,
        budget=90000000,
        constraints=["surface access", "gas takeaway"],
        match_threshold=0.85,
    )

    assert calls == [
        (
            "estimate_project_timeline",
            {
                "projectName": "Wolfcamp North",
                "wellCount": 12,
                "budget": 90000000,
                "constraints": ["surface access", "gas takeaway"],
                "matchThreshold": 0.85,
            },
        )
    ]


@pytest.mark.asyncio
async def test_monitor_development_progress_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(development_mcp, "call_development_tool", fake_call)

    await development_mcp.monitor_development_progress(
        project_id="dev-123",
        metrics=["schedule", "budget", "safety"],
        reporting_period="weekly",
        output_path="status/dev-123.json",
    )

    assert calls == [
        (
            "monitor_development_progress",
            {
                "projectId": "dev-123",
                "reportingPeriod": "weekly",
                "metrics": ["schedule", "budget", "safety"],
                "outputPath": "status/dev-123.json",
            },
        )
    ]
