#!/usr/bin/env bash
# run-coverage.sh — measure test coverage across all suites using c8 + tsx
#
# All non-excluded test files are run in a single tsx invocation via a
# generated entry point, so c8 sees one V8 process and merges coverage correctly.
#
# Thresholds:
#   Lines:     90%
#   Functions: 85%
#   Branches:  80%

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "$0")/../tests" && pwd)"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="$REPO_ROOT/.coverage-entry.ts"

# Remove temp entry file on exit, even if the script is killed mid-run
trap 'rm -f "$ENTRY"' EXIT

EXCLUDED=(
  "mcp-integration.test.ts"
  "mcp-server-infrastructure.test.ts"
)

is_excluded() {
  local file="$1"
  for excl in "${EXCLUDED[@]}"; do
    [[ "$(basename "$file")" == "$excl" ]] && return 0
  done
  return 1
}

# Build a temporary entry file that imports all test suites sequentially.
# Dynamic import keeps each suite's top-level side effects (console.log, assert) isolated.
echo "// Auto-generated coverage entry — do not commit" > "$ENTRY"
echo "// Imports all test suites in sequence so c8 merges coverage in one process." >> "$ENTRY"

count=0
for test_file in "$TESTS_DIR"/*.test.ts; do
  if ! is_excluded "$test_file"; then
    # Use relative path from repo root for clean import
    rel="${test_file#"$REPO_ROOT/"}"
    echo "await import(\"./$rel\");" >> "$ENTRY"
    count=$((count + 1))
  fi
done

echo ""
echo "📊 Running coverage across $count test suites (single process)..."
echo ""

npx c8 \
  --reporter=text \
  --reporter=lcov \
  --include "src/**/*.ts" \
  --exclude "src/**/*.d.ts" \
  --check-coverage \
  --lines 90 \
  --functions 85 \
  --branches 80 \
  npx tsx "$ENTRY"

EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "❌ Coverage below threshold or test failure. Add tests for uncovered files above."
  exit $EXIT_CODE
fi

echo ""
echo "✅ Coverage thresholds met (lines ≥90%, functions ≥85%, branches ≥80%)"
