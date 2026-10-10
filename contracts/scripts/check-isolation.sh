#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
isolation_dir=$(mktemp -d "${TMPDIR:-/tmp}/shaleyeah-contracts.XXXXXX")
trap 'rm -rf "$isolation_dir"' EXIT
mkdir -p "$isolation_dir/node" "$isolation_dir/python"

pnpm build
npm pack --pack-destination "$isolation_dir/node" --json > "$isolation_dir/pack.json"
uv build --out-dir "$isolation_dir/python"
npm install --prefix "$isolation_dir/node" "$isolation_dir/node/shaleyeah-contracts-0.1.0.tgz" --ignore-scripts --no-audit --no-fund
uv venv "$isolation_dir/python/.venv"
uv pip install --python "$isolation_dir/python/.venv/bin/python" "$isolation_dir/python/shaleyeah_contracts-0.1.0-py3-none-any.whl"
cp fixtures/records.json "$isolation_dir/node/records.json"
cp fixtures/records.json "$isolation_dir/python/records.json"

(
 cd "$isolation_dir/node"
 node --input-type=module -e '
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { validateContract } from "@shaleyeah/contracts";
  const records = JSON.parse(readFileSync("records.json", "utf8"));
  assert.equal(validateContract(records.work).confidence, 0);
  assert.equal(validateContract(records.externalCharter).employeeId, "external.geologist");
 '
)
(
 cd "$isolation_dir/python"
 .venv/bin/python -c '
import json
from shaleyeah_contracts import validate_contract
with open("records.json") as fixture:
    records = json.load(fixture)
assert validate_contract(records["work"])["confidence"] == 0
assert validate_contract(records["externalCharter"])["employeeId"] == "external.geologist"
'
)
echo "Isolated npm and Python consumers pass."
