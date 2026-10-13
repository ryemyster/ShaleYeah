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


def test_geologist_eval_configuration_cannot_embed_executable_metrics() -> None:
    configs = list((PACKAGE_ROOT / "tests" / "eval").glob("eval_config.*"))
    assert configs
    for path in configs:
        assert "custom_function" not in path.read_text(), "Profiles must select trusted metric IDs"


def test_geologist_loads_its_registered_profile_and_exact_dataset() -> None:
    from shaleyeah_evaluations import TrustedEvalPolicy, load_profile

    root = PACKAGE_ROOT / "tests/eval"
    loaded = load_profile(
        (root / "eval_config.json").read_bytes(),
        datasets={"geologist.reference": (root / "datasets/geologist-adk-reference.json").read_bytes()},
        policy=TrustedEvalPolicy("geologist"),
    )
    assert loaded.configuration()["roleId"] == "geologist"
    assert len(loaded.configuration()["metrics"]) == 9
    assert len(loaded.config_hash) == 64


def test_adk_app_name_matches_app_directory_for_eval_sessions() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert 'app = App(root_agent=root_agent, name="geologist")' not in agent
