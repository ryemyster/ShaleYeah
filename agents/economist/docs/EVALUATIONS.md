# Economist performance evaluation

The employee's scorecard is JSON configuration in
[`performance_profile.json`](../tests/eval/performance_profile.json). The
[`dataset`](../tests/eval/datasets/economist-performance.json) contains fourteen
control, edge and capability cases. Operators can revise cases, freshness limits,
registered numeric tolerances and optional qualitative rubrics without changing
Python. A changed dataset requires its reviewed revision and SHA-256 in the
profile to change together. Keep earlier profiles and results for comparison.
The dataset also binds the independent financial reference file by reviewed ID,
revision and exact byte hash. Updating an answer requires updating this binding;
changing the file silently is rejected. Financial references participate in the
report's reference hash, so candidate comparisons require the same answer set.

Schema, provenance, freshness, assumptions, authority, architecture, tool use,
financial accuracy and source-faithfulness checks are required. Configuration
cannot disable them or turn their failure into a warning. The installed host
policy also bounds numeric tolerances. An optional model judge cannot waive these
checks, replace the reference labels or authorize a private scenario save.

## Independent financial references

Codex authored the initial synthetic labels under the maintainer's research
authorization. The six financial references were frozen on October 19, 2026,
before implementing their evaluator; the fourteen counterexample cases were
frozen on October 20 before running the qualification benchmark. They are
provisional technical labels, available for professional and contributor review.

The independent evaluator uses Python decimal arithmetic. It does not import
Econobot's solver. It recomputes NPV, checks a claimed IRR against the discounted
cash-flow residual, and independently determines the first period-end recovery.
It also checks reported findings, sign, currency, period and timing conventions.
Forecast-derived results retain an assumed basis rather than becoming measured
observations. Unknown results retain explicit null values and reasons.

| Reference | Cash flows | Effective rate | Expected result |
| --- | --- | --- | --- |
| Base | -100, 110 | 10% per year | NPV 0; IRR 10%; payback period 1 |
| Negative return | -100, 90 | 10% per year | NPV -18.181818…; IRR -10%; no recovery |
| Monthly | -100, 110 | 10% per month | NPV 0; IRR 10% per month; payback month 1 |
| Zero period | -100, 0, 110 | 0% per year | NPV 10; IRR sqrt(1.1)-1; payback period 2 |
| Ambiguous | -100, 230, -132 | 10% per year | NPV 0; ambiguous IRR remains unavailable |
| No solution | -100, -10 | 0% per year | NPV -110; IRR and payback unavailable |

One-period answers follow directly from algebra. The zero-period IRR also has a
closed-form answer. The ambiguous example has two positive roots; deferral is
this product's declared policy. The initial undiscounted payback convention is a
product choice and is explicitly separate from discounted recovery.

The numerical basis is the time-zero, equal-period equation documented by
[NumPy Financial NPV](https://numpy.org/numpy-financial/latest/_api_stubs/numpy_financial.npv.html)
and [IRR](https://numpy.org/numpy-financial/latest/_api_stubs/numpy_financial.irr.html).
The corresponding published implementation is
[NumPy Financial v1.0.0](https://github.com/numpy/numpy-financial/blob/v1.0.0/numpy_financial/_financial.py).
[PHDWin's Basic Economic Concepts and Calculations](https://www.phdwin.com/wp-content/uploads/2017/03/Economics-Basics.pdf),
at its March 2017 document path, informed the explicit net-entity, ownership,
expense, fiscal and investment inputs. The primary documents were read during
the October 19 research and rechecked October 20; the mutable online pages do
not update the frozen labels automatically. These references do not establish
compatibility with a proprietary export format or validate an operator forecast.

## Evidence layers

`fixtures/economic-oracles.json` contains independent answers and rationale.
`fixtures/observed-scenarios.json` contains actual Econobot outputs captured from
synthetic operator inputs. The server's `tests/fixtures/capture-evaluations.ts`
can reproduce those outputs; it supplies only inputs to the solver, never the
expected financial answers. A correct backend object cannot hide incorrect
numbers in the employee's reported findings.

`run_fixture_evals.py` is a deterministic metric benchmark. It checks six correct
outputs and eight deliberately unsafe counterexamples against a frozen fixture
baseline. Its constructed scoring traces are not native model executions or
evidence of improvement against a previous released model. All fourteen expected
outcomes must match, including blocking the unsafe cases.

The separate `servers/econobot/tests/native-context.test.ts` runs the native
Gemini and Anthropic adapters against an authenticated Econobot HTTP service,
with fixture model responses. It requires real source reads, draft and review
preparation, all seven financial sources in context, and restoration of the
pending review after restart. It grades the actual final employee JSON, then
uses installed qualification and the separate human CLI to approve the packet,
resume private storage exactly once and deny revoked context without a model call.
Its transport execution is a separate requirement;
the metric benchmark cannot substitute for it.

Run the metric benchmark from this package:

```sh
uv run --locked python tests/eval/run_fixture_evals.py \
  --output artifacts/evals/economist.json --code-revision "$(git rev-parse HEAD)"
```

The report records fixture qualification, actual blocked counterexamples and
`professionalAcceptance: false`. No paid model, field accuracy, 80% success rate,
saved employee time or professional certification is established. A benchmark
pass alone cannot approve an operator's current packet. Actual installed
qualification, exact packet binding, current source authority and an enrolled
human decision remain required at the executing backend.

The fixture verifier accepts an owner-only `--packet` from the separate review
CLI and an owner-only `--observed` backend result or native execution, together with a private
`--evidence-directory`. It checks the exact work/scenario and every inspected
source's identity and byte hash. The current base control is graded against the
independent financial oracle; agreeing backend and report objects cannot invent
their own correct answer. The installed review guard then re-verifies the owned
bundle and exact packet before human approval and execution. This path remains
fixture qualification for the declared reference inputs. Other financial inputs
need separately reviewed labels and configuration; this helper cannot silently
claim live or professional qualification.

Initial frozen hashes:

| Artifact | SHA-256 |
| --- | --- |
| Dataset bytes | `f941dbb6f20d3159b0a12b08f66a1f2668e36639e0849ce6b555cc94ff555da7` |
| Financial oracle bytes | `bc9e44ad7b6c7732a06463011bd6b19f7f5e98475437893b5166b115aaf60292` |
| Captured backend bytes | `33bd3dd2bd8ccbf87197ebf06a1c07f71f96b06cbaac24b3136091725e8e1a45` |
| Canonical profile | `601a550c68f3577772ce5ed747c65705d6b55225d387e59756659b1d5560972e` |

Before employee acceptance, dataset/profile revision `r2` added the explicit
binding to the unchanged financial oracle file. No case labels changed. Its
dataset hash is `0fa5be4bbe7a7bdf654feda4e74afd69a423913c2adca2716d3ba0ea2d6b0b49`
and canonical profile hash is
`493052347797c790886da1d70243513a93dadd6f187e891fbf5602f31f9f58c0`.

Revision `r3` adds the explicit architecture mode and human-review boundary to
dataset metadata. The fourteen case labels and financial answers remain unchanged.
Its dataset hash is `1454b5f4a1f3d0bd55b76bf9cd63d91ab81ac1c56a0e3b5acec9585f5d357669`
and canonical profile hash is
`4e14724b138c5d6b16ed1dc82c1c109303fa85c53553f8a14bb84ca545e2c377`.

The native service test writes actual fixture-model traces to
`servers/econobot/artifacts/native-traces`. The supplementary agents-cli metric
checks exact output fidelity and the native source/draft/review trajectory.
Agent Platform has a narrower event schema than ADK, so the export adapter keeps
actual authors/content while excluding ADK-only event metadata. Raw traces remain
available. From this employee package, with agents-cli 1.3.1 installed:

```sh
uv run --locked python tests/eval/export_cli_traces.py \
  ../../servers/econobot/artifacts/native-traces /absolute/new/cli-traces
agents-cli eval grade --traces /absolute/cli-traces \
  --config tests/eval/eval_config.json --output /absolute/new/cli-grade
uv run --locked python tests/eval/verify_cli_grade.py /absolute/cli-grade
```

The final check requires two valid provider traces, no metric errors and exact
fidelity. This compatibility metric supplements the installed independent
financial/source/authority scorecard; it cannot replace it or authorize a save.
