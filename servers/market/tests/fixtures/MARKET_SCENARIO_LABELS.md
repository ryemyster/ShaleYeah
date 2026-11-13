# Initial market scenario labels

Codex authored these provisional labels under the maintainer's authorization in
#684. They are synthetic examples for technical qualification. They do not claim
current prices, operator-specific heat content, commercial suitability or human
acceptance. Professionals and contributors may review later label revisions;
retain the earlier version and results when doing so.

The initial oracle file is `market-scenario-oracles.json`, version `0.1.0`.
Its SHA-256 is
`185a3471fd9bc82956ab7586de20abbbff44cdad675348626912f8192c7eb90b`.
It was fixed before the scenario implementation and evaluation. Metadata about
label authorship lives outside the closed runtime source/work record schemas.

The fictional operator supplies 1.05 MMBtu/Mcf for the declared region and dates.
The independent expected arithmetic is:

| Required period | Benchmark, USD/MMBtu | Realized, USD/Mcf | Realized / supplied heat content, USD/MMBtu | Realized minus benchmark |
| --- | ---: | ---: | ---: | ---: |
| 2026-11-11 | 3.00 | 2.94 | 2.80 | -0.20 |
| 2026-11-12 | 3.50 | 3.465 | 3.30 | -0.20 |

The unweighted mean difference over those two explicitly required periods is
-0.20 USD/MMBtu. Coverage is two of two. Missing dates stay missing; the mandate
does not infer a trading calendar or fill holidays/weekends.

The supplied base, downside and upside scenario prices are respectively
4.00 - 0.20 = 3.80, 3.50 - 0.30 = 3.20 and 4.50 - 0.10 = 4.40 USD/MMBtu.
They remain operator scenario assumptions for December 2026 and require the
separate exact-revision commercial review before private recording.

The initial tests also require unavailable comparison values for missing or
foreign-region conversion factors, missing periods, stale observations,
frequency/location mismatch and future source vintages. Zero and negative
observations survive. Duplicate periods, nonfinite values, unknown evidence and
model-supplied factual metric fields must be rejected.

Research checked on 2026-11-13:

- [EIA Henry Hub](https://www.eia.gov/dnav/ng/hist/rngwhhdD.htm) establishes the
  named spot benchmark and dollars-per-million-Btu unit. No fixture price is
  copied from this page.
- [EIA gas-price conversion guidance](https://www.eia.gov/tools/faqs/faq.php?id=45&t=8)
  requires heat content and explains that it varies by place and time. The
  fictional 1.05 factor is an explicit input, not EIA's national example.
- [EIA API v2 documentation](https://www.eia.gov/opendata/documentation.php)
  identifies period/frequency/unit selection and string numeric returns. The
  normalized operator export must preserve the declared native metadata.

The baseline run on develop `0d0d32b08101aa1e3e5cacff829ad3f214fe46fb`
produced 14 failures and zero passes before runtime edits: the new market
scenario builder was absent. Invalid-input assertions separately require the
builder to exist so a missing implementation cannot count as a successful
rejection. These unit controls precede the remaining source, native employee,
context, evaluation, review and extraction qualification required by #684.
