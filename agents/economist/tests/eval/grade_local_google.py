"""Run Google's actual local handler without initializing its cloud client or GCS loader."""

import argparse
import hashlib
import json
import os
from importlib.metadata import version
from pathlib import Path


def require_local(metrics, local, remote):
    if not (
        len(metrics) == local == 1 and remote == 0
        and metrics[0].name == "native_contract_fidelity"
        and callable(metrics[0].custom_function)
    ):
        raise ValueError("local_metric_required")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--traces", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    expected = {"google-agents-cli": "1.3.1", "google-cloud-aiplatform": "1.164.0"}
    if any(version(name) != value for name, value in expected.items()):
        raise ValueError("unqualified_google_handler_version")
    # Supported LiteLLM setting: deterministic metrics need no remote price map.
    os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
    from google.agents.cli.eval.eval_utils import prepare_eval_metrics
    from rich.console import Console
    from vertexai._genai._evals_metric_handlers import (
        EvaluationRunConfig,
        compute_metrics_and_aggregate,
    )
    from vertexai._genai.types.common import EvaluationDataset

    metrics, local, remote = prepare_eval_metrics(
        config_path=args.config, metrics_str=None, default_config_path=None, console=Console()
    )
    require_local(metrics, local, remote)
    files = sorted(Path(args.traces).glob("*.json"))
    if {file.name for file in files} != {"gemini.json", "anthropic.json"}:
        raise ValueError("both_native_providers_required")
    cases = []
    for file in files:
        dataset = EvaluationDataset.model_validate_json(file.read_text())
        if len(dataset.eval_cases or []) != 1 or len(dataset.eval_cases[0].responses or []) != 1:
            raise ValueError("one_native_response_required")
        cases.extend(dataset.eval_cases)
    # No cloud facade, credentials, dummy project or mocked score. The SDK's
    # callable-only handler executes and aggregates the actual typed traces.
    result = compute_metrics_and_aggregate(EvaluationRunConfig(
        evals_module=None, dataset=EvaluationDataset(eval_cases=cases),
        metrics=metrics, num_response_candidates=1,
    ))
    output = Path(args.output)
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    (output / "results_local.json").write_text(result.model_dump_json(exclude_none=True))
    (output / "harness.json").write_text(json.dumps({
        "engine": "google-local-custom-metric-handler", "versions": expected,
        "cloudClient": False, "qualification": "fixture", "professionalAcceptance": False,
        "configSha256": hashlib.sha256(Path(args.config).read_bytes()).hexdigest(),
        "traceSha256": {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in files},
    }))


if __name__ == "__main__":
    main()
