# Legal Analyst evaluation

`tests/eval/performance_profile.json` selects installed metrics, thresholds, weights and data-only datasets. The host's trusted policy preserves mandatory floors. Owners can tune permitted settings and versioned optional rubrics without supplying executable code; a judge cannot relax source or authority gates.

The seven Legal checks cover exact returned source/work fidelity, UTF-8 citation accuracy, declared jurisdiction/territory/activity/date eligibility, question/source/conflict coverage, observed architecture/tool events and no unapproved clearance or recording. Shared contract, provenance, freshness, assumption and authority checks also apply.

`app/evaluation.py` parses the actual final native response. It cannot substitute a correct backend record for altered model output. The response must be exactly `{work, legal}` or explicit deferral. Duplicate keys, nonfinite values and mixed tool-call/final-output parts are rejected.

From this package, replacing the revision placeholder with the actual tested commit:

```sh
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/legal.json --code-revision FULL_TESTED_COMMIT_SHA
```

The 20 control/edge/authority labels were frozen before the Legal grader and prompt changes. Their [fixture provenance](../tests/eval/fixtures/README.md) distinguishes independent source/expected decisions, generated canonical backend observations and actual native traces. The runner requires every case and binds exact source, dataset, profile, candidate and code identities. It can also bind an inspected private packet to owner-only evidence files for installed qualification.

Fixture passes are technical results. They do not prove legal entailment of free-text interpretations, materiality, professional licensing, live-model quality or human effort improvements. Professional acceptance remains false. Qualified human review and optional configured semantic rubrics retain those judgments. Preserve prior labels and results when a reviewed version changes.
