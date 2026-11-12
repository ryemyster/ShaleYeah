# Risk fixture provenance

Codex authored the initial synthetic labels under the maintainer's research authorization on 2026-11-09. They are provisional technical controls, not oilfield probability calibration, professional risk acceptance or measured accuracy.

`joint-scenario-oracles.json` was frozen before the TypeScript calculator. Its five independent controls are dependent, mutually exclusive, identical, zero-variance and large-weight joint states. For example, the dependent case assigns weights 7/1/1/1 to losses 0/100/200/500: mean 80, variance 23600, P90 loss 200, mass at or above 200 of 0.2, and indicator correlation 0.375. The exclusive case has mean 200 and correlation -1; the identical case has correlation 1. A constant loss/indicator retains zero variance and unavailable correlation.

The Python verifier independently uses Decimal/Fraction arithmetic, centered moments and integer-CDF comparisons. Backend observations in `observed-risks.json` were exported separately by `servers/risk-analysis/tests/fixtures/export-observations.ts`. They supply exact source/work snapshots for fidelity checks; their numerical summaries are not independent expected answers.

The dataset binds both files by SHA-256 and declares author, rationale, expected status and required failures for all 18 cases. Config/profile/dataset and prior report hashes must be retained when reviewed bytes change. Correct blocked work is a positive control: missing evidence or a severe hazard at zero assumed probability must remain blocked.

Primary sources inspected for the initial labels:

- [HM Treasury Orange Book](https://www.gov.uk/government/publications/orange-book/the-orange-book-management-of-risk-principles-and-concepts): accountable ownership, explicit assumptions, dependencies and uncertainty. This general governance guidance supplies no petroleum probability calibration.
- [AQuA Book, 2025 edition](https://www.gov.uk/guidance/the-aqua-book): traceable assumptions and proportionate verification/validation. Numerical correctness and suitability for a real asset remain separate questions.
- [NumPy 2.5 quantile documentation](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html): the declared weighted empirical-CDF/inverted-CDF convention. NumPy is not a TypeScript runtime dependency.

Native output is graded from the actual final response. Trusted backend observations and actual dispatch counts are supplied separately by the host. Model labels, optional rubrics and fixture scores cannot approve their own work. Named human MVP acceptance and observed review effort remain required later in the delivery ledger.
