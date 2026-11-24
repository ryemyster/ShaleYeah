# Developing Risk Analyst
Work from this package with locked dependencies: `uv sync --locked`. Inspect scaffold provenance with `agents-cli info`; do not upgrade the scaffold or global tools as a side effect of role changes.

Follow the repository's [sequential delivery contract](../../../docs/sdlc.md). Define a scoped issue and failing controls before changing behavior. Keep persona and argument mapping here, deterministic domain/source/review enforcement in the matching backend, and reusable transport/state/provider mechanics in installed helpers.

Run `uv run --locked ruff check app tests` and `uv run --locked pytest -q --cov=app --cov-fail-under=90`. Native provider/context fixtures, compatible external MCP tests and frozen counterexamples are separate from project-shape checks. The backend's native integration journey must also pass after tool, source, context or review changes.

Add control, edge and authority cases before prompt edits. Existing numerical tolerances and datasets can be tuned through validated configuration; the six Risk trust floors remain mandatory. Preserve prior results and revise hashes explicitly when reviewed fixture/configuration bytes change. See [evaluations](EVALUATIONS.md).
