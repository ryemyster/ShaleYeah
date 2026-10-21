#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
isolation_dir=$(mktemp -d "${TMPDIR:-/tmp}/shaleyeah-contracts.XXXXXX")
trap 'rm -rf "$isolation_dir"' EXIT
mkdir -p "$isolation_dir/node" "$isolation_dir/python"

pnpm build
npm pack --pack-destination "$isolation_dir/node" --json > "$isolation_dir/pack.json"
uv build --out-dir "$isolation_dir/python"
npm install --prefix "$isolation_dir/node" "$isolation_dir/node/shaleyeah-contracts-0.3.0.tgz" --ignore-scripts --no-audit --no-fund
uv venv "$isolation_dir/python/.venv"
uv pip install --python "$isolation_dir/python/.venv/bin/python" "$isolation_dir/python/shaleyeah_contracts-0.3.0-py3-none-any.whl"
cp fixtures/records.json "$isolation_dir/node/records.json"
cp fixtures/records.json "$isolation_dir/python/records.json"
cp fixtures/data-connectors.json "$isolation_dir/node/data-connectors.json"
cp fixtures/data-connectors.json "$isolation_dir/python/data-connectors.json"
cp fixtures/employee-events.json "$isolation_dir/node/employee-events.json"
cp fixtures/employee-events.json "$isolation_dir/python/employee-events.json"

(
 cd "$isolation_dir/node"
 node --input-type=module -e '
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { validateContract, validateSourceContract, validateConnectorConfiguration } from "@shaleyeah/contracts";
  import { validateEvent, redactEvent } from "@shaleyeah/contracts/events";
  const records = JSON.parse(readFileSync("records.json", "utf8"));
  assert.equal(validateContract(records.work).confidence, 0);
  assert.equal(validateContract(records.externalCharter).employeeId, "external.geologist");
  const connectors = JSON.parse(readFileSync("data-connectors.json", "utf8"));
  assert.equal(validateSourceContract(connectors.artifact).kind, "source-artifact");
  assert.equal(validateConnectorConfiguration(connectors.configuration).manifest.id, connectors.manifest.id);
  const events = JSON.parse(readFileSync("employee-events.json", "utf8"));
  assert.equal(validateEvent(events.event, events.context).modelConfidence, 0);
  assert.ok(!JSON.stringify(redactEvent({ ...events.event, prompt: "private source body" })).includes("private source body"));
 '
)
(
 cd "$isolation_dir/python"
 .venv/bin/python -c '
import json
from shaleyeah_contracts import validate_contract, validate_source_contract, validate_connector_configuration
from shaleyeah_contracts.events import validate_event, redact_event
with open("records.json") as fixture:
    records = json.load(fixture)
assert validate_contract(records["work"])["confidence"] == 0
assert validate_contract(records["externalCharter"])["employeeId"] == "external.geologist"
with open("data-connectors.json") as fixture:
    connectors = json.load(fixture)
assert validate_source_contract(connectors["artifact"])["kind"] == "source-artifact"
assert validate_connector_configuration(connectors["configuration"])["manifest"]["id"] == connectors["manifest"]["id"]
with open("employee-events.json") as fixture:
    events = json.load(fixture)
assert validate_event(events["event"], expected_context=events["context"])["modelConfidence"] == 0
assert "private source body" not in json.dumps(redact_event({**events["event"], "prompt": "private source body"}))
'
)
echo "Isolated npm and Python consumers pass."
