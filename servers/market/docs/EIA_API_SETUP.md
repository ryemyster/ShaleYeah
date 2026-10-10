# EIA API Setup

The EIA (U.S. Energy Information Administration) API provides free, official commodity price data — WTI crude and Henry Hub natural gas. SHALE YEAH uses it in `market.ts` to replace stub prices with real values.

## Get a Key

1. Go to [https://www.eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php)
2. Enter your email — the key arrives within minutes
3. No credit card, no tier limits for standard use

## Add It to Your Environment

```bash
# .env (never commit this file — it's in .gitignore)
EIA_API_KEY=your_key_here
```

Or export inline for a single run:

```bash
EIA_API_KEY=your_key_here npm run prod
```

## What It Unlocks

Without the key, `analyze_market_conditions` falls back to documented stub constants (`$75/bbl WTI`, `$3.50/mcf Henry Hub`) and tags the response with `dataSource: 'stub'`. With the key, it fetches live spot prices and tags with `dataSource: 'eia'`.

The fallback is intentional — demo mode and CI both work without a key.

## Endpoints Used

| Price | Series ID | Endpoint |
|-------|-----------|----------|
| WTI Crude ($/bbl) | `RWTC` | `GET /v2/petroleum/pri/spt/data/?frequency=daily&data[0]=value&series_id=RWTC&sort[0][column]=period&sort[0][direction]=desc&length=1` |
| Henry Hub Gas ($/MMBtu) | `RNGWHHD` | `GET /v2/natural-gas/pri/fut/data/?frequency=daily&data[0]=value&series_id=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=1` |

Full API explorer: [https://www.eia.gov/opendata/browser/](https://www.eia.gov/opendata/browser/)

## Rate Limits

- 5,000 requests per hour per key (free tier)
- SHALE YEAH caches prices for 1 hour — a full analysis run costs 2 requests
