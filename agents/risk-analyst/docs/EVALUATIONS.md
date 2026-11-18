# Risk Analyst evaluations
The installed `shaleyeah-evaluations` package supplies trusted deterministic metrics. The role's `tests/eval/performance_profile.json` binds the 18-case dataset and numerical tolerances. It requires source faithfulness, scenario arithmetic, register coverage, architecture/tool boundaries and no unapproved acceptance, in addition to common contract, provenance, freshness, assumption and authority checks.

Frozen cases cover dependent, exclusive and identical hazards, zero variance, large weights, missing evidence, severe risks at zero probability, source freshness/scope, forged quantities/coverage, missing calls and self-approved persistence. Independent expected numbers were authored before the backend calculator. Backend observations are labeled separately. See [fixture provenance](../tests/eval/fixtures/README.md).

From the package directory:
```sh
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/risk.json --code-revision FULL_TESTED_COMMIT_SHA
```
A successful technical decision includes expected blocked counterexamples; it does not approve professional use or an unreviewed work product.

For an exact protected packet, the host supplies owner-only inspected packet and actual backend/native observation files using `--packet`, `--observed` and `--evidence-directory`. The verifier checks inspected source hashes and binds the qualification to the packet, work, scope, task and product revision. The employee cannot select its verifier or claim a passing label as authority.

Native MCP runs produce actual Gemini and Anthropic traces. Export them through `export_cli_traces.py`, then use pinned agents-cli 1.3.1 and `cli-requirements.txt` in a separate grading environment:
```sh
agents-cli eval grade --traces NEW_EXPORTED_TRACE_DIRECTORY --config tests/eval/eval_config.json --output NEW_GRADE_DIRECTORY
uv run --locked python tests/eval/verify_cli_grade.py NEW_GRADE_DIRECTORY
```
The supplementary Google metric requires both actual final packets and native calls to match, with two valid scores of 1.0. The key-free local Google handler is also available for hosts that cannot initialize its cloud facade. Neither replaces installed job qualification. Optional model rubrics cannot override hard failures.

All labels are provisional Codex research judgments. No measured field accuracy, professional certification or manual-effort benefit follows from synthetic fixture success. Named human MVP acceptance remains a separate gate.
