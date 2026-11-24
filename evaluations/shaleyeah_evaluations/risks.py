"""Independent declared-joint-state checks; no employee, backend or field calibration import."""

import math
import re
from datetime import datetime
from decimal import Decimal, localcontext
from fractions import Fraction

import rfc8785


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _same(first, second):
    return rfc8785.dumps(first) == rfc8785.dumps(second)


def _ref(value):
    return (
        type(value) is dict
        and set(value) == {"id", "revision"}
        and all(type(value[k]) is str and 0 < len(value[k]) <= 128 for k in value)
    )


def _close(actual, expected, parameters):
    return _number(actual) and math.isclose(
        actual,
        float(expected),
        rel_tol=parameters["relativeTolerance"],
        abs_tol=parameters["absoluteTolerance"],
    )


def scenario_accuracy(trace, runtime, parameters):
    try:
        reference = runtime["observations"]["risk_reference"]
        definition, states, risks = reference["definition"], reference["states"], reference["risks"]
        packet = trace["riskPacket"]
        total = reference["totalWeight"]
        if (
            type(states) is not list
            or not 1 <= len(states) <= 512
            or type(risks) is not list
            or not 1 <= len(risks) <= 64
            or any(type(risk) is not str or not risk for risk in risks)
            or len(set(risks)) != len(risks)
            or type(total) is not int
            or not 1 <= total <= 512_000_000_000
            or not _number(reference["lossThreshold"])
            or not 0 <= reference["lossThreshold"] <= 1e12
            or not _ref(definition["modelRef"])
            or definition["method"] != "complete-joint-scenarios-v1"
            or definition["amountBasis"] != "undiscounted-residual-loss"
            or definition["probabilityBasis"] != "assumed-joint-scenarios"
            or definition["quantileConvention"] != "weighted-inverted-cdf"
            or not re.fullmatch(r"[A-Z]{3}", definition["currency"])
            or not _same(definition["totalWeight"], total)
            or not _same(definition["lossThreshold"], reference["lossThreshold"])
            or not _same(packet["definition"], definition)
            or packet["version"] != "0.1.0"
            or packet["reviewStatus"] != "unreviewed"
            or packet["riskAccepted"] is not False
            or packet["professionalAcceptance"] is not False
        ):
            return False
        horizon = definition["horizon"]
        start, end = (
            datetime.fromisoformat(horizon[k].replace("Z", "+00:00")) for k in ("start", "end")
        )
        if not start.tzinfo or not end.tzinfo or end <= start:
            return False
        if (
            len({state["id"] for state in states}) != len(states)
            or any(
                type(s["id"]) is not str
                or not s["id"]
                or type(s["weight"]) is not int
                or not 0 <= s["weight"] <= 1_000_000_000
                or not _number(s["loss"])
                or not 0 <= s["loss"] <= 1e12
                or type(s["risks"]) is not list
                or len(set(s["risks"])) != len(s["risks"])
                or not set(s["risks"]) <= set(risks)
                for s in states
            )
            or sum(s["weight"] for s in states) != total
        ):
            return False
        # Decimal moments and integer cumulative weights are independent of the TS calculator.
        with localcontext() as context:
            context.prec = 50
            mean = sum(Decimal(s["weight"]) * Decimal(str(s["loss"])) for s in states) / total
            variance = (
                sum(Decimal(s["weight"]) * (Decimal(str(s["loss"])) - mean) ** 2 for s in states)
                / total
            )
            deviation = variance.sqrt()
        summary = packet["summary"]
        if (
            not _close(summary["expectedLoss"], mean, parameters)
            or not _close(summary["standardDeviation"], deviation, parameters)
            or type(summary["scenarioCount"]) is not int
            or summary["scenarioCount"] != len(states)
            or type(summary["positiveWeightScenarioCount"]) is not int
            or summary["positiveWeightScenarioCount"] != sum(s["weight"] > 0 for s in states)
        ):
            return False
        ordered = sorted((s for s in states if s["weight"] > 0), key=lambda s: s["loss"])
        for key, numerator in (("p10", 1), ("p50", 5), ("p90", 9)):
            cumulative = 0
            for state in ordered:
                cumulative += state["weight"]
                if cumulative * 10 >= total * numerator:
                    if not _close(summary["lossQuantiles"][key], state["loss"], parameters):
                        return False
                    break
        tail = Fraction(
            sum(s["weight"] for s in states if s["loss"] >= reference["lossThreshold"]), total
        )
        if not _close(summary["probabilityLossAtOrAbove"], tail, parameters):
            return False
        risks = sorted(risks)
        probabilities = {
            risk: Fraction(sum(s["weight"] for s in states if risk in s["risks"]), total)
            for risk in risks
        }
        if len(packet["occurrence"]) != len(risks):
            return False
        for risk, item in zip(risks, packet["occurrence"], strict=True):
            if item["riskId"] != risk or not _close(
                item["probability"], probabilities[risk], parameters
            ):
                return False
        if len(packet["correlations"]) != len(risks) * (len(risks) - 1) // 2:
            return False
        pairs = iter(packet["correlations"])
        for i, first in enumerate(risks):
            for second in risks[i + 1 :]:
                item = next(pairs)
                if item["riskIds"] != [first, second] or item["basis"] != "assumed-joint-scenarios":
                    return False
                p, q = probabilities[first], probabilities[second]
                variance_product = p * (1 - p) * q * (1 - q)
                value = item["correlation"]
                if variance_product == 0:
                    if value != {"status": "unavailable", "value": None, "reason": "zero_variance"}:
                        return False
                else:
                    joint = Fraction(
                        sum(
                            s["weight"]
                            for s in states
                            if first in s["risks"] and second in s["risks"]
                        ),
                        total,
                    )
                    rho = float(joint - p * q) / math.sqrt(float(variance_product))
                    if value["status"] != "available" or not _close(
                        value["value"], rho, parameters
                    ):
                        return False
        findings = trace["workProduct"]["findings"]
        return (
            len(findings) == 1
            and all(
                findings[0][key] == value
                for key, value in {
                    "id": definition["modelRef"]["id"] + ".expected-loss",
                    "basis": "assumed",
                    "unit": definition["currency"],
                }.items()
            )
            and _close(findings[0]["value"], mean, parameters)
        )
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError, StopIteration):
        return False


def register_coverage(trace, runtime, _):
    try:
        observed = runtime["observations"]
        entries, policy = observed["risk_register"]["entries"], observed["risk_policy"]
        packet = trace["riskPacket"]
        categories = {
            "geological",
            "technical",
            "economic",
            "regulatory",
            "environmental",
            "operational",
        }
        severity = {"low", "medium", "high", "critical", "unknown"}
        if (
            type(entries) is not list
            or not 1 <= len(entries) <= 64
            or len({e["riskRef"]["id"] for e in entries}) != len(entries)
            or not policy["requiredCategories"]
            or len(set(policy["requiredCategories"])) != len(policy["requiredCategories"])
            or not set(policy["requiredCategories"]) <= categories
            or not policy["escalateSeverities"]
            or len(set(policy["escalateSeverities"])) != len(policy["escalateSeverities"])
            or not set(policy["escalateSeverities"]) <= severity - {"unknown"}
            or type(policy["maxUnmitigatedSevereRisks"]) is not int
            or not 0 <= policy["maxUnmitigatedSevereRisks"] <= 64
            or not _number(policy["maxExpectedLoss"])
            or policy["maxExpectedLoss"] < 0
            or not _number(policy["maxTailProbability"])
            or not 0 <= policy["maxTailProbability"] <= 1
            or not _number(packet["summary"]["expectedLoss"])
            or packet["summary"]["expectedLoss"] < 0
            or not _number(packet["summary"]["probabilityLossAtOrAbove"])
            or not 0 <= packet["summary"]["probabilityLossAtOrAbove"] <= 1
        ):
            return False
        covered, unsupported, conflicting, unknown, severe = set(), [], [], [], []
        for entry in entries:
            if (
                not _ref(entry["riskRef"])
                or entry["category"] not in categories
                or entry["severity"] not in severity
                or type(entry["severityBasis"]) is not str
                or not 1 <= len(entry["severityBasis"]) <= 2048
            ):
                return False
            if (
                entry["evidenceState"] not in {"supported", "missing", "conflicting"}
                or type(entry["evidenceRefs"]) is not list
                or any(not _ref(r) for r in entry["evidenceRefs"])
            ):
                return False
            if type(entry["conflicts"]) is not list or any(
                type(c) is not str or not c for c in entry["conflicts"]
            ):
                return False
            identifier = entry["riskRef"]["id"]
            covered.add(entry["category"])
            if entry["evidenceState"] != "supported" or not entry["evidenceRefs"]:
                unsupported.append(identifier)
            if entry["evidenceState"] == "conflicting" or entry["conflicts"]:
                conflicting.append(identifier)
            if entry["severity"] == "unknown":
                unknown.append(identifier)
            mitigation = entry["mitigation"]
            if (
                mitigation["state"] not in {"none", "proposed", "implemented", "verified"}
                or not mitigation["ownerId"]
            ):
                return False
            if entry["severity"] in policy["escalateSeverities"] and (
                mitigation["state"] != "verified" or not _ref(mitigation["verificationRef"])
            ):
                severe.append(identifier)
        expected = {
            "coveredCategories": sorted(covered),
            "missingCategories": sorted(set(policy["requiredCategories"]) - covered),
            "unsupportedRiskIds": sorted(unsupported),
            "conflictingRiskIds": sorted(conflicting),
            "unknownSeverityRiskIds": sorted(unknown),
            "unmitigatedSevereRiskIds": sorted(severe),
            "expectedLossWithinLimit": packet["summary"]["expectedLoss"]
            <= policy["maxExpectedLoss"],
            "tailProbabilityWithinLimit": packet["summary"]["probabilityLossAtOrAbove"]
            <= policy["maxTailProbability"],
        }
        flags = [
            (bool(expected["missingCategories"]), "missing-category"),
            (bool(unsupported), "unsupported-evidence"),
            (bool(conflicting), "conflicting-evidence"),
            (bool(unknown), "unknown-severity"),
            (len(severe) > policy["maxUnmitigatedSevereRisks"], "unmitigated-severe-risk-limit"),
            (not expected["expectedLossWithinLimit"], "expected-loss-limit"),
            (not expected["tailProbabilityWithinLimit"], "tail-probability-limit"),
        ]
        blockers = [reason for active, reason in flags if active]
        expected["status"] = "failed" if blockers else "passed"
        return (
            _same(packet["coverage"], expected)
            and (
                trace["workProduct"]["status"] == "blocked"
                if blockers
                else trace["workProduct"]["status"] in {"draft", "ready_for_review"}
            )
            and trace["workProduct"]["blockers"]
            == [
                {
                    "code": "conflicting_evidence"
                    if reason == "conflicting-evidence"
                    else "approval_required"
                    if reason.endswith("-limit")
                    else "missing_input",
                    "message": reason,
                    "references": [],
                }
                for reason in blockers
            ]
        )
    except (KeyError, TypeError, ValueError, ArithmeticError, AttributeError):
        return False
