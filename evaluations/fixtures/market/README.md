# Provisional Market fixtures

The source and timing rules use the [EIA Henry Hub series](https://www.eia.gov/dnav/ng/hist/rngwhhdD.htm),
[WTI Cushing series](https://www.eia.gov/dnav/pet/hist/rwtcd.htm),
[gas conversion guidance](https://www.eia.gov/tools/faqs/faq.php?id=45&t=8) and
[API v2 documentation](https://www.eia.gov/opendata/documentation.php), checked
on 2026-11-13. No fixture price or heat-content value comes from those pages.

Codex authored the initial labels under the maintainer's authorization in #684.
All observations, operator assumptions and the 1.05 MMBtu/Mcf factor are
fictional. The labels are provisional technical references, with no professional
acceptance, vendor entitlement, live-price claim or measured accuracy claim.

`source-oracles.json` predates the scenario implementation. Its independent gas
arithmetic divides 2.94 and 3.465 USD/Mcf by the supplied factor to obtain 2.80
and 3.30 USD/MMBtu. Subtracting the supplied benchmark observations gives -0.20
for each period and for their unweighted mean. The three future scenario prices
are 4.00 - 0.20 = 3.80, 3.50 - 0.30 = 3.20 and 4.50 - 0.10 = 4.40.

`evaluation-cases.json` freezes decisions and additional arithmetic before the
Market metric implementation. The oil control compares 58 and 59.5 with 60 and
61 USD/bbl, for differences of -2 and -1.5 and a mean of -1.75. Its scenario
prices are 65 - 2 = 63, 55 - 3 = 52 and 75 - 1 = 74. Other valid controls preserve
zero/negative observations and explicitly requested historical months. Missing,
stale, foreign-region or unconvertible inputs block qualification. An honest
unavailable result preserves the gap and cannot qualify as a complete packet.

`observed-scenario.json` and `observed-variants.json` capture actual synthetic
backend records from the Market fixture exporter. They are observed records,
not the expected arithmetic. The installed Python metrics independently check
native values, conversion, differences, means and scenario sums using rational
arithmetic. They also check geography, periods, freshness and source fidelity.
The graders import neither the backend calculator nor the agent's reasoning.

The 21 cases contain four valid packets and 17 cases expected to block. Their
synthetic function events exercise deterministic metric boundaries; they are
not native inference traces. Actual native model/tool/server qualification must
separately grade the returned final response and bind the exact private packet.
Only the enrolled human can approve that packet. Technical fixtures do not
replace final named human MVP acceptance in #694.

From the Market Analyst package, run the frozen suite with a new report path:

```sh
uv sync --locked
uv run --locked python tests/eval/run_fixture_evals.py --output ./NEW_PRIVATE_REPORT.json
```

The runner verifies reference hashes before grading, prints every expected
decision and writes a private report without overwriting an existing file. Its
`market-fixture-suite` report always has `promotionAllowed: false`; installed
job qualification and human approval are separate gates.

`tests/eval/run_qualification.py` creates the installed verifier's separate
candidate/baseline records for these same 21 fixture cases. With `--packet`,
`--observed` and `--evidence-directory`, it replaces the current control with the
exact inspected work, scenario and source bytes. All three arguments are required
together. The observed file comes from the trusted host, outside employee access;
input assertions in it cannot replace inspected source bytes. When it contains
native responses and events, the returned work/scenario must match the packet.

Run it under the installed Python environment with `-I`, a deployed
`--code-revision` and a new private `--output` file. Evidence directories must be
owned and mode 0700; files are created exclusively with mode 0600. The bundle is
named for the packet digest and paired with a separate `policy.json`. Existing
evidence is preserved. The SDK's fixed installed verifier rechecks this bundle
at human approval and protected continuation. The initial policy and references
remain fixture qualification, even when native scripted-provider events are
included. The CLI test covers separate human approval, recording once, restart,
and rejection after qualification policy changes; full native and independent
package/container acceptance remain separate work in #684.

The JSON profile selects registered metrics and bounded tolerances. Operators
can change supported parameters, dataset revisions and optional reviewed judge
rubrics without executable code. Installed policy requires the source, arithmetic,
coverage and authority gates at threshold 1; configuration cannot remove or
soften them. No model judge is enabled by the default profile. Keep previous
labels, profiles and results when publishing a reviewed revision.

Frozen r1 raw-byte hashes:

| File | SHA-256 |
| --- | --- |
| `source-oracles.json` | `185a3471fd9bc82956ab7586de20abbbff44cdad675348626912f8192c7eb90b` |
| `evaluation-cases.json` | `8f8ff78e7cb4f0b20d75205fd3973933e2da87c939c1064138baa10cc7a00c32` |
| `observed-scenario.json` | `e7947d18eacde1e07ac1640cb912a1542b9d556fa1f01da8273b7549a817ab78` |
| `observed-variants.json` | `52623c6d67c3b2d50e741bd003ff5283a8ddc38a57561d0845eddbf31aa6ad6d` |
| `market-performance.json` | `87748558acb77562d076dd770a6bd88c55f81e180e0c5da000cf6aa4396156ce` |
| `performance_profile.json` | `edcdd021e86c5ab33c06d3e26ed98e036a095f27ddacc531d2d6670f2fbe7ef6` |

The loader additionally computes a canonical configuration hash. Raw file hashes
above identify these exact authored bytes; they are not interchangeable with that
canonical hash.
