# Testing Reporter

From this directory, `uv run --locked pytest -q --cov=app --cov-fail-under=90`
runs native project, tool, provider, context/restart, authority and scorecard
controls. Both provider journeys use offline native HTTP transports; no key or
professional reviewer is claimed.

`tests/eval/performance_profile.json` selects versioned installed metrics and
thresholds. The dataset names control, edge and capability cases. Trust floors
reject missing provenance, unauthorized publication and changed numerical claims;
configuration cannot load arbitrary code or waive those floors. Qualitative
rubrics can use an explicitly configured independent judge, whose scores cannot
grant rights or professional approval.

Run the frozen fixture report with:

```bash
uv run --locked python tests/eval/run_fixture_evals.py --code-revision <40-character-revision> --output artifacts/evals/reporter-qualification.json
```

The output records exact profile/dataset/metric/candidate versions, expected
counterexample failures and fixture limits. Initial expectations use researched
role guidance and authored/source-derived samples. Passing these controls does
not measure live model accuracy, professional correctness or human review effort.
