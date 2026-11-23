"""Drilling output uses the shared actual-response parser, without caller substitution."""

import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response

OBSERVED = json.loads(
    (Path(__file__).parents[1] / "fixtures/drilling/observed-packet.json").read_text()
)
VALUE = {key: OBSERVED[key] for key in ("work", "drilling")}


def response(text):
    return {"role": "model", "parts": [{"text": text}]}


def test_actual_drilling_json_and_explicit_deferral_are_supported():
    assert parse_employee_response(response(json.dumps(VALUE)), "drilling") == VALUE
    assert parse_employee_response(
        response('{"deferred":"Current source access is required"}'), "drilling"
    ) == {"deferred": "Current source access is required"}


@pytest.mark.parametrize(
    "text",
    [
        '{"work":{},"drilling":{},"drilling":{}}',
        '{"work":{},"drilling":{},"approved":true}',
        '{"work":{},"drilling":{"price":NaN}}',
        "[]",
        "```json\n{}\n```",
        '{"deferred":""}',
        '{"work":{},"drilling":true}',
    ],
    ids=["duplicate", "extra", "nan", "array", "fence", "empty-deferral", "boolean"],
)
def test_ambiguous_or_noncanonical_drilling_output_is_rejected(text):
    assert parse_employee_response(response(json.dumps(VALUE)), "drilling") == VALUE
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_employee_response(response(text), "drilling")
