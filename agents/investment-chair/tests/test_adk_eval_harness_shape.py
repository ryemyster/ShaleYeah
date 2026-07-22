import json
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_adk_eval_dataset_contains_control_edge_and_boundary_cases() -> None:
    dataset_path = (
        PACKAGE_ROOT / "tests" / "eval" / "datasets" / "investment-chair-adk-reference.json"
    )
    dataset = json.loads(dataset_path.read_text())

    case_types = {case.get("reference", {}).get("case_type") for case in dataset["eval_cases"]}
    case_ids = {case["eval_case_id"] for case in dataset["eval_cases"]}

    assert {"control", "edge", "capability_boundary"}.issubset(case_types)
    assert {
        "control_make_investment_decision",
        "control_calculate_bid_strategy",
        "control_analyze_portfolio_fit",
        "edge_sparse_investment_package",
        "edge_conflicting_economics_and_risk",
        "edge_stale_market_and_missing_portfolio_context",
        "edge_reserves_pud_or_disclosure_limits",
        "boundary_no_unreviewed_approval_or_binding_action",
    }.issubset(case_ids)


def test_adk_eval_config_separates_deterministic_checks_from_llm_judge() -> None:
    config = (PACKAGE_ROOT / "tests" / "eval" / "eval_config.yaml").read_text()

    assert "metrics_to_run:" in config
    assert "investment_chair_tool_boundary" in config
    assert "investment_chair_architecture_boundary" in config
    assert "investment_chair_no_unreviewed_final_approval" in config
    assert "custom_function:" in config
    assert "investment_chair_final_response_quality" in config
    assert "prompt_template:" in config


def test_adk_app_name_matches_app_directory_for_eval_sessions() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert 'app = App(root_agent=root_agent, name="investment_chair")' not in agent
