# Developing Legal Analyst

Work from this package with `uv sync --locked`, `uv run --locked ruff check app tests` and `uv run --locked pytest -q --cov=app --cov-fail-under=90`. Use `agents-cli info` to inspect the project. The approved native dependency family is pinned through the shared employee runtime and this package's lock.

Write failing behavioral cases before changing prompts/tools. Keep independent labels separate from generated wire observations and actual returned native output. Source fidelity, citation identity, declared applicability, coverage and executing authority are distinct checks. Preserve original labels/results when issuing revisions. See [evaluation](EVALUATIONS.md).

Agent reasoning and context integration live here. Deterministic source/projection/review behavior belongs in the matching Legal MCP package. Keep the Stand-alone Agent with Progressive Disclosure (Skills) mode and human legal-review boundary explicit. Any change to that design needs its owning issue and evidence.

Update affected package docs, changelogs and registered evaluation assets with behavior changes. The repository's sequential issue/branch/PR checks apply before shipping.
