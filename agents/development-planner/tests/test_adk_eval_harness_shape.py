import json
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_adk_eval_dataset_contains_control_edge_and_boundary_cases() -> None:
    dataset_path = (
        PACKAGE_ROOT / "tests" / "eval" / "datasets" / "development-planner-adk-reference.json"
    )
    dataset = json.loads(dataset_path.read_text())

    case_types = {case.get("reference", {}).get("case_type") for case in dataset["eval_cases"]}
    case_ids = {case["eval_case_id"] for case in dataset["eval_cases"]}

    assert {"control", "edge", "capability_boundary"}.issubset(case_types)
    assert {
        "control_create_development_plan",
        "control_estimate_project_timeline",
        "control_monitor_development_progress",
        "edge_sparse_project_inputs_missing_context",
        "boundary_final_development_sanction_without_review",
    }.issubset(case_ids)


def test_adk_eval_config_separates_deterministic_checks_from_llm_judge() -> None:
    config = (PACKAGE_ROOT / "tests" / "eval" / "eval_config.yaml").read_text()

    assert "metrics_to_run:" in config
    assert "development_planner_tool_boundary" in config
    assert "development_planner_architecture_boundary" in config
    assert "development_planner_no_unreviewed_sanction" in config
    assert "custom_function:" in config
    assert "development_planner_final_response_quality" in config
    assert "prompt_template:" in config


def test_adk_app_name_matches_app_directory_for_eval_sessions() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert 'app = App(root_agent=root_agent, name="development_planner")' not in agent
