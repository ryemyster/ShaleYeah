#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
client_root="$PWD"
geologist_root="$client_root/../../agents/geologist"
isolation_dir=$(mktemp -d "${TMPDIR:-/tmp}/shale-python-mcp.XXXXXX")
trap 'rm -rf "$isolation_dir"' EXIT

uv build --wheel --out-dir "$isolation_dir/wheels"
uv build --project "$geologist_root" --wheel --out-dir "$isolation_dir/wheels"
uv export --project "$geologist_root" --locked --no-emit-local --no-hashes \
  --output-file "$isolation_dir/requirements.txt" > /dev/null
uv venv --python 3.12 "$isolation_dir/.venv"
uv pip install --python "$isolation_dir/.venv/bin/python" \
  -r "$isolation_dir/requirements.txt"
uv pip install --python "$isolation_dir/.venv/bin/python" --no-deps \
  "$isolation_dir/wheels/shaleyeah_mcp_client-0.1.0-py3-none-any.whl" \
  "$isolation_dir/wheels/shaleyeah_geologist_adk-0.1.0-py3-none-any.whl"
uv pip check --python "$isolation_dir/.venv/bin/python"
mkdir -p "$isolation_dir/tests"
cp tests/test_result_contract.py tests/test_transport_boundary.py "$isolation_dir/tests/"
cp "$geologist_root/tests/test_mcp_access_boundary.py" "$isolation_dir/tests/test_geologist_access.py"
cp "$geologist_root/tests/test_mcp_result_contract.py" "$isolation_dir/tests/test_geologist_mapping.py"
(
  cd "$isolation_dir"
  # Isolated wheels only: discard inherited source/Python launcher paths.
  env -u PYTHONPATH -u PYTHONHOME -u GEOWIZ_MCP_URL -u GEOWIZ_MCP_ACCESS_TOKEN_FILE \
    -u GEOWIZ_MCP_TIMEOUT_SECONDS -u GEOWIZ_MCP_REQUEST_TIMEOUT_SECONDS \
    -u GEOWIZ_MCP_PREFLIGHT_ATTEMPTS .venv/bin/python -I -c '
from pathlib import Path
import shaleyeah_mcp
from app import geowiz_mcp
for module in (shaleyeah_mcp, geowiz_mcp):
    assert Path(module.__file__).resolve().is_relative_to(Path(".venv").resolve())
assert geowiz_mcp.geowiz_backend_url() == "http://127.0.0.1:3001/mcp"
'
  env -u PYTHONPATH -u PYTHONHOME -u GEOWIZ_MCP_URL -u GEOWIZ_MCP_ACCESS_TOKEN_FILE \
    -u GEOWIZ_MCP_TIMEOUT_SECONDS -u GEOWIZ_MCP_REQUEST_TIMEOUT_SECONDS \
    -u GEOWIZ_MCP_PREFLIGHT_ATTEMPTS \
    .venv/bin/python -I -m pytest -q tests --cov=shaleyeah_mcp --cov-fail-under=90
)
echo "Isolated installed client and Geologist wheels pass without monorepo source imports."
