# Title evaluation and qualification

`tests/eval/performance_profile.json` selects installed deterministic metrics and the frozen 28-case dataset. Owners can tune bounded freshness, add explicit cases or configure supplemental rubric judgments through the common evaluation contract. Exact arithmetic, citation/scope, source fidelity and authority floors remain mandatory at threshold 1; a model judge cannot waive them. No model judge is configured by this starter profile.

The original source/oracle and dataset bytes were frozen before Title backend, prompt and grader implementation. `fixtures/label-freeze.json` records Codex authorship under maintainer authorization, timing, rationale and SHA-256 values. These are provisional research-backed initial labels; qualified professionals/contributors can refine professional correctness and materiality later with versioned evidence. The 80% aspiration is not a measured score or promotion threshold.

Primary references are the BLM's [interest-transfer examples](https://www.blm.gov/sites/blm.gov/files/Transferring_Oil_and_Gas_Lease%20Interests.pdf), [land-record coverage notes](https://www.blm.gov/services/land-records), and the Texas RRC's [jurisdiction limits](https://www.rrc.texas.gov/about-us/faqs/rrc-authority-and-jurisdiction/), retrieved 2026-11-18. They support distinctions and limits, not current filing fees, state-law rules or professional title truth. All tracts, parties and instruments are fictional.

Independent Python `fractions.Fraction` checks distinguish record/operating rights and explicit grantor/whole or WI/whole bases. Other metrics verify exact UTF-8 citations, required instruments/predecessors/questions, tract/depth/date scope, lease uncertainty, common-work projection, actual final output and no unsupported title authority. Native tool trajectory and architecture checks use host events. Coverage/byte identity alone does not establish semantic legal entailment.

`observed-packet.json` and `observed-variants.json` contain actual synthetic backend executions. `observations-manifest.json` binds those captures. They do not replace the independently authored expected fractions or labels. `provider-proposal.json` is authored provider test text; the fixture must obtain every citation from actual quote lookup and copy final output from an actual successful draft. Synthetic negative cases deliberately mutate observed data or authority; they are counterexamples, not observed professional behavior.

The frozen dataset uses `expectedStatus: "failed"` for a disallowed result. The qualification adapter translates that label to the shared hard-gate outcome `blocked` without changing original dataset bytes, required metric failures or hashes. Each control must pass; every counterexample must trigger its declared failure. Actual native provider control output replaces the base trace during installed packet qualification.

```sh
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/title.json --code-revision FULL_TESTED_COMMIT_SHA
```

The decision binds the tested revision, configuration, frozen data and baseline. Promotion and professional acceptance remain false. Approval also requires inspected current source bytes, the actual employee output and installed private qualification evidence; an employee-supplied eval label cannot authorize recording.

Required CI also exports actual native traces and grades them with the pinned Google agents-cli local custom handler. That supplementary exact-output/trajectory score cannot replace independent role qualification, separate human authority or final named human MVP acceptance.
