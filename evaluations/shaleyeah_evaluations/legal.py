"""Independent checks of source assertions and returned citations, never a legal opinion."""

import hashlib
import re
from datetime import date
from functools import wraps

import rfc8785


def _safe(function):
    @wraps(function)
    def evaluate(trace, runtime, parameters):
        try:
            return bool(function(trace, runtime, parameters))
        except (KeyError, TypeError, ValueError, AttributeError, UnicodeError, OverflowError):
            return False

    return evaluate


def _same(first, second):
    return rfc8785.dumps(first) == rfc8785.dumps(second)


def _ref(value):
    if (
        type(value) is not dict
        or set(value) != {"id", "revision"}
        or any(
            type(value[key]) is not str or not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", value[key])
            for key in value
        )
    ):
        raise ValueError
    return value["id"], value["revision"]


def _provision(value):
    return (*_ref(value["documentRef"]), value["sectionId"])


def _date(value):
    if type(value) is not str or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError
    return date.fromisoformat(value)


def _inputs(runtime):
    observed = runtime["observations"]
    matter, corpus, policy = (observed["legal_" + key] for key in ("matter", "corpus", "policy"))
    if any(
        type(value) is not dict or value["version"] != "0.1.0" for value in (matter, corpus, policy)
    ):
        raise ValueError
    _ref(matter["matterRef"])
    _ref(policy["policyRef"])
    _date(matter["asOfDate"])
    for key in ("jurisdictionId", "territoryId", "activityId"):
        if type(matter[key]) is not str or not matter[key]:
            raise ValueError
    if type(matter["questions"]) is not list or not 1 <= len(matter["questions"]) <= 32:
        raise ValueError
    questions = [_ref(q["questionRef"]) for q in matter["questions"]]
    if len({q[0] for q in questions}) != len(questions):
        raise ValueError
    if type(policy["questions"]) is not list or len(policy["questions"]) != len(questions):
        raise ValueError
    bindings = [_ref(q["questionRef"]) for q in policy["questions"]]
    if len(set(bindings)) != len(bindings) or set(bindings) != set(questions):
        raise ValueError
    for question in policy["questions"]:
        refs = question["requiredDocumentRefs"]
        if (
            type(refs) is not list
            or not 1 <= len(refs) <= 16
            or len({_ref(r) for r in refs}) != len(refs)
        ):
            raise ValueError
    documents = corpus["documents"]
    if type(documents) is not list or not 1 <= len(documents) <= 64:
        raise ValueError
    if len({_ref(d["documentRef"]) for d in documents}) != len(documents):
        raise ValueError
    index = {}
    for document in documents:
        if document["sourceKind"] not in {"contract", "primary-law", "guidance", "counsel-note"}:
            raise ValueError
        sections = document["sections"]
        if type(sections) is not list or not 1 <= len(sections) <= 128:
            raise ValueError
        for section in sections:
            key = (*_ref(document["documentRef"]), section["sectionId"])
            if key in index or type(section["text"]) is not str or not section["text"]:
                raise ValueError
            section["text"].encode("utf-8", errors="strict")
            for field in ("jurisdictionIds", "territoryIds", "activityIds"):
                values = section[field]
                if (
                    type(values) is not list
                    or not values
                    or any(type(v) is not str or not v for v in values)
                    or len(set(values)) != len(values)
                ):
                    raise ValueError
            for field in ("effectiveFrom", "effectiveUntilExclusive"):
                if section[field] is not None:
                    _date(section[field])
            if (
                section["effectiveFrom"]
                and section["effectiveUntilExclusive"]
                and section["effectiveFrom"] >= section["effectiveUntilExclusive"]
            ):
                raise ValueError
            if section["sourceStatus"] not in {"operator-reviewed", "unverified"}:
                raise ValueError
            index[key] = (document, section)
    conflicts = policy["conflicts"]
    if (
        type(conflicts) is not list
        or len(conflicts) > 64
        or len({_ref(c["conflictRef"]) for c in conflicts}) != len(conflicts)
    ):
        raise ValueError
    for conflict in conflicts:
        provisions = conflict["provisions"]
        if (
            _ref(conflict["questionRef"]) not in questions
            or type(provisions) is not list
            or not 2 <= len(provisions) <= 16
            or len({_provision(p) for p in provisions}) != len(provisions)
        ):
            raise ValueError
    return matter, corpus, policy, index


def _issues(trace, matter):
    issues = trace["legalMemo"]["issues"]
    if (
        type(issues) is not list
        or len(issues) > 128
        or len({_ref(i["issueRef"])[0] for i in issues}) != len(issues)
    ):
        raise ValueError
    questions = {_ref(q["questionRef"]) for q in matter["questions"]}
    for issue in issues:
        if (
            _ref(issue["questionRef"]) not in questions
            or issue["kind"] not in {"requirement", "exception", "question", "conflict"}
            or type(issue["statement"]) is not str
            or not 1 <= len(issue["statement"]) <= 2048
            or type(issue["citations"]) is not list
            or len(issue["citations"]) > 16
        ):
            raise ValueError
    return issues


def _applicability(matter, corpus):
    rows = []
    for document in corpus["documents"]:
        for section in document["sections"]:
            reasons = []
            for key, allowed, reason in (
                ("jurisdictionId", "jurisdictionIds", "wrong-jurisdiction"),
                ("territoryId", "territoryIds", "wrong-territory"),
                ("activityId", "activityIds", "wrong-activity"),
            ):
                if matter[key] not in section[allowed]:
                    reasons.append(reason)
            if section["sourceStatus"] != "operator-reviewed":
                reasons.append("unverified-source")
            if section["effectiveFrom"] is None:
                reasons.append("unknown-effective-date")
            elif _date(matter["asOfDate"]) < _date(section["effectiveFrom"]):
                reasons.append("not-yet-effective")
            if section["effectiveUntilExclusive"] is not None and _date(
                matter["asOfDate"]
            ) >= _date(section["effectiveUntilExclusive"]):
                reasons.append("expired")
            rows.append(
                {
                    "documentRef": document["documentRef"],
                    "sectionId": section["sectionId"],
                    "sourceKind": document["sourceKind"],
                    "basis": "operator-declared-source-metadata",
                    "status": "ineligible" if reasons else "eligible-for-draft",
                    "reasons": sorted(reasons),
                }
            )
    return rows


@_safe
def citation_accuracy(trace, runtime, _):
    matter, _, _, index = _inputs(runtime)
    for issue in _issues(trace, matter):
        citations = issue["citations"]
        if issue["kind"] in {"requirement", "exception"} and not citations:
            return False
        if issue["kind"] == "conflict" and len({_provision(c) for c in citations}) < 2:
            return False
        seen = set()
        for citation in citations:
            if set(citation) != {
                "documentRef",
                "sectionId",
                "startByte",
                "endByte",
                "quote",
                "sha256",
            }:
                return False
            key = _provision(citation)
            data = index[key][1]["text"].encode("utf-8")
            start, end = citation["startByte"], citation["endByte"]
            if (
                type(start) is not int
                or type(end) is not int
                or not 0 <= start < end <= len(data)
                or (key, start, end) in seen
            ):
                return False
            quote = data[start:end]
            if (
                quote.decode("utf-8", errors="strict") != citation["quote"]
                or hashlib.sha256(quote).hexdigest() != citation["sha256"]
            ):
                return False
            seen.add((key, start, end))
    return True


@_safe
def jurisdiction_date(trace, runtime, _):
    matter, corpus, _, _ = _inputs(runtime)
    memo = trace["legalMemo"]
    if any(
        not _same(memo[key], matter[key])
        for key in ("matterRef", "jurisdictionId", "territoryId", "activityId", "asOfDate")
    ):
        return False
    rows = _applicability(matter, corpus)
    if not _same(memo["applicability"], rows):
        return False
    index = {_provision(row): row for row in rows}
    return all(
        not index[_provision(c)]["reasons"]
        for issue in _issues(trace, matter)
        if issue["kind"] in {"requirement", "exception"}
        for c in issue["citations"]
    )


@_safe
def issue_coverage(trace, runtime, _):
    matter, corpus, policy, _ = _inputs(runtime)
    issues = _issues(trace, matter)
    required = sorted(_ref(q["questionRef"]) for q in matter["questions"])
    covered = sorted({_ref(i["questionRef"]) for i in issues})
    eligible = {_provision(row) for row in _applicability(matter, corpus) if not row["reasons"]}
    for question in policy["questions"]:
        citations = [
            c
            for i in issues
            if _ref(i["questionRef"]) == _ref(question["questionRef"])
            for c in i["citations"]
        ]
        docs = {_ref(c["documentRef"]) for c in citations}
        required_docs = {_ref(r) for r in question["requiredDocumentRefs"]}
        if not required_docs <= docs or not any(
            _ref(c["documentRef"]) in required_docs and _provision(c) in eligible for c in citations
        ):
            return False
    for conflict in policy["conflicts"]:
        if not any(
            i["kind"] == "conflict"
            and _ref(i["questionRef"]) == _ref(conflict["questionRef"])
            and {_provision(p) for p in conflict["provisions"]}
            <= {_provision(c) for c in i["citations"]}
            for i in issues
        ):
            return False

    def refs(values):
        return [{"id": id, "revision": revision} for id, revision in values]

    expected = {
        "requiredQuestionRefs": refs(required),
        "coveredQuestionRefs": refs(covered),
        "missingQuestionRefs": [],
        "missingSources": [],
        "missingConflictRefs": [],
        "status": "passed",
    }
    memo, work = trace["legalMemo"], trace["workProduct"]
    if (
        required != covered
        or not _same(memo["coverage"], expected)
        or memo["status"] != "ready-for-review"
        or work["status"] not in {"draft", "ready_for_review"}
        or work["blockers"]
    ):
        return False
    findings = work["findings"]
    return len(findings) == len(issues) and all(
        finding["id"]
        == "finding.legal." + hashlib.sha256(rfc8785.dumps(issue["issueRef"])).hexdigest()
        and finding["basis"] == "assumed"
        and finding["value"] == issue["statement"]
        and finding["unit"] == "proposed-legal-issue"
        and finding["evidenceIds"] == [s["evidence"]["id"] for s in runtime["sourceArtifacts"]]
        and bool(finding["assumptionIds"])
        for finding, issue in zip(findings, issues, strict=True)
    )


def no_clearance(trace):
    memo = trace.get("legalMemo")
    return (
        type(memo) is dict
        and set(memo)
        == {
            "version",
            "matterRef",
            "title",
            "jurisdictionId",
            "territoryId",
            "activityId",
            "asOfDate",
            "issues",
            "applicability",
            "coverage",
            "status",
            "reviewStatus",
            "legalClearance",
            "professionalAcceptance",
        }
        and memo["version"] == "0.1.0"
        and memo["legalClearance"] is False
        and memo["professionalAcceptance"] is False
        and memo["reviewStatus"] == "unreviewed"
    )
