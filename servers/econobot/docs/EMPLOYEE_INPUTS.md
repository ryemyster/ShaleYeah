# Financial inputs and human review

The Economist prepares an advisory scenario from the operator's financial
evidence. Econobot calculates the supplied net cash flows. A net cash flow is
money received after the operator has accounted for costs, ownership and fiscal
terms. The calculator does not invent those inputs or construct a tax model.

The operator supplies a private JSON binding through `ECONOBOT_CONFIG_FILE`.
It selects a task, the source files, scenario definitions, source rights, an
enrolled human reviewer, and private locations for state and audit events.
File paths and credentials belong to this host configuration, not model arguments.

Each scenario declares currency, effective discount rate per period, period
unit, nominal or real money basis, start date, working interest and revenue
interest. A scale of `1` means amounts are already expressed in the declared
currency units. Convert an export reported in thousands or millions explicitly
before using it; the service does not guess a scale.

Its assumption, forecast, price-deck, cost, ownership and tax/royalty references
must identify actual authorized task inputs by their exact revisions. A missing
or stale reference blocks the work. These references do not certify that a
forecast or fiscal assumption is professionally correct. The human reviewer
sees the source text and the declared basis before accepting a private scenario.

The primary cash-flow CSV uses these columns:

```csv
scenarioId,scenarioRevision,period,netCashFlow
base,r1,0,-100
base,r1,1,110
```

Period zero is the initial date. Later rows are consecutive, equally spaced
period ends. Negative values are payments and positive values are receipts.
Zero is a real value. Missing, nonnumeric or irregular rows are rejected.
The example uses synthetic amounts and is not a forecast or investment recommendation.

The ownership source uses fractions, with one row for each selected scenario:

```csv
scenarioId,workingInterest,revenueInterest
base,0.5,0.4
```

Working interest describes the operator's declared share of costs; revenue
interest describes its declared share of revenue. The service checks that these
values match the scenario definition. It preserves the remaining source exports
for review and does not recreate proprietary fiscal models.

The agent can read source identities first, request a bounded page of source
text, calculate or compare scenarios, and prepare exact work for review. These
calls do not authorize capital spending. The enrolled human uses the separate
review interface:

```sh
node examples/review.mjs inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes PRIVATE_REASON_JSON
```

The reason file is an owner-only JSON file containing a `reason` string.
`approve` and `reject` are also supported decisions. Approval requires a trusted
installed qualification guard; a candidate's own claim of passing evaluations
is insufficient. After approval, the employee can record the exact private
scenario once. Changed sources, assumptions, rights or revisions require fresh
review. No binding offer, capital commitment or external publication is exposed.

Operator CSV and licensed exports use the installed file connector. Public and
internal systems can supply the same source contract through installed adapters.
The optional EIA snapshot hook has offline synthetic mapping tests. It retains
observations and units, rejects missing or stale values, and discards echoed
request credentials. It does not turn a historical spot observation into an
approved future price deck. Its series, frequency and unit mapping require
operator verification before live use. The default CLI performs no EIA request.

EIA's [API documentation](https://www.eia.gov/opendata/documentation.php) describes
dataset metadata, frequency, pagination, string-valued observations and echoed
request parameters. PHDwin's [economic calculation guide](https://www.phdwin.com/wp-content/uploads/2017/03/Economics-Basics.pdf)
and [report guide](https://support.phdwin.com/documentation/running-reports/)
explain why net financial basis, ownership, currency, units and report scale
must remain visible. These references guide the input boundary; they do not
establish compatibility with a proprietary database or certify petroleum economics.
