import pytest

from app import infrastructure_mcp
from app.agent import infrastructure_backend_status, plan_surface_tool_call, root_agent


def test_python_mcp_client_module_exists_for_infrastructure_execution() -> None:
    assert infrastructure_mcp.INFRASTRUCTURE_DEFAULT_URL == "http://localhost:3012"
    assert hasattr(infrastructure_mcp, "call_infrastructure_tool")
    assert hasattr(infrastructure_mcp, "plan_pipeline")
    assert hasattr(infrastructure_mcp, "size_facilities")
    assert hasattr(infrastructure_mcp, "estimate_costs")
    assert hasattr(infrastructure_mcp, "assess_compliance")


def test_adk_root_agent_exposes_migrated_infrastructure_execution_tools() -> None:
    tool_names = {tool.__name__ for tool in root_agent.tools}

    assert root_agent.name == "infrastructure_planner"
    assert {
        "infrastructure_backend_status",
        "plan_surface_tool_call",
        "plan_pipeline",
        "size_facilities",
        "estimate_costs",
        "assess_compliance",
    }.issubset(tool_names)


def test_infrastructure_status_and_planner_mark_architecture_and_hitl_boundaries() -> None:
    status = infrastructure_backend_status()
    planned = plan_surface_tool_call("estimate infrastructure CAPEX", "capex")

    assert status["backend"] == "infrastructure"
    assert status["architectureMode"] == "stand-alone-with-progressive-disclosure-skills"
    assert status["independentBackend"] is True
    assert planned["toolName"] == "estimate_costs"
    assert planned["executionBoundary"] == "adk-mcp"
    assert planned["requiresReviewForFinalRouteOrFacilityLayout"] is True
    assert planned["requiresReviewForConstructionOrFieldExecution"] is True
    assert planned["requiresReviewForCapitalApproval"] is True
    assert planned["requiresReviewForRegulatoryCertification"] is True
    assert planned["requiresReviewForRightOfWayOrCommercialCommitment"] is True
    assert planned["requiresReviewForSensitiveMemoryPromotion"] is True


@pytest.mark.asyncio
async def test_plan_pipeline_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(infrastructure_mcp, "call_infrastructure_tool", fake_call)

    result = await infrastructure_mcp.plan_pipeline(
        well_count=12,
        expected_production=7200,
        location="Reeves County, TX",
        match_threshold=0.9,
    )

    assert result == {"ok": True}
    assert calls == [
        (
            "plan_pipeline",
            {
                "wellCount": 12,
                "expectedProduction": 7200,
                "location": "Reeves County, TX",
                "matchThreshold": 0.9,
            },
        )
    ]


@pytest.mark.asyncio
async def test_size_facilities_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(infrastructure_mcp, "call_infrastructure_tool", fake_call)

    await infrastructure_mcp.size_facilities(
        well_count=20,
        expected_production=11500,
        location="Lea County, NM",
        match_threshold=0.85,
    )

    assert calls == [
        (
            "size_facilities",
            {
                "wellCount": 20,
                "expectedProduction": 11500,
                "location": "Lea County, NM",
                "matchThreshold": 0.85,
            },
        )
    ]


@pytest.mark.asyncio
async def test_estimate_costs_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(infrastructure_mcp, "call_infrastructure_tool", fake_call)

    await infrastructure_mcp.estimate_costs(
        well_count=16,
        compressors=2,
        swd_wells=3,
        location="Midland Basin",
        match_threshold=0.8,
    )

    assert calls == [
        (
            "estimate_costs",
            {
                "wellCount": 16,
                "compressors": 2,
                "swdWells": 3,
                "location": "Midland Basin",
                "matchThreshold": 0.8,
            },
        )
    ]


@pytest.mark.asyncio
async def test_assess_compliance_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(infrastructure_mcp, "call_infrastructure_tool", fake_call)

    await infrastructure_mcp.assess_compliance(
        well_count=8,
        location="Federal land in New Mexico",
        environmental_constraints=["wetlands", "cultural resources"],
        match_threshold=0.75,
    )

    assert calls == [
        (
            "assess_compliance",
            {
                "wellCount": 8,
                "location": "Federal land in New Mexico",
                "environmentalConstraints": ["wetlands", "cultural resources"],
                "matchThreshold": 0.75,
            },
        )
    ]
