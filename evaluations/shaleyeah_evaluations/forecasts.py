"""Independent rate/quadrature checks for frozen, known-parameter production controls.

No agent, server or production fitting/integration code is imported. The host owns
the reference histories and known synthetic parameters; these checks qualify only
their declared fixed-b model, not reservoir uncertainty or professional reserves.
"""

import math

import rfc8785


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def _close(actual, expected, parameters, absolute):
    return (
        _finite(actual)
        and _finite(expected)
        and math.isclose(
            actual, expected, rel_tol=parameters["relativeTolerance"], abs_tol=absolute
        )
    )


def _available(metric, expected, parameters, absolute):
    return (
        type(metric) is dict
        and metric.get("status") == "available"
        and _close(metric.get("value"), expected, parameters, absolute)
    )


def _unavailable(metric):
    return (
        type(metric) is dict
        and metric.get("status") == "unavailable"
        and metric.get("value", False) is None
    )


def _rate(qi, decline, b, t):
    return qi * math.exp(-decline * t) if b == 0 else qi / (1 + b * decline * t) ** (1 / b)


def _stop(qi, decline, b, horizon, cutoff):
    if qi <= cutoff:
        return 0.0
    if _rate(qi, decline, b, horizon) >= cutoff:
        return horizon
    low, high = 0.0, horizon
    for _ in range(80):
        mid = (low + high) / 2
        if _rate(qi, decline, b, mid) > cutoff:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def _volume(qi, decline, b, start, end, days):
    if end <= start:
        return 0.0
    n = 2048
    step = (end - start) / n
    total = _rate(qi, decline, b, start) + _rate(qi, decline, b, end)
    total += sum((4 if i % 2 else 2) * _rate(qi, decline, b, start + i * step) for i in range(1, n))
    return total * step * days / 3


def _check(reference, actual, parameters):
    definition = reference["definition"]
    if actual["reference"] != {k: reference[k] for k in ("id", "revision")} or rfc8785.dumps(
        actual["definition"]
    ) != rfc8785.dumps(definition):
        return None
    if (
        any(actual.get(key) is not False for key in ("authorizesReserves",))
        or actual["reviewStatus"] != "unreviewed"
    ):
        return None
    model = actual["modeled"]
    if any(
        model[key] != reference[key] for key in ("product", "rateUnit", "timeBasis", "formation")
    ):
        return None
    if (reference["product"], reference["rateUnit"]) not in (
        ("oil", "bbl/day"),
        ("gas", "Mcf/day"),
    ):
        return None
    volume_unit = "bbl" if reference["product"] == "oil" else "Mcf"
    if (
        model["volumeUnit"] != volume_unit
        or model["volumeBasis"] != "modeled-from-declared-time-zero"
    ):
        return None
    if (
        model["horizon"] != definition["horizon"]
        or model["economicLimitRate"] != definition["economicLimitRate"]
        or model["forecastTimes"] != definition["forecastTimes"]
    ):
        return None
    if rfc8785.dumps(model["method"]) != rfc8785.dumps(
        {
            "id": "equal-well-mean-fixed-b-transformed-regression-v1",
            "bFactor": definition["bFactor"],
            "fitLoss": "unweighted-transformed-rate-least-squares",
            "cohortWeight": "equal-well",
            "bSource": "declared-assumption",
        }
    ):
        return None
    uncertainty = {"status": "unavailable", "reason": "no_uncertainty_model"}
    if (
        model["uncertainty"] != uncertainty
        or actual["uncertainty"] != uncertainty
        or model["authorizesReserves"] is not False
        or model["professionalAcceptance"] is not False
        or model["reviewStatus"] != "unreviewed"
    ):
        return None
    standards = {
        k: definition[k]
        for k in (
            "minimumTrainingObservations",
            "minimumHoldoutObservations",
            "maxFitRelativeRmse",
            "maxHoldoutRelativeRmse",
        )
    }
    if rfc8785.dumps(actual["quality"]["thresholds"]) != rfc8785.dumps(standards):
        return None
    wells = reference["wells"]
    if (
        type(wells) is not list
        or not 1 <= len(wells) <= 64
        or len({w["wellRef"]["id"] for w in wells}) != len(wells)
    ):
        return None
    if any(len(actual[k]) != len(wells) for k in ("remaining", "validation")) or len(
        model["wells"]
    ) != len(wells):
        return None
    days = reference["timeBasis"]["daysPerUnit"]
    b = definition["bFactor"]
    if not _finite(b) or not 0 <= b <= 2 or not _finite(days) or not 1 <= days <= 366:
        return None
    volumes, points, passed, available = [], [], [], []
    for index, well in enumerate(wells):
        qi, decline = well["initialRate"], well["nominalDecline"]
        observations = well["observations"]
        if (
            not _finite(qi)
            or qi <= 0
            or not _finite(decline)
            or not 0 <= decline <= 1_000_000
            or not observations
        ):
            return None
        if any(
            not _finite(p["elapsedTime"])
            or p["elapsedTime"] < 0
            or (
                p["elapsedTime"] != 0
                if i == 0
                else p["elapsedTime"] <= observations[i - 1]["elapsedTime"]
            )
            or not _close(
                p["rate"],
                _rate(qi, decline, b, p["elapsedTime"]),
                parameters,
                parameters["rateAbsoluteTolerance"],
            )
            for i, p in enumerate(observations)
        ):
            return None
        training = [p for p in observations if p["elapsedTime"] <= definition["fitUntil"]]
        holdout = [p for p in observations if p["elapsedTime"] > definition["fitUntil"]]
        fitted, remaining, validation = (
            model["wells"][index],
            actual["remaining"][index],
            actual["validation"][index],
        )
        if (
            any(item["wellRef"] != well["wellRef"] for item in (fitted, remaining, validation))
            or fitted["evidenceKind"] != "synthetic"
        ):
            return None
        if (
            type(validation["trainingCount"]) is not int
            or type(validation["holdoutCount"]) is not int
            or validation["trainingCount"] != len(training)
            or validation["holdoutCount"] != len(holdout)
        ):
            return None
        can_fit = len(training) >= 3
        available.append(can_fit)
        if not can_fit:
            if (
                fitted["status"] != "unavailable"
                or fitted.get("reason") != "insufficient_history"
                or any(
                    not _unavailable(metric)
                    for metric in (
                        fitted["cumulativeProduction"],
                        remaining["cumulativeProduction"],
                        validation["fitRelativeRmse"],
                        validation["relativeRmse"],
                    )
                )
                or remaining["interval"] is not None
                or validation["status"] != "failed"
            ):
                return None
            passed.append(False)
            continue
        fit = fitted["fit"]
        if (
            fitted["status"] != "available"
            or fit["observationCount"] != len(training)
            or fit["bFactor"] != b
            or not _close(fit["initialRate"], qi, parameters, parameters["rateAbsoluteTolerance"])
            or not _close(
                fit["nominalDecline"], decline, parameters, parameters["rateAbsoluteTolerance"]
            )
        ):
            return None
        stop = _stop(qi, decline, b, definition["horizon"], definition["economicLimitRate"])
        volume = _volume(qi, decline, b, 0, stop, days)
        if not _available(
            fitted["cumulativeProduction"],
            volume,
            parameters,
            parameters["volumeAbsoluteTolerance"],
        ):
            return None
        origin = observations[-1]["elapsedTime"]
        if (
            remaining["volumeBasis"] != "future-only-after-last-observation"
            or remaining["volumeUnit"] != volume_unit
            or not _close(remaining["interval"]["start"], origin, parameters, 1e-10)
            or not _close(remaining["interval"]["end"], max(origin, stop), parameters, 1e-10)
            or not _available(
                remaining["cumulativeProduction"],
                _volume(qi, decline, b, origin, stop, days),
                parameters,
                parameters["volumeAbsoluteTolerance"],
            )
        ):
            return None
        scale = max(p["rate"] for p in training)
        train_rmse = math.sqrt(
            sum((_rate(qi, decline, b, p["elapsedTime"]) - p["rate"]) ** 2 for p in training)
            / len(training)
        )
        if not _close(
            fit["rmseRate"], train_rmse, parameters, parameters["rateAbsoluteTolerance"]
        ) or not _available(
            validation["fitRelativeRmse"],
            train_rmse / scale,
            parameters,
            parameters["rateAbsoluteTolerance"],
        ):
            return None
        mean_rate = sum(p["rate"] for p in training) / len(training)
        variation = sum((p["rate"] - mean_rate) ** 2 for p in training)
        if (variation == 0 and not _unavailable(fit["rSquared"])) or (
            variation > 0
            and not _available(
                fit["rSquared"],
                1 - train_rmse**2 * len(training) / variation,
                parameters,
                parameters["rateAbsoluteTolerance"],
            )
        ):
            return None
        hold_rmse = (
            math.sqrt(
                sum(
                    (
                        (
                            0
                            if qi <= definition["economicLimitRate"] or p["elapsedTime"] > stop
                            else _rate(qi, decline, b, p["elapsedTime"])
                        )
                        - p["rate"]
                    )
                    ** 2
                    for p in holdout
                )
                / len(holdout)
            )
            / scale
            if holdout
            else None
        )
        if (hold_rmse is None and not _unavailable(validation["relativeRmse"])) or (
            hold_rmse is not None
            and not _available(
                validation["relativeRmse"],
                hold_rmse,
                parameters,
                parameters["rateAbsoluteTolerance"],
            )
        ):
            return None
        success = (
            len(training) >= definition["minimumTrainingObservations"]
            and len(holdout) >= definition["minimumHoldoutObservations"]
            and train_rmse / scale <= definition["maxFitRelativeRmse"]
            and hold_rmse is not None
            and hold_rmse <= definition["maxHoldoutRelativeRmse"]
        )
        if validation["status"] != ("passed" if success else "failed"):
            return None
        passed.append(success)
        volumes.append(volume)
        points.append(
            [
                {
                    "time": t,
                    "rate": 0
                    if qi <= definition["economicLimitRate"] or t > stop
                    else _rate(qi, decline, b, t),
                    "cumulativeProduction": _volume(qi, decline, b, 0, min(t, stop), days),
                }
                for t in definition["forecastTimes"]
            ]
        )
    if actual["quality"]["status"] != ("passed" if all(passed) else "failed") or reference[
        "expectedFitAvailable"
    ] is not all(available):
        return None
    if not all(available):
        if (
            model["status"] != "unavailable"
            or not _unavailable(model["cumulativeProduction"])
            or model["forecast"]
        ):
            return None
        return {
            "id": reference["id"] + ".modeled-volume",
            "basis": "unknown",
            "value": None,
            "unit": volume_unit,
        }
    volume = sum(volumes) / len(volumes)
    if (
        model["status"] != "available"
        or not _available(
            model["cumulativeProduction"], volume, parameters, parameters["volumeAbsoluteTolerance"]
        )
        or len(model["forecast"]) != len(definition["forecastTimes"])
    ):
        return None
    for i, point in enumerate(model["forecast"]):
        if (
            point["time"] != definition["forecastTimes"][i]
            or not _close(
                point["rate"],
                sum(w[i]["rate"] for w in points) / len(points),
                parameters,
                parameters["rateAbsoluteTolerance"],
            )
            or not _close(
                point["cumulativeProduction"],
                sum(w[i]["cumulativeProduction"] for w in points) / len(points),
                parameters,
                parameters["volumeAbsoluteTolerance"],
            )
        ):
            return None
    return {
        "id": reference["id"] + ".modeled-volume",
        "basis": "assumed",
        "value": volume,
        "unit": volume_unit,
    }


def forecast_accuracy(trace, runtime, parameters):
    try:
        references = runtime["observations"]["forecast_references"]
        packet = trace["reservoirForecast"]
        if (
            type(references) is not list
            or not 1 <= len(references) <= 100
            or packet["authorizesReserves"] is not False
            or packet["reviewStatus"] != "unreviewed"
        ):
            return False
        actual = packet["forecasts"]
        indexed = {r["id"]: r for r in references}
        if (
            len(indexed) != len(references)
            or len(actual) != len(references)
            or len({a["reference"]["id"] for a in actual}) != len(actual)
        ):
            return False
        expected = [_check(indexed[a["reference"]["id"]], a, parameters) for a in actual]
        if any(f is None for f in expected):
            return False
        findings = trace["workProduct"]["findings"]
        if len(findings) != len(expected) or len({f["id"] for f in findings}) != len(findings):
            return False
        for finding, reference in zip(findings, expected, strict=True):
            if any(finding[k] != reference[k] for k in ("id", "basis", "unit")):
                return False
            if reference["value"] is None:
                if finding["value"] is not None or not finding.get("reason"):
                    return False
            elif not _close(
                finding["value"],
                reference["value"],
                parameters,
                parameters["volumeAbsoluteTolerance"],
            ):
                return False
        return True
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError):
        return False
