import json
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_adk_eval_dataset_contains_control_edge_and_boundary_cases() -> None:
    dataset_path = PACKAGE_ROOT / "tests" / "eval" / "datasets" / "geologist-adk-reference.json"
    dataset = json.loads(dataset_path.read_text())

    case_types = {case.get("reference", {}).get("case_type") for case in dataset["eval_cases"]}
    case_ids = {case["eval_case_id"] for case in dataset["eval_cases"]}

    assert {"control", "edge", "capability_boundary"}.issubset(case_types)
    assert {
        "control_analyze_formation",
        "control_assess_las_quality",
        "control_process_access_database",
        "control_process_aries_database",
        "control_process_document",
        "control_process_gis",
        "control_process_seismic_data",
        "control_process_well_logs",
        "edge_sparse_history_missing_context",
        "boundary_save_without_approval",
    }.issubset(case_ids)


def test_adk_eval_config_separates_deterministic_checks_from_llm_judge() -> None:
    config = (PACKAGE_ROOT / "tests" / "eval" / "eval_config.yaml").read_text()

    assert "metrics_to_run:" in config
    assert "geologist_tool_boundary" in config
    assert "geologist_architecture_boundary" in config
    assert "geologist_no_unapproved_persistence" in config
    assert "custom_function:" in config
    assert "geologist_final_response_quality" in config
    assert "prompt_template:" in config


def test_adk_app_name_matches_app_directory_for_eval_sessions() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert 'app = App(root_agent=root_agent, name="geologist")' not in agent
