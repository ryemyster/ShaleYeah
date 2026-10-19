# Calculation rules

NPV discounts the supplied cash flow at period t by `(1 + rate)^t`, including
the initial flow at t=0. All periods are equally spaced. The rate is effective
per declared month, quarter or year. Dated irregular flows and XIRR are not
supported. Input allows 2–601 finite cash flows and a finite rate greater than -1.

IRR is a decimal rate that makes the same NPV zero. The solver uses bisection in
log discount space, bounded to rates [-0.999999, 1000000] and at most 160
iterations by default (host maximum 512). A returned rate must have a relative
zero-NPV residual no greater than 1e-10 after conversion back to a rate.
This residual divides the absolute discounted sum by the sum of absolute
discounted terms. Log scaling and compensated summation reduce overflow and
cancellation; these remain floating-point calculations, not exact decimal
accounting. NPV outside finite numeric range is explicitly unavailable.

Zero cash flows remain zero. All-zero IRR is indeterminate; one-sign cash flows
have no solution. More than one sign change is conservatively marked
ambiguous_series: this is a root-selection deferral, not a claim that every such
series has multiple roots. A root outside the declared range or failure to
converge returns null with a reason. Rates are never clipped to look plausible.

Payback is the first undiscounted period-end at which cumulative cash flow
recovers the negative initial investment. It is an integer count of the declared
period, without invented within-period interpolation. No initial investment and
no recovery have separate unavailable states. Later cash outflows can reverse a
previous recovery; payback does not certify permanent profitability.

Scenarios are supplied by the operator, not generated from invented commodity
prices. Each must use the base case's currency and period. No exchange rate,
annualization or price-to-production model is inferred.

Independent references checked 2026-10-19:
[NumPy-financial NPV](https://numpy.org/numpy-financial/latest/_api_stubs/numpy_financial.npv.html)
defines t=0 and matching periods;
[NumPy-financial IRR](https://numpy.org/numpy-financial/latest/_api_stubs/numpy_financial.irr.html)
provides the zero-NPV definition and published examples;
[Microsoft IRR](https://support.microsoft.com/en-us/excel/functions/irr-function)
documents periodic cash flows and iterative failure. These are test oracles,
not production dependencies. Tests include the published 8% NPV example
3065.22267, IRR about 0.28095, negative IRR and analytical two-flow cases.

These checks establish bounded numerical behavior. They do not validate a
petroleum forecast, tax/fiscal model, professional assumptions or capital
decision. Those remain human responsibilities.
