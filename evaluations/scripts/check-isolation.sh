#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
isolation_dir=$(mktemp -d "${TMPDIR:-/tmp}/shaleyeah-evaluations.XXXXXX")
trap 'rm -rf "$isolation_dir"' EXIT
uv build --wheel --out-dir "$isolation_dir/wheels"
uv build --project ../contracts --wheel --out-dir "$isolation_dir/wheels"
uv export --locked --no-emit-local --no-hashes --output-file "$isolation_dir/requirements.txt" > /dev/null
uv venv --python 3.12 "$isolation_dir/.venv"
uv pip install --python "$isolation_dir/.venv/bin/python" -r "$isolation_dir/requirements.txt"
uv pip install --python "$isolation_dir/.venv/bin/python" --no-deps \
  "$isolation_dir/wheels/shaleyeah_contracts-0.2.0-py3-none-any.whl" \
  "$isolation_dir/wheels/shaleyeah_evaluations-0.1.0-py3-none-any.whl"
uv pip check --python "$isolation_dir/.venv/bin/python"
mkdir -p "$isolation_dir/evaluations/tests" "$isolation_dir/evaluations/fixtures" "$isolation_dir/agents/geologist/tests/eval/datasets"
cp tests/*.py "$isolation_dir/evaluations/tests/"
cp fixtures/frozen-trace.json "$isolation_dir/evaluations/fixtures/"
cp ../agents/geologist/tests/eval/eval_config.json "$isolation_dir/agents/geologist/tests/eval/"
cp ../agents/geologist/tests/eval/datasets/geologist-adk-reference.json "$isolation_dir/agents/geologist/tests/eval/datasets/"
cd "$isolation_dir/evaluations"
env -u PYTHONPATH -u PYTHONHOME "$isolation_dir/.venv/bin/python" -I -c '
from importlib.metadata import distributions
from pathlib import Path
import shaleyeah_evaluations, shaleyeah_contracts
installed = {item.metadata["Name"].lower().replace("_", "-") for item in distributions()}
assert not installed.intersection({"google-adk", "google-genai", "anthropic", "mcp", "snowflake-connector-python", "temporalio"})
for module in (shaleyeah_evaluations, shaleyeah_contracts):
    assert Path(module.__file__).resolve().is_relative_to(Path("../.venv").resolve())
'
env -u PYTHONPATH -u PYTHONHOME "$isolation_dir/.venv/bin/python" -I -m pytest -q tests --cov=shaleyeah_evaluations --cov-fail-under=90
echo "Installed evaluation and contract wheels pass with fixture data and no agent/provider/orchestrator source."
