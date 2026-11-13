# EIA benchmark access

The U.S. Energy Information Administration (EIA) publishes the benchmark series used here. Obtain an API key through [EIA registration](https://www.eia.gov/opendata/register.php), then supply `EIA_API_KEY` in the server's private process environment. The package does not automatically read an `.env` file.

The client uses EIA's documented [APIv2 series-ID route](https://www.eia.gov/opendata/documentation.php):

| Benchmark | Series ID | Canonical unit | Public definition |
| --- | --- | --- | --- |
| WTI oil at Cushing | `PET.RWTC.D` | `USD/bbl` (US dollars per barrel) | [Daily WTI history](https://www.eia.gov/dnav/pet/hist/rwtcd.htm) |
| Henry Hub natural gas | `NG.RNGWHHD.D` | `USD/MMBtu` (US dollars per million British thermal units) | [Daily Henry Hub history](https://www.eia.gov/dnav/ng/hist/rngwhhdD.htm) |

Requests select daily data, `value`, descending `period` order and length one. The client checks the returned series, daily period, numeric value and unit. EIA's [FAQ](https://www.eia.gov/opendata/faqs.php) explains that compatibility routes retain v2 metadata and can return different row counts; empty or ambiguous rows are unavailable here. Accepted unit spellings are the matching EIA abbreviations or the benchmark's written unit name.

Each HTTP request has a ten-second deadline and a 256 KiB response bound. Request URLs contain the API key for EIA access; they are not returned or logged as source metadata. Results cite the public benchmark definition instead.

Successful observations are cached for one hour with their original retrieval time. The source's observation day remains separate. The analysis defaults to a seven-day observation-age window that the host can configure; this is a local policy, not a promise about publication timing. Clearing the cache or downloading again cannot make an old observation current. Key removal/rotation invalidates its cache. Failed requests are not converted into prices.

Missing access produces `null` current fields and a safe reason. One valid benchmark remains available if the other fails. No key is needed for offline tests; no live-key verification is claimed by that test suite. The region query does not turn a benchmark into a regional price or a single quote into measured volatility.
