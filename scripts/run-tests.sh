#!/usr/bin/env bash
# run-tests.sh — discover and run all test suites
#
# Auto-discovers tests/*.test.ts so that adding a new test file never requires
# touching package.json (which causes merge conflicts on develop → main PRs).
#
# Exclusions (known broken — signal-handling tests that fail in non-TTY env):
#   mcp-integration.test.ts
#   mcp-server-infrastructure.test.ts
#
# To skip a test file permanently, add its basename to EXCLUDED below.

set -euo pipefail

TESTS_DIR="$(cd "$(dirname "$0")/../tests" && pwd)"

EXCLUDED=(
  "mcp-integration.test.ts"
  "mcp-server-infrastructure.test.ts"
)

passed=0
failed=0
failed_files=()

is_excluded() {
  local file="$1"
  for excl in "${EXCLUDED[@]}"; do
    [[ "$(basename "$file")" == "$excl" ]] && return 0
  done
  return 1
}

for test_file in "$TESTS_DIR"/*.test.ts; do
  if is_excluded "$test_file"; then
    echo "⏭  Skipping (excluded): $(basename "$test_file")"
    continue
  fi

  echo ""
  echo "▶  $(basename "$test_file")"
  if npx tsx "$test_file"; then
    ((passed++))
  else
    ((failed++))
    failed_files+=("$(basename "$test_file")")
  fi
done

echo ""
echo "══════════════════════════════════════════════════════"
echo "Test run complete: $passed passed, $failed failed"
echo "══════════════════════════════════════════════════════"

if [[ ${#failed_files[@]} -gt 0 ]]; then
  echo ""
  echo "Failed suites:"
  for f in "${failed_files[@]}"; do
    echo "  ❌ $f"
  done
  exit 1
fi
