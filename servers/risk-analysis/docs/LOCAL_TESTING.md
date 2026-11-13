# Local Risk Analysis checks
First install the matching native employee from the repository root:
```sh
uv sync --project agents/risk-analyst --locked
```
Then run these from the backend package:
```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```
The suite uses synthetic operator files and offline model responses, with real MCP and review transitions. Loopback listeners must be permitted. It checks arithmetic against independently authored references, denied/stale/forged sources, human changes/rejection/approval, installed qualification, restart and replay. The generic MCP consumer uses the compiled entry.

From the repository root, independent packaging and containers use:
```sh
node servers/risk-analysis/scripts/check-extraction.mjs --bundle NEW_EMPTY_BUNDLE_DIRECTORY --report EXTRACTION_REPORT
python3 servers/risk-analysis/scripts/check-containers.py --bundle VERIFIED_BUNDLE_DIRECTORY --report CONTAINER_REPORT
```
Use new owned absolute destinations. Extraction installs declared dependencies and runs isolated source, wheel and archive controls. Container checks require Docker and consume the verified bundle; missing runtime or a failed control produces a blocked decision. Reports retain exact artifact/lock hashes. Fixture success does not certify professional risk judgments.

For startup failures, check private file permissions, enrolled IDs, current source grants, exact revisions and required audit/verifier configuration. Error messages intentionally omit source contents and credentials.
