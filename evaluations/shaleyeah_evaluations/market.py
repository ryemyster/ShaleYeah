"""Independent source/period/unit checks; no agent, backend calculator or professional truth import."""

import calendar
import math
import re
import unicodedata
from datetime import UTC, date, datetime
from fractions import Fraction

import rfc8785


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _fraction(value):
    if not _number(value):
        raise ValueError
    return Fraction(str(value))


def _same(first, second):
    return rfc8785.dumps(first) == rfc8785.dumps(second)


def _place(value):
    if type(value) is not str or not value.strip():
        raise ValueError
    return unicodedata.normalize("NFKC", value.strip()).lower()


def _timestamp(value):
    if type(value) is not str:
        raise ValueError
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if instant.tzinfo is None:
        raise ValueError
    return instant


def _period(value, frequency):
    if type(value) is not str:
        raise ValueError
    if frequency == "daily" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return datetime.combine(date.fromisoformat(value), datetime.min.time(), UTC)
    if frequency == "monthly" and re.fullmatch(r"\d{4}-\d{2}", value):
        year, month = (int(part) for part in value.split("-"))
        return datetime(year, month, calendar.monthrange(year, month)[1], 23, 59, 59, 999000, UTC)
    raise ValueError


def _index(items, key="id"):
    if type(items) is not list or not items or len(items) > 4096:
        raise ValueError
    indexed = {}
    for item in items:
        if (
            type(item) is not dict
            or type(item.get(key)) is not str
            or not item[key]
            or item[key] in indexed
        ):
            raise ValueError
        indexed[item[key]] = item
    return indexed


def _reference(runtime):
    observed = runtime["observations"]
    mandate, bundle, assumptions = (
        observed["market_" + key] for key in ("mandate", "series", "assumptions")
    )
    if any(value["version"] != "0.1.0" for value in (mandate, bundle, assumptions)):
        raise ValueError
    series = _index(bundle["series"])
    benchmark, realized = (
        series[mandate[key]] for key in ("benchmarkSeriesId", "realizedSeriesId")
    )
    if benchmark["id"] == realized["id"]:
        raise ValueError
    return mandate, bundle, assumptions, benchmark, realized


def _selection(mandate, key):
    values = mandate[key]
    if (
        type(values) is not list
        or not 1 <= len(values) <= 4096
        or any(type(value) is not str or not value for value in values)
        or len(set(values)) != len(values)
    ):
        raise ValueError
    return values


def _normalized(series, period, mandate, native_value):
    value = _fraction(native_value)
    if series["unit"] == mandate["targetUnit"]:
        return value
    heat = series["heatContent"]
    factor = _fraction(heat["value"])
    age = (_timestamp(mandate["asOf"]) - _timestamp(heat["asOf"])).total_seconds()
    day = _period(period, series["frequency"]).date()
    if (
        mandate["commodity"] != "gas"
        or mandate["targetUnit"] != "USD/MMBtu"
        or series["unit"] != "USD/Mcf"
        or heat["unit"] != "MMBtu/Mcf"
        or factor <= 0
        or _place(heat["location"]) != _place(series["location"])
        or not 0 <= age <= mandate["maxConversionAgeSeconds"]
        or not date.fromisoformat(heat["validFrom"])
        <= day
        <= date.fromisoformat(heat["validThrough"])
    ):
        raise ValueError
    return value / factor


def regional_relevance(trace, runtime, _):
    try:
        mandate, bundle, assumptions, benchmark, realized = _reference(runtime)
        packet = trace["marketScenario"]
        if mandate["targetUnit"] != {"gas": "USD/MMBtu", "oil": "USD/bbl"}[
            mandate["commodity"]
        ] or not all(
            packet[key] == mandate[key] for key in ("commodity", "region", "asOf", "frequency")
        ):
            return False
        if not _same(
            packet["seriesMetadata"],
            [
                {key: value for key, value in series.items() if key != "observations"}
                for series in bundle["series"]
            ],
        ):
            return False
        for series, basis in ((benchmark, "spot-benchmark"), (realized, "realized")):
            if (
                series["commodity"] != mandate["commodity"]
                or series["basis"] != basis
                or series["frequency"] != mandate["frequency"]
                or not (
                    series["unit"] == mandate["targetUnit"]
                    or mandate["commodity"] == "gas"
                    and series["unit"] == "USD/Mcf"
                )
            ):
                return False
        if _place(realized["location"]) != _place(mandate["region"]):
            return False
        scenarios = _index(assumptions["scenarios"])
        return all(
            scenarios[key]["commodity"] == mandate["commodity"]
            and _place(scenarios[key]["region"]) == _place(mandate["region"])
            and scenarios[key]["unit"] == mandate["targetUnit"]
            for key in _selection(mandate, "requiredScenarioIds")
        )
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError):
        return False


def source_coverage(trace, runtime, _):
    """Qualification requires complete usable inputs; an honest unavailable result still defers promotion."""
    try:
        if not regional_relevance(trace, runtime, {}):
            return False
        mandate, _bundle, assumptions, benchmark, realized = _reference(runtime)
        as_of = _timestamp(mandate["asOf"])
        evaluated_at = _timestamp(runtime["evaluatedAt"])
        if as_of > evaluated_at:
            return False
        periods = sorted(_selection(mandate, "requiredPeriods"))
        if any(
            type(mandate[key]) is not int or mandate[key] <= 0
            for key in ("maxObservationAgeSeconds", "maxConversionAgeSeconds")
        ):
            return False
        for series in (benchmark, realized):
            retrieved = _timestamp(series["retrievedAt"])
            if retrieved > evaluated_at:
                return False
            observed_by = min(as_of, retrieved)
            if series["vintage"] is None:
                if retrieved > as_of:
                    return False
            elif _timestamp(series["vintage"]) > min(as_of, retrieved):
                return False
            else:
                observed_by = min(observed_by, _timestamp(series["vintage"]))
            observations = _index(series["observations"], "period")
            if any(
                not _number(row["value"]) or _period(period, series["frequency"]) > observed_by
                for period, row in observations.items()
            ):
                return False
            for period in periods:
                if (
                    period not in observations
                    or not 0
                    <= (as_of - _period(period, series["frequency"])).total_seconds()
                    <= mandate["maxObservationAgeSeconds"]
                ):
                    return False
                _normalized(series, period, mandate, observations[period]["value"])
        packet, work = trace["marketScenario"], trace["workProduct"]
        rows = packet["comparison"]["rows"]
        if (
            [row["period"] for row in rows] != periods
            or not _same(
                packet["comparison"]["coverage"],
                {"required": len(periods), "aligned": len(periods), "missing": []},
            )
            or not all(
                _number(row[key])
                for row in rows
                for key in ("benchmarkValue", "realizedValue", "differential")
            )
        ):
            return False
        ids = _selection(mandate, "requiredScenarioIds")
        scenarios = _index(assumptions["scenarios"])
        if (
            [item["id"] for item in packet["scenarios"]] != ids
            or not set(ids) <= set(packet["proposal"]["scenarioIds"])
            or _timestamp(assumptions["asOf"]) > as_of
        ):
            return False
        for identifier, item in zip(ids, packet["scenarios"], strict=True):
            source = scenarios[identifier]
            _period(source["period"], "monthly" if len(source["period"]) == 7 else "daily")
            if not _number(item["price"]) or not all(
                _number(source[key]) for key in ("benchmarkPrice", "basisDifferential")
            ):
                return False
        return (
            packet["status"] == "ready-for-review"
            and packet["blockers"] == []
            and work["status"] == "ready_for_review"
            and work["blockers"] == []
        )
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError):
        return False


def _close(actual, expected, parameters):
    if not _number(actual) or actual == 0 and expected != 0:
        return False
    value = float(expected)
    return math.isfinite(value) and math.isclose(
        actual,
        value,
        abs_tol=parameters["absoluteTolerance"],
        rel_tol=parameters["relativeTolerance"],
    )


def transformation_accuracy(trace, runtime, parameters):
    try:
        if not source_coverage(trace, runtime, {}):
            return False
        mandate, _bundle, assumptions, benchmark, realized = _reference(runtime)
        packet, work = trace["marketScenario"], trace["workProduct"]
        comparison = packet["comparison"]
        if (
            comparison["unit"] != mandate["targetUnit"]
            or comparison["benchmarkSeriesId"] != benchmark["id"]
            or comparison["realizedSeriesId"] != realized["id"]
        ):
            return False
        differences = []
        benchmark_rows = _index(benchmark["observations"], "period")
        realized_rows = _index(realized["observations"], "period")
        for row in comparison["rows"]:
            period = row["period"]
            left = _normalized(benchmark, period, mandate, benchmark_rows[period]["value"])
            right = _normalized(realized, period, mandate, realized_rows[period]["value"])
            expected = {
                "benchmarkNativeValue": _fraction(benchmark_rows[period]["value"]),
                "benchmarkValue": left,
                "realizedNativeValue": _fraction(realized_rows[period]["value"]),
                "realizedValue": right,
                "differential": right - left,
            }
            if not all(_close(row[key], value, parameters) for key, value in expected.items()):
                return False
            differences.append(right - left)
        mean = sum(differences, Fraction()) / len(differences)
        if not _close(comparison["meanDifferential"], mean, parameters):
            return False
        values = [mean]
        scenarios = _index(assumptions["scenarios"])
        for item in packet["scenarios"]:
            source = scenarios[item["id"]]
            price = _fraction(source["benchmarkPrice"]) + _fraction(source["basisDifferential"])
            if (
                item["period"] != source["period"]
                or item["unit"] != mandate["targetUnit"]
                or item["basis"] != "operator-scenario"
                or item["rationale"] != source["rationale"]
                or not all(
                    _close(item[key], value, parameters)
                    for key, value in {
                        "benchmarkPriceAssumption": _fraction(source["benchmarkPrice"]),
                        "basisDifferentialAssumption": _fraction(source["basisDifferential"]),
                        "price": price,
                    }.items()
                )
            ):
                return False
            values.append(price)
        return len(work["findings"]) == len(values) and all(
            finding["basis"] == "assumed"
            and finding["unit"] == mandate["targetUnit"]
            and _close(finding["value"], value, parameters)
            for finding, value in zip(work["findings"], values, strict=True)
        )
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError):
        return False


def no_commercial_authority(trace):
    packet = trace.get("marketScenario")
    return (
        type(packet) is dict
        and set(packet)
        == {
            "version",
            "title",
            "commodity",
            "region",
            "asOf",
            "frequency",
            "status",
            "reviewStatus",
            "commercialAuthority",
            "comparison",
            "seriesMetadata",
            "scenarios",
            "proposal",
            "limitations",
            "blockers",
        }
        and packet["version"] == "0.1.0"
        and packet["commercialAuthority"] is False
        and packet["reviewStatus"] == "unreviewed"
        and type(packet["scenarios"]) is list
        and all(
            type(item) is dict and item.get("basis") == "operator-scenario"
            for item in packet["scenarios"]
        )
    )
