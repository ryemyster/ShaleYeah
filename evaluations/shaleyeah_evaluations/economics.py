"""Independent decimal cash-flow checks against host-owned, frozen financial references."""

import math
from decimal import Decimal, DecimalException, localcontext


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def _close(actual, expected, tolerance):
    return _finite(actual) and _finite(expected) and abs(actual - expected) <= tolerance


def _unavailable(actual, reason):
    return (
        type(actual) is dict
        and actual.get("status") == "unavailable"
        and "value" in actual
        and actual["value"] is None
        and actual.get("reason") == reason
    )


def _discounted(flows, rate):
    factor = Decimal(1) + Decimal(str(rate))
    return [Decimal(str(value)) / (factor**period) for period, value in enumerate(flows)]


def _check(reference, actual, parameters):
    if type(reference) is not dict or type(actual) is not dict:
        return False
    flows = reference["cashFlows"]
    if (
        type(flows) is not list
        or not 2 <= len(flows) <= 601
        or not all(_finite(value) for value in flows)
        or not _finite(reference["discountRate"])
        or reference["discountRate"] <= -1
        or not _finite(actual.get("discountRate"))
        or reference["periodUnit"] not in ("year", "quarter", "month")
        or actual.get("cashFlows") != flows
        or not all(_finite(value) for value in actual.get("cashFlows", []))
        or any(
            actual.get(key) != reference[key] for key in ("discountRate", "currency", "periodUnit")
        )
        or actual.get("timing") != "time-zero-then-period-end"
        or actual.get("discountRateConvention") != "effective-per-period"
        or actual.get("paybackConvention") != "first-undiscounted-period-end-recovery"
        or actual.get("authorizesInvestment") is not False
    ):
        return False
    # This implementation does not import the backend's solver or use its reported residual.
    with localcontext() as context:
        context.prec = 60
        computed = float(sum(_discounted(flows, reference["discountRate"])))
        npv = actual["npv"]
        if type(npv) is not dict:
            return False
        if math.isfinite(computed):
            if (
                npv.get("status") != "available"
                or not _close(reference["npv"], computed, parameters["npvAbsoluteTolerance"])
                or not _close(npv.get("value"), computed, parameters["npvAbsoluteTolerance"])
            ):
                return False
        elif reference["npv"] != {
            "status": "unavailable",
            "reason": "numeric_range",
        } or not _unavailable(npv, "numeric_range"):
            return False

        irr, expected_irr = actual["irr"], reference["irr"]
        if type(irr) is not dict or type(expected_irr) is not dict:
            return False
        if expected_irr["status"] == "available":
            if (
                irr.get("status") != "available"
                or not _close(
                    irr.get("value"), expected_irr["value"], parameters["irrAbsoluteTolerance"]
                )
                or irr["value"] <= -1
            ):
                return False
            terms = _discounted(flows, irr["value"])
            absolute = sum(abs(value) for value in terms)
            if absolute == 0 or abs(sum(terms)) / absolute > Decimal(
                str(parameters["irrResidualTolerance"])
            ):
                return False
        elif expected_irr["status"] != "unavailable" or not _unavailable(
            irr, expected_irr["reason"]
        ):
            return False
        else:
            signs = [1 if value > 0 else -1 for value in flows if value != 0]
            changes = sum(left != right for left, right in zip(signs, signs[1:], strict=False))
            reason = expected_irr["reason"]
            if (
                reason == "indeterminate"
                and signs
                or reason == "no_solution"
                and (not signs or changes != 0)
                or reason == "ambiguous_series"
                and changes <= 1
            ):
                return False
            if reason not in {
                "indeterminate",
                "no_solution",
                "ambiguous_series",
                "outside_solver_bounds",
                "nonconvergent",
            }:
                return False

        balance, period = Decimal(0), None
        if flows[0] < 0:
            for index, value in enumerate(flows):
                balance += Decimal(str(value))
                if balance >= 0:
                    period = index
                    break
        payback, expected_payback = actual["payback"], reference["payback"]
        if type(payback) is not dict:
            return False
        if period is not None:
            return (
                expected_payback == {"status": "available", "value": period}
                and payback.get("status") == "available"
                and type(payback.get("value")) in (int, float)
                and payback["value"] == period
            )
        reason = "no_initial_investment" if flows[0] >= 0 else "not_recovered"
        return expected_payback == {"status": "unavailable", "reason": reason} and _unavailable(
            payback, reason
        )


def _findings(work, scenarios, parameters):
    if type(work) is not dict or type(work.get("findings")) is not list:
        return False
    expected = {}
    for scenario in scenarios:
        economics = scenario["economics"]
        for name in ("npv", "irr", "payback"):
            unit = (
                economics["currency"]
                if name == "npv"
                else "fraction_per_" + economics["periodUnit"]
                if name == "irr"
                else economics["periodUnit"]
            )
            expected[scenario["reference"]["id"] + "." + name] = (economics[name], unit, name)
    seen = set()
    for finding in work["findings"]:
        if type(finding) is not dict or finding.get("id") not in expected:
            return False
        identity = finding["id"]
        if identity in seen:
            return False
        seen.add(identity)
        metric, unit, name = expected[identity]
        if finding.get("unit") != unit:
            return False
        if metric["status"] == "available":
            tolerance = parameters.get(name + "AbsoluteTolerance", 0)
            if finding.get("basis") != "assumed" or not _close(
                finding.get("value"), metric["value"], tolerance
            ):
                return False
        elif (
            finding.get("basis") != "unknown"
            or "value" not in finding
            or finding["value"] is not None
            or finding.get("reason") != metric["reason"]
        ):
            return False
    return seen == expected.keys()


def cash_flow_accuracy(trace, runtime, parameters):
    """References are provided by the trusted host, never generated by the candidate being scored."""
    try:
        references = runtime["observations"]["economic_references"]
        scenario = trace["economicScenario"]
        actual = scenario["scenarios"]
        if (
            scenario.get("authorizesInvestment") is not False
            or type(references) is not list
            or not 1 <= len(references) <= 100
            or type(actual) is not list
            or len(actual) != len(references)
        ):
            return False
        expected = {(item["id"], item["revision"]): item for item in references}
        indexed = {
            (item["reference"]["id"], item["reference"]["revision"]): item["economics"]
            for item in actual
        }
        return (
            len(expected) == len(indexed) == len(references)
            and expected.keys() == indexed.keys()
            and all(
                _check(reference, indexed[key], parameters) for key, reference in expected.items()
            )
            and ("workProduct" not in trace or _findings(trace["workProduct"], actual, parameters))
        )
    except (KeyError, TypeError, ValueError, DecimalException, OverflowError, ZeroDivisionError):
        return False
