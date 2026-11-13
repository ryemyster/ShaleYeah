# How Market works

Market helps answer two questions: what do the supplied commodity observations say, and what source facts are available about named competitors?

It reads WTI oil and Henry Hub gas benchmark data from EIA when access is configured. Each observation keeps the day it describes, its unit and when it was retrieved. A recent download of an old observation is still old data. These two benchmarks are not measured prices for every requested region.

For companies, the operator supplies permitted source records through a private JSON file. Each value names its company, market, metric, source and dates. The operator may also supply a reviewed scenario assumption. Assumptions remain labeled and separate from observed values.

The model receives eligible evidence and can return an advisory explanation with known evidence IDs. Its answer cannot fill the source metric fields. If evidence is missing, the field is `null`; if a model is unavailable or returns an unsupported answer, the interpretation is unavailable while valid source facts remain.

The response reports source and review status. `available` means the requested observed fields are present within the declared freshness window. `partial` means some are missing; `assumption-only` means only explicit scenario inputs are eligible; `unavailable` means there is no eligible input. None of these statuses grants commercial approval or certifies professional accuracy.

Before returning after a model call, the backend rechecks the host snapshot and observation age. A changed or revoked source cannot keep a prior narrative. Human reviewers still decide whether the evidence and interpretation are suitable for a real transaction.

See [input records](INPUTS.md) and [integration](INTEGRATION.md) for the response fields and query shapes.
