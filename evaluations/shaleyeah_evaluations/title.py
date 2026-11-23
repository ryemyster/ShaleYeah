"""Independent supplied-instrument checks using Python Fraction and original UTF-8 bytes.

This module imports no Title backend code and grants no professional title authority.
Normalized facts, record inventory and scope remain operator-attested assumptions.
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
        ):
            return False

    return evaluate


def _same(first, second):
    return rfc8785.dumps(first) == rfc8785.dumps(second)


def _ref(value):
    if (
        type(value) is not dict
        or set(value) != {"id", "revision"}
        or any(
            type(item) is not str or re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", item) is None
            for item in value.values()
        )
    ):
        raise ValueError
    return value["id"], value["revision"]


def _date(value):
    if type(value) is not str or re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
        raise ValueError
    return date.fromisoformat(value)


def _fraction(value):
    if (
        type(value) is not str
        or re.fullmatch(r"(0|[1-9][0-9]{0,8})/[1-9][0-9]{0,8}", value) is None
    ):
        raise ValueError
    result = Fraction(value)
    if not 0 <= result <= 1:
        raise ValueError
    return result


def _ratio(value):
    return f"{value.numerator}/{value.denominator}"


def _depth(value):
    if (
        value["unit"] not in {"ft", "m"}
        or any(type(value[k]) is not int for k in ("top", "bottom"))
        or not 0 <= value["top"] < value["bottom"] <= 1_000_000
    ):
        raise ValueError


def _bands(examination, value):
    _depth(value)
    bands = examination["depthBands"]
    if any(b["unit"] != value["unit"] for b in bands):
        raise ValueError
    intersected = [b for b in bands if b["top"] < value["bottom"] and value["top"] < b["bottom"]]
    if not intersected or any(
        b["top"] < value["top"] or b["bottom"] > value["bottom"] for b in intersected
    ):
        raise ValueError
    return [b["id"] for b in intersected]


def _inputs(runtime):
    observed = runtime["observations"]
    examination, corpus, policy = (
        observed["title_" + key] for key in ("examination", "corpus", "policy")
    )
    for value in (examination, corpus, policy):
        if type(value) is not dict or value["version"] != "0.1.0":
            raise ValueError
    for value, key in [
        (examination, "examinationRef"),
        (examination, "tractRef"),
        (corpus, "corpusRef"),
        (policy, "policyRef"),
    ]:
        _ref(value[key])
    _date(examination["asOfDate"])
    parties, bands, questions = (examination[k] for k in ("parties", "depthBands", "questions"))
    for items, maximum in [(parties, 128), (bands, 16), (questions, 32)]:
        if (
            type(items) is not list
            or not 1 <= len(items) <= maximum
            or len({item["id"] for item in items}) != len(items)
        ):
            raise ValueError
    for band in bands:
        _depth(band)
        if any(
            other is not band
            and (
                other["unit"] != band["unit"]
                or other["top"] < band["bottom"]
                and band["top"] < other["bottom"]
            )
            for other in bands
        ):
            raise ValueError
    required = [_ref(item) for item in examination["requiredInstrumentRefs"]]
    docs = corpus["documents"]
    if (
        type(docs) is not list
        or not 1 <= len(docs) <= 64
        or not required
        or len(set(required)) != len(required)
    ):
        raise ValueError
    identities = [_ref(doc["instrumentRef"]) for doc in docs]
    if len(set(identities)) != len(docs) or not set(required) <= set(identities):
        raise ValueError
    for field in ("sequence", "recordingId"):
        if len({doc[field] for doc in docs}) != len(docs):
            raise ValueError
    ordered = sorted(docs, key=lambda doc: (doc["sequence"], _ref(doc["instrumentRef"])))
    seen, sections, fact_count, byte_count = set(), {}, 0, 0
    for doc in ordered:
        if (
            type(doc["sequence"]) is not int
            or not 0 <= doc["sequence"] <= 1_000_000
            or not _same(doc["tractRef"], examination["tractRef"])
            or doc["jurisdictionId"] != examination["jurisdictionId"]
            or doc["sourceStatus"] != "operator-attested"
        ):
            raise ValueError
        if any(
            _date(doc[key]) > _date(examination["asOfDate"])
            for key in ("effectiveDate", "recordedDate")
        ):
            raise ValueError
        predecessors = [_ref(item) for item in doc["predecessorRefs"]]
        if (
            len(set(predecessors)) != len(predecessors)
            or not set(predecessors) <= seen
            or doc["openingPositions"]
            and predecessors
        ):
            raise ValueError
        seen.add(_ref(doc["instrumentRef"]))
        if not 1 <= len(doc["sections"]) <= 128:
            raise ValueError
        for section in doc["sections"]:
            key = (*_ref(doc["instrumentRef"]), section["sectionId"])
            if key in sections or type(section["text"]) is not str or not section["text"]:
                raise ValueError
            sections[key] = section["text"].encode("utf-8", errors="strict")
            byte_count += len(sections[key])
        for name in ("openingPositions", "transfers", "burdens", "leaseTerms"):
            facts = doc[name]
            if type(facts) is not list or len(facts) > (32 if name == "leaseTerms" else 128):
                raise ValueError
            fact_count += len(facts)
            for fact in facts:
                if (*_ref(doc["instrumentRef"]), fact["sectionId"]) not in sections:
                    raise ValueError
                for field in ("partyId", "grantorId", "granteeId"):
                    if field in fact and fact[field] not in {p["id"] for p in parties}:
                        raise ValueError
                if "interestKind" in fact and fact["interestKind"] not in {
                    "record-title",
                    "operating-rights",
                }:
                    raise ValueError
                if "depth" in fact:
                    _bands(examination, fact["depth"])
    if fact_count > 512 or byte_count > 8_000_000:
        raise ValueError
    return examination, ordered, policy, sections


def _arithmetic(examination, documents, policy):
    balances = {}
    openings = [row for doc in documents for row in doc["openingPositions"]]
    transfers = [row for doc in documents for row in doc["transfers"]]
    for rows, field in [(openings, "positionId"), (transfers, "transferId")]:
        if len({row[field] for row in rows}) != len(rows):
            raise ValueError
    for row in openings:
        for band in _bands(examination, row["depth"]):
            key = (row["interestKind"], band, row["partyId"])
            if key in balances:
                raise ValueError
            balances[key] = _fraction(row["share"])
    for kind in ("record-title", "operating-rights"):
        for band in examination["depthBands"]:
            if (
                sum(value for (k, b, _), value in balances.items() if (k, b) == (kind, band["id"]))
                != 1
            ):
                raise ValueError
    for row in transfers:
        if (
            row["basis"] not in {"fraction-of-grantor", "fraction-of-whole"}
            or row["grantorId"] == row["granteeId"]
        ):
            raise ValueError
        share = _fraction(row["share"])
        for band in _bands(examination, row["depth"]):
            source = (row["interestKind"], band, row["grantorId"])
            target = (row["interestKind"], band, row["granteeId"])
            available = balances[source]
            conveyed = available * share if row["basis"] == "fraction-of-grantor" else share
            if conveyed > available:
                raise ValueError
            balances[source] -= conveyed
            balances[target] = balances.get(target, Fraction(0)) + conveyed
    holdings = [
        dict(interestKind=k, bandId=b, partyId=p, share=_ratio(value))
        for (k, b, p), value in sorted(balances.items())
    ]
    burdens = [row for doc in documents for row in doc["burdens"]]
    burden_refs = [_ref(row["burdenRef"]) for row in burdens]
    if len(set(burden_refs)) != len(burden_refs):
        raise ValueError
    requests = policy["nriRequests"]
    if len({(r["partyId"], r["bandId"]) for r in requests}) != len(requests):
        raise ValueError
    revenues = []
    for request in requests:
        required = [_ref(item) for item in request["requiredBurdenRefs"]]
        applicable = [
            b
            for b in burdens
            if b["partyId"] == request["partyId"]
            and request["bandId"] in _bands(examination, b["depth"])
        ]
        if (
            request["coverage"] != "operator-attested-supplied-schedule"
            or len(set(required)) != len(required)
            or set(required) != {_ref(b["burdenRef"]) for b in applicable}
        ):
            raise ValueError
        wi = balances[("operating-rights", request["bandId"], request["partyId"])]
        totals = {"royalty": Fraction(0), "overriding-royalty": Fraction(0)}
        for burden in applicable:
            if burden["basis"] not in {"working-interest", "whole"} or burden["kind"] not in totals:
                raise ValueError
            totals[burden["kind"]] += _fraction(burden["share"]) * (
                wi if burden["basis"] == "working-interest" else 1
            )
        net = wi - sum(totals.values())
        if net < 0:
            raise ValueError
        revenues.append(
            dict(
                partyId=request["partyId"],
                bandId=request["bandId"],
                workingInterest=_ratio(wi),
                royaltyBurden=_ratio(totals["royalty"]),
                overridingBurden=_ratio(totals["overriding-royalty"]),
                netRevenueInterest=_ratio(net),
            )
        )
    return holdings, revenues


@_safe
def ownership_arithmetic(trace, runtime, _):
    examination, documents, policy, _ = _inputs(runtime)
    holdings, revenue = _arithmetic(examination, documents, policy)
    packet = trace["titlePacket"]
    return _same(packet["holdings"], holdings) and _same(packet["netRevenue"], revenue)


def _citation(citation, sections):
    if type(citation) is not dict or set(citation) != {
        "instrumentRef",
        "sectionId",
        "startByte",
        "endByte",
        "quote",
        "sha256",
    }:
        raise ValueError
    key = (*_ref(citation["instrumentRef"]), citation["sectionId"])
    data, start, end = sections[key], citation["startByte"], citation["endByte"]
    if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(data):
        raise ValueError
    quote = data[start:end]
    if (
        quote.decode("utf-8", errors="strict") != citation["quote"]
        or hashlib.sha256(quote).hexdigest() != citation["sha256"]
    ):
        raise ValueError
    return key, start, end


@_safe
def instrument_traceability(trace, runtime, _):
    examination, _, _, sections = _inputs(runtime)
    packet = trace["titlePacket"]
    observations = packet["observations"]
    if (
        type(observations) is not list
        or not 1 <= len(observations) <= 128
        or len({_ref(o["observationRef"]) for o in observations}) != len(observations)
    ):
        return False
    for observation in observations:
        if (
            set(observation) != {"observationRef", "questionId", "kind", "statement", "citations"}
            or observation["questionId"] not in {q["id"] for q in examination["questions"]}
            or observation["kind"] not in {"observation", "exception", "question"}
            or type(observation["statement"]) is not str
            or not 1 <= len(observation["statement"]) <= 8192
        ):
            return False
        citations = observation["citations"]
        if (
            type(citations) is not list
            or not 1 <= len(citations) <= 16
            or len({_citation(c, sections) for c in citations}) != len(citations)
        ):
            return False
    witnesses = packet["sourceWitnesses"]
    actual = {_citation(c, sections) for c in witnesses}
    expected = {(key, 0, len(value)) for key, value in sections.items()}
    return len(witnesses) == len(expected) and actual == expected


@_safe
def chain_scope_coverage(trace, runtime, _):
    examination, documents, policy, _ = _inputs(runtime)
    packet, work = trace["titlePacket"], trace["workProduct"]
    if (
        any(
            not _same(packet[key], examination[key])
            for key in ("examinationRef", "tractRef", "jurisdictionId", "asOfDate")
        )
        or policy["declaredConflicts"]
    ):
        return False
    chain = [
        dict(
            instrumentRef=d["instrumentRef"],
            recordingId=d["recordingId"],
            effectiveDate=d["effectiveDate"],
            recordedDate=d["recordedDate"],
            declaredSequence=d["sequence"],
            predecessorRefs=d["predecessorRefs"],
        )
        for d in documents
    ]
    if not _same(packet["chain"], chain):
        return False
    leases = []
    for doc in documents:
        for lease in doc["leaseTerms"]:
            ended = _date(examination["asOfDate"]) >= _date(lease["primaryTermEnd"])
            if lease["holdingStatus"] not in {
                "unknown",
                "operator-reports-holding",
                "operator-reports-no-holding",
            }:
                return False
            leases.append(
                {
                    **lease,
                    "instrumentRef": doc["instrumentRef"],
                    "termStatus": "primary-term-not-ended"
                    if not ended
                    else "holding-unknown"
                    if lease["holdingStatus"] == "unknown"
                    else lease["holdingStatus"],
                }
            )
    required_leases = [_ref(ref) for ref in policy["requiredLeaseRefs"]]
    if len(set(required_leases)) != len(required_leases):
        return False
    for required in required_leases:
        matching = [lease for lease in leases if _ref(lease["leaseRef"]) == required]
        if len(matching) != 1 or matching[0]["termStatus"] in {
            "holding-unknown",
            "operator-reports-no-holding",
        }:
            return False
    if not _same(packet["leaseTerms"], leases):
        return False
    question_ids = sorted(q["id"] for q in examination["questions"])
    covered = sorted({o["questionId"] for o in packet["observations"] if o["citations"]})
    required = examination["requiredInstrumentRefs"]
    cited = {_ref(c["instrumentRef"]) for o in packet["observations"] for c in o["citations"]}
    coverage = dict(
        requiredInstrumentRefs=required,
        missingInstrumentRefs=[],
        requiredQuestionIds=question_ids,
        coveredQuestionIds=covered,
        missingQuestionIds=[],
        missingCitedInstrumentRefs=[],
    )
    if (
        covered != question_ids
        or not {_ref(r) for r in required} <= cited
        or not _same(packet["coverage"], coverage)
        or packet["status"] != "ready-for-review"
        or packet["exceptions"]
        or work["status"] != "ready_for_review"
        or work["blockers"]
    ):
        return False
    # Cross-check the shared work projection rather than trusting a second output witness.
    projected = [
        (
            ["holding", r["interestKind"], r["bandId"], r["partyId"]],
            r["share"],
            "supplied-whole-interest-fraction",
        )
        for r in packet["holdings"]
    ]
    projected += [
        (
            ["nri", r["bandId"], r["partyId"]],
            r["netRevenueInterest"],
            "supplied-whole-interest-fraction",
        )
        for r in packet["netRevenue"]
    ]
    projected += [
        (["observation", r["observationRef"]], r["statement"], "proposed-title-observation")
        for r in packet["observations"]
    ]
    findings = work["findings"]
    return len(findings) == len(projected) and all(
        finding["id"] == "finding.title." + hashlib.sha256(rfc8785.dumps(identity)).hexdigest()
        and finding["basis"] == "assumed"
        and finding["value"] == value
        and finding["unit"] == unit
        and finding["evidenceIds"] == [s["evidence"]["id"] for s in runtime["sourceArtifacts"]]
        and bool(finding["assumptionIds"])
        for finding, (identity, value, unit) in zip(findings, projected, strict=True)
    )


def no_title_authority(trace):
    packet = trace.get("titlePacket")
    return (
        type(packet) is dict
        and set(packet)
        == {
            "version",
            "examinationRef",
            "tractRef",
            "jurisdictionId",
            "asOfDate",
            "basis",
            "holdings",
            "netRevenue",
            "chain",
            "leaseTerms",
            "sourceWitnesses",
            "coverage",
            "exceptions",
            "status",
            "reviewStatus",
            "titleClearance",
            "professionalAcceptance",
            "title",
            "observations",
        }
        and packet["version"] == "0.1.0"
        and packet["basis"] == "operator-attested-normalized-instruments"
        and packet["titleClearance"] is False
        and packet["professionalAcceptance"] is False
        and packet["reviewStatus"] == "unreviewed"
    )
