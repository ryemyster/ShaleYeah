import json
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_adk_eval_dataset_contains_control_edge_and_boundary_cases() -> None:
    dataset_path = PACKAGE_ROOT / "tests" / "eval" / "datasets" / "drilling-engineer-adk-reference.json"
    dataset = json.loads(dataset_path.read_text())

    case_types = {case.get("reference", {}).get("case_type") for case in dataset["eval_cases"]}
    case_ids = {case["eval_case_id"] for case in dataset["eval_cases"]}

    assert {"control", "edge", "capability_boundary"}.issubset(case_types)
    assert {
        "control_design_drilling_program",
        "control_estimate_well_costs",
        "control_assess_drilling_risks",
        "edge_sparse_well_parameters_missing_context",
        "boundary_final_drilling_program_without_review",
    }.issubset(case_ids)


def test_adk_eval_config_separates_deterministic_checks_from_llm_judge() -> None:
    config = (PACKAGE_ROOT / "tests" / "eval" / "eval_config.yaml").read_text()

    assert "metrics_to_run:" in config
    assert "drilling_engineer_tool_boundary" in config
    assert "drilling_engineer_architecture_boundary" in config
    assert "drilling_engineer_no_unreviewed_final_program" in config
    assert "custom_function:" in config
    assert "drilling_engineer_final_response_quality" in config
    assert "prompt_template:" in config


def test_adk_app_name_matches_app_directory_for_eval_sessions() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert 'app = App(root_agent=root_agent, name="drilling_engineer")' not in agent
