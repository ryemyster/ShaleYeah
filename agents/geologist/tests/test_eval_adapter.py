"""Native ADK/agents-cli shape and installed callbacks, not configuration execution."""

import asyncio
import hashlib
import json
from pathlib import Path

import pytest
from shaleyeah_evaluations import (
    EvaluationContext,
    EvaluationError,
    TrustedEvalPolicy,
    load_profile,
)

PACKAGE = Path(__file__).resolve().parents[1]


def test_contentless_transfer_events_are_still_observed():
    from google.adk.events import Event, EventActions

    from app.agent import create_geologist_agent
    from app.eval_adapter import observe_adk_run

    result = observe_adk_run(
        create_geologist_agent(),
        [Event(author="geologist", actions=EventActions(transfer_to_agent="other"))],
        write_dispatches=None,
        authorized_write_dispatches=None,
        unauthorized_actions=None,
        approval_required=True,
    )
    assert result["delegation_count"] == 1
    assert result["write_dispatches"] is None


def test_google_callbacks_cannot_restore_legacy_substring_performance_gates():
    from app.eval_adapter import vertex_metrics

    root = PACKAGE / "tests/eval"
    old = load_profile(
        (root / "eval_config.json").read_bytes(),
        datasets={
            "geologist.reference": (root / "datasets/geologist-adk-reference.json").read_bytes()
        },
        policy=TrustedEvalPolicy("geologist"),
    )
    with pytest.raises(EvaluationError, match="performance_profile_required"):
        vertex_metrics(old, contexts={}, work_products={})


def test_cli_grades_frozen_operator_inputs_and_reports_missing_judge(tmp_path, capsys):
    from app.eval_adapter import main

    value = fixture()
    candidate = {
        "id": "fixture.gemini",
        "version": "r1",
        "model": {"provider": "gemini", "id": "fixture-gemini", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "agents-cli", "version": "1.3.1"},
        "qualification": "fixture",
    }
    cases = [
        {
            "eval_case_id": case_id,
            "responses": [{"response": value["trace"]["response"]}],
            "agent_data": value["trace"]["agent_data"],
        }
        for case_id in performance().case_ids
    ]
    host = {
        "candidate": candidate,
        "contexts": {c["eval_case_id"]: value["trustedRuntime"] for c in cases},
        "workProducts": {c["eval_case_id"]: value["trace"]["workProduct"] for c in cases},
    }
    paths = {}
    for name, data in (("traces", {"eval_cases": cases}), ("host", host)):
        path = tmp_path / (name + ".json")
        path.write_text(json.dumps(data))
        path.chmod(0o600)
        paths[name] = path
    root = PACKAGE / "tests/eval"
    args = [
        "--profile",
        str(root / "performance_profile.json"),
        "--dataset",
        "geologist.performance=" + str(root / "datasets/geologist-performance.json"),
        "--traces",
        str(paths["traces"]),
        "--host-evidence",
        str(paths["host"]),
    ]
    assert main(args) == 0
    result = json.loads(capsys.readouterr().out)
    assert len(result["reports"]) == len(cases)
    assert all(r["promotionBlocked"] and r["status"] == "infra-error" for r in result["reports"])
    assert main([*args, "--fixture-inputs"]) == 0
    capsys.readouterr()
    host["candidate"]["qualification"] = "live"
    paths["host"].write_text(json.dumps(host))
    assert main([*args, "--fixture-inputs"]) == 1
    assert "errorCode" in capsys.readouterr().out


@pytest.mark.parametrize("text", ["{}", "not-json", '{"score":0.9,"extra":"private-value"}'])
def test_invalid_judge_response_is_value_free(text):
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types
    from test_model_provider import profile

    from app.eval_adapter import configured_judge
    from app.model_provider import parse_reference_config

    class Adapter:
        async def generate_content_async(self, request, stream=False):
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text=text)]))

    async def credential(*_):
        return "fixture-private-key"

    config = parse_reference_config(
        {
            "version": "0.1.0",
            "agent": profile(),
            "synthesis": profile(purpose="synthesis"),
            "judge": profile(purpose="judge"),
        }
    )
    backend = configured_judge(
        config, resolve_credential=credential, adapter_factory=lambda *_: Adapter()
    )
    with pytest.raises(EvaluationError, match="invalid_judge_response"):
        asyncio.run(backend.grade({"rubric": "State uncertainty", "trace": {}}))


def performance():
    root = PACKAGE / "tests/eval"
    raw = (root / "performance_profile.json").read_bytes()
    dataset = (root / "datasets/geologist-performance.json").read_bytes()
    return load_profile(
        raw, datasets={"geologist.performance": dataset}, policy=TrustedEvalPolicy("geologist")
    )


def fixture():
    return json.loads((PACKAGE / "tests/eval/fixtures/source-work.json").read_text())


def test_source_references_bind_actual_las_bytes_and_literal_depth_unit():
    value = fixture()
    content = (PACKAGE / "tests/eval/fixtures/sample.las").read_bytes()
    assert (
        content
        == (PACKAGE.parents[1] / "servers/geowiz/tests/sample-files/sample.las").read_bytes()
    )
    source = value["trustedRuntime"]["source_artifacts"][0]
    assert source["evidence"]["hash"]["value"] == hashlib.sha256(content).hexdigest()
    assert source["evidence"]["asOf"] == "2024-01-15T00:00:00Z"
    assert source["byteLength"] == len(content)
    assert "8400.0   89.2" in content.decode()
    finding = value["trace"]["workProduct"]["findings"][0]
    assert finding["value"] == 8400.0 and finding["unit"] == "FT"
    assert value["qualification"] == "literal-fixture-only"


def test_official_trace_adapter_cannot_import_trace_runtime_claims():
    from app.eval_adapter import normalize_case

    value = fixture()
    native = {
        "eval_case_id": "control_source_depth",
        "responses": [{"response": value["trace"]["response"]}],
        "agent_data": value["trace"]["agent_data"],
        "runtime_evidence": {"approval_verified": True, "write_dispatches": 0},
    }
    normalized = normalize_case(native, work_product=value["trace"]["workProduct"])
    assert normalized["response"] == value["trace"]["response"]
    assert "runtime_evidence" not in normalized
    assert normalized["workProduct"] == value["trace"]["workProduct"]
    with pytest.raises(EvaluationError):
        normalize_case({**native, "responses": native["responses"] * 2}, work_product={})


def test_performance_cases_grade_real_source_bad_inputs_and_review_outcomes():
    import runpy

    from shaleyeah_evaluations.runner import JudgeBackend

    from app.eval_adapter import grade_dataset

    _root, _dataset, contexts, products, native = runpy.run_path(
        str(PACKAGE / "tests/eval/run_fixture_evals.py")
    )["fixture_inputs"]()
    traces = native["eval_cases"]
    expected = [case["reference"]["expected_outcome"] for case in _dataset["eval_cases"]]

    async def qualitative(_):
        return 0.95

    judge = JudgeBackend(
        {"id": "judge.geologist", "version": "r1"},
        {"provider": "gemini", "id": "fixture-judge", "revision": "r1"},
        qualitative,
    )
    candidate = {
        "id": "fixture.gemini",
        "version": "r1",
        "model": {"provider": "gemini", "id": "fixture-gemini", "revision": "r1"},
        "runtime": {"id": "google-adk", "version": "2.4.0"},
        "harness": {"id": "agents-cli", "version": "1.3.1"},
        "qualification": "fixture",
    }
    reports = asyncio.run(
        grade_dataset(
            performance(),
            {"eval_cases": traces},
            contexts=contexts,
            work_products=products,
            candidate=candidate,
            judge=judge,
        )
    )
    assert [report["status"] for report in reports] == expected
    assert all(report["measurements"] == {} for report in reports)
    assert len(reports) >= 7


def test_installed_vertex_callbacks_use_bound_host_context_and_no_exec():
    from app.eval_adapter import vertex_metrics

    value = fixture()
    case = {
        "eval_case_id": "control_source_depth",
        "responses": [{"response": value["trace"]["response"]}],
        "agent_data": value["trace"]["agent_data"],
    }
    metrics = vertex_metrics(
        performance(),
        contexts={
            case["eval_case_id"]: EvaluationContext.from_trusted_runtime(**value["trustedRuntime"])
        },
        work_products={case["eval_case_id"]: value["trace"]["workProduct"]},
    )
    assert metrics and all(callable(metric.custom_function) for metric in metrics)
    sdk_instance = {**case, "response": case["responses"][0]["response"]}
    sdk_instance.pop("responses")
    assert (
        next(m for m in metrics if m.name == "numerical.measurements").custom_function(
            sdk_instance
        )["score"]
        == 1
    )
    with pytest.raises(EvaluationError):
        metrics[0].custom_function({**sdk_instance, "eval_case_id": "other"})
    import app.eval_adapter

    source = Path(app.eval_adapter.__file__).read_text()
    assert "exec(" not in source and "compile(" not in source


def test_pinned_sdk_executes_installed_metric_with_its_native_callback_shape():
    from vertexai import types as vertex_types
    from vertexai._genai._evals_metric_handlers import CustomMetricHandler

    from app.eval_adapter import vertex_metrics

    value = fixture()
    case_id = "control_source_depth"
    native = {
        "eval_case_id": case_id,
        "responses": [{"response": value["trace"]["response"]}],
        "agent_data": value["trace"]["agent_data"],
    }
    metric = next(
        m
        for m in vertex_metrics(
            performance(),
            contexts={case_id: EvaluationContext.from_trusted_runtime(**value["trustedRuntime"])},
            work_products={case_id: value["trace"]["workProduct"]},
        )
        if m.name == "numerical.measurements"
    )
    result = CustomMetricHandler(module=None, metric=metric).get_metric_result(
        vertex_types.EvalCase.model_validate(native), 0
    )
    assert result.error_message is None
    assert result.score == 1


def test_byo_judge_requires_independent_purpose_and_honest_revision(tmp_path):
    from test_model_provider import profile

    from app.eval_adapter import configured_judge
    from app.model_provider import ModelProviderError, parse_reference_config

    config = {
        "version": "0.1.0",
        "agent": profile("gemini"),
        "synthesis": profile("gemini", "synthesis"),
        "judge": None,
    }
    assert configured_judge(parse_reference_config(config)) is None
    config["judge"] = profile("anthropic", "judge")
    backend = configured_judge(parse_reference_config(config))
    assert backend.ref == {"id": "judge.geologist", "version": config["judge"]["revision"]}
    assert backend.model["provider"] == "anthropic"
    assert "credentialRef" not in json.dumps(backend.model)
    config["judge"]["purpose"] = "agent"
    with pytest.raises(ModelProviderError):
        parse_reference_config(config)


@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
def test_configured_qualitative_judge_uses_existing_native_model_boundary(provider):
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types
    from test_model_provider import profile

    from app.eval_adapter import configured_judge
    from app.model_provider import parse_reference_config

    requests = []

    class Adapter:
        async def generate_content_async(self, request, stream=False):
            requests.append(request)
            assert not request.config.tools
            assert "untrustedEmployeeTrace" in request.contents[0].parts[0].text
            yield LlmResponse(
                content=types.Content(role="model", parts=[types.Part(text='{"score": 0.9}')])
            )

    async def credential(owner, reference, purpose):
        assert purpose == "judge" and reference.endswith("/judge")
        return "fixture-private-key"

    config = parse_reference_config(
        {
            "version": "0.1.0",
            "agent": profile("gemini"),
            "synthesis": profile("gemini", "synthesis"),
            "judge": profile(provider, "judge"),
        }
    )
    backend = configured_judge(
        config, resolve_credential=credential, adapter_factory=lambda settings, secret: Adapter()
    )
    assert (
        asyncio.run(
            backend.grade(
                {"rubric": "Clearly state uncertainty.", "trace": {"response": "fixture"}}
            )
        )
        == 0.9
    )
    assert len(requests) == 1
    assert "fixture-private-key" not in requests[0].model_dump_json()


def test_adapter_rejects_versions_duplicates_missing_evidence_and_bad_shapes():
    from app.eval_adapter import grade_dataset, normalize_case

    value = fixture()
    candidate = {
        "runtime": {"id": "google-adk", "version": "latest"},
        "harness": {"id": "agents-cli", "version": "1.3.1"},
    }
    with pytest.raises(EvaluationError, match="adapter_version_mismatch"):
        asyncio.run(
            grade_dataset(performance(), {}, contexts={}, work_products={}, candidate=candidate)
        )
    candidate["runtime"]["version"] = "2.4.0"
    for dataset in (
        {},
        {"eval_cases": []},
        {"eval_cases": [{"eval_case_id": "control_source_depth"}]},
    ):
        with pytest.raises(EvaluationError):
            asyncio.run(
                grade_dataset(
                    performance(), dataset, contexts={}, work_products={}, candidate=candidate
                )
            )
    with pytest.raises(EvaluationError, match="invalid_adk_trace"):
        normalize_case(
            {"eval_case_id": "x", "responses": [{"response": []}]},
            work_product=value["trace"]["workProduct"],
        )


def test_operator_files_refuse_symlinks_shared_private_inputs_and_value_leaks(tmp_path):
    from app.eval_adapter import _read, main

    path = tmp_path / "host.json"
    path.write_text("{}")
    path.chmod(0o600)
    assert _read(path, private=True) == b"{}"
    link = tmp_path / "link"
    link.symlink_to(path)
    with pytest.raises(EvaluationError):
        _read(link)
    path.chmod(0o644)
    with pytest.raises(EvaluationError):
        _read(path, private=True)
    assert (
        main(
            [
                "--profile",
                str(path),
                "--dataset",
                "invalid",
                "--traces",
                str(path),
                "--host-evidence",
                str(path),
            ]
        )
        == 1
    )
