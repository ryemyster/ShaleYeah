import pytest

from app import research_mcp
from app.agent import plan_research_tool_call, research_backend_status, root_agent


def test_python_mcp_client_module_exists_for_research_execution() -> None:
    assert research_mcp.RESEARCH_DEFAULT_URL == "http://localhost:3008"
    assert hasattr(research_mcp, "call_research_tool")
    assert hasattr(research_mcp, "conduct_market_research")
    assert hasattr(research_mcp, "analyze_competition")


def test_adk_root_agent_exposes_migrated_research_execution_tools() -> None:
    tool_names = {tool.__name__ for tool in root_agent.tools}

    assert root_agent.name == "research_analyst"
    assert {
        "research_backend_status",
        "plan_research_tool_call",
        "conduct_market_research",
        "analyze_competition",
    }.issubset(tool_names)


def test_research_status_and_planner_mark_architecture_and_hitl_boundaries() -> None:
    status = research_backend_status()
    planned = plan_research_tool_call("analyze Delaware Basin competitors", "competition")

    assert status["backend"] == "research"
    assert status["architectureMode"] == "stand-alone-with-progressive-disclosure-skills"
    assert status["independentBackend"] is True
    assert planned["toolName"] == "analyze_competition"
    assert planned["executionBoundary"] == "adk-mcp"
    assert planned["requiresReviewForFinalInvestmentRecommendation"] is True
    assert planned["requiresReviewForDisclosureOrReservesClassification"] is True
    assert planned["requiresReviewForSensitiveMemoryPromotion"] is True


@pytest.mark.asyncio
async def test_conduct_market_research_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(research_mcp, "call_research_tool", fake_call)

    result = await research_mcp.conduct_market_research(
        topic="Permian Basin gas takeaway",
        scope="regional",
        timeframe="current",
        sources=["https://www.eia.gov/"],
        output_path="research/permian.json",
    )

    assert result == {"ok": True}
    assert calls == [
        (
            "conduct_market_research",
            {
                "topic": "Permian Basin gas takeaway",
                "scope": "regional",
                "timeframe": "current",
                "sources": ["https://www.eia.gov/"],
                "outputPath": "research/permian.json",
            },
        )
    ]


@pytest.mark.asyncio
async def test_analyze_competition_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(research_mcp, "call_research_tool", fake_call)

    await research_mcp.analyze_competition(
        region="Delaware Basin",
        competitors=["Operator A", "Operator B"],
        analysis_type="strategy",
        timeframe="last 6 months",
        output_path="research/competition.json",
        match_threshold=0.87,
    )

    assert calls == [
        (
            "analyze_competition",
            {
                "region": "Delaware Basin",
                "analysisType": "strategy",
                "timeframe": "last 6 months",
                "competitors": ["Operator A", "Operator B"],
                "outputPath": "research/competition.json",
                "matchThreshold": 0.87,
            },
        )
    ]
