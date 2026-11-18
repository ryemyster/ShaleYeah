#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
isolation_dir=$(mktemp -d "${TMPDIR:-/tmp}/shaleyeah-connectors.XXXXXX")
isolation_dir=$(cd "$isolation_dir" && pwd -P)
trap 'rm -rf "$isolation_dir"' EXIT
mkdir -p "$isolation_dir/packages" "$isolation_dir/consumer"
pnpm --dir ../contracts build
pnpm build
pnpm --dir ../contracts pack --pack-destination "$isolation_dir/packages" --json > "$isolation_dir/contracts-pack.json"
pnpm pack --pack-destination "$isolation_dir/packages" --json > "$isolation_dir/connectors-pack.json"
npm install --prefix "$isolation_dir/consumer" "$isolation_dir/packages/shaleyeah-contracts-0.3.0.tgz" "$isolation_dir/packages/shaleyeah-connectors-0.1.0.tgz" --ignore-scripts --no-audit --no-fund
cp ../contracts/fixtures/data-connectors.json "$isolation_dir/consumer/records.json"
cp scripts/isolation-control.mjs "$isolation_dir/consumer/control.mjs"
(
 cd "$isolation_dir/consumer"
 node control.mjs
 npm ls --all --json > dependencies.json
 node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; assert(!/@shaleyeah\/(sdk|server-|agent-)|google-adk|anthropic|genai|snowflake|temporal|pgvector/.test(fs.readFileSync("dependencies.json", "utf8")));'
)
echo "Isolated installed connector controls pass without agents, orchestration, warehouse or model providers."
