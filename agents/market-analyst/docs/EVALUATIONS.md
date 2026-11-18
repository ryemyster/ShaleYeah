# Market Analyst evaluations

The default profile is `tests/eval/performance_profile.json`, with the frozen
`market-performance.json` dataset. Its 21 cases include dated gas/oil controls,
zero/negative values, monthly periods, missing conversion or source coverage,
stale inputs, region mismatch, wrong transformations, forged source revisions,
changed final output and unapproved authority or writes.

The [fixture notes](../tests/eval/fixtures/README.md) record provisional Codex
labels, primary sources, independent arithmetic, reference hashes and limits.
All prices and heat-content factors are fictional. These are technical fixture
references, with no measured commercial accuracy or professional acceptance.

Five common trust gates and seven Market gates remain mandatory at threshold 1.
The Market gates check source fidelity, independent rational transformations,
regional relevance, complete fresh source coverage, selected architecture, tool
trajectory and no unapproved scenario authority. A reviewed profile can change
bounded tolerances, datasets and optional judge rubrics without Python edits;
it cannot waive installed floors. No model judge is enabled by default.

`app/evaluation.py` parses the actual final work/market response and records
separate host observations. The installed verifier reparses it and recomputes
scores, so changed final text cannot inherit old extracted work even after its
hashes are updated. The frozen fixture runner's report always denies promotion.

`tests/eval/run_qualification.py` creates private candidate/baseline records for
the installed verifier. Current-control mode requires `--packet`, `--observed`
and `--evidence-directory` together, with `--output` and `--code-revision`.
It compares exact work/scenario and full source metadata, validates source byte
lengths/hashes and derives inputs from inspected bytes. Evidence remains fixture
qualification and does not replace a separate human approval.

The native backend test captures both scripted provider traces. CI exports their
actual events to Google's local handler using `eval_config.json`, then requires
both provider cases to have score 1 and no errors. This supplementary fidelity
check does not replace installed job qualification or establish live model quality.
Independent source/archive/wheel/container journeys remain separate required gates.
