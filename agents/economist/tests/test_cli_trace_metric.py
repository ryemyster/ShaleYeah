import copy
import importlib.util
import json
from pathlib import Path


def test_cli_metric_checks_returned_work_and_required_native_calls():
    file = Path(__file__).parent / "eval/cli_trace_metric.py"
    spec = importlib.util.spec_from_file_location("economist_cli_trace_metric", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    content = {"parts": [{"text": json.dumps({"work": {}, "scenario": {}})}]}
    instance = {
        "response": content, "reference": {"response": copy.deepcopy(content)},
        "agent_data": {"turns": [{"events": [{"content": {"parts": [
            {"function_call": {"name": name}}
            for name in ("read_scenario_inputs", "read_scenario_source", "draft_scenario", "prepare_scenario_review")
        ]}}]}]},
    }
    assert module.evaluate(instance)["score"] == 1.0
    wrong = copy.deepcopy(instance)
    wrong["response"]["parts"][0]["text"] = '{"work":{"npv":999},"scenario":{}}'
    assert module.evaluate(wrong)["score"] == 0.0
    missing = copy.deepcopy(instance)
    missing["agent_data"]["turns"] = []
    assert module.evaluate(missing)["score"] == 0.0
    assert module.evaluate({})["score"] == 0.0


def test_cli_report_requires_two_valid_perfect_native_traces(tmp_path):
    file = Path(__file__).parent / "eval/verify_cli_grade.py"
    spec = importlib.util.spec_from_file_location("economist_cli_grade", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = {"summary_metrics": [{"metric_name": "native_contract_fidelity", "num_cases_total": 2,
                                   "num_cases_valid": 2, "num_cases_error": 0, "mean_score": 1.0}]}
    target = tmp_path / "results_fixture.json"
    target.write_text(json.dumps(report))
    assert module.verify(tmp_path) is True
    for field, value in (("num_cases_total", 1), ("num_cases_error", 1), ("num_cases_valid", 1), ("mean_score", 0.5)):
        wrong = copy.deepcopy(report)
        wrong["summary_metrics"][0][field] = value
        target.write_text(json.dumps(wrong))
        assert module.verify(tmp_path) is False
    (tmp_path / "results_stale.json").write_text(json.dumps(report))
    assert module.verify(tmp_path) is False
