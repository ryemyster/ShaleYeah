# Developing the Economist

Use Python 3.12 and `uv sync --locked` in this package. `agents-cli info` inspects
the own code-only ADK project. Configure private model and MCP credentials from
the README before using `agents-cli run` for interactive authoring.

Write failing behavior controls before changing prompts, tool mappings or state.
Use `uv run --locked ruff check app tests` and
`uv run --locked pytest -q --cov=app --cov-fail-under=90` for package checks.
Keep role-specific reasoning and mappings here; share only reusable contracts
and runtime services through declared installed packages.

The scorecard, datasets, optional rubrics and numeric settings are configuration.
A changed label or profile needs a reviewed revision/hash; preserve prior results.
Financial and authority floors remain trusted code. See [evaluations](EVALUATIONS.md).
Do not change labels or lower gates to hide a failed model output.

The matching backend retains its qualified cash-flow solver. Changes to domain
algorithms need their own issue. Remove displaced code when its replacement is
accepted and update this package's documentation and changelog with the change.
