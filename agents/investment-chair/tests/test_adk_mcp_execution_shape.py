import pytest

from app import decision_mcp
from app.agent import decision_backend_status, plan_decision_tool_call, root_agent


def test_python_mcp_client_module_exists_for_decision_execution() -> None:
    assert decision_mcp.DECISION_DEFAULT_URL == "http://localhost:3013"
    assert hasattr(decision_mcp, "call_decision_tool")
    assert hasattr(decision_mcp, "make_investment_decision")
    assert hasattr(decision_mcp, "calculate_bid_strategy")
    assert hasattr(decision_mcp, "analyze_portfolio_fit")


def test_adk_root_agent_exposes_migrated_decision_execution_tools() -> None:
    tool_names = {tool.__name__ for tool in root_agent.tools}

    assert root_agent.name == "investment_chair"
    assert {
        "decision_backend_status",
        "plan_decision_tool_call",
        "make_investment_decision",
        "calculate_bid_strategy",
        "analyze_portfolio_fit",
    }.issubset(tool_names)


def test_decision_status_and_planner_mark_architecture_and_hitl_boundaries() -> None:
    status = decision_backend_status()
    planned = plan_decision_tool_call("build a bid strategy", "bid")

    assert status["backend"] == "decision"
    assert status["architectureMode"] == "stand-alone-with-progressive-disclosure-skills"
    assert status["independentBackend"] is True
    assert planned["toolName"] == "calculate_bid_strategy"
    assert planned["executionBoundary"] == "adk-mcp"
    assert planned["requiresReviewForFinalInvestmentApproval"] is True
    assert planned["requiresReviewForBindingBidOrTransaction"] is True
    assert planned["requiresReviewForCapitalAuthorization"] is True
    assert planned["requiresReviewForDisclosureOrReserveClassification"] is True
    assert planned["requiresReviewForLegalTaxFiduciaryConflictConclusion"] is True
    assert planned["requiresReviewForSensitiveMemoryPromotion"] is True


@pytest.mark.asyncio
async def test_make_investment_decision_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(decision_mcp, "call_decision_tool", fake_call)

    result = await decision_mcp.make_investment_decision(
        analysis_inputs={
            "geological": {"confidence": 0.8},
            "economic": {"npv": 2500000, "irr": 0.22, "paybackMonths": 18},
            "risk": {"overallRisk": 0.35},
        },
        investment_criteria={"minNPV": 1500000, "minIRR": 0.18, "maxPayback": 24, "maxRisk": 0.5},
        market_conditions={"oilPrice": 82, "gasPrice": 3.4, "competitiveActivity": "active"},
        output_path="/tmp/decision.json",
    )

    assert result == {"ok": True}
    assert calls == [
        (
            "make_investment_decision",
            {
                "analysisInputs": {
                    "geological": {"confidence": 0.8},
                    "economic": {"npv": 2500000, "irr": 0.22, "paybackMonths": 18},
                    "risk": {"overallRisk": 0.35},
                },
                "investmentCriteria": {
                    "minNPV": 1500000,
                    "minIRR": 0.18,
                    "maxPayback": 24,
                    "maxRisk": 0.5,
                },
                "marketConditions": {
                    "oilPrice": 82,
                    "gasPrice": 3.4,
                    "competitiveActivity": "active",
                },
                "outputPath": "/tmp/decision.json",
            },
        )
    ]


@pytest.mark.asyncio
async def test_calculate_bid_strategy_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(decision_mcp, "call_decision_tool", fake_call)

    await decision_mcp.calculate_bid_strategy(
        valuation={"npv": 3200000, "irr": 0.24, "p10": 1200000, "p50": 3000000, "p90": 5200000},
        market_data={
            "recentSales": [2200, 2400, 2650],
            "competitorActivity": "high",
            "acreageAvailability": "limited",
        },
        strategy="OPPORTUNISTIC",
        output_path="/tmp/bid.json",
    )

    assert calls == [
        (
            "calculate_bid_strategy",
            {
                "valuation": {
                    "npv": 3200000,
                    "irr": 0.24,
                    "p10": 1200000,
                    "p50": 3000000,
                    "p90": 5200000,
                },
                "marketData": {
                    "recentSales": [2200, 2400, 2650],
                    "competitorActivity": "high",
                    "acreageAvailability": "limited",
                },
                "strategy": "OPPORTUNISTIC",
                "outputPath": "/tmp/bid.json",
            },
        )
    ]


@pytest.mark.asyncio
async def test_analyze_portfolio_fit_maps_python_args_to_mcp_contract(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_call(tool_name: str, arguments: dict):
        calls.append((tool_name, arguments))
        return {"ok": True}

    monkeypatch.setattr(decision_mcp, "call_decision_tool", fake_call)

    await decision_mcp.analyze_portfolio_fit(
        opportunity={
            "location": "Reeves County, TX",
            "formation": "Wolfcamp",
            "acreage": 1280,
            "expectedReturns": {"npv": 4200000, "irr": 0.27},
        },
        current_portfolio=[
            {
                "name": "Delaware Core",
                "location": "Reeves County, TX",
                "formation": "Wolfcamp",
                "status": "held",
            }
        ],
        portfolio_strategy={
            "diversificationTargets": ["Delaware", "Midland"],
            "riskTolerance": 0.45,
            "growthTargets": {"production": 5000, "reserves": 15000000},
        },
        match_threshold=0.85,
    )

    assert calls == [
        (
            "analyze_portfolio_fit",
            {
                "opportunity": {
                    "location": "Reeves County, TX",
                    "formation": "Wolfcamp",
                    "acreage": 1280,
                    "expectedReturns": {"npv": 4200000, "irr": 0.27},
                },
                "currentPortfolio": [
                    {
                        "name": "Delaware Core",
                        "location": "Reeves County, TX",
                        "formation": "Wolfcamp",
                        "status": "held",
                    }
                ],
                "portfolioStrategy": {
                    "diversificationTargets": ["Delaware", "Midland"],
                    "riskTolerance": 0.45,
                    "growthTargets": {"production": 5000, "reserves": 15000000},
                },
                "matchThreshold": 0.85,
            },
        )
    ]
