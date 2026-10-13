# Review a LAS input

LAS (Log ASCII Standard) stores well-log measurements and their headers in a
text file. Geowiz's initial reference flow checks an approved LAS input before
offering interpretation. It does not turn a sparse log into a reservoir model.

## What the tools return

`analyze_formation`, `assess_quality`, and `process_well_logs` return
`analysisVersion: "0.2.0"` and an `inputReview` packet, version `0.1.0`.
The packet contains:

- the exact source-byte SHA-256 hash, row count, declared depth index and units;
- each curve's observed/null counts, sample minimum, maximum and mean;
- sample completeness, separate from unmeasured accuracy and confidence;
- supplied density assumptions and any apparent density porosity calculation;
- unavailable geological conclusions and the additional evidence they need;
- an `unreviewed` status and content-derived packet revision.

MCP calls also carry the separately authorized `sourceArtifact`: customer,
asset, task, employee, source revision, access/license notes and retrieval
provenance. The packet revision binds observations and assumptions; it does not
authorize a save, approve interpretation, or provide restart-safe continuation.
The reviewed employee workflow supplies those controls separately.

Check `success` and `isError` first. A format contradiction returns a permanent
input/source diagnostic. A missing file or unavailable transport is a different
failure. When geological parsing fails after a verified source was fetched,
the diagnostic carries that source artifact without exposing the private path
or row contents.

## Supported input subset

The initial flow accepts numeric, unwrapped LAS 2.0 with unique curve mnemonics,
matching declared index units (`M`, `F`, or `FT`), finite complete rows and a
strictly ascending or descending depth index. The declared start and stop must
match the first and last rows. A nonzero step must match each increment;
explicit `STEP=0` allows irregular sampling. The declared NULL sentinel alone
marks missing curve samples. Real zero and nearby numbers remain observations.

Wrapped LAS, other versions, time indices, ambiguous duplicate curves and
malformed rows need an explicit format/conversion decision. Geowiz does not
silently skip, repair, rename or guess them. This is a bounded subset, not a
claim to support every legal LAS file. LAS measured depth is not automatically
true vertical depth.

## Density assumptions

Apparent density porosity uses:

```text
phi = (matrixDensity - bulkDensity) / (matrixDensity - fluidDensity)
```

The result is a fraction. It is a calculation using supplied assumptions,
not calibrated formation porosity. Geowiz reads explicitly unit-bearing
`MDEN` and `FDEN` (or `FD`) parameters, or accepts this MCP argument:

```json
{
  "densityAssumptions": {
    "matrixDensity": 2.65,
    "fluidDensity": 1,
    "unit": "g/cm3",
    "basis": "operator-supplied test scenario, not field calibration"
  }
}
```

Both densities, units and basis are required. `kg/m3` is also supported, with
explicit conversion; recognized LAS density units include `G/C3`, `G/CC`,
`G/CM3`, `K/M3` and `KG/M3`. No rock or fluid density is selected by default.
Conflicting fluid declarations prevent calculation until the operator makes an
explicit choice. Out-of-range results remain visible with a warning rather
than being clamped to a plausible value. Missing samples remain missing.
Statistics are sample averages, including on irregular depth grids.

The Geologist wrapper accepts the same object as `density_assumptions_json`.
Optional `reviewConfidence` (`review_confidence_json` on the employee) contains
a 0–1 `value` and a stated `basis`. Zero remains zero. It is labeled as a
declared reviewer assessment and does not replace unmeasured confidence.

## What stays unknown

Gamma ray alone does not establish formation identity or hydrocarbon net pay.
Depth alone does not establish maturity or TOC (total organic carbon).
Uncalibrated log responses do not establish permeability, qualified formation
porosity or drilling targets. Those legacy top-level fields are now explicitly
null; `formations` is empty. Requested formation names remain request labels.
No unqualified values populate the shared canonical formation section.

A configured Gemini or Anthropic runtime may add a short `synthesis` note
with observation IDs and its actual provider/model receipt. The note is
unreviewed prose and cannot write numeric measurements or approval. Missing
configuration yields `not_configured`; outages yield `unavailable`; invalid
fields/citations yield `invalid_output`. Deterministic observations remain
available. Cancellation, ownership and credential failures remain errors.
The configured Geologist pair still checks its selected model binding.

## Research and reproducible checks

| Evidence | Decision it supports |
| --- | --- |
| [CWLS LAS 2.0 specification](https://www.cwls.org/wp-content/uploads/2014/09/LAS_20_Update_Jan2014.pdf) | Header/index/null requirements, signed steps and explicit variable sampling |
| [lasio parsing policies](https://lasio.readthedocs.io/en/stable/data-section.html) | Independent parsing; avoid aggressive automatic null/row repairs; distinguish duplicate-curve policy from validity |
| [SLB log interpretation](https://www.slb.com/resource-library/oilfield-review/defining-series/defining-log-interpretation) and [porosity measurements](https://www.slb.com/resource-library/oilfield-review/defining-series/defining-porosity) | Density calculation needs matrix/fluid assumptions; lithology, fluid and environmental effects require calibration |
| [SLB sandstone porosity units](https://glossary.slb.com/terms/s/sandstone_porosity_unit) | Preserve neutron response units and calibration basis; do not silently combine it with density |
| [USGS Appalachian well-log archive](https://pubs.usgs.gov/of/2007/1142/) | Geological correlation uses logs with supporting records; a public field-data source for subsequent calibration |
| [USGS Cow Creek release](https://www.usgs.gov/data/wireline-geophysical-las-logs-lewis-shale-usgs-cow-creek-1-21-well-carbon-county-wyoming) | Public CC0 logs with a wider measurement suite/core context; candidate for future field validation |

Normal tests need no internet or model key. Four unchanged MIT-licensed public
samples are pinned to lasio tag `v0.32`, commit
`aef25d50b9b36c08a9bde8c53181ed244ee2a035`, with original bytes, license,
hashes and an independently generated [oracle](../tests/reference/oracle.json).
Two samples have contradictory declared stops; one is wrapped. They remain
negative tests. An explicitly corrected test derivative checks negative/signed
zero observations without modifying the public original or repairing runtime
operator inputs.

The oracle was generated with the pinned source checkout and strict null/no
repair policies. Its runtime version reports an unversioned source-build string;
the commit, source reader hash and sample hashes identify the tested code.
To reproduce in a disposable development environment, install `lasio==0.32`
and NumPy, then run `python tests/reference/regenerate.py` from this package.
Review any oracle diff before accepting it. lasio is not a Geowiz runtime dependency.

The separate synthetic demo now ends at its declared stop (8410 ft) and
comments its column-label row. The Geologist copy, source hashes, byte count
and performance dataset reference were revised together.

This is a research-reviewed starting baseline for open-source refinement.
It is not an 80 percent accuracy measurement. Remaining work includes diverse
field/core comparisons, environmental corrections, formation calibration,
uncertainty validation and human acceptance of actual employee outputs.
The USGS datasets above were researched, not run through the local tests.
