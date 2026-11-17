# Host market source records

The operator selects an absolute `MARKET_SOURCE_FILE` path. The file must be owned by the process user and private (`0600`). A model/MCP caller cannot select this path, a source URL or a reviewer. Source records are data only; no arbitrary fetch or executable rule is accepted.

A valid empty configuration is:

```json
{"version":"0.1.0","rights":"operator-attested-permitted","records":[]}
```

An empty file supplies no company facts. `rights: "denied"` withdraws host-record use. This declaration and any review identity are operator attestations, not automated license, professional or identity certification. The operator is responsible for actual permission and suitability. The backend rereads the snapshot after interpretation; changed/denied data invalidates the prior narrative.

## Each record

| Field | Required form |
| --- | --- |
| `id` | Unique bounded record ID |
| `subject` | `{"kind":"competitor","name":"exact company","market":"market spelling"}` or `{"kind":"commodity","name":"WTI"}` / `HenryHub` |
| `metric`, `unit` | One of the matching pairs below |
| `value` | Finite JSON number; zero is preserved |
| `basis` | `observed` or `assumed` |
| `observedAt` | For an observation, an actual ISO calendar date or UTC timestamp; for an assumption, `null` |
| `retrievedAt` | UTC timestamp when the host obtained this record |
| `source` | For an observation, `{"id":"source ID","uri":"stable source URI"}`; for an assumption, `null` |
| `review` | For an observation, `null`; for an assumption, `{"reviewerId":"operator ID","reviewedAt":"UTC timestamp","reason":"actual review rationale"}` |

Source URIs are provenance identifiers. Use a stable HTTP(S) URI without credentials, query or fragment, or a bounded `urn:` identifier. The server does not fetch these URIs. Source metadata must contain no secrets. Unknown fields, duplicate record IDs, inconsistent units or missing assumption reviews make the bundle invalid.

| Subject / metric | Unit and value rules |
| --- | --- |
| WTI / `price` | `USD/bbl`; finite values, including zero/negative observations |
| HenryHub / `price` | `USD/MMBtu`; finite values, including zero/negative observations |
| Company / `market_share` | `fraction`, from 0 to 1 |
| Company / `production` | `boe/day` (barrels of oil equivalent per day), nonnegative |
| Company / `costs` | `USD/boe` (US dollars per barrel of oil equivalent), nonnegative |

Provide one selected observed record per company/market/metric or commodity price. Multiple matching observed records are ambiguous and do not silently select a winner. An explicit host benchmark observation takes precedence over EIA; an assumption never fills an observed field. Assumptions can inform a separately labeled hypothetical narrative.

The default analysis window is seven days. Observation age uses `observedAt`; assumption age uses its actual review time. A date-only period is assessed at UTC midnight. Future or inconsistent times are unavailable. A stale value and its original date remain visible in the detailed metric, while its current factual field is `null`. Fresh retrieval and cache timestamps do not renew source age.

The [synthetic test packet](../tests/fixtures/evidence.ts) shows the complete shape for offline tests. Its companies, numbers and review identities are fictional and must not be presented as operating evidence. Enter real permitted source records and actual operator review assertions for a live task.

## Assigned employee sources

The records above serve advisory queries. A task's scenario work uses a separate
private binding with exact mandate, series and assumption JSON exports. It retains
observation periods and vintage separately from retrieval time, requires applicable
heat content for gas conversion, and binds source byte hashes and current rights.
See [employee workflow](EMPLOYEE_WORKFLOW.md); advisory records cannot silently
replace these assigned inputs.
