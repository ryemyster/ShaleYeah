# How checks work

A rule is an explicit statement such as “every row has a net-pay measurement in
feet.” A profile is a reviewed collection of those rules. Net pay here is simply
a field name in the synthetic examples; the tool does not interpret geology.

1. The host binds a task, its input references and an approved profile version/hash.
2. A verified caller requests those exact task/profile references.
3. The service reads authorized source bytes and checks their revision and hash.
4. The evaluator validates the input schema and runs applicable rules.
5. It saves a private draft containing the observed results and a canonical work
   product. Reporting requires that exact result reference and current export rights.
6. The human data/producing owner reviews defects and unresolved inputs.

| Rule | What is actually checked |
| --- | --- |
| Completeness | A configured field has an explicit non-null known value; zero remains valid data |
| Correctness | Same asset, well, period, unit and basis agree with a supplied reference within the configured tolerance |
| Units | The field's stated unit equals the approved unit; no silent conversion |
| Identity | The stated asset and well identifiers exactly equal the approved identifiers |
| Duplication | Configured composite keys identify unique rows; missing keys remain untested |
| Freshness | Observation time is present, not in the future and within the configured age |
| Provenance | Source bytes match their hash and supplied provenance is complete |
| Contradiction | Same-identity observations from different role sources disagree beyond the configured tolerance |

Missing sources or required comparisons remain `UNTESTED`; malformed data is
`ERROR`. Confirmed defects remain `FAIL` even when other rows cannot be tested.
All excluded rules are `NOT_APPLICABLE`, and zero checks never produce `PASS`.
Rules record inspected/evaluated/passed/failed/untested rows and whether their
assessment is complete. At most 100 defect details per rule are returned; total
row counts and `omittedDefects` preserve what was not included in that detail.

`passRate = passed rules / evaluated pass-or-fail rules`. Coverage is the number
of fully assessed applicable rules divided by all applicable rules. Inspect
status, incomplete assessments and row counts alongside these fractions. A
partial successful subset can have passRate 1 while the whole run is untested.
Neither rate is a probability that the underlying petroleum assessment is right.

The design draws on [dbt's configurable assertions and failing records](https://docs.getdbt.com/docs/build/data-tests)
and [Great Expectations' observed counts and bounded result detail](https://docs.greatexpectations.io/docs/core/trigger_actions_based_on_results/choose_a_result_format/).
[PPDM describes business data rules independently of a particular data model](https://ppdm.org/ppdm/PPDM/Collaboration/Committees/Rules_WG/PPDM/Data_Rules.aspx).
These are design references, not runtime integrations. No licensed PPDM rule
corpus is copied or certified. The synthetic labels check declared behavior;
professional correctness and severity judgments remain a separate review.
