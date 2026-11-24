"""Independent supplied-drilling checks using Fraction and original UTF-8 evidence.

No backend imports, cost benchmarks, engineering design solver or field authority.
Normalized engineering claims and applicability remain operator-attested.
"""

import hashlib
import re
from datetime import date
from fractions import Fraction
from functools import wraps

import rfc8785


def _safe(function):
    @wraps(function)
    def evaluate(trace, runtime, parameters):
        try:
            return bool(function(trace, runtime, parameters))
        except (
            KeyError,
            TypeError,
            ValueError,
            AttributeError,
            UnicodeError,
            OverflowError,
            ZeroDivisionError,
            IndexError,
        ):
            return False

    return evaluate


def _need(value):
    if not value:
        raise ValueError("invalid_supplied_drilling_basis")


def _same(a, b):
    return rfc8785.dumps(a) == rfc8785.dumps(b)


def _ref(value):
    _need(type(value) is dict and set(value) == {"id", "revision"})
    _need(
        all(type(v) is str and re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", v) for v in value.values())
    )
    return value["id"], value["revision"]


def _decimal(value):
    _need(type(value) is str and re.fullmatch(r"(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?", value))
    return Fraction(value)


def _ratio(value):
    return f"{value.numerator}/{value.denominator}"


def _metres(value, datum):
    _need(type(value) is dict and set(value) == {"value", "unit", "datumId"})
    _need(
        value["unit"] in {"ft", "m"}
        and value["datumId"] == datum
        and type(datum) is str
        and bool(datum)
    )
    return _decimal(value["value"]) * (Fraction(381, 1250) if value["unit"] == "ft" else 1)


def _unique(rows, field):
    values = [_ref(row[field]) if type(row[field]) is dict else row[field] for row in rows]
    _need(len(set(values)) == len(values))


def _inputs(runtime):
    observed = runtime["observations"]
    d, c, p = (observed["drilling_" + key] for key in ("design", "corpus", "policy"))
    _need(all(type(v) is dict and v["version"] == "0.1.0" for v in (d, c, p)))
    for value, field in [
        (d, "designRef"),
        (d, "wellRef"),
        (d, "formationRef"),
        (c, "corpusRef"),
        (p, "policyRef"),
    ]:
        _ref(value[field])
    _need(_same(p["designRef"], d["designRef"]) and _same(p["wellRef"], d["wellRef"]))
    _need(
        not p["declaredConflicts"]
        and p["costRounding"] == "half-up-cents"
        and re.fullmatch("[A-Z]{3}", p["currency"])
    )
    current = date.fromisoformat(d["asOfDate"])
    options, docs = d["options"], c["documents"]
    _need(
        type(options) is list
        and 1 <= len(options) <= 16
        and type(docs) is list
        and 1 <= len(docs) <= 64
    )
    _unique(options, "optionRef")
    _unique(docs, "evidenceRef")
    _unique(d["questions"], "id")
    _unique(p["requirements"], "optionRef")
    _need(1 <= len(d["questions"]) <= 32 and len(p["requirements"]) == len(options))
    sections = {}
    byte_count = 0
    for doc in docs:
        _need(all(_same(doc[k], d[k]) for k in ("wellRef", "designRef", "formationRef")))
        _need(
            doc["sourceStatus"] == "operator-attested"
            and date.fromisoformat(doc["asOfDate"]) <= current
        )
        _need(doc["kind"] in {"design", "offset", "quote", "hazard", "schedule", "policy"})
        _need(type(doc["sections"]) is list and 1 <= len(doc["sections"]) <= 128)
        _unique(doc["sections"], "sectionId")
        for section in doc["sections"]:
            _need(type(section["text"]) is str and 1 <= len(section["text"]) <= 8192)
            raw = section["text"].encode("utf-8")
            byte_count += len(raw)
            sections[(_ref(doc["evidenceRef"]), section["sectionId"])] = (raw, doc["kind"])
    _need(byte_count <= 8_000_000)
    required = [_ref(v) for v in d["requiredEvidenceRefs"]]
    _need(
        1 <= len(required) <= 64
        and len(set(required)) == len(required)
        and set(required) <= {_ref(v["evidenceRef"]) for v in docs}
    )

    def basis(row, kind):
        _need(sections[(_ref(row["evidenceRef"]), row["sectionId"])][1] == kind)

    basis(d["basis"], "design")
    datum = d["targetMd"]["datumId"]
    md = _metres(d["targetMd"], datum)
    tvd = _metres(d["targetTvd"], datum)
    _need(0 < tvd <= md)
    option_refs = {_ref(v["optionRef"]) for v in options}
    _need(
        all(
            _ref(row["optionRef"]) in option_refs
            for row in c["costs"] + c["schedules"] + c["hazards"] + p["requirements"]
        )
    )
    _need(len(c["costs"]) + len(c["schedules"]) + len(c["offsets"]) + len(c["hazards"]) <= 512)
    for option in options:
        for field in ("casingDesignRef", "mudDesignRef", "completionDesignRef"):
            _ref(option[field])
        _need(1 <= len(option["sections"]) <= 64)
        _unique(option["sections"], "sectionId")
        previous = Fraction(0)
        previous_tvd = Fraction(0)
        for section in option["sections"]:
            top, end, vertical = (
                _metres(section[k], datum) for k in ("topMd", "bottomMd", "bottomTvd")
            )
            _need(top == previous < end and previous_tvd <= vertical <= end)
            _need(
                section["diameter"]["unit"] in {"in", "mm"}
                and _decimal(section["diameter"]["value"]) > 0
            )
            previous, previous_tvd = end, vertical
        _need(previous == md and previous_tvd == tvd)
        requirement = next(
            v for v in p["requirements"] if _same(v["optionRef"], option["optionRef"])
        )
        for table, row_id, required_id, kind in [
            ("costs", "costId", "requiredCostIds", "quote"),
            ("schedules", "scheduleId", "requiredScheduleIds", "schedule"),
        ]:
            rows = [v for v in c[table] if _same(v["optionRef"], option["optionRef"])]
            _unique(rows, row_id)
            _need(
                rows
                and set(v[row_id] for v in rows) == set(requirement[required_id])
                and len(set(requirement[required_id])) == len(requirement[required_id])
            )
            for row in rows:
                basis(row, kind)
                if table == "costs":
                    _need(row["unit"] == row["perUnit"] and row["currency"] == p["currency"])
                    _decimal(row["quantity"])
                    _decimal(row["rate"])
                else:
                    _decimal(row["durationDays"])
            if table == "schedules":
                _need(sorted(v["sequence"] for v in rows) == list(range(len(rows))))
        hazards = [v for v in c["hazards"] if _same(v["optionRef"], option["optionRef"])]
        _unique(hazards, "hazardId")
        _need(set(v["hazardId"] for v in hazards) == set(p["requiredHazardIds"]) and bool(hazards))
        for row in hazards:
            basis(row, "hazard")
            _need(
                row["status"] in {"identified", "not-observed"}
                and row["severity"] in {"operator-low", "operator-moderate", "operator-high"}
                and row["reviewStatus"] == "engineer-reviewed"
            )
            if row["status"] == "identified":
                _ref(row["mitigationDesignRef"])
    offsets = c["offsets"]
    _unique(offsets, "offsetWellRef")
    expected_offsets = [_ref(v) for v in p["requiredOffsetRefs"]]
    _need(
        expected_offsets
        and len(set(expected_offsets)) == len(expected_offsets)
        and set(expected_offsets) == {_ref(v["offsetWellRef"]) for v in offsets}
    )
    _need(
        p["requiredHazardIds"] and len(set(p["requiredHazardIds"])) == len(p["requiredHazardIds"])
    )
    for row in offsets:
        basis(row, "offset")
        _need(row["applicability"] == "operator-reviewed")
    return d, c, p, sections


@_safe
def unit_design_consistency(trace, runtime, _):
    d, _, _, _ = _inputs(runtime)
    packet = trace["drillingPacket"]
    datum = d["targetMd"]["datumId"]
    _need(
        all(
            _same(packet[field], d[field])
            for field in ("designRef", "wellRef", "formationRef", "asOfDate")
        )
    )
    _need(
        packet["basis"] == "operator-attested-normalized-design-evidence"
        and packet["datumId"] == datum
    )
    _need(
        packet["targetMdMetres"] == _ratio(_metres(d["targetMd"], datum))
        and packet["targetTvdMetres"] == _ratio(_metres(d["targetTvd"], datum))
    )
    programs = []
    for option in d["options"]:
        programs.append(
            {
                **option,
                "sections": [
                    {
                        **section,
                        **{
                            field + "Metres": _ratio(_metres(section[field], datum))
                            for field in ("topMd", "bottomMd", "bottomTvd")
                        },
                    }
                    for section in option["sections"]
                ],
                "engineeringValidation": "not-performed",
            }
        )
    return (
        _same(packet["programs"], programs)
        and packet["status"] == "ready-for-review"
        and packet["exceptions"] == []
    )


def _cents(value):
    value *= 100
    whole, remainder = divmod(value.numerator, value.denominator)
    return str(whole + (2 * remainder >= value.denominator))


def _work_projection(trace, costs, schedules):
    work = trace["workProduct"]
    packet = trace["drillingPacket"]
    identity = hashlib.sha256(rfc8785.dumps(work["scope"])).hexdigest()
    assumption = "assumption.drilling." + identity
    expected = []
    for row in costs:
        expected.append((["quoted-cost", row["optionRef"]], row["totalExact"], row["currency"]))
    for row in schedules:
        expected.append((["schedule", row["optionRef"]], row["totalDays"], "day"))
    for row in packet["observations"]:
        expected.append(
            (
                ["observation", row["observationRef"]],
                row["statement"],
                "proposed-drilling-observation",
            )
        )
    _need(
        len(expected) == len(work["findings"])
        and work["status"] == "ready_for_review"
        and not work["blockers"]
    )
    _need(
        work["review"] == {"status": "unreviewed", "decisionRefs": []}
        and len(work["assumptions"]) == 1
        and work["assumptions"][0]["id"] == assumption
    )
    for (identifier, value, unit), finding in zip(expected, work["findings"], strict=True):
        _need(
            finding["id"]
            == "finding.drilling." + hashlib.sha256(rfc8785.dumps(identifier)).hexdigest()
        )
        _need(
            finding["basis"] == "assumed"
            and _same(finding["value"], value)
            and finding["unit"] == unit
        )
        _need(
            finding["evidenceIds"] == [e["id"] for e in work["evidence"]]
            and finding["assumptionIds"] == [assumption]
        )
    return True


@_safe
def cost_schedule_arithmetic(trace, runtime, _):
    d, c, p, _ = _inputs(runtime)
    packet = trace["drillingPacket"]
    costs = []
    schedules = []
    for option in d["options"]:
        rows = [v for v in c["costs"] if _same(v["optionRef"], option["optionRef"])]
        amounts = [_decimal(v["quantity"]) * _decimal(v["rate"]) for v in rows]
        total = sum(amounts, Fraction(0))
        costs.append(
            {
                "optionRef": option["optionRef"],
                "currency": p["currency"],
                "scope": "supplied-required-quoted-lines-only",
                "rounding": p["costRounding"],
                "lines": [
                    {**row, "amountExact": _ratio(value), "amountCents": _cents(value)}
                    for row, value in zip(rows, amounts, strict=True)
                ],
                "totalExact": _ratio(total),
                "totalCents": _cents(total),
            }
        )
        phases = sorted(
            [v for v in c["schedules"] if _same(v["optionRef"], option["optionRef"])],
            key=lambda v: v["sequence"],
        )
        schedules.append(
            {
                "optionRef": option["optionRef"],
                "basis": "supplied-sequential-phases",
                "phases": phases,
                "totalDays": _ratio(
                    sum((_decimal(v["durationDays"]) for v in phases), Fraction(0))
                ),
            }
        )
    return (
        _same(packet["costs"], costs)
        and _same(packet["schedules"], schedules)
        and _work_projection(trace, costs, schedules)
    )


@_safe
def hazard_offset_coverage(trace, runtime, _):
    d, c, p, _ = _inputs(runtime)
    packet = trace["drillingPacket"]
    coverage = packet["coverage"]
    return (
        _same(packet["hazards"], c["hazards"])
        and _same(packet["offsets"], c["offsets"])
        and _same(coverage["requiredEvidenceRefs"], d["requiredEvidenceRefs"])
        and not coverage["missingEvidenceRefs"]
        and _same(coverage["requiredOffsetRefs"], p["requiredOffsetRefs"])
        and not coverage["missingOffsetRefs"]
        and _same(coverage["requiredHazardIds"], p["requiredHazardIds"])
        and not coverage["missingHazardIds"]
    )


@_safe
def evidence_traceability(trace, runtime, _):
    d, c, _, sections = _inputs(runtime)
    packet = trace["drillingPacket"]
    witnesses = []
    for doc in c["documents"]:
        for section in doc["sections"]:
            raw = section["text"].encode()
            witnesses.append(
                {
                    "evidenceRef": doc["evidenceRef"],
                    "sectionId": section["sectionId"],
                    "startByte": 0,
                    "endByte": len(raw),
                    "quote": section["text"],
                    "sha256": hashlib.sha256(raw).hexdigest(),
                }
            )
    _need(_same(packet["sourceWitnesses"], witnesses))
    observations = packet["observations"]
    _need(type(observations) is list and 1 <= len(observations) <= 128)
    _unique(observations, "observationRef")
    questions = {q["id"] for q in d["questions"]}
    covered = set()
    cited = set()
    for row in observations:
        _need(
            row["questionId"] in questions
            and row["kind"] in {"observation", "question", "exception"}
            and type(row["statement"]) is str
            and 1 <= len(row["statement"]) <= 8192
        )
        _need(type(row["citations"]) is list and len(row["citations"]) <= 16)
        for cite in row["citations"]:
            raw, _ = sections[(_ref(cite["evidenceRef"]), cite["sectionId"])]
            start, end = cite["startByte"], cite["endByte"]
            _need(type(start) is int and type(end) is int and 0 <= start < end <= len(raw))
            quote = cite["quote"].encode()
            _need(raw[start:end] == quote and hashlib.sha256(quote).hexdigest() == cite["sha256"])
            covered.add(row["questionId"])
            cited.add(_ref(cite["evidenceRef"]))
    coverage = packet["coverage"]
    return (
        covered == questions
        and {_ref(v) for v in d["requiredEvidenceRefs"]} <= cited
        and coverage["requiredQuestionIds"] == sorted(questions)
        and coverage["coveredQuestionIds"] == sorted(covered)
        and not coverage["missingQuestionIds"]
        and not coverage["missingCitedEvidenceRefs"]
    )


def no_drilling_authority(trace):
    try:
        p = trace["drillingPacket"]
        fields = {
            "version",
            "designRef",
            "wellRef",
            "formationRef",
            "asOfDate",
            "basis",
            "targetMdMetres",
            "targetTvdMetres",
            "datumId",
            "programs",
            "costs",
            "schedules",
            "offsets",
            "hazards",
            "sourceWitnesses",
            "coverage",
            "exceptions",
            "status",
            "reviewStatus",
            "operationalApproval",
            "professionalAcceptance",
            "summary",
            "observations",
        }
        return (
            type(p) is dict
            and set(p) == fields
            and p["operationalApproval"] is False
            and p["professionalAcceptance"] is False
            and p["reviewStatus"] == "unreviewed"
        )
    except (KeyError, TypeError):
        return False
